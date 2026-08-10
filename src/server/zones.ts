import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DeliveryZone, Vehicle } from "@/domain/delivery";
import { distanceVolOiseauKm, estimerDistanceRouteKm, memeCommune } from "@/domain/secteur";
import { communesParCodePostal, type CommuneOfficielle } from "@/server/geo-communes";

/**
 * Résolution de zone de livraison — docs/02-MOTEURS-METIER.md §2.1
 *
 * Point UX critique : ce contrôle intervient DÈS LE PANIER, jamais au paiement.
 * Un client qui découvre à la dernière étape qu'on ne le livre pas est un client
 * perdu et énervé.
 *
 * ⚠️ La liste de communes de l'exploitant ne fait PAS autorité sur la géographie
 * française. Un code postal absent de sa liste reste un code postal réel : on le
 * résout alors dans la base officielle pour pouvoir nommer la commune
 * (« nous ne livrons pas encore Peaugres — demandez un devis »). Répondre
 * « code postal inconnu » à un habitant de Peaugres se lit comme un bug du site,
 * et il s'en va au lieu de demander un devis.
 */

export interface CommuneResolue {
  postalCode: string;
  city: string;
  distanceKm: number | null;
  deliveryDays: number[] | null;
  isServed: boolean;
  zone: DeliveryZone | null;
  /**
   * `liste` = commune enregistrée par l'exploitant, distance mesurée.
   * `france` = commune reconnue dans la base officielle mais absente de sa
   * liste ; la distance n'est alors qu'un ordre de grandeur.
   */
  origine: "liste" | "france";
}

export type ResolutionZone =
  /** Une seule commune correspond : on a tout ce qu'il faut. */
  | { status: "ok"; commune: CommuneResolue; zone: DeliveryZone }
  /** Le code postal couvre plusieurs communes : il faut demander laquelle. */
  | { status: "ambiguous"; choix: { postalCode: string; city: string }[] }
  /** Commune identifiée mais hors secteur → bascule vers le devis. */
  | { status: "not_served"; commune: CommuneResolue }
  /**
   * Aucune commune n'a pu être nommée. `raison` compte : annoncer un code postal
   * inexistant alors que c'est notre source qui est muette ferait douter le
   * client de sa propre adresse.
   */
  | { status: "unknown"; postalCode: string; raison: "inexistant" | "source_indisponible" };

type ZoneRow = {
  id: string;
  name: string;
  base_fee_cents: number;
  fee_per_m3_cents: number;
  free_above_cents: number | null;
  min_order_amount_cents: number;
  min_order_volume_m3: number;
  delivery_days: number[];
  lead_time_days: number | null;
  is_active: boolean;
  distance_km_estimate: number | null;
};

function toZone(row: ZoneRow): DeliveryZone {
  return {
    id: row.id,
    name: row.name,
    baseFeeCents: row.base_fee_cents,
    feePerM3Cents: row.fee_per_m3_cents,
    freeAboveCents: row.free_above_cents,
    minOrderAmountCents: row.min_order_amount_cents,
    minOrderVolumeM3: Number(row.min_order_volume_m3),
    deliveryDays: row.delivery_days ?? [],
    leadTimeDays: row.lead_time_days,
    isActive: row.is_active,
  };
}

const ZONE_SELECT = `
  id, name, base_fee_cents, fee_per_m3_cents, free_above_cents,
  min_order_amount_cents, min_order_volume_m3, delivery_days, lead_time_days,
  is_active, distance_km_estimate
`;

/** Normalise une saisie utilisateur : « 07 690 » → « 07690 ». */
export function normaliserCodePostal(saisie: string): string {
  return saisie.replace(/\s+/g, "").slice(0, 5);
}

/**
 * Coordonnées du dépôt, pour situer une commune que l'exploitant n'a pas
 * enregistrée. `cache` : une seule lecture par requête.
 */
const lireDepot = cache(async (companyId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("companies")
    .select("depot_lat, depot_lng")
    .eq("id", companyId)
    .maybeSingle();

  if (!data || data.depot_lat === null || data.depot_lng === null) return null;
  return { lat: Number(data.depot_lat), lng: Number(data.depot_lng) };
});

/**
 * Commune reconnue dans la base officielle mais absente de la liste de
 * l'exploitant : hors secteur, avec une distance donnée à titre indicatif.
 *
 * La distance n'est PAS mesurée sur route ici — ce serait un appel réseau de
 * plus pendant qu'un client attend. Elle sert uniquement à écrire « à environ
 * 60 km », ce qui aide le client à comprendre le refus. Aucun montant n'est
 * calculé à partir d'elle : hors secteur, il n'y a pas de tarif, il y a un devis.
 */
async function horsSecteur(
  companyId: string,
  postalCode: string,
  officielle: CommuneOfficielle,
): Promise<ResolutionZone> {
  const depot = await lireDepot(companyId);
  return {
    status: "not_served",
    commune: {
      postalCode,
      city: officielle.nom,
      distanceKm: depot
        ? Math.round(estimerDistanceRouteKm(distanceVolOiseauKm(depot, officielle)))
        : null,
      deliveryDays: null,
      isServed: false,
      zone: null,
      origine: "france",
    },
  };
}

