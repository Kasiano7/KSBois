"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { uuidLike } from "@/lib/validation";
import { normaliserCodePostal, resolveZone, joursDeLivraison, listVehicles } from "@/server/zones";
import { getDeliveryFeeSettings, getFuelSettings, getOrderSettings } from "@/server/reglages";
import { computeDeliveryFee, computeFuelSurchargeDetail, selectVehicle } from "@/domain/delivery";
import { formatJoursLivraison } from "@/lib/jours";
import { formatEuros, formatVolume } from "@/domain/units";

/**
 * Configuration des zones de livraison — docs/05-ADMIN.md §6.1
 *
 * Ces réglages décident de ce que chaque client paiera. Ils sont donc réservés
 * au gérant, et chaque modification est journalisée.
 */

export interface ResultatZone {
  ok: boolean;
  message?: string;
}

/** Euros saisis (« 15 », « 15,50 ») → centimes entiers. */
const EurosOptionnels = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  })
  .refine((c) => c === null || (c >= 0 && c <= 100_000), "Montant hors limites.");

const EurosRequis = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
  })
  .refine((c) => Number.isFinite(c) && c >= 0 && c <= 100_000, "Montant invalide.");

const ZoneSchema = z.object({
  zoneId: uuidLike,
  nom: z.string().trim().min(2, "Indiquez un nom de zone.").max(80),
  baseFeeEuros: EurosRequis,
  feePerM3Euros: EurosRequis,
  freeAboveEuros: EurosOptionnels,
  minOrderVolumeM3: z.coerce.number().min(0).max(999),
  distanceKmEstimate: z.coerce.number().int().min(0).max(500).nullable().optional(),
  joursLivraison: z.array(z.coerce.number().int().min(1).max(7)).max(7),
  active: z.coerce.boolean().default(true),
});

export async function modifierZone(entree: unknown): Promise<ResultatZone> {
  const session = await assertRole(["owner"]);
  const parsed = ZoneSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const d = parsed.data;
  const supabase = createSupabaseAdminClient();

  const { data: avant } = await supabase
    .from("delivery_zones")
    .select("*")
    .eq("id", d.zoneId)
    .eq("company_id", session.companyId)
    .maybeSingle();

  if (!avant) return { ok: false, message: "Zone introuvable." };

  const { error } = await supabase
    .from("delivery_zones")
    .update({
      name: d.nom,
      base_fee_cents: d.baseFeeEuros,
      fee_per_m3_cents: d.feePerM3Euros,
      free_above_cents: d.freeAboveEuros,
      min_order_volume_m3: d.minOrderVolumeM3,
      distance_km_estimate: d.distanceKmEstimate ?? null,
      // Une zone sans jour de livraison ne proposerait aucun créneau : on
      // retombe sur la semaine complète plutôt que de bloquer les commandes.
      delivery_days: d.joursLivraison.length > 0 ? d.joursLivraison : [1, 2, 3, 4, 5],
      is_active: d.active,
    })
    .eq("id", d.zoneId);

  if (error) {
    console.error("[zones] modifierZone :", error.message);
    return { ok: false, message: "Enregistrement impossible." };
  }

  await supabase.from("audit_log").insert({
    company_id: session.companyId,
    actor_id: session.userId,
    actor_role: session.role,
    action: "zone.updated",
    entity_type: "delivery_zone",
    entity_id: d.zoneId,
    before: {
      base_fee_cents: avant.base_fee_cents,
      fee_per_m3_cents: avant.fee_per_m3_cents,
      free_above_cents: avant.free_above_cents,
    },
    after: {
      base_fee_cents: d.baseFeeEuros,
      fee_per_m3_cents: d.feePerM3Euros,
      free_above_cents: d.freeAboveEuros,
    },
  });

  revalidatePath("/admin/livraison/zones");
  revalidatePath("/");
  return { ok: true };
}

export async function creerZone(entree: unknown): Promise<ResultatZone> {
  const session = await assertRole(["owner"]);
  const parsed = z
    .object({
      nom: z.string().trim().min(2, "Indiquez un nom de zone.").max(80),
      baseFeeEuros: EurosRequis,
      distanceKmEstimate: z.coerce.number().int().min(0).max(500).optional(),
    })
    .safeParse(entree);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: derniere } = await supabase
    .from("delivery_zones")
    .select("sort_order")
    .eq("company_id", session.companyId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("delivery_zones").insert({
    company_id: session.companyId,
    name: parsed.data.nom,
    base_fee_cents: parsed.data.baseFeeEuros,
    fee_per_m3_cents: 0,
    distance_km_estimate: parsed.data.distanceKmEstimate ?? null,
    delivery_days: [1, 2, 3, 4, 5],
    sort_order: (derniere?.sort_order ?? 0) + 1,
  });

  if (error) {
    console.error("[zones] creerZone :", error.message);
    return { ok: false, message: "Création impossible." };
  }

  revalidatePath("/admin/livraison/zones");
  return { ok: true };
}

