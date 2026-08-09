"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { assertRole } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { uuidLike } from "@/lib/validation";
import { getDemandeDevis, calculerProposition } from "@/server/admin-devis";
import { envoyerDevisAuClient } from "@/server/notifications-devis";
import { canConvertQuote, canSendQuote, type QuoteStatus } from "@/domain/quotes";
import { formatEuros } from "@/domain/units";
import { initialStatus } from "@/domain/orders/state-machine";

/**
 * Traitement des demandes de devis — docs/02-MOTEURS-METIER.md §7.2
 *
 * Deux invariants :
 *  1. aucun montant de ligne ne transite par le navigateur — l'écran envoie des
 *     identifiants de variante et des quantités, le serveur chiffre ;
 *  2. la conversion en commande passe par les mêmes fonctions transactionnelles
 *     que le tunnel client : même numérotation, même réservation de stock.
 */

export interface ResultatDevisAdmin {
  ok: boolean;
  message?: string;
  /** Renseigné après conversion : la commande créée. */
  redirection?: string;
}

/** Euros saisis (« 15 », « 15,50 ») → centimes entiers. */
const EurosOptionnels = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  })
  .refine((c) => c === null || (c >= 0 && c <= 1_000_000), "Montant hors limites.");

const PropositionSchema = z.object({
  devisId: uuidLike,
  lignes: z
    .array(
      z.object({
        variantId: uuidLike,
        quantity: z.coerce.number().positive("Indiquez une quantité.").max(999),
      }),
    )
    .max(30),
  livraisonIncluse: z.coerce.boolean(),
  /** Vide = laisser le moteur calculer quand la commune est desservie. */
  livraisonEuros: EurosOptionnels,
  remiseEuros: EurosOptionnels,
  remiseLabel: z.string().trim().max(80).optional(),
  validJusquA: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
    .nullable()
    .optional(),
});

function chemins(devisId?: string) {
  revalidatePath("/admin/devis");
  if (devisId) revalidatePath(`/admin/devis/${devisId}`);
  revalidatePath("/admin");
}

/**
 * Enregistre la proposition et met à jour le total estimé.
 *
 * `estimated_total_cents` est un CACHE d'affichage pour la liste : il est
 * recalculé ici à chaque enregistrement, jamais lu comme source de vérité.
 */
export async function enregistrerProposition(entree: unknown): Promise<ResultatDevisAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const tenant = await requireTenant();
  const parsed = PropositionSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const d = parsed.data;
  const supabase = createSupabaseAdminClient();

  const avant = await getDemandeDevis(session.companyId, d.devisId);
  if (!avant) return { ok: false, message: "Demande introuvable." };
  if (avant.commandeId) {
    return {
      ok: false,
      message: "Ce devis est déjà converti en commande : modifiez la commande, pas le devis.",
    };
  }

  // Les variantes doivent appartenir à l'entreprise : un identifiant injecté ne
  // doit pas permettre de vendre le produit d'un autre tenant.
  if (d.lignes.length > 0) {
    const { data: connues } = await supabase
      .from("product_variants")
      .select("id")
      .eq("company_id", session.companyId)
      .in(
        "id",
        d.lignes.map((l) => l.variantId),
      );
    const idsConnus = new Set((connues ?? []).map((v) => v.id));
    if (d.lignes.some((l) => !idsConnus.has(l.variantId))) {
      return { ok: false, message: "Un format sélectionné n'existe pas dans votre catalogue." };
    }
  }

  const { error } = await supabase
    .from("quote_requests")
    .update({
      proposal_lines: d.lignes as unknown as Json,
      delivery_included: d.livraisonIncluse,
      delivery_cents: d.livraisonIncluse ? d.livraisonEuros : null,
      discount_cents: d.remiseEuros ?? 0,
      discount_label: d.remiseLabel || null,
      valid_until: d.validJusquA ?? null,
      // Une demande sur laquelle on travaille n'est plus « à traiter ».
      status: avant.statut === "nouveau" ? "en_cours" : avant.statut,
    })
    .eq("id", d.devisId)
    .eq("company_id", session.companyId);

  if (error) {
    console.error("[devis] enregistrerProposition :", error.message);
    return { ok: false, message: "Enregistrement impossible." };
  }

  // Recalcul complet APRÈS écriture, pour stocker un total cohérent avec ce que
  // l'écran, le PDF et l'email afficheront.
  const apres = await getDemandeDevis(session.companyId, d.devisId);
  if (apres) {
    const proposition = await calculerProposition(tenant, apres);
    await supabase
      .from("quote_requests")
      .update({
        estimated_total_cents: proposition.lignes.length > 0 ? proposition.totaux.totalCents : null,
      })
      .eq("id", d.devisId)
      .eq("company_id", session.companyId);
  }

  chemins(d.devisId);
  return { ok: true, message: "Proposition enregistrée." };
}

