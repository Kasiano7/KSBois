/**
 * Pile de bûches vue de face, pour le panneau « Votre sélection ».
 *
 * Tient la place de la photographie de produit tant qu'il n'y en a pas (guide de
 * shooting dans docs/04 §8.2). Les sections sont dessinées avec des diamètres et
 * des positions variés : une grille régulière de cercles identiques aurait l'air
 * d'un motif, pas d'un tas de bois.
 */

interface PileIllustrationProps {
  /** Fait varier la disposition selon la longueur, sans jamais être aléatoire. */
  graine?: number;
  className?: string;
}

const VUE_L = 320;
const VUE_H = 150;

/** Générateur déterministe : le rendu serveur et client doivent concorder. */
function pseudoAleatoire(graine: number): () => number {
  let etat = graine * 9301 + 49297;
  return () => {
    etat = (etat * 9301 + 49297) % 233280;
    return etat / 233280;
  };
}

export function PileIllustration({ graine = 33, className }: PileIllustrationProps) {
  const suivant = pseudoAleatoire(graine);

  const buches: { cx: number; cy: number; r: number; teinte: number }[] = [];
  const rangees = [
    { y: 118, rMin: 15, rMax: 22 },
    { y: 86, rMin: 13, rMax: 20 },
    { y: 58, rMin: 12, rMax: 18 },
    { y: 34, rMin: 10, rMax: 16 },
  ];

  for (const rangee of rangees) {
    let x = 16;
    while (x < VUE_L - 16) {
      const r = rangee.rMin + suivant() * (rangee.rMax - rangee.rMin);
      if (x + r > VUE_L - 12) break;
      buches.push({ cx: x + r, cy: rangee.y + (suivant() - 0.5) * 4, r, teinte: suivant() });
      x += r * 2 + 1.5;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${VUE_L} ${VUE_H}`}
      className={className}
      role="img"
      aria-label="Illustration d'une pile de bûches"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="pile-fond" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2C231B" />
          <stop offset="100%" stopColor="#191310" />
        </linearGradient>
      </defs>

      <rect width={VUE_L} height={VUE_H} fill="url(#pile-fond)" />

      {buches.map((b, i) => {
        const clair = 0.82 + b.teinte * 0.18;
        const aubier = `rgb(${Math.round(206 * clair)}, ${Math.round(170 * clair)}, ${Math.round(124 * clair)})`;
        const ecorce = `rgb(${Math.round(96 * clair)}, ${Math.round(68 * clair)}, ${Math.round(44 * clair)})`;
        return (
          <g key={i}>
            {/* Écorce */}
            <circle cx={b.cx} cy={b.cy} r={b.r} fill={ecorce} />
            {/* Face de coupe */}
            <circle cx={b.cx} cy={b.cy} r={b.r * 0.82} fill={aubier} />
            {/* Cernes */}
            {[0.6, 0.38, 0.18].map((f) => (
              <circle
                key={f}
                cx={b.cx}
                cy={b.cy}
                r={b.r * 0.82 * f}
                fill="none"
                stroke="#8A6B47"
                strokeOpacity={0.4}
                strokeWidth={0.8}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
