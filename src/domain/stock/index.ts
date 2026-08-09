/**
 * Vocabulaire du stock.
 *
 * ⚠️ Ces constantes vivent ici et NON dans le fichier d'actions : un module
 * marqué `"use server"` ne peut exporter que des fonctions asynchrones. Toute
 * autre valeur exportée arrive `undefined` côté client — l'erreur se voit
 * seulement à l'exécution, jamais à la compilation.
 */

export const MOTIFS_CORRECTION = [
  { valeur: "inventaire", libelle: "Inventaire physique" },
  { valeur: "erreur_saisie", libelle: "Erreur de saisie" },
  { valeur: "perte", libelle: "Perte ou casse" },
  { valeur: "reprise", libelle: "Reprise client" },
] as const;

export type MotifCorrection = (typeof MOTIFS_CORRECTION)[number]["valeur"];

export const MOTIFS_VALEURS = MOTIFS_CORRECTION.map((m) => m.valeur) as [
  MotifCorrection,
  ...MotifCorrection[],
];

export function libelleMotif(valeur: string): string {
  return MOTIFS_CORRECTION.find((m) => m.valeur === valeur)?.libelle ?? valeur;
}

export const LIBELLES_MOUVEMENT: Readonly<Record<string, string>> = Object.freeze({
  production: "Production ajoutée",
  reservation: "Réservé par une commande",
  release: "Réservation libérée",
  shipment: "Livré",
  adjustment: "Inventaire corrigé",
  loss: "Perte",
});

/** État d'un stock, pour l'affichage. Jamais la couleur seule (docs/03 §9). */
export type EtatStock = "rupture" | "bas" | "ok";

export function etatStock(
  disponible: number,
  seuil: number,
  suitStock: boolean,
): EtatStock {
  if (!suitStock) return "ok";
  if (disponible <= 0) return "rupture";
  return disponible <= seuil ? "bas" : "ok";
}
