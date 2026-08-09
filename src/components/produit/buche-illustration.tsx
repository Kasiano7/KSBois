/**
 * Illustration d'une bûche, vue de trois quarts.
 *
 * ⚠️ ÉCHELLE RÉELLE : la longueur dessinée est strictement proportionnelle à la
 * longueur de coupe. La bûche de 50 cm fait exactement deux fois celle de 25 cm.
 * C'est ce qui répond à la vraie question d'achat — « est-ce que ça rentre dans
 * mon poêle ? » — et ce qui justifie de montrer un dessin plutôt qu'un texte.
 *
 * Tant qu'il n'y a pas de photographies réelles (voir docs/04 §8.2 pour le guide
 * de shooting), ce dessin tient le rôle : il est honnête sur les proportions,
 * là où une photo de banque d'images ne le serait pas.
 */

interface BucheIllustrationProps {
  cm: number;
  /** Longueur de référence qui occupe toute la largeur disponible. */
  maxCm: number;
  selectionnee?: boolean;
  className?: string;
}

const VUE_L = 120;
const VUE_H = 76;
const MARGE = 4;
const HAUTEUR_BUCHE = 46;

export function BucheIllustration({
  cm,
  maxCm,
  selectionnee = false,
  className,
}: BucheIllustrationProps) {
  const largeurMax = VUE_L - MARGE * 2;
  const longueur = Math.max(14, (cm / maxCm) * largeurMax);

  const x = MARGE;
  const y = (VUE_H - HAUTEUR_BUCHE) / 2;
  const rayonFace = 7;
  const centreFaceX = x + longueur - rayonFace;
  const centreY = y + HAUTEUR_BUCHE / 2;

  // L'écorce s'assombrit légèrement à la sélection : le contraste sert de repère
  // secondaire, jamais unique (la bordure et le bouton radio portent l'état).
  const ecorce = selectionnee ? "#5E4028" : "#7A5B3D";
  const ecorceOmbre = selectionnee ? "#422C1B" : "#5C4229";
  const aubier = "#D8BC93";
  const cernes = "#9C7A50";
  const id = `buche-${cm}`;

  return (
    <svg
      viewBox={`0 0 ${VUE_L} ${VUE_H}`}
      className={className}
      role="img"
      aria-label={`Bûche de ${cm} centimètres, dessinée à l'échelle`}
    >
      <defs>
        <linearGradient id={`${id}-corps`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ecorce} />
          <stop offset="55%" stopColor={ecorceOmbre} />
          <stop offset="100%" stopColor={ecorce} />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0%" stopColor="#E8D2AE" />
          <stop offset="100%" stopColor={aubier} />
        </radialGradient>
      </defs>

      {/* Ombre portée : donne l'assise, sans quoi la bûche flotte */}
      <ellipse
        cx={x + longueur / 2}
        cy={y + HAUTEUR_BUCHE + 3}
        rx={longueur / 2}
        ry={3}
        fill="#14100D"
        opacity={0.1}
      />

      {/* Corps : l'écorce */}
      <path
        d={`M ${x + rayonFace} ${y}
            L ${centreFaceX} ${y}
            A ${rayonFace} ${HAUTEUR_BUCHE / 2} 0 0 1 ${centreFaceX} ${y + HAUTEUR_BUCHE}
            L ${x + rayonFace} ${y + HAUTEUR_BUCHE}
            A ${rayonFace} ${HAUTEUR_BUCHE / 2} 0 0 1 ${x + rayonFace} ${y} Z`}
        fill={`url(#${id}-corps)`}
      />

      {/* Stries verticales de l'écorce */}
      {Array.from({ length: Math.max(2, Math.round(longueur / 9)) }).map((_, i) => {
        const sx = x + rayonFace + 4 + i * 9;
        if (sx > centreFaceX - 3) return null;
        return (
          <line
            key={i}
            x1={sx}
            y1={y + 4}
            x2={sx}
            y2={y + HAUTEUR_BUCHE - 4}
            stroke="#2A1B10"
            strokeOpacity={0.22}
            strokeWidth={1.1}
          />
        );
      })}

      {/* Face de coupe et cernes */}
      <ellipse
        cx={centreFaceX}
        cy={centreY}
        rx={rayonFace}
        ry={HAUTEUR_BUCHE / 2}
        fill={`url(#${id}-face)`}
      />
      {[0.72, 0.46, 0.22].map((facteur) => (
        <ellipse
          key={facteur}
          cx={centreFaceX}
          cy={centreY}
          rx={rayonFace * facteur}
          ry={(HAUTEUR_BUCHE / 2) * facteur}
          fill="none"
          stroke={cernes}
          strokeOpacity={0.55}
          strokeWidth={0.9}
        />
      ))}
      <ellipse cx={centreFaceX} cy={centreY} rx={0.9} ry={2} fill={cernes} />
    </svg>
  );
}
