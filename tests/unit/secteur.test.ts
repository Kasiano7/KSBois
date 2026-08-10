import { describe, it, expect } from "vitest";
import {
  distanceVolOiseauKm,
  estimerDistanceRouteKm,
  departementsCandidats,
  communesDansLeRayon,
  suggererZone,
  bornerDistanceRoute,
  cleCommune,
  memeCommune,
  type ZoneParDistance,
} from "@/domain/secteur";
import { DEPARTEMENTS_FRANCE } from "@/data/departements-france";

/** Dépôt de référence des tests : Villevocance (07690). */
const depot = { lat: 45.2253, lng: 4.5952 };

const annonay = { lat: 45.2449, lng: 4.6419 };
const tournon = { lat: 45.0672, lng: 4.8331 };
const privas = { lat: 44.7351, lng: 4.5992 };

describe("distanceVolOiseauKm", () => {
  it("mesure une distance connue à moins d'un kilomètre près", () => {
    // Villevocance → Annonay : environ 4,4 km à vol d'oiseau.
    expect(distanceVolOiseauKm(depot, annonay)).toBeGreaterThan(3.5);
    expect(distanceVolOiseauKm(depot, annonay)).toBeLessThan(5.5);
  });

  it("est nulle pour un point sur lui-même", () => {
    expect(distanceVolOiseauKm(depot, depot)).toBe(0);
  });

  it("est symétrique", () => {
    expect(distanceVolOiseauKm(depot, tournon)).toBeCloseTo(
      distanceVolOiseauKm(tournon, depot),
      6,
    );
  });
});

describe("estimerDistanceRouteKm", () => {
  it("majore la distance à vol d'oiseau", () => {
    expect(estimerDistanceRouteKm(20)).toBeGreaterThan(20);
  });
});

describe("departementsCandidats", () => {
  it("retient les départements voisins du dépôt ardéchois", () => {
    const codes = departementsCandidats(depot, 25, DEPARTEMENTS_FRANCE);
    // La Loire et l'Isère sont à quelques kilomètres : les oublier ferait
    // disparaître Saint-Julien-Molin-Molette ou Le Péage-de-Roussillon.
    expect(codes).toEqual(expect.arrayContaining(["07", "42", "38", "26", "69"]));
  });

  it("écarte les départements hors de portée", () => {
    const codes = departementsCandidats(depot, 25, DEPARTEMENTS_FRANCE);
    expect(codes).not.toContain("29"); // Finistère
    expect(codes).not.toContain("06"); // Alpes-Maritimes
    expect(codes).not.toContain("974"); // La Réunion
  });

  it("s'élargit avec le rayon", () => {
    const petit = departementsCandidats(depot, 10, DEPARTEMENTS_FRANCE);
    const grand = departementsCandidats(depot, 100, DEPARTEMENTS_FRANCE);
    expect(grand.length).toBeGreaterThan(petit.length);
    expect(grand).toEqual(expect.arrayContaining(petit));
  });
});

describe("communesDansLeRayon", () => {
  const communes = [
    { nom: "Annonay", ...annonay },
    { nom: "Tournon-sur-Rhône", ...tournon },
    { nom: "Privas", ...privas },
  ];

  it("ne garde que les communes à portée et les trie par distance", () => {
    const proches = communesDansLeRayon(depot, 30, communes);
    expect(proches.map((c) => c.nom)).toEqual(["Annonay", "Tournon-sur-Rhône"]);
    expect(proches[0].volOiseauKm).toBeLessThan(proches[1].volOiseauKm);
  });

  it("expose la distance à vol d'oiseau utilisée pour le filtre", () => {
    const [premiere] = communesDansLeRayon(depot, 30, communes);
    expect(premiere.volOiseauKm).toBeCloseTo(distanceVolOiseauKm(depot, annonay), 6);
  });

  it("ne retient rien avec un rayon nul", () => {
    expect(communesDansLeRayon(depot, 0, communes)).toEqual([]);
  });
});

