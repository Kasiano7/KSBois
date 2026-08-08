import "server-only";

import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { DeliveryFeeSettings, FuelSettings } from "@/domain/delivery";

/**
 * Réglages de l'entreprise.
 *
 * ⚠️ `company_settings` contient des valeurs exploitables par un attaquant
 * (plafond espèces, seuils d'acompte). Elle n'est lisible que par le client
 * d'administration, côté serveur — `anon` n'a aucun privilège dessus
 * (docs/01 §4.0). Ces fonctions ne doivent jamais renvoyer l'objet complet à un
 * composant client : uniquement les valeurs nécessaires à l'affichage.
 */

export interface OrderSettings {
  leadTimeDays: number;
  bookingHorizonDays: number;
  minAmountCents: number;
  minVolumeM3: number;
}

export interface PaymentSettings {
  cashLimitCents: number;
  depositPercent: number;
  depositTriggerVolumeM3: number;
  depositTriggerKm: number;
}

const DEFAUTS = {
  "order.lead_time_days": 3,
  "order.booking_horizon_days": 45,
  "order.min_amount_cents": 0,
  "order.min_volume_m3": 1,
  "payment.cash_limit_cents": 100_000,
  "payment.deposit_percent": 30,
  "payment.deposit_trigger_volume_m3": 10,
  "payment.deposit_trigger_km": 45,
  "delivery.rounding_step_cents": 50,
  "delivery.max_fee_cents": 15_000,
  "fuel.margin_coefficient": 1,
  "fuel.max_surcharge_cents": 3_000,
  "fuel.fallback_price_cents": 175,
} as const;

type CleReglage = keyof typeof DEFAUTS;

/** Charge tous les réglages en une requête, avec repli sur les défauts. */
export const getSettings = cache(async (companyId: string): Promise<Record<string, number>> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("company_settings")
    .select("key, value")
    .eq("company_id", companyId);

  if (error) console.error("[reglages] lecture company_settings :", error.message);

  const valeurs: Record<string, number> = { ...DEFAUTS };
  for (const ligne of data ?? []) {
    const brut = ligne.value;
    const nombre = typeof brut === "number" ? brut : Number(brut);
    if (Number.isFinite(nombre)) valeurs[ligne.key] = nombre;
  }
  return valeurs;
});

function lire(valeurs: Record<string, number>, cle: CleReglage): number {
  return valeurs[cle] ?? DEFAUTS[cle];
}

export async function getOrderSettings(companyId: string): Promise<OrderSettings> {
  const v = await getSettings(companyId);
  return {
    leadTimeDays: lire(v, "order.lead_time_days"),
    bookingHorizonDays: lire(v, "order.booking_horizon_days"),
    minAmountCents: lire(v, "order.min_amount_cents"),
    minVolumeM3: lire(v, "order.min_volume_m3"),
  };
}

export async function getPaymentSettings(companyId: string): Promise<PaymentSettings> {
  const v = await getSettings(companyId);
  return {
    cashLimitCents: lire(v, "payment.cash_limit_cents"),
    depositPercent: lire(v, "payment.deposit_percent"),
    depositTriggerVolumeM3: lire(v, "payment.deposit_trigger_volume_m3"),
    depositTriggerKm: lire(v, "payment.deposit_trigger_km"),
  };
}

export async function getDeliveryFeeSettings(companyId: string): Promise<DeliveryFeeSettings> {
  const v = await getSettings(companyId);
  return {
    roundingStepCents: lire(v, "delivery.rounding_step_cents"),
    maxFeeCents: lire(v, "delivery.max_fee_cents"),
  };
}

/**
 * Réglages carburant, avec le dernier prix relevé.
 *
 * Garde-fou : si aucun relevé n'a moins de 7 jours, on retombe sur le prix de
 * repli et on journalise. Un prix périmé fausserait tous les frais de port
 * (docs/02 §2.3).
 */
export async function getFuelSettings(
  companyId: string,
  fuelSurchargeEnabled: boolean,
): Promise<FuelSettings> {
  const [v, dernier] = await Promise.all([
    getSettings(companyId),
    getDernierPrixCarburant(companyId),
  ]);

  const repli = lire(v, "fuel.fallback_price_cents");
  let prix = repli;

  if (dernier) {
    const ageJours = (Date.now() - new Date(dernier.recordedAt).getTime()) / 86_400_000;
    if (ageJours <= 7) {
      prix = dernier.pricePerLiterCents;
    } else {
      console.warn(
        `[carburant] dernier relevé vieux de ${Math.round(ageJours)} jours — ` +
          `repli sur ${repli} centimes/L. Vérifier le cron.`,
      );
    }
  } else {
    console.warn("[carburant] aucun relevé en base — repli sur le prix par défaut.");
  }

  return {
    enabled: fuelSurchargeEnabled,
    pricePerLiterCents: prix,
    marginCoefficient: lire(v, "fuel.margin_coefficient"),
    maxSurchargeCents: lire(v, "fuel.max_surcharge_cents"),
  };
}

export const getDernierPrixCarburant = cache(
  async (
    companyId: string,
  ): Promise<{ pricePerLiterCents: number; recordedAt: string; source: string } | null> => {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("fuel_prices")
      .select("price_per_liter_cents, recorded_at, source")
      .eq("company_id", companyId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data
      ? {
          pricePerLiterCents: data.price_per_liter_cents,
          recordedAt: data.recorded_at,
          source: data.source,
        }
      : null;
  },
);
