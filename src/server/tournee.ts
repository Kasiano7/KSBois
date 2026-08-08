import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/domain/orders/state-machine";

/**
 * Feuille de tournée — docs/05-ADMIN.md §3
 *
 * Écran le plus utilisé de l'application. Deux informations font échouer une
 * livraison : le MODE DE PAIEMENT et les CONTRAINTES D'ACCÈS. Elles sont donc
 * remontées au premier plan, en toutes lettres.
 */

export interface ArretTournee {
  orderId: string;
  reference: string;
  position: number | null;
  nom: string;
  telephone: string | null;
  adresse: string;
  ville: string;
  codePostal: string;
  lat: number | null;
  lng: number | null;
  produits: { nom: string; format: string; volumeM3: number }[];
  volumeM3: number;
  status: OrderStatus;
  /** Mode de paiement et montant restant dû : à afficher en gros. */
  modePaiement: string | null;
  resteAPayerCents: number;
  totalCents: number;
  /** Contraintes d'accès : le champ qui évite le demi-tour. */
  accesCamion: string | null;
  contraintesAcces: string | null;
  livraisonSansPresence: boolean;
  typeDechargement: string | null;
  notesClient: string | null;
  notesInternes: string | null;
  creneau: string | null;
}

export interface Tournee {
  date: string;
  arrets: ArretTournee[];
  volumeTotalM3: number;
  aEncaisserCents: number;
  especesCents: number;
  vehicules: string[];
}

export async function getTournee(companyId: string, date: string): Promise<Tournee> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, reference, route_position, first_name, last_name, phone, shipping_address,
       total_volume_m3, status, payment_method, payment_status, total_cents,
       amount_paid_cents, delivery_notes, internal_notes, confirmed_slot_label,
       vehicles ( name ),
       order_items ( product_name, variant_label, line_volume_m3 )`,
    )
    .eq("company_id", companyId)
    .eq("confirmed_delivery_date", date)
    .neq("status", "annulee")
    .order("route_position", { ascending: true, nullsFirst: false })
    .order("reference");

  if (error) {
    console.error("[tournee] lecture :", error.message);
    return { date, arrets: [], volumeTotalM3: 0, aEncaisserCents: 0, especesCents: 0, vehicules: [] };
  }

  const arrets: ArretTournee[] = (data ?? []).map((o) => {
    const adresse = (o.shipping_address ?? {}) as Record<string, unknown>;
    const resteAPayer =
      o.payment_status === "paid" ? 0 : o.total_cents - (o.amount_paid_cents ?? 0);

    return {
      orderId: o.id,
      reference: o.reference,
      position: o.route_position,
      nom: `${o.first_name ?? ""} ${(o.last_name ?? "").toUpperCase()}`.trim() || "—",
      telephone: o.phone,
      adresse: String(adresse.line1 ?? ""),
      ville: String(adresse.city ?? ""),
      codePostal: String(adresse.postalCode ?? ""),
      lat: typeof adresse.lat === "number" ? adresse.lat : null,
      lng: typeof adresse.lng === "number" ? adresse.lng : null,
      produits: (o.order_items ?? []).map((i) => ({
        nom: i.product_name,
        format: i.variant_label,
        volumeM3: Number(i.line_volume_m3),
      })),
      volumeM3: Number(o.total_volume_m3),
      status: o.status as OrderStatus,
      modePaiement: o.payment_method,
      resteAPayerCents: resteAPayer,
      totalCents: o.total_cents,
      accesCamion: adresse.truckAccess ? String(adresse.truckAccess) : null,
      contraintesAcces: adresse.accessNotes ? String(adresse.accessNotes) : null,
      livraisonSansPresence: adresse.allowUnattendedDelivery === true,
      typeDechargement: adresse.unloadType ? String(adresse.unloadType) : null,
      notesClient: o.delivery_notes,
      notesInternes: o.internal_notes,
      creneau: o.confirmed_slot_label,
    };
  });

  return {
    date,
    arrets,
    volumeTotalM3: Math.round(arrets.reduce((s, a) => s + a.volumeM3, 0) * 1000) / 1000,
    aEncaisserCents: arrets.reduce((s, a) => s + a.resteAPayerCents, 0),
    especesCents: arrets
      .filter((a) => a.modePaiement === "cash")
      .reduce((s, a) => s + a.resteAPayerCents, 0),
    vehicules: [
      ...new Set(
        (data ?? [])
          .map((o) => (o.vehicles as unknown as { name: string } | null)?.name)
          .filter((n): n is string => Boolean(n)),
      ),
    ],
  };
}

/**
 * Lien d'itinéraire multi-étapes.
 * On utilise l'adresse en texte : les coordonnées GPS ne sont pas encore
 * géocodées, et Google Maps résout très bien une adresse française complète.
 */
export function lienTourneeComplete(arrets: ArretTournee[]): string | null {
  if (arrets.length === 0) return null;
  const points = arrets.map((a) =>
    encodeURIComponent(`${a.adresse}, ${a.codePostal} ${a.ville}, France`),
  );
  const destination = points.at(-1)!;
  const etapes = points.slice(0, -1);
  const waypoints = etapes.length > 0 ? `&waypoints=${etapes.join("|")}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}${waypoints}&travelmode=driving`;
}

export function lienItineraire(
  arret: ArretTournee,
  application: "google" | "waze" | "apple",
): string {
  const adresse = `${arret.adresse}, ${arret.codePostal} ${arret.ville}, France`;
  const encodee = encodeURIComponent(adresse);

  switch (application) {
    case "waze":
      return `https://waze.com/ul?q=${encodee}&navigate=yes`;
    case "apple":
      return `https://maps.apple.com/?daddr=${encodee}&dirflg=d`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${encodee}&travelmode=driving`;
  }
}
