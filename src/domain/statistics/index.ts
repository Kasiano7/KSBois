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

/* ==========================================================================
   Séries temporelles — la matière des courbes de l'administration.

   Le pas de temps n'est pas choisi par l'exploitant : il découle de la durée
   affichée. Une courbe de 365 points quotidiens est illisible sur un écran
   d'ordinateur portable, et une courbe de 4 points mensuels sur 30 jours ne
   dit rien. On agrège donc, et on l'écrit sous le graphique.
   ========================================================================== */

export type Granularite = "jour" | "semaine" | "mois";

/** Nombre de segments au-delà duquel une courbe devient un aplat de bruit. */
const MAX_POINTS_SERIE = 400;

export function choisirGranularite(debut: Date, fin: Date): Granularite {
  const jours = (fin.getTime() - debut.getTime()) / JOUR_MS;
  if (jours <= 45) return "jour";
  if (jours <= 200) return "semaine";
  return "mois";
}

/** Début du seau contenant `date` : minuit UTC, lundi UTC, ou 1er du mois UTC. */
export function debutDeSeau(date: Date, granularite: Granularite): Date {
  const jour = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  if (granularite === "jour") return jour;
  if (granularite === "mois") {
    return new Date(Date.UTC(jour.getUTCFullYear(), jour.getUTCMonth(), 1));
  }
  // Semaine ISO : elle commence le lundi. getUTCDay() met dimanche à 0.
  const decalage = (jour.getUTCDay() + 6) % 7;
  return new Date(jour.getTime() - decalage * JOUR_MS);
}

export function seauSuivant(debut: Date, granularite: Granularite): Date {
  if (granularite === "mois") {
    return new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 1));
  }
  return new Date(debut.getTime() + (granularite === "jour" ? 1 : 7) * JOUR_MS);
}

export interface PointSerie {
  /** Début du seau, en ISO — sert de clé React et d'ancre pour les libellés. */
  cle: string;
  commandes: number;
  caCents: number;
  volumeM3: number;
}

/**
 * Agrège des commandes en une série régulière, **trous compris**.
 *
 * Les seaux vides valent zéro et ne sont pas omis : une semaine sans vente est
 * une information, et une courbe qui saute par-dessus la ment par omission.
 */
export function agregerSerie(
  points: ReadonlyArray<{ dateIso: string; caCents: number; volumeM3: number }>,
  debut: Date,
  fin: Date,
  granularite: Granularite,
): PointSerie[] {
  if (!(debut.getTime() < fin.getTime())) return [];

  const seaux = new Map<string, PointSerie>();
  for (
    let curseur = debutDeSeau(debut, granularite);
    curseur.getTime() < fin.getTime() && seaux.size < MAX_POINTS_SERIE;
    curseur = seauSuivant(curseur, granularite)
  ) {
    seaux.set(curseur.toISOString(), {
      cle: curseur.toISOString(),
      commandes: 0,
      caCents: 0,
      volumeM3: 0,
    });
  }

  for (const point of points) {
    const date = new Date(point.dateIso);
    if (Number.isNaN(date.getTime())) continue;
    const seau = seaux.get(debutDeSeau(date, granularite).toISOString());
    if (!seau) continue;
    seau.commandes += 1;
    seau.caCents += point.caCents;
    seau.volumeM3 += point.volumeM3;
  }

  return [...seaux.values()].map((seau) => ({
    ...seau,
    volumeM3: Math.round(seau.volumeM3 * 1000) / 1000,
  }));
}

/**
 * Moyenne mobile centrée — la courbe de tendance posée sur les valeurs brutes.
 *
 * Centrée et non glissante vers l'arrière : on regarde le passé, pas une
 * prévision. Une moyenne à retard décalerait visuellement les pics d'une
 * demi-fenêtre, ce qui ferait mentir la lecture « la hausse a commencé là ».
 * Les bords utilisent la fenêtre disponible plutôt que de disparaître.
 */
export function moyenneMobile(valeurs: readonly number[], fenetre: number): number[] {
  const rayon = Math.max(0, Math.floor((fenetre - 1) / 2));
  if (rayon === 0) return [...valeurs];
  return valeurs.map((_, index) => {
    const debut = Math.max(0, index - rayon);
    const fin = Math.min(valeurs.length, index + rayon + 1);
    const tranche = valeurs.slice(debut, fin);
    return tranche.reduce((somme, valeur) => somme + valeur, 0) / tranche.length;
  });
}
