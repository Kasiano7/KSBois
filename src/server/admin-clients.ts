import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import { predireProchaineCommande } from "@/domain/statistics";

type ClientRow = Database["public"]["Tables"]["customers"]["Row"];
type AdresseRow = Database["public"]["Tables"]["addresses"]["Row"];

export interface ClientListe {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
  commune: string | null;
  professionnel: boolean;
  societe: string | null;
  bloque: boolean;
  anonymise: boolean;
  commandes: number;
  totalCents: number;
  derniereCommande: string | null;
}

export interface CommandeClientAdmin {
  id: string;
  reference: string;
  statut: string;
  creeLe: string;
  totalCents: number;
  volumeM3: number;
  source: string;
  paiement: string;
  livraison: string | null;
  ville: string | null;
}

export interface FactureClientAdmin {
  id: string;
  numero: string;
  emiseLe: string;
  avoir: boolean;
  totalCents: number | null;
  chemin: string | null;
  commandeId: string;
}

export interface DetailClientAdmin {
  client: ClientRow;
  adresses: AdresseRow[];
  commandes: CommandeClientAdmin[];
  factures: FactureClientAdmin[];
  doublonsPossibles: { id: string; nom: string; email: string }[];
  indicateurs: {
    clientDepuis: string;
    derniereCommande: string | null;
    nbCommandes: number;
    totalCents: number;
    volumeM3: number;
    panierMoyenCents: number;
    frequenceJours: number | null;
    prochaineCommande: string | null;
  };
}

type CommandeListeRow = {
  customer_id: string | null;
  status: string;
  total_cents: number;
  created_at: string;
  shipping_address: Json | null;
};

function nomClient(client: Pick<ClientRow, "first_name" | "last_name" | "company_name" | "email">) {
  return (
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
    client.company_name ||
    client.email
  );
}

function villeSnapshot(adresse: Json | null): string | null {
  if (!adresse || Array.isArray(adresse) || typeof adresse !== "object") return null;
  const ville = (adresse as Record<string, Json | undefined>).city;
  return typeof ville === "string" && ville.trim() ? ville : null;
}

export async function listerClientsAdmin(companyId: string): Promise<ClientListe[]> {
  const supabase = createSupabaseAdminClient();
  const [{ data: clients, error }, { data: commandes }, { data: adresses }] = await Promise.all([
    supabase.from("customers").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(1000),
    supabase
      .from("orders")
      .select("customer_id, status, total_cents, created_at, shipping_address")
      .eq("company_id", companyId)
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(10000),
    supabase
      .from("addresses")
      .select("customer_id, city, is_default, created_at")
      .eq("company_id", companyId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (error) throw new Error(`Lecture des clients impossible : ${error.message}`);

  const commandesParClient = new Map<string, CommandeListeRow[]>();
  for (const commande of (commandes ?? []) as CommandeListeRow[]) {
    if (!commande.customer_id) continue;
    const groupe = commandesParClient.get(commande.customer_id) ?? [];
    groupe.push(commande);
    commandesParClient.set(commande.customer_id, groupe);
  }
  const villeParClient = new Map<string, string>();
  for (const adresse of adresses ?? []) {
    if (!villeParClient.has(adresse.customer_id)) villeParClient.set(adresse.customer_id, adresse.city);
  }

  return (clients ?? []).map((client) => {
    const toutes = commandesParClient.get(client.id) ?? [];
    const utiles = toutes.filter((commande) => commande.status !== "annulee");
    return {
      id: client.id,
      nom: nomClient(client),
      email: client.email,
      telephone: client.phone,
      commune: villeParClient.get(client.id) ?? villeSnapshot(toutes[0]?.shipping_address ?? null),
      professionnel: client.customer_type === "professionnel" || client.is_company,
      societe: client.company_name,
      bloque: client.is_blocked,
      anonymise: client.anonymized_at !== null,
      commandes: utiles.length,
      totalCents: utiles.reduce((somme, commande) => somme + commande.total_cents, 0),
      derniereCommande: utiles[0]?.created_at ?? null,
    };
  });
}

function totalFacture(totaux: Json): number | null {
  if (!totaux || Array.isArray(totaux) || typeof totaux !== "object") return null;
  const objet = totaux as Record<string, Json | undefined>;
  for (const cle of ["totalCents", "total_cents", "totalTtcCents", "total_ttc_cents"]) {
    if (typeof objet[cle] === "number") return objet[cle] as number;
  }
  return null;
}

export async function getClientAdmin(companyId: string, clientId: string): Promise<DetailClientAdmin | null> {
  const supabase = createSupabaseAdminClient();
  const [{ data: client }, { data: adresses }, { data: commandes }, { data: autres }] = await Promise.all([
    supabase.from("customers").select("*").eq("company_id", companyId).eq("id", clientId).maybeSingle(),
    supabase
      .from("addresses")
      .select("*")
      .eq("company_id", companyId)
      .eq("customer_id", clientId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, reference, status, created_at, total_cents, total_volume_m3, source, payment_status, confirmed_delivery_date, shipping_address")
      .eq("company_id", companyId)
      .eq("customer_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("customers")
      .select("id, first_name, last_name, company_name, email")
      .eq("company_id", companyId)
      .neq("id", clientId)
      .is("anonymized_at", null)
      .order("last_name")
      .limit(500),
  ]);
  if (!client) return null;

  const idsCommandes = (commandes ?? []).map((commande) => commande.id);
  const { data: factures } = idsCommandes.length
    ? await supabase
        .from("invoices")
        .select("id, order_id, number, issued_at, is_credit_note, totals, storage_path")
        .eq("company_id", companyId)
        .in("order_id", idsCommandes)
        .order("issued_at", { ascending: false })
    : { data: [] };

  const commandesFormatees: CommandeClientAdmin[] = (commandes ?? []).map((commande) => ({
    id: commande.id,
    reference: commande.reference,
    statut: commande.status,
    creeLe: commande.created_at,
    totalCents: commande.total_cents,
    volumeM3: Number(commande.total_volume_m3),
    source: commande.source,
    paiement: commande.payment_status,
    livraison: commande.confirmed_delivery_date,
    ville: villeSnapshot(commande.shipping_address),
  }));
  const utiles = commandesFormatees.filter((commande) => commande.statut !== "annulee");
  const totalCents = utiles.reduce((somme, commande) => somme + commande.totalCents, 0);
  const prediction = predireProchaineCommande(utiles.map((commande) => commande.creeLe));

  return {
    client,
    adresses: adresses ?? [],
    commandes: commandesFormatees,
    factures: (factures ?? []).map((facture) => ({
      id: facture.id,
      numero: facture.number,
      emiseLe: facture.issued_at,
      avoir: facture.is_credit_note,
      totalCents: totalFacture(facture.totals),
      chemin: facture.storage_path,
      commandeId: facture.order_id,
    })),
    doublonsPossibles: (autres ?? []).map((autre) => ({
      id: autre.id,
      nom: nomClient(autre),
      email: autre.email,
    })),
    indicateurs: {
      clientDepuis: client.created_at,
      derniereCommande: utiles[0]?.creeLe ?? null,
      nbCommandes: utiles.length,
      totalCents,
      volumeM3: Math.round(utiles.reduce((somme, commande) => somme + commande.volumeM3, 0) * 1000) / 1000,
      panierMoyenCents: utiles.length > 0 ? Math.round(totalCents / utiles.length) : 0,
      frequenceJours: prediction?.intervalleJours ?? null,
      prochaineCommande: prediction?.datePrevue ?? null,
    },
  };
}
