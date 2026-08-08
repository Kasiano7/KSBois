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
 * Mention secondaire rassurante, affichée à côté du volume officiel.
 * Réservée à l'ÉCRAN : contient le caractère « ≈ ».
 * @example formatStereHint(3) → "≈ 3 stères"
 */
export function formatStereHint(m3: M3Apparent): string {
  return `≈ ${volumeFormatter.format(m3)} stère${m3 >= 2 ? "s" : ""}`;
}

/**
 * Variante pour les DOCUMENTS PDF.
 *
 * ⚠️ Ne jamais utiliser « ≈ » dans un PDF : ce caractère (U+2248) est absent de
 * l'encodage WinAnsi des polices standard, et @react-pdf le remplace
 * SILENCIEUSEMENT par la lettre « H ». Le devis affichait « H 5 stères ».
 * Tant que les documents utilisent les polices standard, ils doivent se limiter
 * aux caractères WinAnsi — « environ » est de toute façon plus clair sur un
 * document commercial.
 *
 * @example formatStereHintPdf(3) → "environ 3 stères"
 */
export function formatStereHintPdf(m3: M3Apparent): string {
  return `environ ${volumeFormatter.format(m3)} stère${m3 >= 2 ? "s" : ""}`;
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
