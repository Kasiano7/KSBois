/**
 * Unités de vente du bois de chauffage.
 *
 * Règle légale (PLAN.md §3.1) : le stère n'est plus une unité de mesure légale
 * en France depuis le décret n° 75-1200. L'unité canonique du système est le
 * MÈTRE CUBE APPARENT (m³ apparent). Le mot « stère » n'apparaît qu'en mention
 * secondaire, pour être compris des clients.
 *
 * Aucune de ces valeurs ne doit être dupliquée ailleurs dans le code.
 */

/** Volume exprimé en mètres cubes apparents. */
export type M3Apparent = number;

/**
 * Coefficient d'empilage : volume apparent obtenu à partir d'un stère de bois
 * de 1 m, une fois recoupé à la longueur donnée (PLAN.md §3.2).
 *
 * ⚠️ Valeurs de référence uniquement — utilisées pour le SEED de la table
 * `cut_lengths`. À l'exécution, on lit TOUJOURS `cut_lengths.stacking_coefficient`,
 * qui est éditable depuis l'administration.
 */
export const DEFAULT_STACKING_COEFFICIENTS: Readonly<Record<number, number>> = Object.freeze({
  100: 1.0,
  50: 0.8,
  40: 0.75,
  33: 0.7,
  25: 0.65,
});

/**
 * Base de prix retenue par l'entreprise (PLAN.md §3.3).
 * - `map_delivered`        : le prix s'entend au m³ apparent de la longueur livrée (défaut marché)
 * - `stere_1m_equivalent`  : le prix s'entend au stère équivalent bois de 1 m
 */
export type PricingBasis = "map_delivered" | "stere_1m_equivalent";

/**
 * Volume apparent réellement livré pour une quantité commandée.
 *
 * En base `map_delivered`, le client qui commande 3 reçoit 3 m³ apparents.
 * En base `stere_1m_equivalent`, il reçoit 3 × coefficient m³ apparents.
 */
export function deliveredVolumeM3(
  quantity: number,
  stackingCoefficient: number,
  basis: PricingBasis,
): M3Apparent {
  const volume = basis === "stere_1m_equivalent" ? quantity * stackingCoefficient : quantity;
  return roundVolume(volume);
}

/** Les volumes sont stockés et comparés au millième de m³. */
export function roundVolume(m3: number): M3Apparent {
  return Math.round(m3 * 1000) / 1000;
}

const volumeFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/**
 * Formatage canonique d'un volume. Point d'entrée UNIQUE : fiche produit,
 * panier, devis, facture, bon de livraison, emails (docs/02 §1.4).
 *
 * @example formatVolume(3)      → "3 m³ apparents"
 * @example formatVolume(1)      → "1 m³ apparent"
 * @example formatVolume(2.5)    → "2,5 m³ apparents"
 */
export function formatVolume(m3: M3Apparent): string {
  const value = volumeFormatter.format(m3);
  return `${value} m³ apparent${m3 >= 2 ? "s" : ""}`;
}

/**
 * Formatage canonique d'une distance routière.
 *
 * Depuis le scan de secteur (docs/02 §2.1), les distances portent une décimale :
 * un « 7.3 km » à l'anglaise sur une page client jurerait avec le reste du site,
 * où tout est en virgule décimale.
 *
 * @example formatDistance(7.3) → "7,3 km"
 * @example formatDistance(12)  → "12 km"
 */
export function formatDistance(km: number): string {
  return `${km.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}

/**
 * Équivalent en stères de bois de 1 m d'un volume apparent livré à une longueur
 * donnée.
 *
 * ⚠️ CORRECTION D'UN BUG : on affichait « ≈ X stères » pour X m³ apparents, quelle
 * que soit la longueur de coupe. C'était faux, et cela vidait de son sens le
 * coefficient d'empilage du PLAN.md §3.2.
 *
 * Le stère se définit comme 1 m³ apparent de rondins de 1 m. Recoupé plus court,
 * le bois s'empile plus dense : un stère de 1 m ne remplit plus que 0,70 m³
 * apparent en 33 cm. Réciproquement, 1 m³ apparent de bûches de 33 cm contient
 * la matière de 1 / 0,70 ≈ 1,43 stère.
 *
 * @example steresEquivalent1m(2, 0.70) → 2.857  (2 m³app en 33 cm)
 * @example steresEquivalent1m(2, 1)    → 2      (bois en 1 m : identité)
 */
export function steresEquivalent1m(
  m3Apparent: M3Apparent,
  stackingCoefficient: number,
): number {
  if (!Number.isFinite(stackingCoefficient) || stackingCoefficient <= 0) return m3Apparent;
  return roundVolume(m3Apparent / stackingCoefficient);
}

/**
 * Mention secondaire, affichée à côté du volume officiel.
 * Réservée à l'ÉCRAN : contient le caractère « ≈ ».
 *
 * Le coefficient est OBLIGATOIRE : sans lui, on retomberait dans le bug de
 * l'équivalence systématique 1 m³ apparent = 1 stère.
 *
 * @example formatStereHint(2, 0.70) → "≈ 2,86 stères de bois de 1 m"
 */
export function formatStereHint(m3: M3Apparent, stackingCoefficient: number): string {
  const steres = steresEquivalent1m(m3, stackingCoefficient);
  const valeur = volumeFormatter.format(steres);
  return `≈ ${valeur} stère${steres >= 2 ? "s" : ""} de bois de 1 m`;
}

/**
 * Phrase d'équivalence complète, à afficher sous la quantité.
 * Retourne `null` quand il n'y a rien à expliquer — bois déjà en 1 m, ou
 * longueur inconnue. On n'encombre pas l'écran d'une évidence.
 */
export function formatEquivalenceSteres(
  m3Apparent: M3Apparent,
  cutLengthCm: number | null,
  stackingCoefficient: number | null,
): string | null {
  if (cutLengthCm === null || stackingCoefficient === null) return null;
  if (Math.abs(stackingCoefficient - 1) < 0.001) return null;

  const steres = steresEquivalent1m(m3Apparent, stackingCoefficient);
  return (
    `Soit la matière d'environ ${volumeFormatter.format(steres)} stère` +
    `${steres >= 2 ? "s" : ""} de bois en 1 m : coupé en ${cutLengthCm} cm, ` +
    `le bois s'empile plus dense.`
  );
}