const AffectationSchema = z.object({
  communeIds: z.array(uuidLike).min(1, "Sélectionnez au moins une commune.").max(500),
  /** `null` = commune connue mais non desservie (bascule vers le devis). */
  zoneId: uuidLike.nullable(),
});

/** Affectation en masse : c'est le geste le plus fréquent de cet écran. */
export async function affecterCommunes(entree: unknown): Promise<ResultatZone> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = AffectationSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const { error } = await createSupabaseAdminClient()
    .from("zone_communes")
    .update({ zone_id: parsed.data.zoneId, is_served: parsed.data.zoneId !== null })
    .in("id", parsed.data.communeIds)
    .eq("company_id", session.companyId);

  if (error) {
    console.error("[zones] affecterCommunes :", error.message);
    return { ok: false, message: "Affectation impossible." };
  }

  revalidatePath("/admin/livraison/zones");
  revalidatePath("/");
  return { ok: true };
}

const CommuneSchema = z.object({
  communeId: uuidLike,
  distanceKm: z.coerce.number().min(0).max(500).nullable().optional(),
  joursLivraison: z.array(z.coerce.number().int().min(1).max(7)).max(7).optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function modifierCommune(entree: unknown): Promise<ResultatZone> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = CommuneSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const d = parsed.data;
  const { error } = await createSupabaseAdminClient()
    .from("zone_communes")
    .update({
      distance_km: d.distanceKm ?? null,
      // Tableau vide = pas de surcharge : la commune suit les jours de sa zone.
      delivery_days: d.joursLivraison && d.joursLivraison.length > 0 ? d.joursLivraison : null,
      notes: d.notes ?? null,
    })
    .eq("id", d.communeId)
    .eq("company_id", session.companyId);

  if (error) return { ok: false, message: "Enregistrement impossible." };

  revalidatePath("/admin/livraison/zones");
  revalidatePath("/");
  return { ok: true };
}

const AjoutCommuneSchema = z.object({
  codePostal: z
    .string()
    .trim()
    .transform(normaliserCodePostal)
    .refine((v) => /^\d{5}$/.test(v), "Le code postal doit contenir 5 chiffres."),
  ville: z.string().trim().min(1, "Indiquez la commune.").max(120),
  distanceKm: z.coerce.number().min(0).max(500),
  zoneId: uuidLike.nullable(),
});

export async function ajouterCommune(entree: unknown): Promise<ResultatZone> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = AjoutCommuneSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const d = parsed.data;
  const { error } = await createSupabaseAdminClient().from("zone_communes").insert({
    company_id: session.companyId,
    postal_code: d.codePostal,
    city: d.ville,
    distance_km: d.distanceKm,
    zone_id: d.zoneId,
    is_served: d.zoneId !== null,
  });

  if (error) {
    return {
      ok: false,
      message: error.message.includes("duplicate")
        ? `${d.ville} (${d.codePostal}) est déjà dans la liste.`
        : "Ajout impossible.",
    };
  }

  revalidatePath("/admin/livraison/zones");
  revalidatePath("/");
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Simulateur « Tester une adresse »
// -----------------------------------------------------------------------------

export interface ResultatTest {
  ok: boolean;
  message?: string;
  detail?: {
    commune: string;
    zone: string;
    distanceKm: number;
    vehicule: string;
    baseCents: number;
    volumeCents: number;
    carburantCents: number;
    /** Vrai quand le plafond de sécurité a rogné la surcharge carburant. */
    carburantPlafonne: boolean;
    carburantBrutCents: number;
    litres: number;
    totalCents: number;
    offerte: boolean;
    jours: string;
    delaiJours: number;
    minimumAtteint: boolean;
    minimumVolumeM3: number;
    prixGazoleCents: number;
  };
}

/**
 * Reproduit EXACTEMENT ce que verrait un client, avec le détail du calcul.
 *
 * C'est l'outil qui donne confiance à l'exploitant : sans lui, il ne peut pas
 * vérifier sa propre grille tarifaire et n'utilisera pas l'écran (docs/05 §6.1).
 */
export async function testerAdresse(entree: unknown): Promise<ResultatTest> {
  await assertRole(["owner", "staff"]);
  const tenant = await requireTenant();

  const parsed = z
    .object({
      codePostal: z
        .string()
        .trim()
        .transform(normaliserCodePostal)
        .refine((v) => /^\d{5}$/.test(v), "Code postal invalide."),
      ville: z.string().trim().max(120).optional().nullable(),
      volumeM3: z.coerce.number().positive("Indiquez un volume.").max(200),
    })
    .safeParse(entree);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const { codePostal, ville, volumeM3 } = parsed.data;
  const resolution = await resolveZone(tenant.id, codePostal, ville);

  if (resolution.status === "unknown") {
    return {
      ok: false,
      message:
        resolution.raison === "inexistant"
          ? `Le code postal ${codePostal} n'existe pas en France.`
          : `Impossible de vérifier ${codePostal} : la base officielle des communes n'a pas répondu.`,
    };
  }
  if (resolution.status === "ambiguous") {
    return {
      ok: false,
      message: `Plusieurs communes portent ce code postal : ${resolution.choix
        .map((c) => c.city)
        .join(", ")}. Précisez laquelle.`,
    };
  }
  if (resolution.status === "not_served") {
    return {
      ok: false,
      // On distingue les deux cas : « pas encore ajoutée » se règle en un clic
      // avec le scan de secteur, « marquée non desservie » est une décision.
      message:
        resolution.commune.origine === "france"
          ? `${resolution.commune.city} n'est pas dans votre liste (environ ${resolution.commune.distanceKm ?? "?"} km). Le client verra « nous ne livrons pas encore ${resolution.commune.city} » et sera orienté vers le devis.`
          : `${resolution.commune.city} est marquée non desservie : le client sera orienté vers le formulaire de devis.`,
    };
  }

  const { commune, zone } = resolution;
  const [carburant, reglagesFrais, vehicules, reglagesCommande] = await Promise.all([
    getFuelSettings(tenant.id, tenant.features.fuelSurcharge),
    getDeliveryFeeSettings(tenant.id),
    listVehicles(tenant.id),
    getOrderSettings(tenant.id),
  ]);

  const distanceKm = commune.distanceKm ?? 0;
  const vehicule = selectVehicle(volumeM3, "camion", vehicules, distanceKm);

  if (!vehicule) {
    return {
      ok: false,
      message: `Aucun véhicule ne peut emporter ${formatVolume(volumeM3)} : le client sera orienté vers un devis.`,
    };
  }

  // Sous-total estimé au prix moyen du catalogue, pour éprouver le seuil de
  // gratuité de façon réaliste.
  const sousTotalEstime = Math.round(volumeM3 * 10_400);
  const devis = computeDeliveryFee({
    zone,
    vehicle: vehicule,
    distanceKm,
    volumeM3,
    subtotalCents: sousTotalEstime,
    fuel: carburant,
    settings: reglagesFrais,
  });

  if (devis.status !== "ok") {
    return {
      ok: false,
      message: `Les frais atteindraient ${formatEuros(devis.estimatedCents)}, au-dessus de votre plafond : le client sera orienté vers un devis.`,
    };
  }

  const minimumVolume = Math.max(zone.minOrderVolumeM3, reglagesCommande.minVolumeM3);
  // Détail du carburant, pour signaler un éventuel plafonnement.
  const carburantDetail = computeFuelSurchargeDetail(distanceKm, vehicule, carburant);

  return {
    ok: true,
    detail: {
      commune: commune.city,
      zone: zone.name,
      distanceKm,
      vehicule: vehicule.name,
      baseCents: devis.baseCents,
      volumeCents: devis.volumeCents,
      carburantCents: devis.fuelCents,
      carburantPlafonne: carburantDetail.capped,
      carburantBrutCents: carburantDetail.rawCents,
      litres: carburantDetail.liters,
      totalCents: devis.totalCents,
      offerte: devis.isFree,
      jours: formatJoursLivraison(joursDeLivraison(commune, zone)),
      delaiJours: zone.leadTimeDays ?? reglagesCommande.leadTimeDays,
      minimumAtteint: volumeM3 >= minimumVolume,
      minimumVolumeM3: minimumVolume,
      prixGazoleCents: carburant.pricePerLiterCents,
    },
  };
}