export async function enregistrerNotesDevis(entree: unknown): Promise<ResultatDevisAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = z
    .object({ devisId: uuidLike, notes: z.string().trim().max(4000) })
    .safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const { error } = await createSupabaseAdminClient()
    .from("quote_requests")
    .update({ admin_notes: parsed.data.notes || null })
    .eq("id", parsed.data.devisId)
    .eq("company_id", session.companyId);

  if (error) return { ok: false, message: "Enregistrement impossible." };

  chemins(parsed.data.devisId);
  return { ok: true, message: "Note enregistrée." };
}

const STATUTS: QuoteStatus[] = ["nouveau", "en_cours", "envoye", "accepte", "refuse"];

export async function changerStatutDevis(entree: unknown): Promise<ResultatDevisAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = z
    .object({ devisId: uuidLike, statut: z.enum(STATUTS as [QuoteStatus, ...QuoteStatus[]]) })
    .safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Statut invalide." };

  const { error } = await createSupabaseAdminClient()
    .from("quote_requests")
    .update({ status: parsed.data.statut })
    .eq("id", parsed.data.devisId)
    .eq("company_id", session.companyId);

  if (error) return { ok: false, message: "Enregistrement impossible." };

  chemins(parsed.data.devisId);
  return { ok: true, message: "Statut mis à jour." };
}

/**
 * Envoie le devis au client, PDF joint.
 *
 * Le résultat est rendu honnêtement : sans clé Resend configurée, l'écran doit
 * dire que rien n'est parti plutôt que d'afficher un succès mensonger.
 */
export async function envoyerDevis(entree: unknown): Promise<ResultatDevisAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const tenant = await requireTenant();
  const parsed = z
    .object({ devisId: uuidLike, message: z.string().trim().max(2000).optional() })
    .safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const demande = await getDemandeDevis(session.companyId, parsed.data.devisId);
  if (!demande) return { ok: false, message: "Demande introuvable." };

  if (!canSendQuote(demande.statut, demande.lignesProposees.length)) {
    return {
      ok: false,
      message:
        demande.lignesProposees.length === 0
          ? "Ajoutez au moins une ligne avant d'envoyer le devis."
          : "Cette demande est refusée : rouvrez-la avant d'envoyer un devis.",
    };
  }

  const resultat = await envoyerDevisAuClient(tenant, demande.id, parsed.data.message ?? null);

  if (!resultat.pdfGenere) {
    return { ok: false, message: "Le PDF n'a pas pu être produit. Le devis n'a pas été envoyé." };
  }

  // Le statut passe à « envoyé » même si le fournisseur d'email est absent :
  // le PDF est téléchargeable et l'exploitant peut l'envoyer lui-même. La date
  // de réponse est posée dans les deux cas — c'est le jour où la demande a
  // effectivement reçu une proposition.
  await createSupabaseAdminClient()
    .from("quote_requests")
    .update({ status: "envoye", responded_at: new Date().toISOString() })
    .eq("id", demande.id)
    .eq("company_id", session.companyId);

  chemins(demande.id);

  if (!resultat.envoye) {
    return {
      ok: true,
      message:
        resultat.raison === "non_configure"
          ? `Devis marqué comme envoyé, mais AUCUN email n'est parti : l'envoi d'emails n'est pas encore configuré. Téléchargez le PDF et envoyez-le vous-même à ${demande.email}.`
          : `Devis marqué comme envoyé, mais l'email a échoué. Téléchargez le PDF et envoyez-le vous-même à ${demande.email}.`,
    };
  }

  return { ok: true, message: `Devis envoyé à ${demande.email}.` };
}

