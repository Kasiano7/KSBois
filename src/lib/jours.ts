/**
 * Formatage des jours de livraison en français correct.
 *
 * Une énumération brute donne « le lundi et le mardi et le mercredi et le jeudi
 * et le vendredi », ce qui est illisible. On regroupe donc les suites de jours
 * consécutifs en « du lundi au vendredi ».
 */

const NOMS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const listFormatter = new Intl.ListFormat("fr-FR", { style: "long", type: "conjunction" });

/** Nom du jour à partir d'un numéro ISO (1 = lundi). */
export function nomJour(iso: number): string {
  return NOMS[iso] ?? "";
}

/**
 * @example formatJoursLivraison([1,2,3,4,5]) → "du lundi au vendredi"
 * @example formatJoursLivraison([2,4])       → "le mardi et le jeudi"
 * @example formatJoursLivraison([2])         → "le mardi"
 * @example formatJoursLivraison([1,2,4,5])   → "du lundi au mardi et du jeudi au vendredi"
 */
export function formatJoursLivraison(jours: number[]): string {
  const tries = [...new Set(jours)].filter((j) => j >= 1 && j <= 7).sort((a, b) => a - b);
  if (tries.length === 0) return "";

  // Découpage en plages de jours consécutifs.
  const plages: number[][] = [];
  for (const jour of tries) {
    const derniere = plages.at(-1);
    if (derniere && jour === derniere.at(-1)! + 1) derniere.push(jour);
    else plages.push([jour]);
  }

  const morceaux = plages.map((plage) =>
    // À partir de trois jours consécutifs, « du … au … » est plus lisible.
    plage.length >= 3
      ? `du ${nomJour(plage[0])} au ${nomJour(plage.at(-1)!)}`
      : plage.map((j) => `le ${nomJour(j)}`).join(" et "),
  );

  return listFormatter.format(morceaux);
}
