import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  FactureIncoherenteError,
  construireAvoir,
  construireFacture,
  type DocumentFacture,
  type EntreeFacture,
  type IdentiteAcheteur,
  type IdentiteVendeur,
} from "@/domain/invoices";

/**
 * Émission et lecture des factures — docs/02 §6.
 *
 * ⚠️ Une facture émise ne se modifie jamais et ne se supprime jamais. Les
 * corrections passent par un AVOIR, qui porte son propre numéro et référence la
 * facture annulée. C'est ce qui garantit une numérotation continue et sans
 * lacune, seule forme acceptable pour un contrôle.
 *
 * Le contenu est figé dans `invoices.lines` / `.totals` / `.seller` / `.buyer`
 * au moment de l'émission. Rien n'est recalculé ensuite : ni les prix, ni la
 * raison sociale, ni le taux de TVA. Une réédition deux ans plus tard doit
 * produire un document identique.
 *
 * La numérotation passe par `next_document_number()` — verrou d'avis Postgres,
 * jamais une lecture-puis-écriture applicative (PLAN.md, règle 5).
 */

export interface FactureEnregistree {
  id: string;
  numero: string;
  emiseLe: string;
  estAvoir: boolean;
  factureOrigineId: string | null;
  orderId: string;
  document: DocumentFacture;
}

interface LigneCommandeFacture {
  product_name: string;
  variant_label: string;
  species_label: string | null;
  cut_length_cm: number | null;
  humidity_class: string | null;
  line_volume_m3: number;
  unit_price_cents: number;
  line_total_cents: number;
  vat_rate: number;
  product_variants: { cut_lengths: { stacking_coefficient: number } | null } | null;
}

const LIBELLES_HUMIDITE: Record<string, string> = {
  H1: "bois sec",
  H2: "mi-sec",
  H3: "fraîchement coupé",
};

/** Le PDF est rendu depuis ce document ; il ne relit jamais la commande. */
function documentDepuisLigne(ligne: {
  seller: unknown;
  buyer: unknown;
  lines: unknown;
  totals: unknown;
  vat_breakdown: unknown;
}): DocumentFacture {
  // Les colonnes jsonb portent exactement le `DocumentFacture` sérialisé à
  // l'émission : on le relit tel quel, sans reconstruction.
  return {
    ...(ligne.totals as { document: DocumentFacture }).document,
  };
}

export async function getFactureDeCommande(
  companyId: string,
  orderId: string,
): Promise<FactureEnregistree | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, number, issued_at, is_credit_note, parent_invoice_id, order_id, totals")
    .eq("company_id", companyId)
    .eq("order_id", orderId)
    .eq("is_credit_note", false)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    numero: data.number,
    emiseLe: data.issued_at,
    estAvoir: data.is_credit_note,
    factureOrigineId: data.parent_invoice_id,
    orderId: data.order_id,
    document: documentDepuisLigne(data as never),
  };
}

export async function listerFacturesDeCommande(
  companyId: string,
  orderId: string,
): Promise<FactureEnregistree[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, number, issued_at, is_credit_note, parent_invoice_id, order_id, totals")
    .eq("company_id", companyId)
    .eq("order_id", orderId)
    .order("issued_at", { ascending: true });

  return (data ?? []).map((ligne) => ({
    id: ligne.id,
    numero: ligne.number,
    emiseLe: ligne.issued_at,
    estAvoir: ligne.is_credit_note,
    factureOrigineId: ligne.parent_invoice_id,
    orderId: ligne.order_id,
    document: documentDepuisLigne(ligne as never),
  }));
}

/** L'avoir qui annule une facture donnée, s'il existe. */
export async function getAvoirDeFacture(
  companyId: string,
  invoiceId: string,
): Promise<FactureEnregistree | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, number, issued_at, is_credit_note, parent_invoice_id, order_id, totals")
    .eq("company_id", companyId)
    .eq("parent_invoice_id", invoiceId)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    numero: data.number,
    emiseLe: data.issued_at,
    estAvoir: data.is_credit_note,
    factureOrigineId: data.parent_invoice_id,
    orderId: data.order_id,
    document: documentDepuisLigne(data as never),
  };
}

export async function getFacture(
  companyId: string,
  invoiceId: string,
): Promise<FactureEnregistree | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, number, issued_at, is_credit_note, parent_invoice_id, order_id, totals")
    .eq("company_id", companyId)
    .eq("id", invoiceId)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    numero: data.number,
    emiseLe: data.issued_at,
    estAvoir: data.is_credit_note,
    factureOrigineId: data.parent_invoice_id,
    orderId: data.order_id,
    document: documentDepuisLigne(data as never),
  };
}

