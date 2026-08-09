/**
 * Formatage des jours de livraison en français correct.
 *
 * Une énumération brute donne « le lundi et le mardi et le mercredi et le jeudi
 * et le vendredi », ce qui est illisible. On regroupe donc les suites de jours
 * consécutifs en « du lundi au vendredi ».
 */

const NOMS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/**
 * Date en toutes lettres à partir d'une date ISO « AAAA-MM-JJ ».
 *
 * `Intl` écrit « 1 septembre » : personne n'écrit ni ne dit cela en français.
 * On rétablit le « 1er », et on lit la date en UTC pour qu'une date sans heure
 * ne recule pas d'un jour selon le fuseau du navigateur.
 *
 * @example formatDateFr("2026-09-01")                  → "mardi 1er septembre"
 * @example formatDateFr("2026-09-08", { jourSemaine: false }) → "8 septembre"
 */
export function formatDateFr(
  iso: string,
  { jourSemaine = true, annee = false }: { jourSemaine?: boolean; annee?: boolean } = {},
): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;

  const format = new Intl.DateTimeFormat("fr-FR", {
    weekday: jourSemaine ? "long" : undefined,
    day: "numeric",
    month: "long",
    year: annee ? "numeric" : undefined,
    timeZone: "UTC",
  });

  return format
    .formatToParts(new Date(Date.UTC(y, m - 1, d)))
    .map((p) => (p.type === "day" && p.value === "1" ? "1er" : p.value))
    .join("");
}

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
