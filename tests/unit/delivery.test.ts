import { describe, it, expect } from "vitest";
import {
  selectVehicle,
  computeFuelSurcharge,
  computeDeliveryFee,
  checkZoneEligibility,
  roundUpTo,
  type Vehicle,
  type DeliveryZone,
  type FuelSettings,
  type DeliveryFeeSettings,
} from "@/domain/delivery";

const fourgon: Vehicle = {
  id: "v1",
  name: "Fourgon",
  vehicleType: "fourgon",
  capacityM3: 4,
  fuelConsumptionLPer100km: 12,
  costPerKmCents: 0,
  maxDistanceKm: null,
  isActive: true,
};

const camion: Vehicle = {
  id: "v2",
  name: "Camion benne 19T",
  vehicleType: "camion",
  capacityM3: 15,
  fuelConsumptionLPer100km: 28,
  costPerKmCents: 0,
  maxDistanceKm: null,
  isActive: true,
};

const spl: Vehicle = {
  id: "v3",
  name: "Semi",
  vehicleType: "spl",
  capacityM3: 40,
  fuelConsumptionLPer100km: 35,
  costPerKmCents: 0,
  maxDistanceKm: 120,
  isActive: true,
};

const flotte = [camion, fourgon, spl];

const zoneB: DeliveryZone = {
  id: "z2",
  name: "Zone B — 15-25 km",
  baseFeeCents: 1_500,
  feePerM3Cents: 0,
  freeAboveCents: null,
  minOrderAmountCents: 0,
  minOrderVolumeM3: 0,
  deliveryDays: [2, 4],
  leadTimeDays: null,
  isActive: true,
};

const carburant: FuelSettings = {
  enabled: true,
  pricePerLiterCents: 175, // 1,75 €/L
  marginCoefficient: 1,
  maxSurchargeCents: 3_000,
};

const reglages: DeliveryFeeSettings = {
  roundingStepCents: 50,
  maxFeeCents: 15_000,
};

describe("selectVehicle", () => {
  it("retient le plus petit véhicule capable d'emporter le volume", () => {
    expect(selectVehicle(3, "spl", flotte)?.id).toBe("v1");
    expect(selectVehicle(5, "spl", flotte)?.id).toBe("v2");
    expect(selectVehicle(20, "spl", flotte)?.id).toBe("v3");
  });

  it("exclut les véhicules trop gros pour l'accès déclaré", () => {
    // Chemin qui n'accepte qu'un fourgon : 5 m³ ne passent pas.
    expect(selectVehicle(5, "fourgon", flotte)).toBeNull();
    expect(selectVehicle(3, "fourgon", flotte)?.id).toBe("v1");
  });

  it("respecte la distance maximale d'un véhicule", () => {
    expect(selectVehicle(20, "spl", flotte, 200)).toBeNull();
    expect(selectVehicle(20, "spl", flotte, 80)?.id).toBe("v3");
  });

  it("ignore les véhicules désactivés", () => {
    const flotteHS = flotte.map((v) => (v.id === "v1" ? { ...v, isActive: false } : v));
    expect(selectVehicle(3, "spl", flotteHS)?.id).toBe("v2");
  });

  it("retourne null quand le volume dépasse toute la flotte", () => {
    expect(selectVehicle(100, "spl", flotte)).toBeNull();
  });
});

describe("computeFuelSurcharge", () => {
  it("calcule le coût d'un aller-retour", () => {
    // 20 km × 2 = 40 km ; 40 × 28/100 = 11,2 L ; × 1,75 € = 19,60 €
    expect(computeFuelSurcharge(20, camion, carburant)).toBe(1_960);
  });

  it("applique le coefficient de marge", () => {
    const majore = { ...carburant, marginCoefficient: 1.2 };
    expect(computeFuelSurcharge(20, camion, majore)).toBe(2_352);
  });

  it("plafonne la surcharge — garde-fou anti-dérive d'API", () => {
    const prixAberrant = { ...carburant, pricePerLiterCents: 9_999 };
    expect(computeFuelSurcharge(60, camion, prixAberrant)).toBe(3_000);
  });

  it("retourne zéro quand la fonctionnalité est coupée", () => {
    expect(computeFuelSurcharge(50, camion, { ...carburant, enabled: false })).toBe(0);
  });

  it("retourne zéro pour un retrait sur place", () => {
    expect(computeFuelSurcharge(0, camion, carburant)).toBe(0);
  });
});

