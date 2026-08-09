import { describe, it, expect } from "vitest";
import {
  steresEquivalent1m,
  formatStereHint,
  formatStereHintPdf,
  formatEquivalenceSteres,
  DEFAULT_STACKING_COEFFICIENTS,
} from "@/domain/units";

/**
 * Non-régression du bug « 1 m³ apparent = 1 stère ».
 *
 * L'ancienne implémentation affichait « ≈ 3 stères » pour 3 m³ apparents, quelle
 * que soit la longueur de coupe. Le coefficient d'empilage (PLAN.md §3.2) était
 * donc décoratif. Ces tests verrouillent la conversion réelle.
 */

describe("steresEquivalent1m", () => {
  it("est l'identité pour du bois en 1 m", () => {
    expect(steresEquivalent1m(3, 1)).toBe(3);
    expect(steresEquivalent1m(3, DEFAULT_STACKING_COEFFICIENTS[100])).toBe(3);
  });

  it("DIFFÈRE du volume apparent dès que le bois est recoupé", () => {
    // C'est exactement ce qui était faux avant.
    expect(steresEquivalent1m(3, 0.7)).not.toBe(3);
  });

  it("convertit selon le coefficient d'empilage", () => {
    // 1 stère de 1 m ne remplit que 0,70 m³ apparent en 33 cm.
    // Donc 1 m³ apparent de 33 cm contient la matière de 1/0,70 ≈ 1,429 stère.
    expect(steresEquivalent1m(1, 0.7)).toBe(1.429);
    expect(steresEquivalent1m(2, 0.7)).toBe(2.857);
    expect(steresEquivalent1m(3.5, 0.7)).toBe(5);
  });

  it("donne un équivalent plus grand pour une coupe plus courte", () => {
    const en50 = steresEquivalent1m(3, DEFAULT_STACKING_COEFFICIENTS[50]);
    const en33 = steresEquivalent1m(3, DEFAULT_STACKING_COEFFICIENTS[33]);
    const en25 = steresEquivalent1m(3, DEFAULT_STACKING_COEFFICIENTS[25]);
    expect(en50).toBeLessThan(en33);
    expect(en33).toBeLessThan(en25);
    expect(en50).toBeCloseTo(3.75, 2);
    expect(en25).toBeCloseTo(4.615, 2);
  });

  it("se protège d'un coefficient absurde plutôt que de diviser par zéro", () => {
    expect(steresEquivalent1m(3, 0)).toBe(3);
    expect(steresEquivalent1m(3, Number.NaN)).toBe(3);
    expect(steresEquivalent1m(3, -1)).toBe(3);
  });
});

describe("formatStereHint", () => {
  it("nomme l'unité de référence pour éviter toute ambiguïté", () => {
    expect(formatStereHint(2, 0.7)).toBe("≈ 2,86 stères de bois de 1 m");
  });

  it("accorde le singulier", () => {
    expect(formatStereHint(0.5, 0.7)).toBe("≈ 0,71 stère de bois de 1 m");
  });

  it("ne prétend plus que le nombre est identique au volume apparent", () => {
    expect(formatStereHint(3, 0.7)).not.toContain("3 stères de bois");
  });
});

describe("formatStereHintPdf", () => {
  it("évite le caractère ≈ absent de l'encodage WinAnsi", () => {
    const texte = formatStereHintPdf(2, 0.7);
    expect(texte).not.toContain("≈");
    expect(texte).toContain("environ");
    expect(texte).toContain("2,86");
  });
});

describe("formatEquivalenceSteres", () => {
  it("explique la densité d'empilage pour une coupe courte", () => {
    const phrase = formatEquivalenceSteres(2, 33, 0.7);
    expect(phrase).toContain("2,86");
    expect(phrase).toContain("33 cm");
    expect(phrase).toContain("plus dense");
  });

  it("se tait quand il n'y a rien à expliquer", () => {
    // Bois déjà en 1 m : l'équivalence serait une évidence.
    expect(formatEquivalenceSteres(2, 100, 1)).toBeNull();
    expect(formatEquivalenceSteres(2, null, 0.7)).toBeNull();
    expect(formatEquivalenceSteres(2, 33, null)).toBeNull();
  });
});
