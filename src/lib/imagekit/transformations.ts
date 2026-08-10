/**
 * Transformations nommées ImageKit — docs/04 §5.1.
 *
 * ⚠️ C'est l'UNIQUE endroit du projet où une chaîne de transformation est
 * écrite. Aucun composant, aucune page ne compose de `tr=` à la main : sinon
 * les réglages divergent, on perd `f-auto` quelque part, et la moitié du site
 * sert du JPEG à des navigateurs qui acceptent l'AVIF.
 *
 * Trois paramètres sont systématiques :
 *  • `f-auto` — sert AVIF ou WebP selon ce que le navigateur accepte ;
 *  • `q-auto` — ajuste la qualité au contenu de l'image ;
 *  • `fo-auto` — recentre le recadrage sur le sujet, pas sur le centre
 *    géométrique. Sur une photo de tas de bois, la différence est visible.
 */

export const TRANSFORMATIONS = {
  productCard: "w-640,ar-4-3,c-maintain_ratio,fo-auto,f-auto,q-auto",
  productHero: "w-1400,ar-4-3,c-maintain_ratio,fo-auto,f-auto,q-auto",
  productThumb: "w-160,h-160,c-maintain_ratio,fo-auto,f-auto,q-auto",
  heroFull: "w-2400,ar-16-9,c-maintain_ratio,fo-auto,f-auto,q-auto",
  galleryTile: "w-800,ar-1-1,c-maintain_ratio,fo-auto,f-auto,q-auto",
  storyWide: "w-1600,ar-21-9,c-maintain_ratio,f-auto,q-auto",
  avatar: "w-200,h-200,c-maintain_ratio,fo-face,r-max",
  ogImage: "w-1200,h-630,c-maintain_ratio,fo-auto,f-jpg,q-80",
  lqip: "w-20,bl-8,q-20",
} as const;

export type PresetMedia = keyof typeof TRANSFORMATIONS;

/**
 * Ratio de chaque transformation, pour réserver la place avant chargement.
 *
 * Sans ces valeurs, la page saute au chargement des images et le CLS explose
 * (docs/03 §9 : CLS < 0,1). Elles sont déduites du `ar-` ou du couple `w-`/`h-`
 * de la transformation ci-dessus — les garder synchronisées est le prix à payer
 * pour ne pas mesurer côté navigateur.
 */
export const RATIOS: Record<PresetMedia, { largeur: number; hauteur: number }> = {
  productCard: { largeur: 640, hauteur: 480 },
  productHero: { largeur: 1400, hauteur: 1050 },
  productThumb: { largeur: 160, hauteur: 160 },
  heroFull: { largeur: 2400, hauteur: 1350 },
  galleryTile: { largeur: 800, hauteur: 800 },
  storyWide: { largeur: 1600, hauteur: 686 },
  avatar: { largeur: 200, hauteur: 200 },
  ogImage: { largeur: 1200, hauteur: 630 },
  lqip: { largeur: 20, hauteur: 15 },
};

/**
 * Largeurs proposées au `srcSet`, par transformation.
 *
 * On ne génère pas dix variantes par image : chaque largeur supplémentaire est
 * une transformation facturée et une entrée de cache de plus. Trois paliers
 * couvrent téléphone, tablette et grand écran.
 */
export const LARGEURS_SRCSET: Record<PresetMedia, number[]> = {
  productCard: [320, 640, 960],
  productHero: [640, 1024, 1400],
  productThumb: [160, 320],
  heroFull: [768, 1440, 2400],
  galleryTile: [400, 800, 1200],
  storyWide: [768, 1200, 1600],
  avatar: [200, 400],
  ogImage: [1200],
  lqip: [20],
};

/** Remplace la largeur d'une transformation, pour une entrée de `srcSet`. */
export function transformationLargeur(preset: PresetMedia, largeur: number): string {
  return TRANSFORMATIONS[preset].replace(/(^|,)w-\d+/, `$1w-${largeur}`);
}
