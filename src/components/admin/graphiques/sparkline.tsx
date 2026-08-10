import { cheminAire, cheminLisse, plafondAxe, projeter } from "@/lib/graphiques";

/**
 * Micro-courbe posée dans une tuile d'indicateur.
 *
 * Elle n'a ni axe, ni graduation, ni infobulle : elle ne répond qu'à « ça monte
 * ou ça descend ? ». Le chiffre exact est au-dessus, en grand. Elle est donc
 * `aria-hidden` — la répéter à voix haute n'apporterait rien.
 */
export function Sparkline({
  valeurs,
  couleur = "var(--graphique-1)",
  hauteur = 44,
}: {
  valeurs: number[];
  couleur?: string;
  hauteur?: number;
}) {
  if (valeurs.length < 2 || valeurs.every((valeur) => valeur === 0)) {
    return <div style={{ height: hauteur }} aria-hidden="true" />;
  }

  const LARGEUR = 200;
  // Marge à droite : le marqueur de fin doit tenir dans le cadre.
  const LARGEUR_TRACE = LARGEUR - 6;
  const plafond = plafondAxe(Math.max(...valeurs), 2);
  const points = projeter(valeurs, { largeur: LARGEUR_TRACE, hauteur, plafond, margeHaute: 5 });
  const dernier = points[points.length - 1];
  // L'identifiant du dégradé doit être unique dans la page : on le dérive du
  // contenu (un hook `useId` est impossible dans un composant serveur).
  const empreinte = valeurs.reduce((somme, valeur, index) => somme + valeur * (index + 1), 0);
  const identifiant = `spark-${valeurs.length}-${Math.round(plafond)}-${Math.round(empreinte)}-${couleur.replace(/\W/g, "")}`;

  return (
    <div className="relative" style={{ height: hauteur }} aria-hidden="true">
      <svg
        viewBox={`0 0 ${LARGEUR} ${hauteur}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height: hauteur }}
        focusable="false"
      >
        <defs>
          <linearGradient id={identifiant} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={couleur} stopOpacity="0.28" />
            <stop offset="100%" stopColor={couleur} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={cheminAire(points, hauteur)} fill={`url(#${identifiant})`} />
        <path
          d={cheminLisse(points)}
          fill="none"
          stroke={couleur}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Marqueur en HTML : un <circle> serait étiré en ellipse par
          `preserveAspectRatio="none"`. La hauteur du viewBox valant la hauteur
          CSS, l'ordonnée est directement en pixels. */}
      <span
        className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${(dernier[0] / LARGEUR) * 100}%`,
          top: dernier[1],
          background: couleur,
        }}
      />
    </div>
  );
}