export type ResultatEmission =
  | { ok: true; facture: FactureEnregistree; dejaEmise: boolean }
  | { ok: false; message: string };

/**
 * Émet la facture d'une commande, ou rend celle qui existe déjà.
 *
 * **Idempotent par construction** : deux clics sur le bouton, ou un passage à
 * « livrée » rejoué, ne créent jamais deux factures. C'est ce qui permet de
 * l'appeler depuis la transition de statut sans réfléchir.
 */
export async function emettreFactureCommande(
  companyId: string,
  orderId: string,
): Promise<ResultatEmission> {
  const existante = await getFactureDeCommande(companyId, orderId);
  if (existante) return { ok: true, facture: existante, dejaEmise: true };

  const supabase = createSupabaseAdminClient();

  const [{ data: commande }, { data: entreprise }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, reference, status, created_at, confirmed_delivery_date, email, phone,
         first_name, last_name, customer_id, shipping_address, distance_km,
         subtotal_cents, discount_cents, promotion_code, delivery_total_cents,
         total_cents, total_volume_m3, amount_paid_cents, fulfillment_type,
         vat_breakdown,
         delivery_zones ( name ),
         order_items (
           product_name, variant_label, species_label, cut_length_cm, humidity_class,
           line_volume_m3, unit_price_cents, line_total_cents, vat_rate,
           product_variants ( cut_lengths ( stacking_coefficient ) )
         ),
         order_option_items ( name, price_cents, vat_rate )`,
      )
      .eq("id", orderId)
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
  ]);

  if (!commande) return { ok: false, message: "Commande introuvable." };
  if (!entreprise) return { ok: false, message: "Entreprise introuvable." };
  if (commande.status === "annulee") {
    return { ok: false, message: "Une commande annulée ne se facture pas." };
  }

  const { data: client } = commande.customer_id
    ? await supabase
        .from("customers")
        .select("is_company, company_name, siret, vat_number, customer_type")
        .eq("id", commande.customer_id)
        .maybeSingle()
    : { data: null };

  const adresse = (commande.shipping_address ?? {}) as {
    line1?: string;
    line2?: string;
    postalCode?: string;
    city?: string;
  };

  const vendeur: IdentiteVendeur = {
    name: entreprise.name,
    legalName: entreprise.legal_name,
    addressLine1: entreprise.address_line1,
    postalCode: entreprise.postal_code,
    city: entreprise.city,
    siret: entreprise.siret,
    rcs: entreprise.rcs,
    apeCode: entreprise.ape_code,
    vatNumber: entreprise.vat_number,
    email: entreprise.email,
    phone: entreprise.phone_display ?? entreprise.phone,
    vatMode: entreprise.vat_mode as IdentiteVendeur["vatMode"],
  };

  const acheteur: IdentiteAcheteur = {
    name: `${commande.first_name ?? ""} ${commande.last_name ?? ""}`.trim() || commande.email,
    companyName: client?.company_name ?? null,
    siret: client?.siret ?? null,
    vatNumber: client?.vat_number ?? null,
    addressLine1: adresse.line1 ?? null,
    addressLine2: adresse.line2 ?? null,
    postalCode: adresse.postalCode ?? null,
    city: adresse.city ?? null,
    email: commande.email,
    phone: commande.phone,
    isProfessional: client?.customer_type === "professionnel" || client?.is_company === true,
  };

  const lignes = (commande.order_items ?? []) as unknown as LigneCommandeFacture[];

  const entree: EntreeFacture = {
    seller: vendeur,
    buyer: acheteur,
    orderReference: commande.reference,
    // La date de vente est celle de la livraison quand elle est connue : c'est
    // le fait générateur de la TVA sur une livraison de biens.
    saleDate: commande.confirmed_delivery_date ?? commande.created_at.slice(0, 10),
    lines: lignes.map((ligne) => ({
      designation: ligne.species_label?.trim() || ligne.product_name,
      precision:
        [
          ligne.variant_label,
          ligne.humidity_class ? LIBELLES_HUMIDITE[ligne.humidity_class] : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      quantiteM3: Number(ligne.line_volume_m3),
      stackingCoefficient: ligne.product_variants?.cut_lengths
        ? Number(ligne.product_variants.cut_lengths.stacking_coefficient)
        : null,
      unitPriceCents: ligne.unit_price_cents,
      lineTotalCents: ligne.line_total_cents,
      vatRate: Number(ligne.vat_rate),
    })),
    options: (commande.order_option_items ?? []).map((option) => ({
      name: option.name,
      priceCents: option.price_cents,
      vatRate: Number(option.vat_rate),
    })),
    delivery:
      commande.delivery_total_cents > 0
        ? {
            label: [
              "Livraison",
              commande.delivery_zones?.name ?? null,
              commande.distance_km !== null ? `${commande.distance_km} km` : null,
            ]
              .filter(Boolean)
              .join(" — "),
            totalCents: commande.delivery_total_cents,
          }
        : null,
    discount:
      commande.discount_cents > 0
        ? {
            label: commande.promotion_code
              ? `Remise ${commande.promotion_code}`
              : "Remise commerciale",
            amountCents: commande.discount_cents,
          }
        : null,
    orderTotalCents: commande.total_cents,
    paidCents: commande.amount_paid_cents,
    totalVolumeM3: Number(commande.total_volume_m3),
    // `orders.vat_breakdown` porte déjà le `VatBucket[]` figé à la commande :
    // on le reprend tel quel plutôt que de le recalculer, pour que la facture
    // montre exactement la TVA que le client a payée.
    vatBreakdown: (commande.vat_breakdown ?? []) as unknown as EntreeFacture["vatBreakdown"],
  };

  let document: DocumentFacture;
  try {
    document = construireFacture(entree);
  } catch (erreur) {
    if (erreur instanceof FactureIncoherenteError) {
      console.error(`[factures] ${commande.reference} : ${erreur.message}`);
      return {
        ok: false,
        // Message explicite : mieux vaut un exploitant qui appelle qu'une
        // facture fausse partie chez un client.
        message:
          `Le détail de la commande ne retombe pas sur son total ` +
          `(${(erreur.calculeCents / 100).toLocaleString("fr-FR")} € contre ` +
          `${(erreur.attenduCents / 100).toLocaleString("fr-FR")} €). ` +
          `Aucune facture n'a été émise. Vérifiez les lignes de la commande.`,
      };
    }
    throw erreur;
  }

  return enregistrer(companyId, orderId, document, null);
}

