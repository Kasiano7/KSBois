import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Lectures de l'écran zones — docs/05-ADMIN.md §6.1
 *
 * C'est l'écran d'administration le plus important à soigner : c'est lui qui
 * décide ce que chaque client paiera pour être livré. Deux vues du même objet :
 * les ZONES (la grille tarifaire) et les COMMUNES (l'affectation).
 */

export interface ZoneAdmin {
  id: string;
  nom: string;
  baseFeeCents: number;
  feePerM3Cents: number;
  freeAboveCents: number | null;
  minOrderAmountCents: number;
  minOrderVolumeM3: number;
  distanceKmEstimate: number | null;
  joursLivraison: number[];
  leadTimeDays: number | null;
  active: boolean;
  ordre: number;
  /** Nombre de communes rattachées : une zone vide ne sert à rien. */
  nbCommunes: number;
}

export interface CommuneAdmin {
  id: string;
  codePostal: string;
  ville: string;
  distanceKm: number | null;
  /** Une distance estimée doit se voir : c'est elle qui facture le carburant. */
  sourceDistance: "manuelle" | "route" | "vol_oiseau";
  zoneId: string | null;
  zoneNom: string | null;
  joursLivraison: number[] | null;
  desservie: boolean;
  notes: string | null;
}

export interface SecteurAdmin {
  /** Rayon de service en kilomètres de route. */
  rayonKm: number;
  dernierScan: string | null;
  /** Sans point de départ, aucun rayon n'a de sens. */
  depotRenseigne: boolean;
  adresse: string | null;
}

/** Réglages du secteur, pour l'écran « Communes autour du dépôt ». */
export async function lireSecteur(companyId: string): Promise<SecteurAdmin> {
  const { data } = await createSupabaseAdminClient()
    .from("companies")
    .select("service_radius_km, sector_scanned_at, depot_lat, depot_lng, address_line1, postal_code, city")
    .eq("id", companyId)
    .maybeSingle();

  const adresse = [data?.address_line1, data?.postal_code, data?.city]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    rayonKm: data?.service_radius_km ?? 25,
    dernierScan: data?.sector_scanned_at ?? null,
    // Les coordonnées manquantes ne bloquent pas : elles seront déduites de
    // l'adresse au premier scan. Sans adresse NI coordonnées, en revanche,
    // l'écran doit le dire avant que l'exploitant ne clique pour rien.
    depotRenseigne:
      (data?.depot_lat !== null && data?.depot_lng !== null) || adresse.length > 0,
    adresse: adresse || null,
  };
}

/**
 * Relevés de carburant à afficher : le prix en vigueur et les relevés refusés
 * récents, que l'exploitant doit pouvoir accepter ou ignorer en connaissance de
 * cause (docs/02 §2.4).
 */
export async function listerRelevesCarburant(companyId: string) {
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("fuel_prices")
    .select(
      "id, price_per_liter_cents, source, applied, rejected_reason, sample_size, department, recorded_at",
    )
    .eq("company_id", companyId)
    .order("recorded_at", { ascending: false })
    .limit(20);

  const releves = (data ?? []).map((r) => ({
    id: r.id,
    prixCents: r.price_per_liter_cents,
    source: r.source,
    applique: r.applied,
    motifRefus: r.rejected_reason,
    stations: r.sample_size,
    departement: r.department,
    date: r.recorded_at,
  }));

  const enVigueur = releves.find((r) => r.applique) ?? null;

  return {
    enVigueur,
    /**
     * Âge du relevé en jours, calculé ICI et non dans le composant : appeler
     * `Date.now()` pendant le rendu est impur et peut faire diverger le HTML
     * serveur du HTML client.
     */
    ageJours: enVigueur
      ? Math.floor((Date.now() - new Date(enVigueur.date).getTime()) / 86_400_000)
      : null,
    // Uniquement les refus POSTÉRIEURS au prix en vigueur : un refus antérieur
    // est de l'histoire ancienne, pas une décision en attente.
    refuses: releves.filter(
      (r) => !r.applique && (!enVigueur || new Date(r.date) > new Date(enVigueur.date)),
    ),
  };
}

export async function listerZones(companyId: string): Promise<ZoneAdmin[]> {
  const supabase = createSupabaseAdminClient();

  const [{ data: zones, error }, { data: communes }] = await Promise.all([
    supabase
      .from("delivery_zones")
      .select(
        `id, name, base_fee_cents, fee_per_m3_cents, free_above_cents,
         min_order_amount_cents, min_order_volume_m3, distance_km_estimate,
         delivery_days, lead_time_days, is_active, sort_order`,
      )
      .eq("company_id", companyId)
      .order("sort_order"),
    supabase.from("zone_communes").select("zone_id").eq("company_id", companyId),
  ]);

  if (error) {
    console.error("[zones] listerZones :", error.message);
    return [];
  }

  const parZone = new Map<string, number>();
  for (const c of communes ?? []) {
    if (c.zone_id) parZone.set(c.zone_id, (parZone.get(c.zone_id) ?? 0) + 1);
  }

  return (zones ?? []).map((z) => ({
    id: z.id,
    nom: z.name,
    baseFeeCents: z.base_fee_cents,
    feePerM3Cents: z.fee_per_m3_cents,
    freeAboveCents: z.free_above_cents,
    minOrderAmountCents: z.min_order_amount_cents,
    minOrderVolumeM3: Number(z.min_order_volume_m3),
    distanceKmEstimate: z.distance_km_estimate,
    joursLivraison: z.delivery_days ?? [],
    leadTimeDays: z.lead_time_days,
    active: z.is_active,
    ordre: z.sort_order,
    nbCommunes: parZone.get(z.id) ?? 0,
  }));
}

export async function listerCommunes(companyId: string): Promise<CommuneAdmin[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("zone_communes")
    .select(
      `id, postal_code, city, distance_km, distance_source, zone_id, delivery_days,
       is_served, notes, delivery_zones ( name )`,
    )
    .eq("company_id", companyId)
    .order("distance_km", { nullsFirst: false })
    .order("city");

  if (error) {
    console.error("[zones] listerCommunes :", error.message);
    return [];
  }

  return (data ?? []).map((c) => ({
    id: c.id,
    codePostal: c.postal_code,
    ville: c.city,
    distanceKm: c.distance_km === null ? null : Number(c.distance_km),
    sourceDistance: (c.distance_source ?? "manuelle") as CommuneAdmin["sourceDistance"],
    zoneId: c.zone_id,
    zoneNom: (c.delivery_zones as unknown as { name: string } | null)?.name ?? null,
    joursLivraison: c.delivery_days,
    desservie: c.is_served,
    notes: c.notes,
  }));
}
