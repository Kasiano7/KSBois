import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  dimensionsMedia,
  endpointImagekit,
  imagekitConfigure,
  srcSetMedia,
  urlMedia,
} from "@/lib/imagekit";
import {
  LARGEURS_SRCSET,
  RATIOS,
  TRANSFORMATIONS,
  transformationLargeur,
  type PresetMedia,
} from "@/lib/imagekit/transformations";

/**
 * Construction des URL ImageKit.
 *
 * Ces fonctions sont le seul endroit du projet qui compose une transformation.
 * Une erreur ici ne casse rien visiblement : elle sert simplement des images
 * trop lourdes, ou au mauvais format, sur tout le site.
 */

const ENDPOINT = "https://ik.imagekit.io/demo";

beforeEach(() => {
  process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = ENDPOINT;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
});

const PRESETS = Object.keys(TRANSFORMATIONS) as PresetMedia[];

describe("configuration", () => {
  it("se déclare non configuré quand l'endpoint manque", () => {
    delete process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
    expect(imagekitConfigure()).toBe(false);
    expect(urlMedia("/bois/tas.jpg", "productCard")).toBeNull();
    expect(srcSetMedia("/bois/tas.jpg", "productCard")).toBeUndefined();
  });

  it("retire la barre oblique finale de l'endpoint", () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = `${ENDPOINT}/`;
    expect(endpointImagekit()).toBe(ENDPOINT);
    expect(urlMedia("/bois/tas.jpg", "productCard")).toBe(
      `${ENDPOINT}/bois/tas.jpg?tr=${TRANSFORMATIONS.productCard}`,
    );
  });

  it("tolère un chemin sans barre oblique initiale", () => {
    expect(urlMedia("bois/tas.jpg", "productThumb")).toBe(
      `${ENDPOINT}/bois/tas.jpg?tr=${TRANSFORMATIONS.productThumb}`,
    );
  });
});

describe("transformations nommées", () => {
  it("porte systématiquement f-auto et q-auto sur les images du site", () => {
    // `ogImage` sort du lot : les réseaux sociaux ne négocient pas le format,
    // et `lqip`/`avatar` n'ont pas vocation à être servis en AVIF.
    const soumises = PRESETS.filter(
      (preset) => !["ogImage", "lqip", "avatar"].includes(preset),
    );
    for (const preset of soumises) {
      expect(TRANSFORMATIONS[preset], preset).toContain("f-auto");
      expect(TRANSFORMATIONS[preset], preset).toContain("q-auto");
    }
  });

  it("déclare un ratio et des largeurs pour chaque transformation", () => {
    for (const preset of PRESETS) {
      expect(RATIOS[preset], preset).toBeDefined();
      expect(LARGEURS_SRCSET[preset]?.length, preset).toBeGreaterThan(0);
    }
  });

  it("réserve des dimensions cohérentes avec la transformation", () => {
    expect(dimensionsMedia("productCard")).toEqual({ width: 640, height: 480 });
    expect(dimensionsMedia("galleryTile")).toEqual({ width: 800, height: 800 });
    expect(dimensionsMedia("ogImage")).toEqual({ width: 1200, height: 630 });
  });
});

describe("srcSet", () => {
  it("remplace la largeur sans abîmer le reste de la transformation", () => {
    const transformation = transformationLargeur("productCard", 320);
    expect(transformation).toContain("w-320");
    expect(transformation).not.toContain("w-640");
    expect(transformation).toContain("ar-4-3");
    expect(transformation).toContain("f-auto");
  });

  it("produit une entrée par largeur déclarée, avec son descripteur", () => {
    const srcSet = srcSetMedia("/bois/tas.jpg", "productCard");
    const entrees = srcSet!.split(", ");

    expect(entrees).toHaveLength(LARGEURS_SRCSET.productCard.length);
    expect(entrees[0]).toContain("w-320");
    expect(entrees[0].endsWith(" 320w")).toBe(true);
    expect(entrees.at(-1)!.endsWith(" 960w")).toBe(true);
  });

  it("ne remplace que la largeur, jamais une hauteur du même nom", () => {
    // `productThumb` porte w-160 ET h-160 : seul le premier doit bouger.
    const transformation = transformationLargeur("productThumb", 320);
    expect(transformation).toContain("w-320");
    expect(transformation).toContain("h-160");
  });
});
