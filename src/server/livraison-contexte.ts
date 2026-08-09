import "server-only";

import type { DeliveryFeeSettings, DeliveryZone, FuelSettings, Vehicle } from "@/domain/delivery";
import { getCartId } from "./panier";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveZone, listVehicles } from "./zones";
import { getDeliveryFeeSettings, getFuelSettings } from "./reglages";
import type { Tenant } from "@/lib/tenant";

/**
 * Contexte de calcul des frais de livraison, transmis au configurateur.
 *
 * Pourquoi envoyer ces paramètres au navigateur : le panneau « Votre sélection »
 * doit afficher un total qui inclut la livraison, et ce total change à chaque
 * variation de quantité. Recalculer côté serveur à chaque clic serait lent.
 *
 * Ce n'est PAS une brèche : le client utilise EXACTEMENT la même fonction
 * `computeDeliveryFee` que le serveur, donc aucune divergence n'est possible, et
 * le montant est de toute façon recalculé côté serveur au panier puis avant
 * paiement (PLAN.md §5.1). Zones et véhicules sont déjà publics ; le prix du
 * gazole figure déjà sur les devis PDF.
 */
export interface ContexteLivraison {
  ville: string;
  distanceKm: number;
  zone: DeliveryZone;
  vehicules: Vehicle[];
  carburant: FuelSettings;
  reglages: DeliveryFeeSettings;
}

/**
 * Contexte de livraison déduit du panier en cours, s'il porte déjà un code
 * postal. Retourne `null` si le visiteur n'a rien renseigné — on n'invente pas
 * une commune par défaut.
 */
export async function getContexteLivraison(tenant: Tenant): Promise<ContexteLivraison | null> {
  const cartId = await getCartId();
  if (!cartId) return null;

  const { data: panier } = await createSupabaseAdminClient()
    .from("carts")
    .select("postal_code, city")
    .eq("id", cartId)
    .eq("company_id", tenant.id)
    .maybeSingle();

  if (!panier?.postal_code) return null;

  const resolution = await resolveZone(tenant.id, panier.postal_code, panier.city);
  if (resolution.status !== "ok") return null;

  const [vehicules, carburant, reglages] = await Promise.all([
    listVehicles(tenant.id),
    getFuelSettings(tenant.id, tenant.features.fuelSurcharge),
    getDeliveryFeeSettings(tenant.id),
  ]);

  return {
    ville: resolution.commune.city,
    distanceKm: resolution.commune.distanceKm ?? 0,
    zone: resolution.zone,
    vehicules,
    carburant,
    reglages,
  };
}
