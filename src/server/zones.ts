import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DeliveryZone, Vehicle } from "@/domain/delivery";

/**
 * Résolution de zone de livraison — docs/02-MOTEURS-METIER.md §2.1
 *
 * Point UX critique : ce contrôle intervient DÈS LE PANIER, jamais au paiement.
 * Un client qui découvre à la dernière étape qu'on ne le livre pas est un client
 * perdu et énervé.
 */

export interface CommuneResolue {
  postalCode: string;
  city: string;
  distanceKm: number | null;
  deliveryDays: number[] | null;
  isServed: boolean;
  zone: DeliveryZone | null;
}

export type ResolutionZone =
  /** Une seule commune correspond : on a tout ce qu'il faut. */
  | { status: "ok"; commune: CommuneResolue; zone: DeliveryZone }
  /** Le code postal couvre plusieurs communes : il faut demander laquelle. */
  | { status: "ambiguous"; choix: { postalCode: string; city: string }[] }
  /** Commune connue mais hors secteur → bascule vers le devis. */
  | { status: "not_served"; commune: CommuneResolue }
  /** Code postal inconnu → bascule vers le devis. */
  | { status: "unknown"; postalCode: string };

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
  if (lignes.length === 0) return { status: "unknown", postalCode };

  // Plusieurs communes partagent souvent un code postal : on demande laquelle,
  // plutôt que de deviner et de facturer la mauvaise distance.
  let ligne = lignes[0];
  if (lignes.length > 1) {
    const correspondance = city
      ? lignes.find((l) => l.city.toLowerCase() === city.trim().toLowerCase())
      : undefined;
    if (!correspondance) {
      return {
        status: "ambiguous",
        choix: lignes.map((l) => ({ postalCode: l.postal_code, city: l.city })),
      };
    }
    ligne = correspondance;
  }

  const zoneRow = ligne.delivery_zones as unknown as ZoneRow | null;
  const commune: CommuneResolue = {
    postalCode: ligne.postal_code,
    city: ligne.city,
    distanceKm: ligne.distance_km === null ? null : Number(ligne.distance_km),
    deliveryDays: ligne.delivery_days,
    isServed: ligne.is_served,
    zone: zoneRow ? toZone(zoneRow) : null,
  };

  if (!ligne.is_served || !zoneRow || !zoneRow.is_active) {
    return { status: "not_served", commune };
  }

  return { status: "ok", commune, zone: toZone(zoneRow) };
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
