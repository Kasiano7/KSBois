/**
 * Moteur de livraison — docs/02-MOTEURS-METIER.md §2
 *
 * frais = base_zone + (coef_m³ × volume) + surcharge_carburant
 *
 * Le calcul est intégralement serveur. Le client n'envoie jamais un montant,
 * seulement un code postal, une commune et des quantités.
 */

import type { Cents } from "../pricing";

/** Type d'accès déclaré par le client pour son adresse de livraison. */
export type TruckAccess = "spl" | "camion" | "fourgon" | "remorque_seule";

export type VehicleType = "spl" | "camion" | "fourgon" | "remorque";

export interface Vehicle {
  id: string;
  name: string;
  vehicleType: VehicleType;
  capacityM3: number;
  fuelConsumptionLPer100km: number;
  /** Coût fixe d'usure au kilomètre, hors carburant. Souvent 0 au démarrage. */
  costPerKmCents: Cents;
  maxDistanceKm: number | null;
  isActive: boolean;
}

export interface DeliveryZone {
  id: string;
  name: string;
  baseFeeCents: Cents;
  feePerM3Cents: Cents;
  freeAboveCents: Cents | null;
  minOrderAmountCents: Cents;
  minOrderVolumeM3: number;
  /** Jours ISO : 1 = lundi … 7 = dimanche. */
  deliveryDays: number[];
  leadTimeDays: number | null;
  isActive: boolean;
}

export interface FuelSettings {
  enabled: boolean;
  pricePerLiterCents: Cents;
  /** Coefficient de marge appliqué au coût carburant brut. 1.0 = coût réel. */
  marginCoefficient: number;
  /** Plafond ABSOLU de la surcharge, en centimes. Garde-fou anti-dérive d'API. */
  maxSurchargeCents: Cents;
}

export interface DeliveryFeeSettings {
  /** Pas d'arrondi supérieur, en centimes. 50 = arrondi aux 50 centimes. */
  roundingStepCents: number;
  /** Au-delà, on bascule vers une demande de devis plutôt que d'afficher un prix. */
  maxFeeCents: Cents;
}

/** Les véhicules trop gros pour l'accès déclaré sont exclus. */
const ACCESS_ALLOWS: Readonly<Record<TruckAccess, VehicleType[]>> = Object.freeze({
  spl: ["spl", "camion", "fourgon", "remorque"],
  camion: ["camion", "fourgon", "remorque"],
  fourgon: ["fourgon", "remorque"],
  remorque_seule: ["remorque"],
});

/**
 * Sélectionne le plus PETIT véhicule capable d'emporter le volume et autorisé
 * par les contraintes d'accès de l'adresse. C'est ce qui évite le camion qui
 * fait demi-tour dans un chemin de montagne.
 */
export function selectVehicle(
  volumeM3: number,
  access: TruckAccess,
  vehicles: Vehicle[],
  distanceKm = 0,
): Vehicle | null {
  const allowed = ACCESS_ALLOWS[access];

  const eligible = vehicles
    .filter(
      (v) =>
        v.isActive &&
        allowed.includes(v.vehicleType) &&
        v.capacityM3 >= volumeM3 &&
        (v.maxDistanceKm === null || v.maxDistanceKm >= distanceKm),
    )
    .sort((a, b) => a.capacityM3 - b.capacityM3);

  return eligible[0] ?? null;
}

export interface FuelSurchargeDetail {
  /** Montant réellement facturé, plafond appliqué. */
  cents: Cents;
  /** Montant avant plafonnement — utile pour l'expliquer à l'exploitant. */
  rawCents: Cents;
  /** Vrai quand le plafond a rogné le calcul. */
  capped: boolean;
  liters: number;
}

/**
 * Coût carburant d'un aller-retour, avec le détail du calcul.
 *
 * Garde-fous obligatoires : la surcharge est plafonnée en valeur absolue, et la
 * fonctionnalité peut être coupée. Sans cela, une dérive de l'API carburant peut
 * facturer des centaines d'euros de port.
 *
 * ⚠️ Le plafond doit être VISIBLE dans l'administration : sinon l'exploitant voit
 * un montant rond sans comprendre qu'il a été rogné, et il perd confiance dans
 * l'outil — ou pire, il ne s'en aperçoit pas et sous-facture ses livraisons
 * lointaines.
 */
