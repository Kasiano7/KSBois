/**
 * Secteur de livraison — docs/02-MOTEURS-METIER.md §2.1
 *
 * « Je suis à Villevocance, je livre à 25 km » : tout part de là. Ce module
 * contient la géométrie pure — aucun appel réseau, aucune base — pour qu'elle
 * soit testable et que le comportement du scan ne dépende pas d'une API.
 */

import type { DepartementReference } from "@/data/departements-france";

export interface Point {
  lat: number;
  lng: number;
}

/** D'où vient la distance retenue pour une commune. */
export type SourceDistance = "manuelle" | "route" | "vol_oiseau";

const RAYON_TERRE_KM = 6371;

const enRadians = (degres: number) => (degres * Math.PI) / 180;

/** Distance orthodromique. Suffisamment précise à l'échelle d'un département. */
export function distanceVolOiseauKm(a: Point, b: Point): number {
  const dLat = enRadians(b.lat - a.lat);
  const dLng = enRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(enRadians(a.lat)) * Math.cos(enRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Coefficient de sinuosité : rapport moyen entre distance routière et distance
 * à vol d'oiseau. 1,3 est la valeur usuelle en France ; en secteur de montagne
 * elle monte vers 1,5.
 *
 * Il ne sert QUE de repli quand le routeur est injoignable. Une distance ainsi
 * estimée est marquée `vol_oiseau` pour que l'exploitant sache qu'elle est à
 * vérifier : c'est elle qui déterminera la surcharge carburant facturée.
 */
export const COEFFICIENT_SINUOSITE = 1.3;

export function estimerDistanceRouteKm(volOiseauKm: number): number {
  return Math.round(volOiseauKm * COEFFICIENT_SINUOSITE * 10) / 10;
}

/**
 * Départements susceptibles de contenir une commune du secteur.
 *
 * Le test est volontairement large : rater un département, c'est rater des
 * communes entières (le cas typique de la Loire ou de l'Isère juste de l'autre
 * côté du Rhône). Interroger un département de trop ne coûte qu'un appel HTTP.
 */
export function departementsCandidats(
  depot: Point,
  rayonKm: number,
  departements: readonly DepartementReference[],
): string[] {
  // Marge d'arrondi sur le centre et le rayon tabulés (4 décimales, entier).
  const marge = 5;
  return departements
    .filter((d) => distanceVolOiseauKm(depot, d) <= d.rayonKm + rayonKm + marge)
    .map((d) => d.code);
}

/**
 * Pré-filtre des communes avant le calcul routier.
 *
 * ⚠️ Aucune marge n'est nécessaire, et c'est important : une distance routière
 * est TOUJOURS supérieure ou égale à la distance à vol d'oiseau. Une commune à
 * plus de 25 km à vol d'oiseau ne peut donc pas être à moins de 25 km de route.
 * Le filtre est exact, pas approché — on ne perd aucune commune.
 */
export function communesDansLeRayon<T extends Point>(
  depot: Point,
  rayonKm: number,
  communes: readonly T[],
): (T & { volOiseauKm: number })[] {
  return communes
    .map((c) => ({ ...c, volOiseauKm: distanceVolOiseauKm(depot, c) }))
    .filter((c) => c.volOiseauKm <= rayonKm)
    .sort((a, b) => a.volOiseauKm - b.volOiseauKm);
}

export interface ZoneParDistance {
  id: string;
  nom: string;
  /** « Distance indicative » de la zone, telle que saisie dans l'administration. */
  distanceKmEstimate: number | null;
}

/**
 * Rattache une commune à la zone dont la distance indicative est la plus proche.
 *
 * Les zones décrivent des couronnes autour du dépôt (« 0 à 15 km », « 15 à
 * 30 km »…) et l'administration n'en retient qu'une distance REPRÉSENTATIVE,
 * pas une borne. Le plus proche voisin est donc la lecture fidèle du réglage :
 * avec des zones à 10, 22 et 37 km, une commune à 12 km tombe bien dans la
 * première couronne.
 *
 * En cas d'égalité parfaite, la zone la plus lointaine l'emporte : mieux vaut
 * proposer le tarif un cran au-dessus que sous-facturer la tournée.
 *
 * ⚠️ Au-delà de la dernière couronne, on ne devine PAS : la commune est
 * proposée sans zone — donc non desservie — et l'exploitant tranche. Deviner
 * ici reviendrait à facturer un tarif de proximité à 80 km.
 */
export function suggererZone(
  distanceKm: number,
  zones: readonly ZoneParDistance[],
): string | null {
  const bandes = zones
    .filter((z): z is ZoneParDistance & { distanceKmEstimate: number } =>
      z.distanceKmEstimate !== null,
    )
    .sort((a, b) => a.distanceKmEstimate - b.distanceKmEstimate);

  if (bandes.length === 0) return null;

  const derniere = bandes[bandes.length - 1];
  const avantDerniere = bandes[bandes.length - 2];
  // Largeur de la dernière couronne, déduite de l'écart avec la précédente.
  // Avec une seule zone, on retient sa propre distance : « 15 km indicatif »
  // couvre alors jusqu'à 22,5 km.
  const largeur = avantDerniere
    ? derniere.distanceKmEstimate - avantDerniere.distanceKmEstimate
    : derniere.distanceKmEstimate;

  if (distanceKm > derniere.distanceKmEstimate + largeur / 2) return null;

  return bandes.reduce((meilleure, z) =>
    Math.abs(z.distanceKmEstimate - distanceKm) <=
    Math.abs(meilleure.distanceKmEstimate - distanceKm)
      ? z
      : meilleure,
  ).id;
}

/**
 * Borne une distance routière proposée par le client de l'administration.
 *
 * Le formulaire d'import renvoie les distances calculées lors de l'analyse ;
 * elles alimentent la surcharge carburant, donc une facture. On ne peut pas
 * accepter n'importe quelle valeur : la route ne peut pas être plus courte que
 * le vol d'oiseau, ni raisonnablement plus de trois fois plus longue.
 */
export function bornerDistanceRoute(distanceKm: number, volOiseauKm: number): number {
  const plancher = Math.round(volOiseauKm * 10) / 10;
  const plafond = Math.round((volOiseauKm * 3 + 5) * 10) / 10;
  // La colonne `distance_km` est un numeric(6,1) : on arrondit ici plutôt que
  // de laisser Postgres le faire en silence.
  const borne = Math.min(Math.max(distanceKm, plancher), plafond);
  return Math.round(borne * 10) / 10;
}

/**
 * Forme comparable d'un nom de commune : sans accents, sans casse, sans
 * ponctuation.
 *
 * Un client tape « st marcel les annonay », la base officielle écrit
 * « Saint-Marcel-lès-Annonay » et l'exploitant a peut-être saisi
 * « Saint Marcel les Annonay ». Comparer les chaînes brutes reviendrait à
 * répondre « nous ne livrons pas chez vous » à un client qu'on livre.
 *
 * Les abréviations (« st » pour « saint ») ne sont PAS développées : la
 * levée d'ambiguïté se fait par sélection dans une liste, pas par saisie libre.
 */
export function normaliserNomCommune(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Deux écritures désignent-elles la même commune ? */
export function memeCommune(a: string, b: string): boolean {
  return normaliserNomCommune(a) === normaliserNomCommune(b);
}

/** Clé d'identité d'une commune dans `zone_communes` : (code postal, nom). */
export function cleCommune(codePostal: string, ville: string): string {
  return `${codePostal}|${normaliserNomCommune(ville)}`;
}
