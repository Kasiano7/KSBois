import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  jsonldEntreprise,
  jsonldFaq,
  jsonldFilAriane,
  metadataPage,
  urlAbsolue,
} from "@/lib/seo";
import { slugCommune } from "@/lib/slug";
import type { Tenant } from "@/lib/tenant";

/**
 * Métadonnées et données structurées.
 *
 * Ces sorties ne sont visibles ni à l'écran ni dans les tests d'interface :
 * seuls les robots les lisent. Une canonique absente ou une donnée structurée
 * malformée ne se remarque qu'à la Search Console, des semaines plus tard.
 */

const SITE = "https://bois-exemple.fr";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = SITE;
});
afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

const tenant = {
  id: "1",
  slug: "demo",
  name: "Bois de chauffage",
  tagline: "Bois sec livré en Ardèche",
  logoUrl: null,
  email: "contact@exemple.fr",
  phone: "0475000000",
  phoneDisplay: "04 75 00 00 00",
  postalCode: "07690",
  city: "Villevocance",
  vatMode: "assujetti",
  pricingBasis: "map_delivered",
  theme: { tokens: {}, fontDisplay: "Fraunces", fontBody: "Archivo" },
  features: {} as Tenant["features"],
} as Tenant;

describe("URL absolues", () => {
  it("préfixe le chemin et tolère l'absence de barre initiale", () => {
    expect(urlAbsolue("/livraison")).toBe(`${SITE}/livraison`);
    expect(urlAbsolue("livraison")).toBe(`${SITE}/livraison`);
  });

  it("retire la barre finale de la variable d'environnement", () => {
    process.env.NEXT_PUBLIC_SITE_URL = `${SITE}/`;
    expect(urlAbsolue("/guides")).toBe(`${SITE}/guides`);
  });
});

describe("métadonnées de page", () => {
  it("pose toujours une canonique absolue", () => {
    const meta = metadataPage({
      titre: "Livraison",
      description: "Zones et tarifs.",
      chemin: "/livraison",
    });
    expect(meta.alternates?.canonical).toBe(`${SITE}/livraison`);
    expect(meta.openGraph?.url).toBe(`${SITE}/livraison`);
  });

  it("laisse la page indexable par défaut et la désindexe sur demande", () => {
    expect(metadataPage({ titre: "A", description: "B", chemin: "/a" }).robots).toBeUndefined();

    const cachee = metadataPage({ titre: "A", description: "B", chemin: "/a", noindex: true });
    expect(cachee.robots).toEqual({ index: false, follow: true });
  });

  it("bascule la carte Twitter selon la présence d'une image", () => {
    const sans = metadataPage({ titre: "A", description: "B", chemin: "/a" });
    expect(sans.twitter).toMatchObject({ card: "summary" });

    const avec = metadataPage({
      titre: "A",
      description: "B",
      chemin: "/a",
      imageOg: `${SITE}/og.jpg`,
    });
    expect(avec.twitter).toMatchObject({ card: "summary_large_image" });
  });
});

describe("fiche établissement", () => {
  it("décrit l'adresse et les communes réellement desservies", () => {
    const fiche = jsonldEntreprise(tenant, {
      adresse: { rue: "Route du Bois", codePostal: "07690", ville: "Villevocance" },
      latitude: 45.23,
      longitude: 4.61,
      communesDesservies: ["Annonay", "Davézieux"],
    });

    expect(fiche["@type"]).toBe("LocalBusiness");
    expect(fiche.telephone).toBe("0475000000");
    expect(fiche.geo).toMatchObject({ latitude: 45.23, longitude: 4.61 });
    expect(fiche.areaServed).toEqual([
      { "@type": "City", name: "Annonay" },
      { "@type": "City", name: "Davézieux" },
    ]);
  });

  it("omet la géolocalisation et la fourchette de prix quand elles sont inconnues", () => {
    const fiche = jsonldEntreprise(tenant, {
      adresse: { rue: null, codePostal: null, ville: null },
      communesDesservies: [],
    });
    // Publier une position approximative ou un `priceRange` inventé expose à
    // une pénalité manuelle : mieux vaut ne rien dire.
    expect(fiche.geo).toBeUndefined();
    expect(fiche.priceRange).toBeUndefined();
    expect(fiche.areaServed).toBeUndefined();
  });

  it("publie une fourchette de prix seulement si elle vient du catalogue", () => {
    const fiche = jsonldEntreprise(tenant, {
      adresse: { rue: null, codePostal: null, ville: null },
      communesDesservies: [],
      prixMinCents: 8_500,
      prixMaxCents: 11_300,
    });
    expect(fiche.priceRange).toBe("85-113 EUR");
  });
});

describe("fil d'Ariane et FAQ", () => {
  it("numérote les étapes à partir de 1 avec des URL absolues", () => {
    const fil = jsonldFilAriane([
      { nom: "Accueil", chemin: "/" },
      { nom: "Livraison", chemin: "/livraison" },
    ]);
    expect(fil.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Livraison", item: `${SITE}/livraison` },
    ]);
  });

  it("structure les questions au format attendu", () => {
    const faq = jsonldFaq([{ question: "Livrez-vous ?", reponse: "Oui." }]) as {
      mainEntity: Array<Record<string, unknown>>;
    };
    expect(faq.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "Livrez-vous ?",
      acceptedAnswer: { "@type": "Answer", text: "Oui." },
    });
  });
});

describe("slug de commune", () => {
  it("retire les accents et normalise la ponctuation", () => {
    expect(slugCommune("Boulieu-lès-Annonay")).toBe("boulieu-les-annonay");
    expect(slugCommune("Davézieux")).toBe("davezieux");
    expect(slugCommune("Saint-Julien-Molin-Molette")).toBe("saint-julien-molin-molette");
  });

  it("ne laisse ni tiret en tête ni tiret en fin", () => {
    expect(slugCommune("  Sarras  ")).toBe("sarras");
    expect(slugCommune("L'Étrat")).toBe("l-etrat");
  });
});
