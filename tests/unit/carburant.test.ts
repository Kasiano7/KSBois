import { describe, it, expect } from "vitest";
import {
  departementDepuisCodePostal,
  mediane,
  ecarterAberrants,
  deciderReleve,
  VARIATION_MAX_PCT,
  ECHANTILLON_MINIMUM,
} from "@/domain/carburant";

describe("departementDepuisCodePostal", () => {
  it("extrait le département métropolitain", () => {
    expect(departementDepuisCodePostal("07690")).toBe("07");
    expect(departementDepuisCodePostal("42220")).toBe("42");
    expect(departementDepuisCodePostal("75001")).toBe("75");
  });

  it("gère l'outre-mer sur trois chiffres", () => {
    expect(departementDepuisCodePostal("97400")).toBe("974");
    expect(departementDepuisCodePostal("98800")).toBe("988");
  });

  it("tolère les espaces de saisie", () => {
    expect(departementDepuisCodePostal("07 690")).toBe("07");
  });

  it("refuse une saisie invalide", () => {
    expect(departementDepuisCodePostal("076")).toBeNull();
    expect(departementDepuisCodePostal("")).toBeNull();
    expect(departementDepuisCodePostal("abcde")).toBeNull();
  });
});

describe("mediane", () => {
  it("gère un nombre impair de valeurs", () => {
    expect(mediane([1, 3, 2])).toBe(2);
  });

  it("moyenne les deux valeurs centrales si le nombre est pair", () => {
    expect(mediane([1, 2, 3, 4])).toBe(2.5);
  });

  it("est insensible à une valeur extrême, contrairement à la moyenne", () => {
    const valeurs = [2.1, 2.2, 2.15, 2.18, 99];
    expect(mediane(valeurs)).toBe(2.18);
    const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
    expect(moyenne).toBeGreaterThan(20);
  });
});

describe("ecarterAberrants", () => {
  it("écarte une station manifestement fautive", () => {
    const { retenus, ecartes } = ecarterAberrants([2.1, 2.15, 2.2, 2.18, 2.12, 0.01]);
    expect(ecartes).toEqual([0.01]);
    expect(retenus).toHaveLength(5);
  });

  it("ne touche à rien quand les prix sont homogènes", () => {
    const { retenus, ecartes } = ecarterAberrants([2.1, 2.15, 2.2, 2.18]);
    expect(ecartes).toEqual([]);
    expect(retenus).toHaveLength(4);
  });

  it("écarte les valeurs non numériques ou négatives", () => {
    const { retenus } = ecarterAberrants([2.1, Number.NaN, -1, 0, 2.2, 2.15, 2.18]);
    expect(retenus).toEqual([2.1, 2.2, 2.15, 2.18]);
  });

  it("ne tente pas de statistique sur trop peu de valeurs", () => {
    const { retenus, ecartes } = ecarterAberrants([2.1, 9.9]);
    expect(retenus).toHaveLength(2);
    expect(ecartes).toEqual([]);
  });
});

describe("deciderReleve", () => {
  const releves = [2.16, 2.13, 2.229, 2.199, 2.18, 2.2, 2.21];

  it("retient la médiane en centimes", () => {
    const d = deciderReleve(releves, null);
    expect(d.applicable).toBe(true);
    expect(d.prixCents).toBe(220); // médiane 2,199 € → 220 centimes
    expect(d.variationPct).toBeNull();
  });

  it("calcule la variation par rapport au dernier relevé", () => {
    const d = deciderReleve(releves, 215);
    expect(d.applicable).toBe(true);
    expect(d.variationPct).toBeCloseTo(2.3, 1);
  });

  it("REFUSE une variation brutale : c'est un bug plus souvent qu'un marché", () => {
    // Passer de 1,00 € à 2,20 € en une nuit n'arrive pas.
    const d = deciderReleve(releves, 100);
    expect(d.applicable).toBe(false);
    expect(d.raison).toBe("variation_excessive");
    // Le prix calculé est renvoyé quand même, pour que l'admin puisse trancher.
    expect(d.prixCents).toBe(220);
    expect(Math.abs(d.variationPct!)).toBeGreaterThan(VARIATION_MAX_PCT);
  });

  it("accepte une variation juste sous le seuil", () => {
    // 220 depuis 195 = +12,8 %, sous les 15 %.
    expect(deciderReleve(releves, 195).applicable).toBe(true);
  });

  it("refuse un échantillon trop maigre", () => {
    const d = deciderReleve([2.2, 2.1], null);
    expect(d.applicable).toBe(false);
    expect(d.raison).toBe("echantillon_insuffisant");
    expect(d.echantillon).toBeLessThan(ECHANTILLON_MINIMUM);
  });

  it("refuse une liste vide sans lever d'exception", () => {
    const d = deciderReleve([], 200);
    expect(d.applicable).toBe(false);
    expect(d.prixCents).toBe(0);
  });

  it("ignore les stations aberrantes dans le calcul retenu", () => {
    const avec = deciderReleve([...releves, 0.01, 99], null);
    const sans = deciderReleve(releves, null);
    expect(avec.prixCents).toBe(sans.prixCents);
    expect(avec.ecartes).toBe(2);
  });
});
