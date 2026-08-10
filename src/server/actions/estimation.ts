"use server";

import { z } from "zod";
import { requireTenant } from "@/lib/tenant";
import { getCartId } from "@/server/panier";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { normaliserCodePostal, resolveZone, joursDeLivraison, listVehicles } from "@/server/zones";
import { getDeliveryFeeSettings, getFuelSettings, getOrderSettings } from "@/server/reglages";
import { computeDeliveryFee, selectVehicle } from "@/domain/delivery";
import { formatJoursLivraison } from "@/lib/jours";

/**
 * Estimation de livraison depuis l'accueil — docs/03 §6.1
 *
 * « Est-ce que vous livrez chez moi ? » est la première question du visiteur.
 * Elle est donc traitée au-dessus de la ligne de flottaison, sans obliger à
 * remplir un panier.
 *
 * Volontairement SANS EFFET DE BORD : un visiteur qui vérifie sa commune ne doit
 * pas voir un panier se créer. Si un panier existe déjà, on y enregistre le code
 * postal pour éviter une double saisie au moment de commander.
 */

/** Volume de référence de l'estimation : la commande la plus courante. */
const VOLUME_REFERENCE_M3 = 3;

export type ResultatEstimation =
  | {
      statut: "livree";
      ville: string;
      distanceKm: number | null;
      fraisCents: number;
      offerte: boolean;
      jours: string;
      delaiJours: number;
      volumeReference: number;
      minimumVolumeM3: number;
    }
  | { statut: "ambigu"; choix: { postalCode: string; city: string }[] }
  | { statut: "hors_zone"; ville: string; distanceKm: number | null }
  /**
   * Aucune commune n'a pu être nommée. `raison` distingue le code postal qui
   * n'existe pas de notre source momentanément muette : les deux appellent des
   * phrases très différentes côté client.
   */
  | { statut: "inconnu"; codePostal: string; raison: "inexistant" | "source_indisponible" }
  | { statut: "sur_devis" }
  | { statut: "erreur"; message: string };

const Schema = z.object({
  postalCode: z
    .string()
    .trim()
    .transform(normaliserCodePostal)
    .refine((v) => /^\d{5}$/.test(v), "Le code postal doit contenir 5 chiffres."),
  city: z.string().trim().max(120).optional().nullable(),
});

export async function estimerLivraison(entree: unknown): Promise<ResultatEstimation> {
  const parsed = Schema.safeParse(entree);
  if (!parsed.success) {
    return {
      statut: "erreur",
      message: parsed.error.issues[0]?.message ?? "Code postal invalide.",
    };
  }

  const tenant = await requireTenant();
  const resolution = await resolveZone(tenant.id, parsed.data.postalCode, parsed.data.city);

  if (resolution.status === "ambiguous") {
    return { statut: "ambigu", choix: resolution.choix };
  }
  if (resolution.status === "unknown") {
    return { statut: "inconnu", codePostal: parsed.data.postalCode, raison: resolution.raison };
  }
  if (resolution.status === "not_served") {
    return {
      statut: "hors_zone",
      ville: resolution.commune.city,
      distanceKm: resolution.commune.distanceKm,
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
  const vehicule = selectVehicle(VOLUME_REFERENCE_M3, "camion", vehicules, distanceKm);
  if (!vehicule) return { statut: "sur_devis" };

  const devis = computeDeliveryFee({
    zone,
    vehicle: vehicule,
    distanceKm,
    volumeM3: VOLUME_REFERENCE_M3,
    // Sous-total nul : on ne connaît pas encore la commande, donc aucun seuil de
    // gratuité ne s'applique. L'estimation est ainsi un PLANCHER honnête.
    subtotalCents: 0,
    fuel: carburant,
    settings: reglagesFrais,
  });

  if (devis.status !== "ok") return { statut: "sur_devis" };

  // Si le visiteur a déjà un panier, on lui évite de resaisir son code postal.
  const cartId = await getCartId();
  if (cartId) {
    await createSupabaseAdminClient()
      .from("carts")
      .update({ postal_code: commune.postalCode, city: commune.city })
      .eq("id", cartId)
      .eq("company_id", tenant.id);
  }

  return {
    statut: "livree",
    ville: commune.city,
    distanceKm: commune.distanceKm,
    fraisCents: devis.totalCents,
    offerte: devis.totalCents === 0,
    jours: formatJoursLivraison(joursDeLivraison(commune, zone)),
    delaiJours: zone.leadTimeDays ?? reglagesCommande.leadTimeDays,
    volumeReference: VOLUME_REFERENCE_M3,
    minimumVolumeM3: Math.max(zone.minOrderVolumeM3, reglagesCommande.minVolumeM3),
  };
}
