"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth";
import { uuidLike } from "@/lib/validation";

/**
 * Gestion du catalogue depuis l'écran stock — docs/05-ADMIN.md §5
 *
 * Le patron doit pouvoir modifier un prix, ajouter un format et créer une gamme
 * d'essence SANS développeur. Tout ce qui est créé ici apparaît immédiatement sur
 * la page d'accueil : le configurateur lit le catalogue, il n'a rien en dur.
 */

export interface ResultatCatalogue {
  ok: boolean;
  message?: string;
}

/** Convertit une saisie en euros (« 104 », « 104,50 ») en centimes entiers. */
const EurosEnCentimes = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const nombre = typeof v === "number" ? v : Number.parseFloat(v.replace(",", "."));
    return Math.round(nombre * 100);
  })
  .refine((c) => Number.isFinite(c) && c > 0, "Indiquez un prix supérieur à zéro.")
  .refine((c) => c <= 1_000_00, "Ce prix dépasse 1 000 € le m³ : vérifiez la saisie.");

// -----------------------------------------------------------------------------
// Prix
// -----------------------------------------------------------------------------

const PrixSchema = z.object({
  variantId: uuidLike,
  prixEuros: EurosEnCentimes,
});

/**
 * Modifie le prix du m³ apparent d'un format.
 *
 * ⚠️ Les paliers dégressifs sont recalculés à partir de l'ÉCART qu'ils avaient
 * avec l'ancien prix de base. Sans cela, changer le prix de base laisserait des
 * paliers incohérents — voire supérieurs au prix plein.
 */
export async function modifierPrix(entree: unknown): Promise<ResultatCatalogue> {
  const session = await assertRole(["owner"]);
  const parsed = PrixSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Prix invalide." };
  }

  const supabase = createSupabaseAdminClient();
  const { variantId, prixEuros: nouveauPrix } = parsed.data;

  const { data: variante } = await supabase
    .from("product_variants")
    .select("id, base_price_cents, price_tiers ( id, unit_price_cents )")
    .eq("id", variantId)
    .eq("company_id", session.companyId)
    .maybeSingle();

  if (!variante) return { ok: false, message: "Format introuvable." };

  const ancienPrix = variante.base_price_cents;

  const { error } = await supabase
    .from("product_variants")
    .update({ base_price_cents: nouveauPrix })
    .eq("id", variantId);

  if (error) {
    console.error("[catalogue] modifierPrix :", error.message);
    return { ok: false, message: "Le prix n'a pas pu être enregistré." };
  }

  // Report de l'écart sur chaque palier, borné pour ne jamais dépasser le prix plein.
  const paliers = (variante.price_tiers ?? []) as { id: string; unit_price_cents: number }[];
  for (const palier of paliers) {
    const remise = ancienPrix - palier.unit_price_cents;
    const prixPalier = Math.max(1, Math.min(nouveauPrix - 1, nouveauPrix - remise));
    await supabase
      .from("price_tiers")
      .update({ unit_price_cents: prixPalier })
      .eq("id", palier.id);
  }

  await supabase.from("audit_log").insert({
    company_id: session.companyId,
    actor_id: session.userId,
    actor_role: session.role,
    action: "variant.price_changed",
    entity_type: "product_variant",
    entity_id: variantId,
    before: { base_price_cents: ancienPrix },
    after: { base_price_cents: nouveauPrix },
  });

  revalidatePath("/admin/stock");
  revalidatePath("/");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Ajout d'un format à une gamme existante
// -----------------------------------------------------------------------------

const FormatSchema = z.object({
  productId: uuidLike,
  cutLengthId: uuidLike,
  prixEuros: EurosEnCentimes,
  stockInitial: z.coerce.number().min(0).max(99_999).default(0),
});