/**
 * Convertit la proposition acceptée en commande — docs/02 §7.2
 *
 * C'est la fonctionnalité qui évite la double saisie. Elle réutilise les mêmes
 * briques que le tunnel client : numérotation par `next_document_number`,
 * snapshot des lignes, réservation de stock par `reserve_order_stock`.
 *
 * Aucun créneau n'est réservé : la date se cale au téléphone, et l'exploitant
 * la confirmera depuis la fiche commande.
 */
export async function convertirDevisEnCommande(entree: unknown): Promise<ResultatDevisAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const tenant = await requireTenant();
  const parsed = z.object({ devisId: uuidLike }).safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const supabase = createSupabaseAdminClient();
  const demande = await getDemandeDevis(session.companyId, parsed.data.devisId);
  if (!demande) return { ok: false, message: "Demande introuvable." };

  if (
    !canConvertQuote(demande.statut, demande.lignesProposees.length, demande.commandeId !== null)
  ) {
    return {
      ok: false,
      message: demande.commandeId
        ? `Ce devis a déjà produit la commande ${demande.commandeReference ?? ""}.`
        : "Ajoutez au moins une ligne avant de convertir ce devis en commande.",
    };
  }

  const proposition = await calculerProposition(tenant, demande);
  if (proposition.lignes.length === 0) {
    return { ok: false, message: "Aucune ligne valide dans cette proposition." };
  }

  const { data: reference, error: erreurRef } = await supabase.rpc("next_document_number", {
    p_company_id: session.companyId,
    p_kind: "order",
  });
  if (erreurRef || !reference) {
    console.error("[devis] numérotation commande :", erreurRef?.message);
    return { ok: false, message: "La numérotation de commande a échoué." };
  }

  const livraison = proposition.livraison;
  const adresse: Json = {
    line1: demande.adresse,
    postalCode: demande.codePostal,
    city: demande.ville,
    accessNotes: null,
    truckAccess: "camion",
    unloadType: null,
    allowUnattendedDelivery: false,
  };

  // Même fiche client que le tunnel : un client qui a d'abord demandé un devis
  // puis commandé en ligne ne doit pas exister en double, et il doit retrouver
  // cette commande dans son espace.
  const { data: customerId } = await supabase.rpc("upsert_customer", {
    p_company_id: session.companyId,
    p_email: demande.email,
    p_first_name: demande.prenom ?? undefined,
    p_last_name: demande.nom ?? undefined,
    p_phone: demande.telephone ?? undefined,
  });

  const { data: commande, error: erreurCommande } = await supabase
    .from("orders")
    .insert({
      company_id: session.companyId,
      reference,
      customer_id: customerId ?? null,
      is_guest: true,
      // Aucun mode de paiement n'est arrêté à ce stade : l'exploitant
      // l'enregistrera depuis la fiche commande, comme pour une commande
      // téléphonique.
      status: initialStatus(null),
      email: demande.email,
      phone: demande.telephone,
      first_name: demande.prenom,
      last_name: demande.nom,
      fulfillment_type: demande.livraisonIncluse ? "delivery" : "pickup",
      shipping_address: demande.livraisonIncluse ? adresse : null,
      zone_id: livraison?.zoneId ?? null,
      distance_km: livraison?.distanceKm ?? null,
      vehicle_id: livraison?.vehiculeId ?? null,
      delivery_notes: demande.message,
      internal_notes:
        `Créée depuis le devis ${demande.reference}.` +
        (demande.notesInternes ? `\n${demande.notesInternes}` : ""),
      subtotal_cents: proposition.totaux.subtotalCents,
      discount_cents: proposition.totaux.discountCents,
      delivery_base_cents: livraison?.detail?.status === "ok" ? livraison.detail.baseCents : 0,
      delivery_volume_cents: livraison?.detail?.status === "ok" ? livraison.detail.volumeCents : 0,
      delivery_fuel_cents: livraison?.detail?.status === "ok" ? livraison.detail.fuelCents : 0,
      delivery_total_cents: proposition.totaux.deliveryCents,
      delivery_offered_cents: proposition.totaux.deliveryOfferedCents,
      fuel_price_snapshot_cents: livraison?.prixCarburantCents ?? null,
      total_cents: proposition.totaux.totalCents,
      vat_breakdown: proposition.totaux.vatBreakdown as unknown as Json,
      total_volume_m3: proposition.totaux.totalVolumeM3,
      payment_status: "pending",
      source: "admin",
      created_by: session.userId,
    })
    .select("id, reference")
    .single();

  if (erreurCommande || !commande) {
    console.error("[devis] création de commande :", erreurCommande?.message);
    return { ok: false, message: "La commande n'a pas pu être créée." };
  }

  const { error: erreurLignes } = await supabase.from("order_items").insert(
    proposition.lignes.map((l) => ({
      company_id: session.companyId,
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
      unit_volume_m3: l.unitVolumeM3,
      line_volume_m3: l.lineVolumeM3,
      unit_price_cents: l.unitPriceCents,
      line_total_cents: l.lineTotalCents,
      vat_rate: l.vatRate,
    })),
  );

  if (erreurLignes) {
    console.error("[devis] lignes de commande :", erreurLignes.message);
    await supabase.from("orders").delete().eq("id", commande.id);
    return { ok: false, message: "La commande n'a pas pu être créée." };
  }

  // Réservation atomique du stock, exactement comme au tunnel.
  const { error: erreurStock } = await supabase.rpc("reserve_order_stock", {
    p_order_id: commande.id,
  });
  if (erreurStock) {
    await supabase.from("orders").delete().eq("id", commande.id);
    return {
      ok: false,
      message: erreurStock.message.includes("Stock insuffisant")
        ? "Stock insuffisant pour cette commande : saisissez votre production ou réduisez les quantités."
        : "La réservation du stock a échoué : la commande n'a pas été créée.",
    };
  }

  await supabase.from("order_status_history").insert({
    company_id: session.companyId,
    order_id: commande.id,
    from_status: null,
    to_status: initialStatus(null),
    changed_by: session.userId,
    actor: "admin",
    note: `Commande créée à partir du devis ${demande.reference}`,
  });

  const { error: erreurLien } = await supabase
    .from("quote_requests")
    .update({ status: "accepte", converted_order_id: commande.id })
    .eq("id", demande.id)
    .eq("company_id", session.companyId);

  if (erreurLien) {
    // La commande existe : on ne la supprime pas, mais le lien manquant
    // permettrait une seconde conversion. On le signale franchement.
    console.error("[devis] lien devis→commande :", erreurLien.message);
    return {
      ok: true,
      message: `Commande ${commande.reference} créée, mais le devis n'a pas pu être marqué comme accepté. Vérifiez avant de recliquer.`,
      redirection: `/admin/commandes/${commande.id}`,
    };
  }

  chemins(demande.id);
  revalidatePath("/admin/commandes");

  return {
    ok: true,
    message: `Commande ${commande.reference} créée pour ${formatEuros(proposition.totaux.totalCents)}. Le stock est réservé.`,
    redirection: `/admin/commandes/${commande.id}`,
  };
}
