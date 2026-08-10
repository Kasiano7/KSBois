import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dimensionsMedia,
  imagekitConfigure,
  srcSetMedia,
  urlMedia,
  type MediaSource,
} from "@/lib/imagekit";
import type { PresetMedia } from "@/lib/imagekit/transformations";

/**
 * Composant unique d'affichage d'un média — docs/04 §5.2.
 *
 * **C'est le seul endroit du code qui rend un média ImageKit.** Aucun `<img>`
 * brut, aucun `next/image`, aucune concaténation d'URL ailleurs. Cette règle
 * n'est pas cosmétique : c'est elle qui garantit qu'on n'oublie nulle part le
 * `srcSet`, les dimensions réservées, le `loading="lazy"` ou le texte
 * alternatif.
 *
 * ⚠️ Pas de `next/image` : l'optimiseur de Next re-téléchargerait et
 * retraiterait une image qu'ImageKit a déjà servie au bon format et à la bonne
 * taille. On paierait deux fois le même travail, et on perdrait `f-auto`.
 *
 * Trois états, comme l'exige la checklist (docs/03 §9) :
 *  • normal — l'image ;
 *  • non configuré — ImageKit n'a pas de clés : cadre neutre, pas d'erreur ;
 *  • média manquant — le fichier a disparu : on le dit, on ne masque pas.
 */
export function Media({
  media,
  preset,
  sizes,
  priority = false,
  className,
  classNameCadre,
  /** Force un texte alternatif décoratif (`alt=""`) sur une image d'ambiance. */
  decorative = false,
}: {
  media: MediaSource | null;
  preset: PresetMedia;
  sizes?: string;
  priority?: boolean;
  className?: string;
  classNameCadre?: string;
  decorative?: boolean;
}) {
  const { width, height } = dimensionsMedia(preset);

  if (!media || !imagekitConfigure()) {
    return (
      <Cadre width={width} height={height} className={classNameCadre}>
        <span className="text-cendre flex h-full w-full items-center justify-center">
          <ImageOff size={28} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">
            {imagekitConfigure() ? "Image indisponible" : "Bibliothèque d'images non configurée"}
          </span>
        </span>
      </Cadre>
    );
  }

  const src = urlMedia(media.filePath, preset);
  if (!src) {
    return (
      <Cadre width={width} height={height} className={classNameCadre}>
        <span className="sr-only">Image indisponible</span>
      </Cadre>
    );
  }

  return (
    // ImageKit fait déjà le travail de next/image, en amont et une seule fois.
    // eslint-disable-next-line @next/next/no-img-element -- voir l'en-tête du fichier
    <img
      src={src}
      srcSet={srcSetMedia(media.filePath, preset)}
      sizes={sizes}
      alt={decorative ? "" : (media.altText ?? "")}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : undefined}
      className={cn("h-auto w-full object-cover", className)}
      // Le LQIP supprime le saut de mise en page pendant le chargement : il
      // occupe la boîte finale dès le premier rendu (docs/04 §3).
      style={
        media.lqip
          ? {
              backgroundImage: `url(${media.lqip})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    />
  );
}

function Cadre({
  width,
  height,
  className,
  children,
}: {
  width: number;
  height: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("bg-aubier-bord/40 w-full overflow-hidden", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {children}
    </div>
  );
}

/**
 * Préconnexion à l'endpoint ImageKit — docs/04 §5.3.
 *
 * À poser une fois dans le layout racine. Économise la résolution DNS et la
 * poignée de main TLS sur la première image, qui est souvent l'image LCP.
 */
export function PreconnexionImagekit() {
  const origine = origineImagekit();
  if (!origine) return null;
  return (
    <>
      <link rel="preconnect" href={origine} crossOrigin="" />
      <link rel="dns-prefetch" href={origine} />
    </>
  );
}

/** Isolé du rendu : construire du JSX dans un try/catch masque les erreurs. */
function origineImagekit(): string | null {
  const endpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT?.trim();
  if (!endpoint) return null;
  try {
    return new URL(endpoint).origin;
  } catch {
    return null;
  }
}
