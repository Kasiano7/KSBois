"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { requireTenant } from "@/lib/tenant";
import { getCartId, getPanier } from "@/server/panier";
import { creneauAppartientAuTenant } from "@/server/creneaux";
import { getPaymentSettings } from "@/server/reglages";
import { uuidLike } from "@/lib/validation";
import {
  evaluateDeposit,
  isPaymentMethodAllowed,
  type PaymentAvailabilityInput,
  type PaymentMethod,
} from "@/domain/payments";
import { initialStatus } from "@/domain/orders/state-machine";

/**
 * Server Actions du tunnel de commande — étapes 2 à 4.
 *
 * Invariant absolu : le navigateur n'envoie jamais de montant, ni de mode de
 * paiement « autorisé ». Chaque choix est REVALIDÉ contre les règles serveur
 * avant écriture (PLAN.md §5.1).
 */

export interface ResultatEtape {
  ok: boolean;
  message?: string;
  erreurs?: Record<string, string>;
}

function erreursDeZod(erreur: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of erreur.issues) {
    const champ = String(issue.path[0] ?? "_");
    out[champ] ??= issue.message;
  }
  return out;
}

// -----------------------------------------------------------------------------
// Étape 2 — coordonnées et adresse
// -----------------------------------------------------------------------------

const CoordonneesSchema = z.object({
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(80),
  lastName: z.string().trim().min(1, "Indiquez votre nom.").max(80),
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(160),
  phone: z
    .string()
    .trim()
    .min(1, "Indiquez un numéro de téléphone.")
    .max(30)
    .refine((v) => v.replace(/\D/g, "").length >= 9, "Le numéro semble incomplet."),
  fulfillmentType: z.enum(["delivery", "pickup"]).default("delivery"),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  truckAccess: z.enum(["spl", "camion", "fourgon", "remorque_seule"]).default("camion"),
  unloadType: z.enum(["vrac_sol", "range", "benne"]).optional(),
  allowUnattendedDelivery: z.coerce.boolean().default(false),
  accessNotes: z.string().trim().max(1000).optional(),
  deliveryNotes: z.string().trim().max(1000).optional(),
});

export async function enregistrerCoordonnees(entree: unknown): Promise<ResultatEtape> {
  const parsed = CoordonneesSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: "Vérifiez les champs signalés.", erreurs: erreursDeZod(parsed.error) };
  }

  const d = parsed.data;
  if (d.fulfillmentType === "delivery" && !d.addressLine1) {
    return {
      ok: false,
      message: "Vérifiez les champs signalés.",
      erreurs: { addressLine1: "Indiquez l'adresse de livraison." },
    };
  }

  const tenant = await requireTenant();
  const cartId = await getCartId();
  if (!cartId) return { ok: false, message: "Votre panier a expiré." };

  const { error } = await createSupabaseAdminClient()
    .from("carts")
    .update({
      first_name: d.firstName,
      last_name: d.lastName,
      email: d.email,
      phone: d.phone,
      fulfillment_type: d.fulfillmentType,
      address_line1: d.addressLine1 ?? null,
      address_line2: d.addressLine2 ?? null,
      truck_access: d.truckAccess,
      unload_type: d.unloadType ?? null,
      allow_unattended_delivery: d.allowUnattendedDelivery,
      access_notes: d.accessNotes ?? null,
      delivery_notes: d.deliveryNotes ?? null,
      step: "creneau",
    })
    .eq("id", cartId)
    .eq("company_id", tenant.id);

  if (error) {
    console.error("[commande] coordonnées :", error.message);
    return { ok: false, message: "Enregistrement impossible." };
  }

  revalidatePath("/commande/creneau");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Étape 3 — créneau souhaité
// -----------------------------------------------------------------------------