describe("suggererZone", () => {
  // Les couronnes du jeu de démonstration : 0-15, 15-30, 30-45, 45-60 km,
  // décrites par leur distance indicative.
  const zones: ZoneParDistance[] = [
    { id: "c", nom: "Zone C — 30 à 45 km", distanceKmEstimate: 37 },
    { id: "a", nom: "Zone A — 0 à 15 km", distanceKmEstimate: 10 },
    { id: "d", nom: "Zone D — 45 à 60 km", distanceKmEstimate: 52 },
    { id: "b", nom: "Zone B — 15 à 30 km", distanceKmEstimate: 22 },
  ];

  it("retient la couronne la plus proche, quel que soit l'ordre des zones", () => {
    expect(suggererZone(2, zones)).toBe("a");
    expect(suggererZone(12, zones)).toBe("a");
    expect(suggererZone(20, zones)).toBe("b");
    expect(suggererZone(40, zones)).toBe("c");
    expect(suggererZone(50, zones)).toBe("d");
  });

  it("tranche les égalités vers la zone la plus lointaine", () => {
    // 16 km est à égale distance de 10 et de 22 : sous-facturer une tournée
    // coûte plus cher que de proposer le tarif du cran au-dessus.
    expect(suggererZone(16, zones)).toBe("b");
  });

  it("ne devine rien au-delà de la dernière couronne", () => {
    // Sinon on facturerait un tarif de proximité à 80 km.
    expect(suggererZone(80, zones)).toBeNull();
    expect(suggererZone(60, zones)).toBeNull();
    expect(suggererZone(59, zones)).toBe("d");
  });

  it("couvre une demi-couronne au-delà quand une seule zone est définie", () => {
    const seule: ZoneParDistance[] = [{ id: "u", nom: "Unique", distanceKmEstimate: 15 }];
    expect(suggererZone(22, seule)).toBe("u");
    expect(suggererZone(23, seule)).toBeNull();
  });

  it("ne devine rien si aucune zone n'a de distance indicative", () => {
    expect(suggererZone(10, [{ id: "z", nom: "Zone", distanceKmEstimate: null }])).toBeNull();
  });
});

describe("bornerDistanceRoute", () => {
  it("laisse passer une distance routière plausible", () => {
    expect(bornerDistanceRoute(18.4, 14)).toBe(18.4);
  });

  it("refuse une route plus courte que le vol d'oiseau", () => {
    expect(bornerDistanceRoute(2, 14)).toBe(14);
  });

  it("plafonne une distance aberrante", () => {
    // Une valeur trafiquée gonflerait la surcharge carburant facturée.
    expect(bornerDistanceRoute(900, 14)).toBe(47);
  });
});

describe("cleCommune", () => {
  it("ignore la casse et les espaces autour du nom", () => {
    expect(cleCommune("07100", " Annonay ")).toBe(cleCommune("07100", "annonay"));
  });

  it("distingue deux communes de même nom sous des codes postaux différents", () => {
    expect(cleCommune("07100", "Annonay")).not.toBe(cleCommune("07430", "Annonay"));
  });
});

describe("memeCommune", () => {
  it("reconnaît une commune malgré les accents, tirets et majuscules", () => {
    // Sans cela, un client de Saint-Marcel-lès-Annonay que l'on livre s'entend
    // répondre qu'on ne le livre pas, parce qu'il a saisi le nom sans accent.
    expect(memeCommune("Saint-Marcel-lès-Annonay", "saint marcel les annonay")).toBe(true);
    expect(memeCommune("Félines", "FELINES")).toBe(true);
    expect(memeCommune("Tain-l'Hermitage", "Tain l Hermitage")).toBe(true);
  });

  it("ne confond pas deux communes voisines", () => {
    expect(memeCommune("Vanosc", "Vocance")).toBe(false);
    expect(memeCommune("Annonay", "Boulieu-lès-Annonay")).toBe(false);
  });

  it("n'invente pas d'équivalence sur les abréviations", () => {
    // « St » n'est pas développé : la levée d'ambiguïté se fait par sélection
    // dans une liste, jamais par devinette sur une saisie libre.
    expect(memeCommune("St-Désirat", "Saint-Désirat")).toBe(false);
  });
});
