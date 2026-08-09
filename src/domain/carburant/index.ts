/**
 * Relevé du prix du carburant — docs/02-MOTEURS-METIER.md §2.4
 *
 * Source : open data officiel français (data.economie.gouv.fr), et non un
 * scraping du site d'un distributeur — gratuit, officiel, et qui ne casse pas au
 * premier changement de page.
 *
 * Logique pure : ce module ne fait aucun appel réseau. Il reçoit des prix, il
 * rend une décision. C'est ce qui le rend testable.
 */

export interface DecisionReleve {
  /** Prix retenu, en centimes par litre. */
  prixCents: number;
  /** Nombre de relevés effectivement utilisés après nettoyage. */
  echantillon: number;
  /** Relevés écartés comme aberrants. */
  ecartes: number;
  /** Faux quand le contrôle de sanité refuse la valeur. */
  applicable: boolean;
  raison?: "variation_excessive" | "echantillon_insuffisant";
  /** Variation par rapport au dernier relevé, en pourcentage signé. */
  variationPct: number | null;
}

/** Écart maximal toléré d'un jour sur l'autre. Au-delà, on suspecte un bug. */
export const VARIATION_MAX_PCT = 15;

/** En dessous, la médiane n'est pas représentative d'un département. */
export const ECHANTILLON_MINIMUM = 3;

/**
 * Département à partir d'un code postal.
 * Gère l'outre-mer (971 à 978) et la Corse, où le découpage n'est pas
 * simplement les deux premiers chiffres.
 */
export function departementDepuisCodePostal(codePostal: string): string | null {
  const cp = codePostal.replace(/\D/g, "");
  if (cp.length !== 5) return null;

  if (cp.startsWith("97") || cp.startsWith("98")) return cp.slice(0, 3);
  // La Corse est 2A/2B dans le référentiel, mais l'open data carburant utilise
  // « 20 » : on garde les deux premiers chiffres, qui fonctionnent des deux côtés.
  return cp.slice(0, 2);
}

export function mediane(valeurs: number[]): number {
  if (valeurs.length === 0) return Number.NaN;
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 1
    ? triees[milieu]
    : (triees[milieu - 1] + triees[milieu]) / 2;
}

function quantile(triees: number[], q: number): number {
  const position = (triees.length - 1) * q;
  const bas = Math.floor(position);
  const haut = Math.ceil(position);
  if (bas === haut) return triees[bas];
  return triees[bas] + (position - bas) * (triees[haut] - triees[bas]);
}

/**
 * Écarte les valeurs aberrantes par la règle de Tukey (1,5 × écart
 * interquartile). Une station qui affiche 0,01 € ou 9,99 € ne doit pas tirer la
 * médiane du département.
 */
export function ecarterAberrants(valeurs: number[]): { retenus: number[]; ecartes: number[] } {
  const propres = valeurs.filter((v) => Number.isFinite(v) && v > 0);
  if (propres.length < 4) return { retenus: propres, ecartes: [] };

  const triees = [...propres].sort((a, b) => a - b);
  const q1 = quantile(triees, 0.25);
  const q3 = quantile(triees, 0.75);
  const iqr = q3 - q1;
  const bas = q1 - 1.5 * iqr;
  const haut = q3 + 1.5 * iqr;

  return {
    retenus: propres.filter((v) => v >= bas && v <= haut),
    ecartes: propres.filter((v) => v < bas || v > haut),
  };
}

/**
 * Décide si un nouveau relevé peut remplacer le précédent.
 *
 * @param prixParLitre prix en euros, tels que fournis par l'open data
 * @param dernierCents dernier prix retenu, en centimes ; `null` au premier relevé
 */
export function deciderReleve(
  prixParLitre: number[],
  dernierCents: number | null,
): DecisionReleve {
  const { retenus, ecartes } = ecarterAberrants(prixParLitre);

  if (retenus.length < ECHANTILLON_MINIMUM) {
    return {
      prixCents: 0,
      echantillon: retenus.length,
      ecartes: ecartes.length,
      applicable: false,
      raison: "echantillon_insuffisant",
      variationPct: null,
    };
  }

  const prixCents = Math.round(mediane(retenus) * 100);
  const variationPct =
    dernierCents && dernierCents > 0
      ? Math.round(((prixCents - dernierCents) / dernierCents) * 1000) / 10
      : null;

  // Un écart brutal signale plus souvent un bug de source qu'un vrai mouvement
  // de marché. On refuse d'appliquer et on laisse l'exploitant trancher.
  if (variationPct !== null && Math.abs(variationPct) > VARIATION_MAX_PCT) {
    return {
      prixCents,
      echantillon: retenus.length,
      ecartes: ecartes.length,
      applicable: false,
      raison: "variation_excessive",
      variationPct,
    };
  }

  return {
    prixCents,
    echantillon: retenus.length,
    ecartes: ecartes.length,
    applicable: true,
    variationPct,
  };
}
