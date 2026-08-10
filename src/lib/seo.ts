import type { Metadata } from "next";
import type { Tenant } from "@/lib/tenant";

/**
 * Métadonnées et données structurées — docs/06 §1.
 *
 * Un seul point de construction : sans lui, une page finit toujours par
 * oublier sa canonique ou son image de partage, et personne ne s'en aperçoit
 * avant de regarder la Search Console six mois plus tard.
 *
 * ⚠️ Toute donnée structurée doit être VRAIE. Un `AggregateRating` inventé, un
 * horaire approximatif ou une zone desservie exagérée exposent à une pénalité
 * manuelle Google, bien plus coûteuse que le gain espéré (docs/06 §1.5).
 */

export function urlSite(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function urlAbsolue(chemin: string): string {
  return `${urlSite()}${chemin.startsWith("/") ? chemin : `/${chemin}`}`;
}

/**
 * Métadonnées d'une page publique.
 *
 * `titre` est complété par le `template` du layout racine : on ne répète donc
 * jamais le nom de l'entreprise ici. Viser 60 caractères une fois assemblé.
 */
export function metadataPage(options: {
  titre: string;
  description: string;
  chemin: string;
  /** Retire la page de l'index sans la retirer du site (docs/06 §1.3). */
  noindex?: boolean;
  imageOg?: string | null;
}): Metadata {
  const url = urlAbsolue(options.chemin);

  return {
    title: options.titre,
    description: options.description,
    alternates: { canonical: url },
    robots: options.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      locale: "fr_FR",
      url,
      title: options.titre,
      description: options.description,
      images: options.imageOg ? [{ url: options.imageOg, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: options.imageOg ? "summary_large_image" : "summary",
      title: options.titre,
      description: options.description,
    },
  };
}

/* ==========================================================================
   Données structurées
   ========================================================================== */

type Jsonld = Record<string, unknown>;

/**
 * Fiche établissement, posée sur toutes les pages publiques.
 *
 * `areaServed` liste les communes RÉELLEMENT desservies, lues en base : c'est
 * l'information qui alimente les recherches locales, et la seule qu'on ne peut
 * pas se permettre d'inventer.
 */
export function jsonldEntreprise(
  tenant: Tenant,
  options: {
    adresse: { rue: string | null; codePostal: string | null; ville: string | null };
    latitude?: number | null;
    longitude?: number | null;
    communesDesservies: string[];
    prixMinCents?: number | null;
    prixMaxCents?: number | null;
  },
): Jsonld {
  const fiche: Jsonld = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${urlSite()}/#entreprise`,
    name: tenant.name,
    url: urlSite(),
    description: tenant.tagline,
    address: {
      "@type": "PostalAddress",
      streetAddress: options.adresse.rue ?? undefined,
      postalCode: options.adresse.codePostal ?? undefined,
      addressLocality: options.adresse.ville ?? undefined,
      addressCountry: "FR",
    },
  };

  if (tenant.email) fiche.email = tenant.email;
  if (tenant.phone) fiche.telephone = tenant.phone;
  if (tenant.logoUrl) fiche.image = tenant.logoUrl;

  if (options.latitude != null && options.longitude != null) {
    fiche.geo = {
      "@type": "GeoCoordinates",
      latitude: options.latitude,
      longitude: options.longitude,
    };
  }

  if (options.communesDesservies.length > 0) {
    fiche.areaServed = options.communesDesservies.map((commune) => ({
      "@type": "City",
      name: commune,
    }));
  }

  // `priceRange` n'est publié que s'il correspond à de vrais prix catalogue.
  if (options.prixMinCents != null && options.prixMaxCents != null) {
    fiche.priceRange = `${Math.round(options.prixMinCents / 100)}-${Math.round(options.prixMaxCents / 100)} EUR`;
  }

  return fiche;
}

export function jsonldFilAriane(etapes: Array<{ nom: string; chemin: string }>): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: etapes.map((etape, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: etape.nom,
      item: urlAbsolue(etape.chemin),
    })),
  };
}

/**
 * Questions fréquentes.
 *
 * ⚠️ Les questions doivent être RÉELLEMENT présentes dans la page. Publier une
 * `FAQPage` dont le contenu n'apparaît pas à l'écran est explicitement contraire
 * aux règles de Google.
 */
export function jsonldFaq(questions: Array<{ question: string; reponse: string }>): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((entree) => ({
      "@type": "Question",
      name: entree.question,
      acceptedAnswer: { "@type": "Answer", text: entree.reponse },
    })),
  };
}

export function jsonldServiceLivraison(
  tenant: Tenant,
  communes: string[],
  description: string,
): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Livraison de bois de chauffage",
    provider: { "@type": "LocalBusiness", name: tenant.name, "@id": `${urlSite()}/#entreprise` },
    description,
    areaServed: communes.map((commune) => ({ "@type": "City", name: commune })),
  };
}

export function jsonldArticle(options: {
  titre: string;
  description: string;
  chemin: string;
  auteur: string;
  publieLe: string;
  modifieLe?: string;
}): Jsonld {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: options.titre,
    description: options.description,
    mainEntityOfPage: urlAbsolue(options.chemin),
    author: { "@type": "Organization", name: options.auteur },
    publisher: { "@type": "Organization", name: options.auteur },
    datePublished: options.publieLe,
    dateModified: options.modifieLe ?? options.publieLe,
  };
}