/**
 * Variante pour les DOCUMENTS PDF.
 *
 * ⚠️ Le coefficient est requis pour la même raison que `formatStereHint` :
 * l'équivalence en stères dépend de la longueur de coupe.
 *
 * ⚠️ Ne jamais utiliser « ≈ » dans un PDF : ce caractère (U+2248) est absent de
 * l'encodage WinAnsi des polices standard, et @react-pdf le remplace
 * SILENCIEUSEMENT par la lettre « H ». Le devis affichait « H 5 stères ».
 * Tant que les documents utilisent les polices standard, ils doivent se limiter
 * aux caractères WinAnsi — « environ » est de toute façon plus clair sur un
 * document commercial.
 *
 * @example formatStereHintPdf(2, 0.70) → "environ 2,86 steres de bois de 1 m"
 */
export function formatStereHintPdf(m3: M3Apparent, stackingCoefficient: number): string {
  const steres = steresEquivalent1m(m3, stackingCoefficient);
  const valeur = volumeFormatter.format(steres);
  return `environ ${valeur} stère${steres >= 2 ? "s" : ""} de bois de 1 m`;
}

/**
 * Phrase complète affichée sur la fiche produit. Elle est CALCULÉE, jamais
 * saisie à la main : c'est ce qui protège d'un litige sur les quantités.
 *
 * @example describeDelivered(3, 33) → "Vous recevrez 3 m³ apparents de bûches de 33 cm"
 */
export function describeDelivered(m3: M3Apparent, cutLengthCm: number | null): string {
  const base = `Vous recevrez ${formatVolume(m3)}`;
  return cutLengthCm ? `${base} de bûches de ${cutLengthCm} cm` : base;
}

/** Formatage monétaire depuis des centimes entiers. */
export function formatEuros(cents: number): string {
  return moneyFormatter.format(cents / 100);
}

/**
 * Montant abrégé — **graduations d'axe et étiquettes de graphique uniquement**.
 *
 * Jamais sur un prix, un total, une facture ou un devis : « 1,2 k€ » n'est pas
 * une somme, c'est un repère de lecture. Le montant exact reste affiché en
 * toutes lettres à côté de chaque courbe (docs/03 §11).
 */
export function formatEurosCompact(cents: number): string {
  const euros = cents / 100;
  const absolu = Math.abs(euros);
  if (absolu >= 1_000_000) {
    return `${(euros / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  }
  if (absolu >= 1_000) {
    return `${(euros / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: absolu >= 10_000 ? 0 : 1 })} k€`;
  }
  return `${Math.round(euros).toLocaleString("fr-FR")} €`;
}

/**
 * Vérifie qu'une quantité respecte les bornes et le pas de la variante.
 * Retourne `null` si valide, sinon un message destiné à l'utilisateur.
 */
export function validateQuantity(
  quantity: number,
  { min, max, step }: { min: number; max: number | null; step: number },
): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Indiquez une quantité.";
  }
  if (quantity < min) {
    return `La quantité minimum est de ${volumeFormatter.format(min)}.`;
  }
  if (max !== null && quantity > max) {
    return `La quantité maximum est de ${volumeFormatter.format(max)}.`;
  }
  // Comparaison en millièmes pour éviter les pièges de la virgule flottante.
  const remainder = Math.round(quantity * 1000) % Math.round(step * 1000);
  if (remainder !== 0) {
    return `La quantité doit être un multiple de ${volumeFormatter.format(step)}.`;
  }
  return null;
}
