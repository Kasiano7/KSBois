"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant";
import { ensureCart, getCartId, getPanier } from "@/server/panier";
import { normaliserCodePostal, resolveZone } from "@/server/zones";
import { validateQuantity } from "@/domain/units";
import { uuidLike } from "@/lib/validation";
import { enregistrerEvenementAnalytics } from "@/server/analytics";

/**
 * Server Actions du panier.
 *
 * Règles appliquées ici sans exception :
 *  • toute entrée est validée par Zod ;
 *  • le client n'envoie qu'un identifiant de variante et une quantité ;
 *  • les bornes de quantité sont revérifiées CÔTÉ SERVEUR à partir de la base,
 *    jamais depuis ce que le navigateur prétend.
 */

export interface ResultatAction {
  ok: boolean;
  message?: string;
}

const AjoutSchema = z.object({
  variantId: uuidLike,
  quantity: z.coerce.number().positive("Indiquez une quantité.").max(999),
});

export async function ajouterAuPanier(entree: unknown): Promise<ResultatAction> {
  const parsed = AjoutSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  // On relit la variante en base : bornes, activité et appartenance au tenant.
  const { data: variante } = await supabase
    .from("product_variants")
    .select(
      `id, min_quantity, max_quantity, quantity_step, unit_volume_m3, base_price_cents,
       is_active, track_stock,
       allow_backorder, stock_available, products ( is_active )`,
    )
    .eq("id", parsed.data.variantId)
    .eq("company_id", tenant.id)
    .maybeSingle();

  if (!variante || !variante.is_active || !variante.products?.is_active) {
    return { ok: false, message: "Ce produit n'est plus disponible." };
  }

  const erreur = validateQuantity(parsed.data.quantity, {
    min: Number(variante.min_quantity),
    max: variante.max_quantity === null ? null : Number(variante.max_quantity),
    step: Number(variante.quantity_step),
  });
  if (erreur) return { ok: false, message: erreur };

  if (
    variante.track_stock &&
    !variante.allow_backorder &&
    parsed.data.quantity > Number(variante.stock_available ?? 0)
  ) {
    await enregistrerEvenementAnalytics(tenant.id, {
      type: "lost_demand",
      motif: "out_of_stock",
      variantId: variante.id,
      caPotentielCents: Math.round(variante.base_price_cents * parsed.data.quantity),
      volumePotentielM3: Number(variante.unit_volume_m3) * parsed.data.quantity,
    });
    return {
      ok: false,
      message: `Nous n'avons que ${Number(variante.stock_available ?? 0).toLocaleString("fr-FR")} m³ apparents en stock pour ce format.`,
    };
  }

  const cartId = await ensureCart(tenant.id);

  // Une seule ligne par variante : un nouvel ajout remplace la quantité plutôt
  // que de créer un doublon incompréhensible pour le client.
  const { error } = await supabase
    .from("cart_items")
    .upsert(
      { cart_id: cartId, variant_id: parsed.data.variantId, quantity: parsed.data.quantity },
      { onConflict: "cart_id,variant_id" },
    );

  if (error) {
    console.error("[panier] ajout :", error.message);
    return { ok: false, message: "Impossible d'ajouter ce produit au panier." };
  }

  revalidatePath("/panier");
  return { ok: true };
}

const ModifSchema = z.object({
  itemId: uuidLike,
  quantity: z.coerce.number().positive().max(999),
});

export async function modifierQuantite(entree: unknown): Promise<ResultatAction> {
  const parsed = ModifSchema.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const tenant = await requireTenant();
  const cartId = await getCartId();
  if (!cartId) return { ok: false, message: "Panier introuvable." };

  const supabase = createSupabaseAdminClient();

  const { data: item } = await supabase
    .from("cart_items")
    .select(
      `id, cart_id,
       carts!inner ( company_id ),
       product_variants!inner ( min_quantity, max_quantity, quantity_step )`,
    )
    .eq("id", parsed.data.itemId)
    .eq("cart_id", cartId)
    .maybeSingle();

  // Contrôle d'appartenance : le panier doit être celui du cookie ET du tenant.
  const proprietaire = item?.carts as unknown as { company_id: string } | null;
  if (!item || proprietaire?.company_id !== tenant.id) {
    return { ok: false, message: "Ligne introuvable." };
  }

  const bornes = item.product_variants as unknown as {
    min_quantity: number;
    max_quantity: number | null;
    quantity_step: number;
  };

  const erreur = validateQuantity(parsed.data.quantity, {
    min: Number(bornes.min_quantity),
    max: bornes.max_quantity === null ? null : Number(bornes.max_quantity),
    step: Number(bornes.quantity_step),
  });
  if (erreur) return { ok: false, message: erreur };

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: parsed.data.quantity })
    .eq("id", parsed.data.itemId);

  if (error) return { ok: false, message: "Modification impossible." };

  revalidatePath("/panier");
  return { ok: true };
}

export async function retirerDuPanier(entree: unknown): Promise<ResultatAction> {
  const parsed = z.object({ itemId: uuidLike }).safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const cartId = await getCartId();
  if (!cartId) return { ok: false, message: "Panier introuvable." };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", parsed.data.itemId)
    .eq("cart_id", cartId);

  if (error) return { ok: false, message: "Suppression impossible." };

  revalidatePath("/panier");
  return { ok: true };
}

const AdresseSchema = z.object({
  postalCode: z
    .string()
    .trim()
    .transform(normaliserCodePostal)
    .refine((v) => /^\d{5}$/.test(v), "Le code postal doit contenir 5 chiffres."),
  city: z.string().trim().max(120).optional().nullable(),
});

/**
 * Enregistre le code postal du panier et déclenche le calcul des frais.
 * Retourne le statut de résolution pour que l'interface puisse demander la
 * commune si le code postal en couvre plusieurs.
 */
export async function definirDestination(
  entree: unknown,
): Promise<ResultatAction & { statut?: string; choix?: { postalCode: string; city: string }[] }> {
  const parsed = AdresseSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Code postal invalide." };
  }

  const tenant = await requireTenant();
  const resolution = await resolveZone(tenant.id, parsed.data.postalCode, parsed.data.city);

  // On enregistre la ville seulement si elle est levée d'ambiguïté.
  const ville =
    resolution.status === "ok"
      ? resolution.commune.city
      : resolution.status === "not_served"
        ? resolution.commune.city
        : (parsed.data.city ?? null);

  const cartId = await ensureCart(tenant.id);
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("carts")
    .update({ postal_code: parsed.data.postalCode, city: ville })
    .eq("id", cartId);

  if (error) return { ok: false, message: "Enregistrement impossible." };

  const panier = await getPanier(tenant);
  await enregistrerEvenementAnalytics(tenant.id, {
    type: "zone_check",
    cartId,
    zoneId: resolution.status === "ok" ? resolution.zone.id : null,
    caPotentielCents: panier.totaux.totalCents,
    volumePotentielM3: panier.totaux.totalVolumeM3,
  });

  if (resolution.status === "not_served" || resolution.status === "unknown") {
    await enregistrerEvenementAnalytics(tenant.id, {
      type: "lost_demand",
      cartId,
      motif: resolution.status === "not_served" ? "out_of_zone" : "unknown_postal_code",
      caPotentielCents: panier.totaux.subtotalCents,
      volumePotentielM3: panier.totaux.totalVolumeM3,
    });
  }

  revalidatePath("/panier");

  return {
    ok: true,
    statut: resolution.status,
    choix: resolution.status === "ambiguous" ? resolution.choix : undefined,
  };
}