export function computeFuelSurchargeDetail(
  distanceKm: number,
  vehicle: Vehicle,
  fuel: FuelSettings,
): FuelSurchargeDetail {
  if (!fuel.enabled || distanceKm <= 0) {
    return { cents: 0, rawCents: 0, capped: false, liters: 0 };
  }

  const roundTripKm = distanceKm * 2;
  const liters = (roundTripKm * vehicle.fuelConsumptionLPer100km) / 100;
  const fuelCost = liters * fuel.pricePerLiterCents * fuel.marginCoefficient;
  const wearCost = roundTripKm * vehicle.costPerKmCents;
  const rawCents = Math.round(fuelCost + wearCost);

  return {
    cents: Math.min(rawCents, fuel.maxSurchargeCents),
    rawCents,
    capped: rawCents > fuel.maxSurchargeCents,
    liters: Math.round(liters * 100) / 100,
  };
}

/** Montant seul. Conserve la signature d'origine pour les appelants existants. */
export function computeFuelSurcharge(
  distanceKm: number,
  vehicle: Vehicle,
  fuel: FuelSettings,
): Cents {
  return computeFuelSurchargeDetail(distanceKm, vehicle, fuel).cents;
}

/** Arrondi au pas supérieur (50 centimes par défaut). */
export function roundUpTo(cents: Cents, stepCents: number): Cents {
  if (stepCents <= 1) return Math.ceil(cents);
  return Math.ceil(cents / stepCents) * stepCents;
}

export interface DeliveryQuoteInput {
  zone: DeliveryZone;
  vehicle: Vehicle;
  distanceKm: number;
  volumeM3: number;
  subtotalCents: Cents;
  fuel: FuelSettings;
  settings: DeliveryFeeSettings;
  freeDeliveryPromotion?: boolean;
}

export type DeliveryQuote =
  | {
      status: "ok";
      baseCents: Cents;
      volumeCents: Cents;
      fuelCents: Cents;
      totalCents: Cents;
      isFree: boolean;
      freeReason: "seuil" | "promotion" | null;
    }
  | {
      /** Frais hors norme : on ne montre pas un prix, on propose un devis. */
      status: "requires_quote";
      reason: "fee_too_high";
      estimatedCents: Cents;
    };

/**
 * Calcule les frais de livraison d'une commande.
 *
 * L'ordre est important : on calcule TOUJOURS le montant complet avant de
 * l'annuler pour cause de gratuité, afin que le montant offert reste affichable
 * (« Livraison offerte — 18,50 € »), ce qui a une vraie valeur commerciale.
 */
export function computeDeliveryFee(input: DeliveryQuoteInput): DeliveryQuote {
  const { zone, vehicle, distanceKm, volumeM3, subtotalCents, fuel, settings } = input;

  const baseCents = zone.baseFeeCents;
  const volumeCents = Math.round(zone.feePerM3Cents * volumeM3);
  const fuelCents = computeFuelSurcharge(distanceKm, vehicle, fuel);

  const raw = baseCents + volumeCents + fuelCents;
  const rounded = roundUpTo(raw, settings.roundingStepCents);

  if (rounded > settings.maxFeeCents) {
    return { status: "requires_quote", reason: "fee_too_high", estimatedCents: rounded };
  }

  const freeByThreshold = zone.freeAboveCents !== null && subtotalCents >= zone.freeAboveCents;
  const freeByPromotion = input.freeDeliveryPromotion === true;
  const isFree = freeByThreshold || freeByPromotion;

  return {
    status: "ok",
    baseCents,
    volumeCents,
    fuelCents,
    totalCents: isFree ? 0 : rounded,
    isFree,
    freeReason: freeByPromotion ? "promotion" : freeByThreshold ? "seuil" : null,
  };
}

export type ZoneEligibility =
  | { status: "ok" }
  | { status: "below_min_amount"; missingCents: Cents }
  | { status: "below_min_volume"; missingM3: number };

/**
 * Vérifie les minimums de commande de la zone.
 *
 * Les messages produits à partir de ce résultat doivent toujours être
 * CONSTRUCTIFS : indiquer ce qui manque et proposer une action, jamais un
 * blocage sec (docs/02 §2.5).
 */
export function checkZoneEligibility(
  zone: DeliveryZone,
  subtotalCents: Cents,
  volumeM3: number,
): ZoneEligibility {
  if (subtotalCents < zone.minOrderAmountCents) {
    return { status: "below_min_amount", missingCents: zone.minOrderAmountCents - subtotalCents };
  }
  if (volumeM3 < zone.minOrderVolumeM3) {
    return {
      status: "below_min_volume",
      missingM3: Math.round((zone.minOrderVolumeM3 - volumeM3) * 1000) / 1000,
    };
  }
  return { status: "ok" };
}
