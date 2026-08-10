import "server-only";

import type { Point } from "@/domain/secteur";

/**
 * Base officielle des communes — geo.api.gouv.fr (Etalab)
 *
 * Gratuite, sans clé, mise à jour à chaque fusion de communes. C'est la même
 * philosophie que le relevé de carburant (docs/02 §2.4) : une source publique
 * officielle plutôt qu'un fichier CSV figé qui vieillit en silence.
 *
 * ⚠️ On interroge DÉPARTEMENT par DÉPARTEMENT. La liste complète des 35 000
 * communes pèse 4,8 Mo et met une vingtaine de secondes à arriver : intenable
 * dans une fonction serverless. Les départements à interroger sont déterminés
 * par `departementsCandidats` (src/domain/secteur).
 */

const API_COMMUNES = "https://geo.api.gouv.fr/communes";
const API_ADRESSE = "https://api-adresse.data.gouv.fr/search";

export interface CommuneOfficielle {
  inseeCode: string;
  nom: string;
  /** Une commune peut porter plusieurs codes postaux (et souvent en porte 2). */
  codesPostaux: string[];
  lat: number;
  lng: number;
  population: number | null;
}

interface CommuneApi {
  code?: string;
  nom?: string;
  codesPostaux?: string[];
  centre?: { coordinates?: [number, number] };
  population?: number;
}

/**
 * Cache mémoire par département.
 *
 * Le découpage communal ne bouge qu'au 1ᵉʳ janvier : une journée de cache est
 * généreuse et évite de marteler une API publique quand l'exploitant essaie
 * plusieurs rayons à la suite. Le cache `fetch` de Next n'est pas utilisable
 * ici : les réponses dépassent sa limite de 2 Mo par entrée.
 */
const CACHE_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { expire: number; communes: CommuneOfficielle[] }>();

