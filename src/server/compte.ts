import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { formatDateFr } from "@/lib/jours";
import type { OrderStatus } from "@/domain/orders/state-machine";

/**
 * Lectures de l'espace client — docs/03-DESIGN-SYSTEM.md §6.4
 *
 * Toutes les requêtes sont filtrées sur le `customerId` de la SESSION VÉRIFIÉE,
 * jamais sur une valeur venue de l'URL ou du navigateur. La RLS
 * (`orders_customer_read`) reste la seconde barrière, pas la première.
 */

export interface LigneCommandeClient {
  produit: string;
  format: string;
  quantite: number;
  volumeM3: number;
  totalCents: number;
}

export interface CommandeClient {
  id: string;
  reference: string;
  statut: OrderStatus;
  creeLe: string;
  totalCents: number;
  volumeM3: number;
  lignes: LigneCommandeClient[];
  /** Date confirmée par l'entreprise, ou souhait exprimé à la commande. */
  livraisonConfirmee: string | null;
  creneauConfirme: string | null;
  creneauSouhaite: string | null;
  modePaiement: string | null;
  statutPaiement: string;
  resteAPayerCents: number;
  ville: string | null;
  adresse: string | null;
}

export interface ResumeClient {
  nbCommandes: number;
  volumeTotalM3: number;
  totalDepenseCents: number;
  /** Année de la première commande : « client depuis 2024 ». */
  clientDepuis: string | null;
}

type LigneRow = {
  product_name: string;
  variant_label: string;
  quantity: number;
  line_volume_m3: number;
  line_total_cents: number;
};

type AdresseSnapshot = { line1?: string | null; city?: string | null } | null;

const SELECT_COMMANDE = `
  id, reference, status, created_at, total_cents, total_volume_m3,
  confirmed_delivery_date, confirmed_slot_label, requested_slot_label,
  payment_method, payment_status, amount_paid_cents, shipping_address,
  order_items ( product_name, variant_label, quantity, line_volume_m3, line_total_cents )
`;

function versCommande(row: Record<string, unknown>): CommandeClient {
  const adresse = row.shipping_address as AdresseSnapshot;
  const total = row.total_cents as number;
  const paye = (row.amount_paid_cents as number | null) ?? 0;

  return {
    id: row.id as string,
    reference: row.reference as string,
    statut: row.status as OrderStatus,
    creeLe: row.created_at as string,
    totalCents: total,
    volumeM3: Number(row.total_volume_m3),
    lignes: ((row.order_items ?? []) as LigneRow[]).map((l) => ({
      produit: l.product_name,
      format: l.variant_label,
      quantite: Number(l.quantity),
      volumeM3: Number(l.line_volume_m3),
      totalCents: l.line_total_cents,
    })),
    livraisonConfirmee: (row.confirmed_delivery_date as string | null) ?? null,
    creneauConfirme: (row.confirmed_slot_label as string | null) ?? null,
    creneauSouhaite: (row.requested_slot_label as string | null) ?? null,
    modePaiement: (row.payment_method as string | null) ?? null,
    statutPaiement: row.payment_status as string,
    // Ce qui reste dû, jamais négatif : un remboursement partiel ne doit pas
    // afficher un montant à percevoir de signe inverse.
    resteAPayerCents: Math.max(0, total - paye),
    ville: adresse?.city ?? null,
    adresse: adresse?.line1 ?? null,
  };
}

export async function listerCommandesClient(
  companyId: string,
  customerId: string,
  limite = 50,
): Promise<CommandeClient[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("orders")
    .select(SELECT_COMMANDE)
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) {
    console.error("[compte] listerCommandesClient :", error.message);
    return [];
  }

  return (data ?? []).map((row) => versCommande(row as unknown as Record<string, unknown>));
}

/** Commande précise du client. `null` si elle ne lui appartient pas. */
export async function getCommandeClient(
  companyId: string,
  customerId: string,
  reference: string,
): Promise<CommandeClient | null> {
  const { data } = await createSupabaseAdminClient()
    .from("orders")
    .select(SELECT_COMMANDE)
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .eq("reference", reference)
    .maybeSingle();

  return data ? versCommande(data as unknown as Record<string, unknown>) : null;
}

/** Chiffres du client, calculés à la lecture plutôt que stockés. */
export function resumerClient(commandes: CommandeClient[]): ResumeClient {
  const utiles = commandes.filter((c) => c.statut !== "annulee");

  return {
    nbCommandes: utiles.length,
    volumeTotalM3: Math.round(utiles.reduce((t, c) => t + c.volumeM3, 0) * 1000) / 1000,
    totalDepenseCents: utiles.reduce((t, c) => t + c.totalCents, 0),
    clientDepuis: utiles.length > 0 ? (utiles.at(-1)!.creeLe.slice(0, 4) ?? null) : null,
  };
}

/**
 * Phrase de livraison à afficher, du plus ferme au plus vague.
 * On ne présente jamais un souhait comme une date confirmée (docs/02 §3.1).
 */
export function phraseLivraison(commande: CommandeClient): string {
  if (commande.statut === "livree") {
    // Année comprise : une livraison passée peut dater d'un autre hiver, et
    // « livrée le 18 novembre » ne dit alors pas de quelle année on parle.
    return commande.livraisonConfirmee
      ? `Livrée le ${formatDateFr(commande.livraisonConfirmee, { jourSemaine: false, annee: true })}`
      : "Livrée";
  }
  if (commande.statut === "annulee") return "Commande annulée";

  if (commande.livraisonConfirmee) {
    const date = formatDateFr(commande.livraisonConfirmee);
    return commande.creneauConfirme
      ? `Livraison confirmée ${date} · ${commande.creneauConfirme}`
      : `Livraison confirmée ${date}`;
  }

  return commande.creneauSouhaite
    ? `Créneau souhaité : ${commande.creneauSouhaite} — nous vous confirmons la date par email`
    : "Date de livraison à convenir — nous vous appelons";
}
