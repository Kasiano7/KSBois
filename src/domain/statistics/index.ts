/**
 * Calculs purs des statistiques d'exploitation.
 * Aucun accès base, aucune date implicite : tout est injecté et testable.
 */

export function pourcentage(partie: number, total: number): number | null {
  if (!Number.isFinite(partie) || !Number.isFinite(total) || total <= 0) return null;
  return Math.round((partie / total) * 10_000) / 100;
}
export function moyennePonderee(
  lignes: ReadonlyArray<{ valeur: number; poids: number }>,
): number | null {
  const valides = lignes.filter(
    (ligne) => Number.isFinite(ligne.valeur) && Number.isFinite(ligne.poids) && ligne.poids > 0,
  );
  const poids = valides.reduce((somme, ligne) => somme + ligne.poids, 0);
  if (poids <= 0) return null;
  return valides.reduce((somme, ligne) => somme + ligne.valeur * ligne.poids, 0) / poids;
}

export function mediane(valeurs: readonly number[]): number | null {
  const triees = valeurs.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (triees.length === 0) return null;
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 0
    ? (triees[milieu - 1] + triees[milieu]) / 2
    : triees[milieu];
}

export function coutReelLivraisonCents(entree: {
  distanceKm: number;
  consommationLitres100Km: number;
  prixCarburantCentsLitre: number;
  coutVehiculeCentsKm: number;
}): number {
  const distanceAllerRetour = Math.max(0, entree.distanceKm) * 2;
  const litres = (distanceAllerRetour * Math.max(0, entree.consommationLitres100Km)) / 100;
  return Math.round(
    litres * Math.max(0, entree.prixCarburantCentsLitre) +
      distanceAllerRetour * Math.max(0, entree.coutVehiculeCentsKm),
  );
}

export type PrioriteStock = "urgent" | "a_produire" | "a_surveiller" | "stable";

export function projeterStock(entree: {
  stockDisponibleM3: number;
  volumeVenduM3: number;
  joursObserves: number;
  seuilUrgentJours: number;
  seuilAlerteJours: number;
}): {
  vitesseM3ParJour: number;
  joursRestants: number | null;
  priorite: PrioriteStock;
} {
  const jours = Math.max(1, entree.joursObserves);
  const vitesseM3ParJour = Math.max(0, entree.volumeVenduM3) / jours;
  if (vitesseM3ParJour <= 0) {
    return { vitesseM3ParJour: 0, joursRestants: null, priorite: "stable" };
  }

  const joursRestants = Math.max(0, entree.stockDisponibleM3) / vitesseM3ParJour;
  const priorite: PrioriteStock =
    joursRestants <= entree.seuilUrgentJours
      ? "urgent"
      : joursRestants <= entree.seuilAlerteJours
        ? "a_produire"
        : joursRestants <= entree.seuilAlerteJours * 2
          ? "a_surveiller"
          : "stable";

  return { vitesseM3ParJour, joursRestants, priorite };
}

const JOUR_MS = 86_400_000;

export function predireProchaineCommande(
  datesIso: readonly string[],
): { intervalleJours: number; datePrevue: string } | null {
  const dates = datesIso
    .map((date) => new Date(date).getTime())
    .filter(Number.isFinite)
    .toSorted((a, b) => a - b);
  if (dates.length < 2) return null;

  const intervalles = dates.slice(1).map((date, index) => (date - dates[index]) / JOUR_MS);
  const intervalle = mediane(intervalles);
  if (intervalle === null || intervalle <= 0) return null;

  return {
    intervalleJours: Math.round(intervalle),
    datePrevue: new Date(dates.at(-1)! + intervalle * JOUR_MS).toISOString(),
  };
}

export function evolutionPourcent(valeur: number, precedente: number): number | null {
  if (precedente <= 0) return null;
  return Math.round(((valeur - precedente) / precedente) * 10_000) / 100;
}
