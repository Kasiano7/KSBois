/**
 * Vocabulaire partagé de la bibliothèque de médias.
 *
 * ⚠️ Ces constantes ne peuvent PAS vivre dans le fichier d'actions : un module
 * `"use server"` n'a le droit d'exporter que des fonctions asynchrones. Exporter
 * un objet depuis un tel fichier échoue au chargement, pas à la compilation —
 * le typecheck passe et l'écran plante au premier affichage.
 */

export const DOSSIERS_MEDIAS = [
  "produits",
  "galerie",
  "recit",
  "equipe",
  "banniere",
  "divers",
] as const;

export type DossierMedia = (typeof DOSSIERS_MEDIAS)[number];

export const LIBELLES_DOSSIER: Record<DossierMedia, string> = {
  produits: "Photos de produits",
  galerie: "Galerie",
  recit: "Notre histoire et savoir-faire",
  equipe: "Équipe",
  banniere: "Bandeaux et en-têtes",
  divers: "Divers",
};
