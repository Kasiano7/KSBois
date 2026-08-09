import { describe, expect, it } from "vitest";
import {
  coutReelLivraisonCents,
  evolutionPourcent,
  mediane,
  moyennePonderee,
  pourcentage,
  predireProchaineCommande,
  projeterStock,
} from "@/domain/statistics";

describe("statistiques", () => {
  it("calcule les ratios sans inventer de valeur quand le dénominateur est vide", () => {
    expect(pourcentage(25, 100)).toBe(25);
    expect(pourcentage(1, 0)).toBeNull();
    expect(evolutionPourcent(120, 100)).toBe(20);
    expect(evolutionPourcent(120, 0)).toBeNull();
  });

  it("calcule une moyenne pondérée et une médiane", () => {
    expect(moyennePonderee([{ valeur: 100, poids: 1 }, { valeur: 120, poids: 3 }])).toBe(115);
    expect(mediane([10, 30, 20, 40])).toBe(25);
  });

  it("compare les frais facturés au coût carburant et véhicule aller-retour", () => {
    expect(
      coutReelLivraisonCents({
        distanceKm: 25,
        consommationLitres100Km: 20,
        prixCarburantCentsLitre: 180,
        coutVehiculeCentsKm: 30,
      }),
    ).toBe(3300);
  });

  it("projette l'autonomie et la priorité de production", () => {
    expect(
      projeterStock({
        stockDisponibleM3: 5,
        volumeVenduM3: 30,
        joursObserves: 30,
        seuilUrgentJours: 7,
        seuilAlerteJours: 14,
      }),
    ).toEqual({ vitesseM3ParJour: 1, joursRestants: 5, priorite: "urgent" });
  });

  it("prévoit la prochaine commande depuis l'intervalle médian", () => {
    const prediction = predireProchaineCommande([
      "2024-01-01T00:00:00.000Z",
      "2024-12-31T00:00:00.000Z",
      "2025-12-31T00:00:00.000Z",
    ]);
    expect(prediction?.intervalleJours).toBe(365);
    expect(prediction?.datePrevue.slice(0, 10)).toBe("2026-12-31");
  });
});