export async function ajouterFormat(entree: unknown): Promise<ResultatCatalogue> {
  const session = await assertRole(["owner"]);
  const parsed = FormatSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const supabase = createSupabaseAdminClient();
  const { productId, cutLengthId, prixEuros, stockInitial } = parsed.data;

  const [{ data: produit }, { data: longueur }] = await Promise.all([
    supabase
      .from("products")
      .select("id, slug")
      .eq("id", productId)
      .eq("company_id", session.companyId)
      .maybeSingle(),
    supabase
      .from("cut_lengths")
      .select("id, cm, sort_order")
      .eq("id", cutLengthId)
      .eq("company_id", session.companyId)
      .maybeSingle(),
  ]);

  if (!produit || !longueur) return { ok: false, message: "Produit ou longueur introuvable." };

  const { data: existant } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .eq("cut_length_id", cutLengthId)
    .maybeSingle();

  if (existant) {
    return { ok: false, message: "Ce format existe déjà pour cette gamme." };
  }

  // SKU lisible et stable, dérivé du slug : c'est ce que le patron verra sur ses
  // bons de livraison.
  const prefixe = produit.slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 12);
  const sku = `${prefixe}-${longueur.cm}`;

  const { error } = await supabase.from("product_variants").insert({
    company_id: session.companyId,
    product_id: productId,
    sku,
    cut_length_id: cutLengthId,
    humidity_class: "H1",
    base_price_cents: prixEuros,
    vat_rate: 10,
    min_quantity: 1,
    quantity_step: 0.5,
    stock_on_hand: stockInitial,
    low_stock_threshold: 5,
    sort_order: longueur.sort_order,
  });

  if (error) {
    console.error("[catalogue] ajouterFormat :", error.message);
    return {
      ok: false,
      message: error.message.includes("duplicate")
        ? `La référence ${sku} existe déjà.`
        : "Le format n'a pas pu être ajouté.",
    };
  }

  revalidatePath("/admin/stock");
  revalidatePath("/");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Création d'une gamme d'essence
// -----------------------------------------------------------------------------

const EssenceSchema = z.object({
  nom: z.string().trim().min(2, "Indiquez un nom.").max(80),
  sousTitre: z.string().trim().max(80).optional(),
  prixEuros: EurosEnCentimes,
  /** Longueurs proposées d'emblée. Au moins une, sinon la gamme est invisible. */
  cutLengthIds: z.array(uuidLike).min(1, "Choisissez au moins une longueur."),
});

/** Slug ASCII stable : sert d'URL et de préfixe de référence. */
function slugifier(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function creerEssence(entree: unknown): Promise<ResultatCatalogue> {
  const session = await assertRole(["owner"]);
  const parsed = EssenceSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const supabase = createSupabaseAdminClient();
  const { nom, sousTitre, prixEuros, cutLengthIds } = parsed.data;

  let slug = slugifier(nom);
  if (!slug) return { ok: false, message: "Ce nom ne permet pas de créer une référence." };

  // Unicité du slug : on suffixe plutôt que d'échouer sur une contrainte.
  const { data: collision } = await supabase
    .from("products")
    .select("id")
    .eq("company_id", session.companyId)
    .eq("slug", slug)
    .maybeSingle();
  if (collision) slug = `${slug}-2`;

  const { data: dernier } = await supabase
    .from("products")
    .select("sort_order")
    .eq("company_id", session.companyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: produit, error: erreurProduit } = await supabase
    .from("products")
    .insert({
      company_id: session.companyId,
      slug,
      name: nom,
      short_description: sousTitre ?? null,
      product_type: "buches",
      is_active: true,
      sort_order: (dernier?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (erreurProduit || !produit) {
    console.error("[catalogue] creerEssence :", erreurProduit?.message);
    return { ok: false, message: "La gamme n'a pas pu être créée." };
  }

  const { data: longueurs } = await supabase
    .from("cut_lengths")
    .select("id, cm, sort_order")
    .eq("company_id", session.companyId)
    .in("id", cutLengthIds);

  const prefixe = slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 12);

  const { error: erreurVariantes } = await supabase.from("product_variants").insert(
    (longueurs ?? []).map((l) => ({
      company_id: session.companyId,
      product_id: produit.id,
      sku: `${prefixe}-${l.cm}`,
      cut_length_id: l.id,
      humidity_class: "H1",
      base_price_cents: prixEuros,
      vat_rate: 10,
      min_quantity: 1,
      quantity_step: 0.5,
      stock_on_hand: 0,
      low_stock_threshold: 5,
      sort_order: l.sort_order,
    })),
  );

  if (erreurVariantes) {
    // La gamme sans format serait invisible sur le site : on annule tout.
    await supabase.from("products").delete().eq("id", produit.id);
    console.error("[catalogue] creerEssence variantes :", erreurVariantes.message);
    return { ok: false, message: "Les formats n'ont pas pu être créés." };
  }

  revalidatePath("/admin/stock");
  revalidatePath("/");
  return { ok: true };
}

/** Retire une gamme du site sans détruire son historique de commandes. */
export async function desactiverEssence(entree: unknown): Promise<ResultatCatalogue> {
  const session = await assertRole(["owner"]);
  const parsed = z.object({ productId: uuidLike }).safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const { error } = await createSupabaseAdminClient()
    .from("products")
    .update({ is_active: false })
    .eq("id", parsed.data.productId)
    .eq("company_id", session.companyId);

  if (error) return { ok: false, message: "Désactivation impossible." };

  revalidatePath("/admin/stock");
  revalidatePath("/");
  return { ok: true };
}