/**
 * Émet un avoir annulant une facture existante.
 *
 * Réservé au gérant côté action : c'est une écriture comptable, pas une
 * correction d'interface.
 */
export async function emettreAvoir(
  companyId: string,
  invoiceId: string,
): Promise<ResultatEmission> {
  const origine = await getFacture(companyId, invoiceId);
  if (!origine) return { ok: false, message: "Facture introuvable." };
  if (origine.estAvoir) return { ok: false, message: "Un avoir ne s'annule pas par un avoir." };

  const dejaAnnulee = await getAvoirDeFacture(companyId, invoiceId);
  if (dejaAnnulee) return { ok: false, message: "Cette facture a déjà fait l'objet d'un avoir." };

  return enregistrer(companyId, origine.orderId, construireAvoir(origine.document), invoiceId);
}

async function enregistrer(
  companyId: string,
  orderId: string,
  document: DocumentFacture,
  parentInvoiceId: string | null,
): Promise<ResultatEmission> {
  const supabase = createSupabaseAdminClient();

  const { data: numero, error: erreurNumero } = await supabase.rpc("next_document_number", {
    p_company_id: companyId,
    p_kind: "invoice",
  });
  if (erreurNumero || !numero) {
    console.error("[factures] numérotation :", erreurNumero?.message);
    return { ok: false, message: "Le numéro de facture n'a pas pu être attribué." };
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      company_id: companyId,
      order_id: orderId,
      number: numero,
      seller: document.seller as never,
      buyer: document.buyer as never,
      lines: document.lines as never,
      // `totals` porte le document complet : c'est lui qui est réaffiché, et
      // le stocker en un bloc évite qu'une relecture partielle recompose un
      // document légèrement différent de celui qui a été remis au client.
      totals: { ...document.totals, document } as never,
      vat_breakdown: document.vatBreakdown as never,
      is_credit_note: document.isCreditNote,
      parent_invoice_id: parentInvoiceId,
    })
    .select("id, number, issued_at, is_credit_note, parent_invoice_id, order_id")
    .single();

  if (error || !data) {
    // 23505 = violation d'unicité. C'est l'index `invoices_une_facture_par_commande`
    // (ou `..._un_avoir_par_facture`) qui vient d'arbitrer une course : un autre
    // appel a émis le document une fraction de seconde plus tôt. Ce n'est pas une
    // erreur pour l'appelant — il voulait une facture, elle existe.
    if (error?.code === "23505") {
      const existante = parentInvoiceId
        ? await getAvoirDeFacture(companyId, parentInvoiceId)
        : await getFactureDeCommande(companyId, orderId);
      if (existante) return { ok: true, facture: existante, dejaEmise: true };
    }
    console.error("[factures] insertion :", error?.message);
    return { ok: false, message: "La facture n'a pas pu être enregistrée." };
  }

  return {
    ok: true,
    dejaEmise: false,
    facture: {
      id: data.id,
      numero: data.number,
      emiseLe: data.issued_at,
      estAvoir: data.is_credit_note,
      factureOrigineId: data.parent_invoice_id,
      orderId: data.order_id,
      document,
    },
  };
}

