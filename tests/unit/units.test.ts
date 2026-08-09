import { describe, it, expect } from "vitest";
import {
  DEFAULT_STACKING_COEFFICIENTS,
  deliveredVolumeM3,
  formatVolume,
  formatStereHint,
  describeDelivered,
  formatEuros,
  validateQuantity,
} from "@/domain/units";

describe("coefficients d'empilage", () => {
  it("décroissent avec la longueur de coupe (PLAN.md §3.2)", () => {
    expect(DEFAULT_STACKING_COEFFICIENTS[100]).toBe(1.0);
    expect(DEFAULT_STACKING_COEFFICIENTS[50]).toBe(0.8);
    expect(DEFAULT_STACKING_COEFFICIENTS[33]).toBe(0.7);
    expect(DEFAULT_STACKING_COEFFICIENTS[25]).toBe(0.65);
  });
});

describe("deliveredVolumeM3", () => {
  it("livre la quantité telle quelle en base map_delivered", () => {
    expect(deliveredVolumeM3(3, 0.7, "map_delivered")).toBe(3);
  });

  it("applique le coefficient en base stere_1m_equivalent", () => {
    // 3 stères équivalents 1 m, recoupés en 33 cm → 2,1 m³ apparents
    expect(deliveredVolumeM3(3, 0.7, "stere_1m_equivalent")).toBe(2.1);
  });

  it("les deux bases divergent de plus de 30 % en 25 cm — d'où l'alerte du plan", () => {
    const a = deliveredVolumeM3(10, 0.65, "map_delivered");
    const b = deliveredVolumeM3(10, 0.65, "stere_1m_equivalent");
    expect(a).toBe(10);
    expect(b).toBe(6.5);
  });
});

describe("formatage", () => {
  it("accorde le pluriel de « m³ apparent »", () => {
    expect(formatVolume(1)).toBe("1 m³ apparent");
    expect(formatVolume(3)).toBe("3 m³ apparents");
    expect(formatVolume(2.5)).toBe("2,5 m³ apparents");
  });

  it("produit la mention stère en secondaire, dépendante de la coupe", () => {
    // Bois en 1 m : l'équivalence est une identité.
    expect(formatStereHint(1, 1)).toBe("≈ 1 stère de bois de 1 m");
    expect(formatStereHint(4, 1)).toBe("≈ 4 stères de bois de 1 m");
    // Conversion détaillée dans tests/unit/steres.test.ts.
  });

  it("compose la phrase de la fiche produit", () => {
    expect(describeDelivered(3, 33)).toBe(
      "Vous recevrez 3 m³ apparents de bûches de 33 cm",
    );
    expect(describeDelivered(1, null)).toBe("Vous recevrez 1 m³ apparent");
  });

  it("formate les montants en euros depuis des centimes", () => {
    // Espace insécable étroit dans le format français : on compare le contenu.
    expect(formatEuros(10_400).replace(/ | /g, " ")).toBe("104,00 €");
    expect(formatEuros(0).replace(/ | /g, " ")).toBe("0,00 €");
  });
});

describe("validateQuantity", () => {
  const bornes = { min: 1, max: 30, step: 0.5 };

  it("accepte une quantité valide", () => {
    expect(validateQuantity(3, bornes)).toBeNull();
    expect(validateQuantity(2.5, bornes)).toBeNull();
  });

  it("refuse une quantité nulle ou négative", () => {
    expect(validateQuantity(0, bornes)).toBe("Indiquez une quantité.");
    expect(validateQuantity(-2, bornes)).toBe("Indiquez une quantité.");
    expect(validateQuantity(Number.NaN, bornes)).toBe("Indiquez une quantité.");
  });

  it("refuse hors bornes avec un message exploitable", () => {
    expect(validateQuantity(0.5, bornes)).toContain("minimum");
    expect(validateQuantity(50, bornes)).toContain("maximum");
  });

  it("refuse un pas invalide sans se faire piéger par la virgule flottante", () => {
    expect(validateQuantity(2.3, bornes)).toContain("multiple");
    expect(validateQuantity(1 + 0.1 + 0.2 + 0.2, bornes)).toBeNull(); // 1,5 en flottant
  });

  it("accepte une quantité maximale nulle (illimitée)", () => {
    expect(validateQuantity(999, { min: 1, max: null, step: 1 })).toBeNull();
  });
});
