"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getClientSession } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { ensureCart } from "@/server/panier";
import { prepareReorder, type LigneCommandePassee, type VarianteActuelle } from "@/domain/reorder";

/**
 * Espace client — docs/03-DESIGN-SYSTEM.md §6.4
 *
 * La recommande est la fonctionnalité la plus rentable du site : cette
 * clientèle rachète chaque année, presque toujours la même chose. Deux clics,
 * trente secondes, et surtout AUCUNE surprise — ce qui a changé depuis l'an
 * dernier est dit avant de continuer, jamais découvert au paiement.
 */

export interface ResultatCompte {
  ok: boolean;
  message?: string;
  redirection?: string;
  /** Ce qui a changé depuis la commande d'origine, en français courant. */
  avertissements?: string[];
}

async function sessionClient() {
  const session = await getClientSession();
  if (!session) throw new Error("Non authentifié.");
  return session;
}

/**
 * Remet au panier le contenu d'une commande passée, coordonnées comprises.
 *
 * Retourne les divergences plutôt que de les taire : si un format a disparu ou
 * si un prix a bougé, le client doit le voir AVANT de repartir dans le tunnel.
 */
export async function recommander(entree: unknown): Promise<ResultatCompte> {
  const session = await sessionClient();
  const tenant = await requireTenant();

  const parsed = z.object({ reference: z.string().trim().min(3).max(40) }).safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const supabase = createSupabaseAdminClient();

  // La commande doit appartenir au client connecté : on filtre sur le
  // `customer_id` de la session, jamais sur une valeur reçue du navigateur.
  const { data: commande } = await supabase
    .from("orders")
    .select(
      `id, reference, email, phone, first_name, last_name, fulfillment_type,
       shipping_address, delivery_notes,
       order_items ( variant_id, product_name, variant_label, quantity, unit_price_cents )`,
    )
    .eq("company_id", tenant.id)
    .eq("customer_id", session.customerId)
    .eq("reference", parsed.data.reference)
    .maybeSingle();

  if (!commande) return { ok: false, message: "Commande introuvable." };

  const lignesPassees: LigneCommandePassee[] = (commande.order_items ?? []).map((l) => ({
    variantId: l.variant_id,
    productName: l.product_name,
    variantLabel: l.variant_label,
    quantity: Number(l.quantity),
    unitPriceCents: l.unit_price_cents,
  }));

  if (lignesPassees.length === 0) {
    return { ok: false, message: "Cette commande ne contient aucun article." };
  }

  const identifiants = lignesPassees
    .map((l) => l.variantId)
    .filter((id): id is string => id !== null);

  const { data: variantesRows } = await supabase
    .from("product_variants")
    .select(
      `id, is_active, base_price_cents, stock_available, track_stock, allow_backorder,
       min_quantity, max_quantity, quantity_step,
       price_tiers ( min_quantity, unit_price_cents ),
       products ( is_active )`,
    )
    .eq("company_id", tenant.id)
    .in("id", identifiants.length > 0 ? identifiants : ["00000000-0000-0000-0000-000000000000"]);

  const variantes: VarianteActuelle[] = (variantesRows ?? []).map((v) => ({
    id: v.id,
    // Un produit désactivé rend ses formats invendables, même actifs.
    isActive:
      v.is_active && (v.products as unknown as { is_active: boolean } | null)?.is_active !== false,
    basePriceCents: v.base_price_cents,
    tiers: (v.price_tiers ?? []).map((t) => ({
      minQuantity: Number(t.min_quantity),
      unitPriceCents: t.unit_price_cents,
    })),
    stockAvailable: Number(v.stock_available ?? 0),
    trackStock: v.track_stock,
    allowBackorder: v.allow_backorder,
    minQuantity: Number(v.min_quantity ?? 1),
    maxQuantity: v.max_quantity === null ? null : Number(v.max_quantity),
    quantityStep: Number(v.quantity_step ?? 1),
  }));

  const resultat = prepareReorder(lignesPassees, variantes);

  if (resultat.vide) {
    return {
      ok: false,
      message:
        "Aucun article de cette commande n'est encore disponible. Appelez-nous, nous trouverons l'équivalent.",
      avertissements: resultat.avertissements.map((a) => a.message),
    };
  }

  // --- Panier : on repart d'une ardoise propre ---
  const cartId = await ensureCart(tenant.id);

  const { count: dejaPresent } = await supabase
    .from("cart_items")
    .select("id", { count: "exact", head: true })
    .eq("cart_id", cartId);

  await supabase.from("cart_items").delete().eq("cart_id", cartId);

  // `cart_items` ne porte pas de `company_id` : le panier le porte pour lui, et
  // la variante a déjà été vérifiée comme appartenant à l'entreprise.
  const { error: erreurLignes } = await supabase.from("cart_items").insert(
    resultat.lignes.map((l) => ({
      cart_id: cartId,
      variant_id: l.variantId,
      quantity: l.quantity,
    })),
  );

  if (erreurLignes) {
    console.error("[compte] recommander :", erreurLignes.message);
    return { ok: false, message: "Le panier n'a pas pu être rempli. Réessayez." };
  }

  // --- Coordonnées et adresse reprises : c'est ce qui fait les deux clics ---
  const adresse = (commande.shipping_address ?? {}) as Record<string, unknown>;
  const codePostal = typeof adresse.postalCode === "string" ? adresse.postalCode : null;
  const ville = typeof adresse.city === "string" ? adresse.city : null;

  await supabase
    .from("carts")
    .update({
      first_name: commande.first_name,
      last_name: commande.last_name,
      email: commande.email,
      phone: commande.phone,
      fulfillment_type: commande.fulfillment_type,
      address_line1: typeof adresse.line1 === "string" ? adresse.line1 : null,
      address_line2: typeof adresse.line2 === "string" ? adresse.line2 : null,
      postal_code: codePostal,
      city: ville,
      truck_access: typeof adresse.truckAccess === "string" ? adresse.truckAccess : "camion",
      unload_type: typeof adresse.unloadType === "string" ? adresse.unloadType : null,
      allow_unattended_delivery: adresse.allowUnattendedDelivery === true,
      access_notes: typeof adresse.accessNotes === "string" ? adresse.accessNotes : null,
      delivery_notes: commande.delivery_notes,
      // Le créneau précédent n'a aucune raison d'être repris : c'est justement
      // la seule chose que le client doit rechoisir.
      slot_id: null,
      step: "creneau",
    })
    .eq("id", cartId)
    .eq("company_id", tenant.id);

  const avertissements = resultat.avertissements.map((a) => a.message);
  if ((dejaPresent ?? 0) > 0) {
    avertissements.unshift(
      "Votre panier en cours a été remplacé par le contenu de cette commande.",
    );
  }

  revalidatePath("/panier");
  revalidatePath("/commande/creneau");

  return {
    ok: true,
    // Sans divergence, on saute directement au choix du créneau : l'adresse et
    // les coordonnées sont déjà connues (docs/03 §6.4).
    redirection: avertissements.length === 0 ? "/commande/creneau" : "/panier",
    avertissements,
  };
}