/* ==========================================================================
   Bon de livraison — reconstruit à la demande, jamais persisté (docs/02 §6)
   ========================================================================== */

export interface DonneesBonLivraison {
  reference: string;
  client: {
    nom: string;
    societe: string | null;
    adresse: string | null;
    complementAdresse: string | null;
    codePostalVille: string | null;
    telephone: string | null;
  };
  livraison: {
    date: string | null;
    creneau: string | null;
    distanceKm: number | null;
    contraintes: string | null;
    accesCamion: string | null;
  };
  lignes: Array<{
    cle: string;
    designation: string;
    precision: string | null;
    quantiteM3: number;
    stackingCoefficient: number | null;
  }>;
  volumeTotalM3: number;
  paiement: { mode: string; resteAEncaisserCents: number };
}

const LIBELLES_PAIEMENT: Record<string, string> = {
  card: "Carte bancaire en ligne",
  cash: "Espèces à la livraison",
  check: "Chèque",
  transfer: "Virement bancaire",
  sumup: "Carte au terminal du camion",
};

const LIBELLES_ACCES: Record<string, string> = {
  easy: "Accès camion sans difficulté",
  narrow: "Chemin étroit",
  slope: "Pente marquée",
  restricted: "Accès restreint — voir consignes",
};

export async function getDonneesBonLivraison(
  companyId: string,
  orderId: string,
): Promise<DonneesBonLivraison | null> {
  const supabase = createSupabaseAdminClient();
  const { data: commande } = await supabase
    .from("orders")
    .select(
      `reference, first_name, last_name, phone, shipping_address, distance_km,
       confirmed_delivery_date, confirmed_slot_label, requested_slot_label,
       total_cents, amount_paid_cents, total_volume_m3, payment_method, customer_id,
       order_items (
         product_name, variant_label, species_label, cut_length_cm, humidity_class,
         line_volume_m3,
         product_variants ( cut_lengths ( stacking_coefficient ) )
       )`,
    )
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!commande) return null;

  const { data: client } = commande.customer_id
    ? await supabase
        .from("customers")
        .select("company_name")
        .eq("id", commande.customer_id)
        .maybeSingle()
    : { data: null };

  const adresse = (commande.shipping_address ?? {}) as {
    line1?: string;
    line2?: string;
    postalCode?: string;
    city?: string;
    accessNotes?: string;
    truckAccess?: string;
  };
  const lignes = (commande.order_items ?? []) as unknown as LigneCommandeFacture[];

  return {
    reference: commande.reference,
    client: {
      nom: `${commande.first_name ?? ""} ${commande.last_name ?? ""}`.trim() || "Client",
      societe: client?.company_name ?? null,
      adresse: adresse.line1 ?? null,
      complementAdresse: adresse.line2 ?? null,
      codePostalVille: [adresse.postalCode, adresse.city].filter(Boolean).join(" ") || null,
      telephone: commande.phone,
    },
    livraison: {
      date: commande.confirmed_delivery_date,
      creneau: commande.confirmed_slot_label ?? commande.requested_slot_label,
      distanceKm: commande.distance_km === null ? null : Number(commande.distance_km),
      contraintes: adresse.accessNotes ?? null,
      accesCamion: adresse.truckAccess ? (LIBELLES_ACCES[adresse.truckAccess] ?? null) : null,
    },
    lignes: lignes.map((ligne, index) => ({
      cle: `${ligne.product_name}-${index}`,
      designation: ligne.species_label?.trim() || ligne.product_name,
      precision:
        [ligne.variant_label, ligne.humidity_class ? LIBELLES_HUMIDITE[ligne.humidity_class] : null]
          .filter(Boolean)
          .join(" · ") || null,
      quantiteM3: Number(ligne.line_volume_m3),
      stackingCoefficient: ligne.product_variants?.cut_lengths
        ? Number(ligne.product_variants.cut_lengths.stacking_coefficient)
        : null,
    })),
    volumeTotalM3: Number(commande.total_volume_m3),
    paiement: {
      mode: LIBELLES_PAIEMENT[commande.payment_method ?? ""] ?? "À préciser",
      resteAEncaisserCents: Math.max(0, commande.total_cents - commande.amount_paid_cents),
    },
  };
}