export async function resolveZone(
  companyId: string,
  postalCodeSaisi: string,
  city?: string | null,
): Promise<ResolutionZone> {
  const postalCode = normaliserCodePostal(postalCodeSaisi);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("zone_communes")
    .select(
      `postal_code, city, distance_km, delivery_days, is_served,
       delivery_zones ( ${ZONE_SELECT} )`,
    )
    .eq("company_id", companyId)
    .eq("postal_code", postalCode)
    .order("city");

  if (error) console.error("[zones] lecture zone_communes :", error.message);

  const lignes = data ?? [];

  const resoudre = (ligne: (typeof lignes)[number]): ResolutionZone => {
    const zoneRow = ligne.delivery_zones as unknown as ZoneRow | null;
    const commune: CommuneResolue = {
      postalCode: ligne.postal_code,
      city: ligne.city,
      distanceKm: ligne.distance_km === null ? null : Number(ligne.distance_km),
      deliveryDays: ligne.delivery_days,
      isServed: ligne.is_served,
      zone: zoneRow ? toZone(zoneRow) : null,
      origine: "liste",
    };

    if (!ligne.is_served || !zoneRow || !zoneRow.is_active) {
      return { status: "not_served", commune };
    }
    return { status: "ok", commune, zone: toZone(zoneRow) };
  };

  // Chemin rapide, et de loin le plus fréquent : la commune est désignée et
  // figure dans la liste. Aucun appel réseau.
  if (city) {
    const exacte = lignes.find((l) => memeCommune(l.city, city));
    if (exacte) return resoudre(exacte);
  }

  // Sinon, on consulte la base officielle. Elle seule sait qu'un code postal
  // couvre seize communes quand l'exploitant n'en a enregistré qu'une : sans
  // elle, on attribuerait la distance de Serrières à un habitant de Peaugres.
  const officielles = await communesParCodePostal(postalCode);

  if (officielles === null) {
    // Source injoignable : on se rabat sur la liste locale, sans jamais
    // prétendre que le code postal n'existe pas.
    if (lignes.length === 1) return resoudre(lignes[0]);
    if (lignes.length > 1) {
      return {
        status: "ambiguous",
        choix: lignes.map((l) => ({ postalCode: l.postal_code, city: l.city })),
      };
    }
    return { status: "unknown", postalCode, raison: "source_indisponible" };
  }

  if (officielles.length === 0 && lignes.length === 0) {
    return { status: "unknown", postalCode, raison: "inexistant" };
  }

  if (city) {
    const officielle = officielles.find((o) => memeCommune(o.nom, city));
    if (officielle) return horsSecteur(companyId, postalCode, officielle);
  }

  // Toutes les communes du code postal, celles de la liste et les autres :
  // le client doit pouvoir se reconnaître même si on ne le livre pas encore.
  const choix = [
    ...lignes.map((l) => l.city),
    ...officielles.map((o) => o.nom),
  ].reduce<string[]>((acc, nom) => {
    if (!acc.some((existant) => memeCommune(existant, nom))) acc.push(nom);
    return acc;
  }, []);

  if (choix.length > 1) {
    return {
      status: "ambiguous",
      choix: choix
        .sort((a, b) => a.localeCompare(b, "fr"))
        .map((nom) => ({ postalCode, city: nom })),
    };
  }

  if (lignes.length === 1) return resoudre(lignes[0]);
  if (officielles.length === 1) return horsSecteur(companyId, postalCode, officielles[0]);

  return { status: "unknown", postalCode, raison: "inexistant" };
}

/** Jours de livraison effectifs : la commune surcharge la zone. */
export function joursDeLivraison(commune: CommuneResolue, zone: DeliveryZone): number[] {
  return commune.deliveryDays?.length ? commune.deliveryDays : zone.deliveryDays;
}

export const listVehicles = cache(async (companyId: string): Promise<Vehicle[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select(
      `id, name, vehicle_type, capacity_m3, fuel_consumption_l_per_100km,
       cost_per_km_cents, max_distance_km, is_active`,
    )
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("capacity_m3");

  if (error) {
    console.error("[zones] lecture vehicles :", error.message);
    return [];
  }

  return (data ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    vehicleType: v.vehicle_type as Vehicle["vehicleType"],
    capacityM3: Number(v.capacity_m3),
    fuelConsumptionLPer100km: Number(v.fuel_consumption_l_per_100km),
    costPerKmCents: v.cost_per_km_cents,
    maxDistanceKm: v.max_distance_km,
    isActive: v.is_active,
  }));
});

/** Liste publique des communes desservies — sert la page /livraison et le SEO. */
export const listCommunesDesservies = cache(async (companyId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("zone_communes")
    .select(`postal_code, city, distance_km, delivery_days, is_served,
             delivery_zones ( id, name, base_fee_cents, delivery_days )`)
    .eq("company_id", companyId)
    .eq("is_served", true)
    .order("distance_km");

  return data ?? [];
});