export async function choisirCreneau(entree: unknown): Promise<ResultatEtape> {
  const parsed = z
    .object({ slotId: uuidLike.nullable().optional() })
    .safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Créneau invalide." };

  const tenant = await requireTenant();
  const cartId = await getCartId();
  if (!cartId) return { ok: false, message: "Votre panier a expiré." };

  const slotId = parsed.data.slotId ?? null;

  // Un créneau d'une autre entreprise ne doit pas pouvoir être injecté.
  if (slotId && !(await creneauAppartientAuTenant(tenant.id, slotId))) {
    return { ok: false, message: "Ce créneau n'existe plus." };
  }

  const { error } = await createSupabaseAdminClient()
    .from("carts")
    .update({ slot_id: slotId, step: "paiement" })
    .eq("id", cartId)
    .eq("company_id", tenant.id);

  if (error) return { ok: false, message: "Enregistrement impossible." };

  revalidatePath("/commande/paiement");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Étape 4 — validation de la commande
// -----------------------------------------------------------------------------

const PaiementSchema = z.object({
  paymentMethod: z.enum(["card", "cash", "check", "transfer", "sumup"]),
  cgvAccepted: z.coerce.boolean().refine((v) => v, "Vous devez accepter les conditions de vente."),
});

/**
 * Crée la commande, réserve le stock et le créneau.
 *
 * Le stock et le créneau passent par des fonctions Postgres transactionnelles :
 * deux clients simultanés ne peuvent pas vendre le même dernier stère ni
 * dépasser la capacité d'un créneau (docs/01 §5).
 */
export async function validerCommande(entree: unknown): Promise<ResultatEtape> {
  const parsed = PaiementSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: "Vérifiez les champs signalés.", erreurs: erreursDeZod(parsed.error) };
  }

  const tenant = await requireTenant();
  const cartId = await getCartId();
  if (!cartId) return { ok: false, message: "Votre panier a expiré." };

  const supabase = createSupabaseAdminClient();
  const panier = await getPanier(tenant);

  if (panier.lignes.length === 0) return { ok: false, message: "Votre panier est vide." };
  if (panier.divergences.length > 0) {
    return { ok: false, message: "Votre panier a changé, vérifiez-le avant de valider." };
  }

  const { data: brouillon } = await supabase
    .from("carts")
    .select(
      `email, phone, first_name, last_name, fulfillment_type, address_line1,
       address_line2, access_notes, truck_access, unload_type,
       allow_unattended_delivery, slot_id, delivery_notes, postal_code, city`,
    )
    .eq("id", cartId)
    .eq("company_id", tenant.id)
    .maybeSingle();

  if (!brouillon?.email || !brouillon.first_name || !brouillon.last_name) {
    return { ok: false, message: "Vos coordonnées sont incomplètes." };
  }

  const livraisonRequise = brouillon.fulfillment_type === "delivery";
  if (livraisonRequise && panier.livraison.devis?.status !== "ok") {
    return { ok: false, message: "La livraison n'a pas pu être calculée." };
  }
  if (livraisonRequise && panier.livraison.eligibilite?.status !== "ok") {
    return { ok: false, message: "Le minimum de commande de votre commune n'est pas atteint." };
  }

  // --- Revalidation du mode de paiement contre les règles serveur ---
  const reglagesPaiement = await getPaymentSettings(tenant.id);
  const contexte: PaymentAvailabilityInput = {
    enabledMethods: ["cash", "check", "transfer", "sumup", "card"],
    totalCents: panier.totaux.totalCents,
    volumeM3: panier.totaux.totalVolumeM3,
    distanceKm: panier.livraison.distanceKm ?? 0,
    fulfillmentType: livraisonRequise ? "delivery" : "pickup",
    cashLimitCents: reglagesPaiement.cashLimitCents,
    depositPercent: reglagesPaiement.depositPercent,
    depositTriggerVolumeM3: reglagesPaiement.depositTriggerVolumeM3,
    depositTriggerKm: reglagesPaiement.depositTriggerKm,
    cardConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  };

  const methode = parsed.data.paymentMethod as PaymentMethod;
  if (!isPaymentMethodAllowed(methode, contexte)) {
    return { ok: false, message: "Ce mode de paiement n'est pas disponible pour votre commande." };
  }

  const acompte = evaluateDeposit(contexte);

  // --- Numérotation ---
  const { data: reference, error: erreurRef } = await supabase.rpc("next_document_number", {
    p_company_id: tenant.id,
    p_kind: "order",
  });
  if (erreurRef || !reference) {
    console.error("[commande] numérotation :", erreurRef?.message);
    return { ok: false, message: "Une erreur est survenue. Merci de nous appeler." };
  }

  const devis = panier.livraison.devis;
  const adresseSnapshot: Json = {
    line1: brouillon.address_line1,
    line2: brouillon.address_line2,
    postalCode: brouillon.postal_code,
    city: brouillon.city,
    accessNotes: brouillon.access_notes,
    truckAccess: brouillon.truck_access,
    unloadType: brouillon.unload_type,
    allowUnattendedDelivery: brouillon.allow_unattended_delivery,
  };

  const { data: commande, error: erreurCommande } = await supabase
    .from("orders")
    .insert({
      company_id: tenant.id,
      reference,
      is_guest: true,
      status: initialStatus(methode),
      email: brouillon.email,
      phone: brouillon.phone,
      first_name: brouillon.first_name,
      last_name: brouillon.last_name,
      fulfillment_type: brouillon.fulfillment_type,
      shipping_address: livraisonRequise ? adresseSnapshot : null,
      zone_id:
        panier.livraison.resolution?.status === "ok" ? panier.livraison.resolution.zone.id : null,
      distance_km: panier.livraison.distanceKm,
      vehicle_id: panier.livraison.vehicule?.id ?? null,
      requested_slot_label: null,
      delivery_notes: brouillon.delivery_notes,
      subtotal_cents: panier.totaux.subtotalCents,
      discount_cents: panier.totaux.discountCents,
      delivery_base_cents: devis?.status === "ok" ? devis.baseCents : 0,
      delivery_volume_cents: devis?.status === "ok" ? devis.volumeCents : 0,
      delivery_fuel_cents: devis?.status === "ok" ? devis.fuelCents : 0,
      delivery_total_cents: panier.totaux.deliveryCents,
      delivery_offered_cents: panier.totaux.deliveryOfferedCents,
      total_cents: panier.totaux.totalCents,
      vat_breakdown: panier.totaux.vatBreakdown as unknown as Json,
      total_volume_m3: panier.totaux.totalVolumeM3,
      payment_method: methode,
      payment_status: "pending",
      deposit_required_cents: acompte.required ? acompte.amountCents : 0,
      cgv_version: "2026-08",
      cgv_accepted_at: new Date().toISOString(),
      fuel_price_snapshot_cents: panier.livraison.prixCarburantCents,
      source: "web",
    })
    .select("id, reference")
    .single();

  if (erreurCommande || !commande) {
    console.error("[commande] création :", erreurCommande?.message);
    return { ok: false, message: "La commande n'a pas pu être enregistrée." };
  }

  // --- Lignes, figées en snapshot ---
  const { error: erreurLignes } = await supabase.from("order_items").insert(
    panier.lignes.map((l) => ({
      company_id: tenant.id,
      order_id: commande.id,
      variant_id: l.variantId,
      product_name: l.productName,
      variant_label: l.variantLabel,
      sku: l.sku,
      cut_length_cm: l.cutLengthCm,
      humidity_class: l.humidityClass,
      packaging: l.packaging,
      quantity: l.quantity,
      unit: "m3app",
      unit_volume_m3: l.lineVolumeM3 / l.quantity,
      line_volume_m3: l.lineVolumeM3,
      unit_price_cents: l.unitPriceCents,
      line_total_cents: l.lineTotalCents,
      vat_rate: l.vatRate,
    })),
  );

  if (erreurLignes) {
    console.error("[commande] lignes :", erreurLignes.message);
    await supabase.from("orders").delete().eq("id", commande.id);
    return { ok: false, message: "La commande n'a pas pu être enregistrée." };
  }

  // --- Réservation atomique du stock ---
  const { error: erreurStock } = await supabase.rpc("reserve_order_stock", {
    p_order_id: commande.id,
  });
  if (erreurStock) {
    await supabase.from("orders").delete().eq("id", commande.id);
    return {
      ok: false,
      message: erreurStock.message.includes("Stock insuffisant")
        ? "Un produit vient de partir en rupture. Ajustez votre panier."
        : "La commande n'a pas pu être enregistrée.",
    };
  }

  // --- Réservation du créneau souhaité (double contrainte nombre + volume) ---
  if (brouillon.slot_id) {
    const { error: erreurCreneau } = await supabase.rpc("book_slot", {
      p_order_id: commande.id,
      p_slot_id: brouillon.slot_id,
    });
    if (erreurCreneau) {
      await supabase.rpc("release_order_stock", { p_order_id: commande.id });
      await supabase.from("orders").delete().eq("id", commande.id);
      return {
        ok: false,
        message: "Ce créneau vient d'être complet. Choisissez-en un autre.",
      };
    }
  }

  await supabase.from("order_status_history").insert({
    company_id: tenant.id,
    order_id: commande.id,
    from_status: null,
    to_status: initialStatus(methode),
    actor: "customer",
    note: "Commande passée depuis le site",
  });

  // --- Jeton d'accès invité : la référence seule est devinable ---
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expire = new Date(Date.now() + 90 * 86_400_000).toISOString();
  await supabase
    .from("order_access_tokens")
    .insert({ token, order_id: commande.id, expires_at: expire });

  // --- Le panier a vécu ---
  await supabase.from("cart_items").delete().eq("cart_id", cartId);
  await supabase.from("carts").delete().eq("id", cartId);
  (await cookies()).delete("panier_id");

  // TODO : email de confirmation (Resend) + PaymentIntent Stripe si methode === 'card'.

  redirect(`/commande/confirmation/${commande.reference}?jeton=${token}`);
}
