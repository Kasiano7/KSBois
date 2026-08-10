import {
  LARGEURS_SRCSET,
  RATIOS,
  TRANSFORMATIONS,
  transformationLargeur,
  type PresetMedia,
} from "./transformations";

/**
 * Construction des URL ImageKit — docs/04 §5.
 *
 * **Aucune dépendance ajoutée.** Le format d'URL d'ImageKit est
 * `<endpoint>/<chemin>?tr=<transformation>` : le documenter et le construire
 * ici coûte vingt lignes, et évite d'embarquer un SDK client dans le bundle
 * pour concaténer une chaîne. Le composant `<Media />` est le seul appelant.
 *
 * ⚠️ On stocke `file_path`, jamais l'URL complète (docs/04 §3). Changer
 * d'endpoint ou brancher un domaine personnalisé ne doit toucher aucune ligne
 * de la base.
 */

export interface MediaSource {
  filePath: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  lqip: string | null;
}

/** ImageKit est-il configuré ? Sinon le site fonctionne, sans médias distants. */
export function imagekitConfigure(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT?.trim());
}

export function endpointImagekit(): string | null {
  const brut = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT?.trim();
  if (!brut) return null;
  return brut.replace(/\/+$/, "");
}

/** URL d'un média pour une transformation nommée. `null` si non configuré. */
export function urlMedia(filePath: string, preset: PresetMedia): string | null {
  return urlTransformation(filePath, TRANSFORMATIONS[preset]);
}

export function urlTransformation(filePath: string, transformation: string): string | null {
  const endpoint = endpointImagekit();
  if (!endpoint) return null;
  const chemin = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `${endpoint}${chemin}?tr=${transformation}`;
}

/** Jeu de largeurs pour l'attribut `srcSet`. */
export function srcSetMedia(filePath: string, preset: PresetMedia): string | undefined {
  const endpoint = endpointImagekit();
  if (!endpoint) return undefined;

  const entrees = LARGEURS_SRCSET[preset]
    .map((largeur) => {
      const url = urlTransformation(filePath, transformationLargeur(preset, largeur));
      return url ? `${url} ${largeur}w` : null;
    })
    .filter((entree): entree is string => entree !== null);

  return entrees.length > 0 ? entrees.join(", ") : undefined;
}

/**
 * Dimensions à réserver dans la page.
 *
 * On privilégie le ratio de la TRANSFORMATION sur celui du fichier d'origine :
 * l'image affichée est recadrée, donc c'est sa boîte à elle qu'il faut réserver
 * pour ne pas provoquer de décalage au chargement.
 */
export function dimensionsMedia(preset: PresetMedia): { width: number; height: number } {
  const ratio = RATIOS[preset];
  return { width: ratio.largeur, height: ratio.hauteur };
}