const CoordonneesSchema = z.object({
  prenom: z.string().trim().min(1, "Indiquez votre prénom.").max(80),
  nom: z.string().trim().min(1, "Indiquez votre nom.").max(80),
  telephone: z
    .string()
    .trim()
    .max(30)
    .refine(
      (v) => v === "" || v.replace(/\D/g, "").length >= 9,
      "Le numéro de téléphone semble incomplet.",
    ),
});

/**
 * Mise à jour des coordonnées du client.
 *
 * L'adresse email n'est PAS modifiable ici : elle identifie le compte et
 * rattache l'historique des commandes. La changer se fait en nous appelant.
 */
export async function modifierMesCoordonnees(entree: unknown): Promise<ResultatCompte> {
  const session = await sessionClient();
  const tenant = await requireTenant();

  const parsed = CoordonneesSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const { error } = await createSupabaseAdminClient()
    .from("customers")
    .update({
      first_name: parsed.data.prenom,
      last_name: parsed.data.nom,
      phone: parsed.data.telephone || null,
    })
    .eq("id", session.customerId)
    .eq("company_id", tenant.id);

  if (error) {
    console.error("[compte] modifierMesCoordonnees :", error.message);
    return { ok: false, message: "Enregistrement impossible." };
  }

  revalidatePath("/compte");
  return { ok: true, message: "Vos coordonnées sont à jour." };
}
