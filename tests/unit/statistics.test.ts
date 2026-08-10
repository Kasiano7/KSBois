import { describe, expect, it } from "vitest";
import {
  agregerSerie,
  choisirGranularite,
  coutReelLivraisonCents,
  debutDeSeau,
  evolutionPourcent,
  mediane,
  moyenneMobile,
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

describe("séries temporelles", () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it("choisit le pas de temps d'après la durée affichée", () => {
    expect(choisirGranularite(d("2026-01-01"), d("2026-01-31"))).toBe("jour");
    expect(choisirGranularite(d("2026-01-01"), d("2026-04-01"))).toBe("semaine");
    expect(choisirGranularite(d("2025-01-01"), d("2026-01-01"))).toBe("mois");
  });

  it("cale les seaux sur minuit, sur le lundi et sur le 1er du mois", () => {
    // 8 août 2026 est un samedi : la semaine ISO commence le lundi 3.
    expect(debutDeSeau(new Date("2026-08-08T22:30:00.000Z"), "jour").toISOString()).toBe(
      "2026-08-08T00:00:00.000Z",
    );
    expect(debutDeSeau(new Date("2026-08-08T22:30:00.000Z"), "semaine").toISOString()).toBe(
      "2026-08-03T00:00:00.000Z",
    );
    expect(debutDeSeau(new Date("2026-08-08T22:30:00.000Z"), "mois").toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
  });

  it("remplit les trous à zéro plutôt que de sauter les jours sans vente", () => {
    const serie = agregerSerie(
      [
        { dateIso: "2026-08-01T09:00:00.000Z", caCents: 12_000, volumeM3: 2 },
        { dateIso: "2026-08-01T18:00:00.000Z", caCents: 8_000, volumeM3: 1 },
        { dateIso: "2026-08-03T10:00:00.000Z", caCents: 5_000, volumeM3: 0.5 },
      ],
      d("2026-08-01"),
      d("2026-08-04"),
      "jour",
    );

    expect(serie).toHaveLength(3);
    expect(serie[0]).toEqual({
      cle: "2026-08-01T00:00:00.000Z",
      commandes: 2,
      caCents: 20_000,
      volumeM3: 3,
    });
    expect(serie[1]).toEqual({
      cle: "2026-08-02T00:00:00.000Z",
      commandes: 0,
      caCents: 0,
      volumeM3: 0,
    });
    expect(serie[2].caCents).toBe(5_000);
  });

  it("ignore une commande hors bornes et une date invalide", () => {
    const serie = agregerSerie(
      [
        { dateIso: "2026-07-31T23:00:00.000Z", caCents: 99_000, volumeM3: 9 },
        { dateIso: "pas une date", caCents: 99_000, volumeM3: 9 },
      ],
      d("2026-08-01"),
      d("2026-08-03"),
      "jour",
    );
    expect(serie.map((point) => point.caCents)).toEqual([0, 0]);
  });

  it("agrège par mois sur une période de douze mois", () => {
    const serie = agregerSerie(
      [
        { dateIso: "2026-01-15T00:00:00.000Z", caCents: 1_000, volumeM3: 1 },
        { dateIso: "2026-01-28T00:00:00.000Z", caCents: 2_000, volumeM3: 1 },
        { dateIso: "2026-03-02T00:00:00.000Z", caCents: 4_000, volumeM3: 1 },
      ],
      d("2026-01-01"),
      d("2026-04-01"),
      "mois",
    );
    expect(serie.map((point) => point.caCents)).toEqual([3_000, 0, 4_000]);
  });

  it("centre la moyenne mobile et rétrécit la fenêtre sur les bords", () => {
    expect(moyenneMobile([0, 3, 0, 3, 0], 3)).toEqual([1.5, 1, 2, 1, 1.5]);
    // Une fenêtre de 1 laisse la série intacte.
    expect(moyenneMobile([4, 8], 1)).toEqual([4, 8]);
  });
});