async function lireDepartement(code: string): Promise<CommuneOfficielle[]> {
  const enCache = cache.get(code);
  if (enCache && enCache.expire > Date.now()) return enCache.communes;

  const parametres = new URLSearchParams({
    codeDepartement: code,
    fields: "nom,code,codesPostaux,centre,population",
    format: "json",
  });

  const reponse = await fetch(`${API_COMMUNES}?${parametres}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!reponse.ok) {
    throw new Error(`geo.api.gouv.fr (département ${code}) : HTTP ${reponse.status}`);
  }

  const brut = (await reponse.json()) as CommuneApi[];
  const communes = brut.flatMap((c): CommuneOfficielle[] => {
    const coordonnees = c.centre?.coordinates;
    // Une commune sans centre ni code postal n'est pas exploitable : on
    // l'ignore plutôt que d'insérer une ligne au rabais dans la grille.
    if (!c.code || !c.nom || !coordonnees || !c.codesPostaux?.length) return [];
    return [
      {
        inseeCode: c.code,
        nom: c.nom,
        codesPostaux: c.codesPostaux,
        lat: coordonnees[1],
        lng: coordonnees[0],
        population: typeof c.population === "number" ? c.population : null,
      },
    ];
  });

  cache.set(code, { expire: Date.now() + CACHE_MS, communes });
  return communes;
}

export interface LectureCommunes {
  communes: CommuneOfficielle[];
  /** Départements dont la lecture a échoué : le scan est alors INCOMPLET. */
  departementsEnEchec: string[];
}

/**
 * Lit plusieurs départements en parallèle.
 *
 * Un département en échec ne fait pas échouer le scan entier — mais il est
 * remonté explicitement : annoncer « 38 communes trouvées » en taisant que la
 * Loire n'a pas répondu ferait croire à l'exploitant que son secteur s'arrête
 * au Rhône.
 */
export async function listerCommunesDepartements(
  codes: readonly string[],
): Promise<LectureCommunes> {
  const resultats = await Promise.allSettled(codes.map(lireDepartement));

  const communes: CommuneOfficielle[] = [];
  const departementsEnEchec: string[] = [];

  resultats.forEach((r, i) => {
    if (r.status === "fulfilled") {
      communes.push(...r.value);
    } else {
      console.error(`[secteur] département ${codes[i]} :`, r.reason);
      departementsEnEchec.push(codes[i]);
    }
  });

  return { communes, departementsEnEchec };
}

/** Cache des recherches par code postal, même durée que les départements. */
const cacheCodePostal = new Map<string, { expire: number; communes: CommuneOfficielle[] }>();

/**
 * Communes françaises portant un code postal donné.
 *
 * Sert la résolution de zone (docs/02 §2.1) : un code postal absent de la liste
 * de l'exploitant n'est pas pour autant un code postal inconnu. Savoir que
 * 07340 est Serrières, Peaugres ou Andance permet de répondre « nous ne livrons
 * pas encore Peaugres » plutôt que « code postal inconnu » — la première phrase
 * amène une demande de devis, la seconde ressemble à un bug.
 *
 * @returns `null` si la source est injoignable — à distinguer d'un tableau vide,
 *          qui signifie « ce code postal n'existe pas en France ».
 */
export async function communesParCodePostal(
  codePostal: string,
): Promise<CommuneOfficielle[] | null> {
  if (!/^\d{5}$/.test(codePostal)) return [];

  const enCache = cacheCodePostal.get(codePostal);
  if (enCache && enCache.expire > Date.now()) return enCache.communes;

  const parametres = new URLSearchParams({
    codePostal,
    fields: "nom,code,codesPostaux,centre,population",
    format: "json",
  });

  try {
    const reponse = await fetch(`${API_COMMUNES}?${parametres}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      // Ce chemin est parcouru pendant qu'un client attend son prix : on abrège
      // plutôt que de faire patienter le panier. Au pire, le message de repli
      // reste correct — il ne prétend jamais que le code postal n'existe pas.
      signal: AbortSignal.timeout(4_000),
    });

    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);

    const brut = (await reponse.json()) as CommuneApi[];
    const communes = brut.flatMap((c): CommuneOfficielle[] => {
      const coordonnees = c.centre?.coordinates;
      if (!c.code || !c.nom || !coordonnees) return [];
      return [
        {
          inseeCode: c.code,
          nom: c.nom,
          codesPostaux: c.codesPostaux ?? [codePostal],
          lat: coordonnees[1],
          lng: coordonnees[0],
          population: typeof c.population === "number" ? c.population : null,
        },
      ];
    });

    cacheCodePostal.set(codePostal, { expire: Date.now() + CACHE_MS, communes });
    return communes;
  } catch (erreur) {
    console.error(`[zones] base officielle (${codePostal}) :`, erreur);
    return null;
  }
}

export interface AdresseGeocodee extends Point {
  ville: string;
  codePostal: string;
  inseeCode: string | null;
}

/**
 * Géocode une adresse via la Base Adresse Nationale.
 *
 * Sert quand l'exploitant n'a jamais renseigné les coordonnées de son dépôt :
 * sans point de départ, aucun rayon n'a de sens. Mieux vaut le déduire de son
 * adresse que de lui demander d'aller chercher une latitude.
 */
export async function geocoderAdresse(requete: string): Promise<AdresseGeocodee | null> {
  const parametres = new URLSearchParams({ q: requete, limit: "1" });

  const reponse = await fetch(`${API_ADRESSE}/?${parametres}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!reponse.ok) throw new Error(`api-adresse.data.gouv.fr : HTTP ${reponse.status}`);

  const donnees = (await reponse.json()) as {
    features?: {
      geometry?: { coordinates?: [number, number] };
      properties?: { city?: string; postcode?: string; citycode?: string };
    }[];
  };

  const trouve = donnees.features?.[0];
  const coordonnees = trouve?.geometry?.coordinates;
  if (!coordonnees || !trouve?.properties?.postcode) return null;

  return {
    lat: coordonnees[1],
    lng: coordonnees[0],
    ville: trouve.properties.city ?? "",
    codePostal: trouve.properties.postcode,
    inseeCode: trouve.properties.citycode ?? null,
  };
}
