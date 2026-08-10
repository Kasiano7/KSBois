import { describe, expect, it } from "vitest";
import {
  cheminAire,
  cheminArc,
  cheminLisse,
  graduations,
  plafondAxe,
  projeter,
  type PointSvg,
} from "@/lib/graphiques";
import { formatEurosCompact } from "@/domain/units";

describe("graduations d'axe", () => {
  it("arrondit le pas sur 1 · 2 · 2,5 · 5 × 10ⁿ", () => {
    expect(graduations(1_000)).toEqual([0, 250, 500, 750, 1_000]);
    expect(graduations(3_214)).toEqual([0, 1_000, 2_000, 3_000, 4_000]);
    expect(plafondAxe(3_214)).toBe(4_000);
  });

  it("garde un axe lisible quand il n'y a aucune donnée", () => {
    const crans = graduations(0);
    expect(crans.length).toBeGreaterThanOrEqual(2);
    expect(crans[0]).toBe(0);
    expect(plafondAxe(0)).toBeGreaterThan(0);
  });

  it("ne laisse pas dériver l'addition flottante", () => {
    // 3 × 0,2 = 0,6000000000000001 sans le ré-arrondi sur le pas.
    expect(graduations(0.5)).toEqual([0, 0.2, 0.4, 0.6]);
  });

  it("place toujours le plafond AU-DESSUS de la donnée maximale", () => {
    for (const maximum of [1, 7, 42, 3_214, 89_999, 1_234_567]) {
      expect(plafondAxe(maximum)).toBeGreaterThanOrEqual(maximum);
    }
  });
});

describe("projection", () => {
  it("étale les points sur la largeur et inverse l'axe vertical", () => {
    const points = projeter([0, 50, 100], { largeur: 200, hauteur: 100, plafond: 100 });
    expect(points[0]).toEqual([0, 100]);
    expect(points[1]).toEqual([100, 50]);
    expect(points[2]).toEqual([200, 0]);
  });

  it("centre un point unique au lieu de le coller au bord", () => {
    expect(projeter([10], { largeur: 200, hauteur: 100, plafond: 20 })[0][0]).toBe(100);
  });

  it("réserve une marge haute pour que le sommet ne touche pas le bord", () => {
    const [point] = projeter([100], { largeur: 100, hauteur: 100, plafond: 100, margeHaute: 8 });
    expect(point[1]).toBe(8);
  });
});

describe("tracés", () => {
  it("borne les points de contrôle au segment — une courbe d'argent ne plonge pas sous zéro", () => {
    const points: PointSvg[] = [
      [0, 100],
      [50, 100],
      [100, 0],
      [150, 100],
      [200, 100],
    ];
    const chemin = cheminLisse(points);
    const ordonnees = [...chemin.matchAll(/-?\d+(?:\.\d+)?\s(-?\d+(?:\.\d+)?)/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.max(...ordonnees)).toBeLessThanOrEqual(100);
    expect(Math.min(...ordonnees)).toBeGreaterThanOrEqual(0);
  });

  it("rend un point seul sans lever d'erreur", () => {
    expect(cheminLisse([[10, 20]])).toBe("M 10 20");
    expect(cheminLisse([])).toBe("");
  });

  it("referme l'aire sur la ligne de base", () => {
    const aire = cheminAire(
      [
        [0, 10],
        [100, 20],
      ],
      50,
    );
    expect(aire.startsWith("M 0 10")).toBe(true);
    expect(aire.endsWith("L 100 50 L 0 50 Z")).toBe(true);
  });
});

describe("arcs d'anneau", () => {
  it("démarre à midi", () => {
    const arc = cheminArc({ debutRatio: 0, finRatio: 0.25, rayon: 100, epaisseur: 20 });
    expect(arc.startsWith("M 0 -100")).toBe(true);
  });

  it("dessine une part unique de 100 % en deux demi-arcs", () => {
    const arc = cheminArc({ debutRatio: 0, finRatio: 1, rayon: 100, epaisseur: 20 });
    expect(arc.split("M").length - 1).toBe(2);
  });

  it("ne dessine rien pour une part nulle", () => {
    expect(cheminArc({ debutRatio: 0.5, finRatio: 0.5, rayon: 100, epaisseur: 20 })).toBe("");
  });
});

describe("montant abrégé des axes", () => {
  it("abrège au millier et au million", () => {
    expect(formatEurosCompact(94_000)).toBe("940 €");
    expect(formatEurosCompact(189_400)).toBe("1,9 k€");
    expect(formatEurosCompact(1_894_000)).toBe("19 k€");
    expect(formatEurosCompact(250_000_000)).toBe("2,5 M€");
  });
});
