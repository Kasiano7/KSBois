/**
 * Jauge circulaire — un taux unique, lisible à deux mètres.
 *
 * Réservée aux ratios qui ont un sens sur 0-100 % (conversion, automatisation).
 * Le verdict est écrit sous le pourcentage : « Très bon », « À surveiller ». Un
 * cercle vert ne dit rien à quelqu'un qui n'a pas la grille de lecture en tête,
 * et l'information ne passe jamais par la couleur seule (docs/03 §9).
 */
export function Jauge({
  pourcentage,
  verdict,
  couleur = "var(--graphique-2)",
  taille = 132,
}: {
  pourcentage: number | null;
  verdict: string;
  couleur?: string;
  taille?: number;
}) {
  const rayon = 54;
  const circonference = 2 * Math.PI * rayon;
  const ratio = pourcentage === null ? 0 : Math.min(1, Math.max(0, pourcentage / 100));

  return (
    <div className="relative shrink-0" style={{ width: taille, height: taille }}>
      <svg
        viewBox="-70 -70 140 140"
        className="block size-full -rotate-90"
        role="img"
        aria-label={
          pourcentage === null
            ? `Taux non mesurable — ${verdict}`
            : `${pourcentage.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % — ${verdict}`
        }
        focusable="false"
      >
        <circle
          r={rayon}
          fill="none"
          stroke="var(--ecorce-bord)"
          strokeWidth={12}
          opacity={0.55}
        />
        {ratio > 0 && (
          <circle
            r={rayon}
            fill="none"
            stroke={couleur}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${circonference * ratio} ${circonference}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display tabulaire text-[27px] leading-none font-bold">
          {pourcentage === null
            ? "—"
            : `${pourcentage.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`}
        </span>
        <span className="text-cendre-clair mt-1 px-2 text-[12px] leading-tight">{verdict}</span>
      </div>
    </div>
  );
}