describe("computeDeliveryFee", () => {
  it("additionne base, volume et carburant puis arrondit au pas supérieur", () => {
    const quote = computeDeliveryFee({
      zone: { ...zoneB, feePerM3Cents: 100 },
      vehicle: camion,
      distanceKm: 20,
      volumeM3: 5,
      subtotalCents: 49_500,
      fuel: carburant,
      settings: reglages,
    });
    expect(quote.status).toBe("ok");
    if (quote.status !== "ok") return;
    expect(quote.baseCents).toBe(1_500);
    expect(quote.volumeCents).toBe(500);
    expect(quote.fuelCents).toBe(1_960);
    expect(quote.totalCents).toBe(4_000); // 39,60 € arrondi à 40,00 €
  });

  it("offre la livraison au-delà du seuil, sans perdre le montant offert", () => {
    const quote = computeDeliveryFee({
      zone: { ...zoneB, freeAboveCents: 40_000 },
      vehicle: camion,
      distanceKm: 20,
      volumeM3: 5,
      subtotalCents: 49_500,
      fuel: carburant,
      settings: reglages,
    });
    if (quote.status !== "ok") throw new Error("attendu ok");
    expect(quote.totalCents).toBe(0);
    expect(quote.isFree).toBe(true);
    expect(quote.freeReason).toBe("seuil");
    // Le détail reste disponible pour afficher « Livraison offerte — 34,60 € »
    expect(quote.baseCents + quote.volumeCents + quote.fuelCents).toBe(3_460);
  });

  it("bascule en devis quand les frais dépassent le plafond", () => {
    const quote = computeDeliveryFee({
      zone: { ...zoneB, baseFeeCents: 14_000 },
      vehicle: spl,
      distanceKm: 90,
      volumeM3: 30,
      subtotalCents: 300_000,
      fuel: carburant,
      settings: reglages,
    });
    expect(quote.status).toBe("requires_quote");
  });

  it("distingue la gratuité par promotion de la gratuité par seuil", () => {
    const quote = computeDeliveryFee({
      zone: zoneB,
      vehicle: fourgon,
      distanceKm: 10,
      volumeM3: 2,
      subtotalCents: 20_000,
      fuel: carburant,
      settings: reglages,
      freeDeliveryPromotion: true,
    });
    if (quote.status !== "ok") throw new Error("attendu ok");
    expect(quote.freeReason).toBe("promotion");
  });
});

describe("roundUpTo", () => {
  it("arrondit au pas supérieur", () => {
    expect(roundUpTo(3_960, 50)).toBe(4_000);
    expect(roundUpTo(4_000, 50)).toBe(4_000);
    expect(roundUpTo(1, 50)).toBe(50);
    expect(roundUpTo(0, 50)).toBe(0);
  });
});

describe("checkZoneEligibility", () => {
  it("accepte une commande conforme", () => {
    expect(checkZoneEligibility(zoneB, 50_000, 5).status).toBe("ok");
  });

  it("indique le montant manquant, pas seulement un refus", () => {
    const zone = { ...zoneB, minOrderAmountCents: 20_000 };
    const result = checkZoneEligibility(zone, 15_000, 2);
    expect(result).toEqual({ status: "below_min_amount", missingCents: 5_000 });
  });

  it("indique le volume manquant", () => {
    const zone = { ...zoneB, minOrderVolumeM3: 3 };
    const result = checkZoneEligibility(zone, 50_000, 1.5);
    expect(result).toEqual({ status: "below_min_volume", missingM3: 1.5 });
  });
});
