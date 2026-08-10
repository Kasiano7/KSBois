import { cheminArc } from "@/lib/graphiques";

/**
 * Anneau de répartition — la part de chaque origine, zone ou essence.
 *
 * Volontairement limité à cinq parts, le reste étant regroupé sous « Autres » :
 * au-delà, les arcs deviennent des filets qu'on ne compare plus. Le pourcentage
 * est TOUJOURS écrit dans la légende — la couleur seule ne porte jamais
 * l'information (docs/03 §9).
 *
 * Le SVG garde ici son ratio (pas d'étirement) : un anneau étiré est une
 * ellipse, et une ellipse fausse la comparaison visuelle des angles.
 */

export interface PartAnneau {
  cle: string;
  libelle: string;
  valeur: number;
  /** Ligne secondaire de la légende : « 34 % · 12 480 € ». */
  precision?: string;
  couleur: string;
}

export function Anneau({
  parts,
  total,
  centreValeur,
  centreLibelle,
  titreAccessible,
  taille = 168,
}: {
  parts: PartAnneau[];
  /** Total de référence. Fourni séparément : la somme des parts peut être partielle. */
  total: number;
  centreValeur: string;
  centreLibelle: string;
  titreAccessible: string;
  taille?: number;
}) {
  const rayon = 100;
  const epaisseur = 26;
  const somme = total > 0 ? total : parts.reduce((cumul, part) => cumul + part.valeur, 0);

  // Cumul par tranche plutôt que par accumulateur muté : le rendu React doit
  // rester une pure projection des props (règle `react-hooks/immutability`).
  const ratios = parts.map((part) => (somme > 0 ? part.valeur / somme : 0));
  const arcs = parts.map((part, index) => {
    const debut = ratios.slice(0, index).reduce((cumul, ratio) => cumul + ratio, 0);
    return { ...part, ratio: ratios[index], debut, fin: debut + ratios[index] };
  });

  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-5">
      <div className="relative shrink-0" style={{ width: taille, height: taille }}>
        <svg
          viewBox="-110 -110 220 220"
          className="block size-full"
          role="img"
          aria-label={titreAccessible}
          focusable="false"
        >
          {/* Piste de fond : sans elle, un anneau presque vide n'a pas de forme. */}
          <circle
            r={rayon - epaisseur / 2}
            fill="none"
            stroke="var(--ecorce-bord)"
            strokeWidth={epaisseur}
            opacity={0.45}
          />
          {arcs.map((arc) =>
            arc.ratio > 0 ? (
              <path
                key={arc.cle}
                d={cheminArc({
                  debutRatio: arc.debut,
                  finRatio: arc.fin,
                  rayon,
                  epaisseur,
                })}
                fill={arc.couleur}
              >
                <title>{`${arc.libelle} — ${Math.round(arc.ratio * 100)} %`}</title>
              </path>
            ) : null,
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display tabulaire text-[26px] leading-none font-bold">
            {centreValeur}
          </span>
          <span className="text-cendre-clair mt-1.5 px-3 text-[12px] leading-tight">
            {centreLibelle}
          </span>
        </div>
      </div>

      <ul className="min-w-[150px] flex-1 space-y-2.5">
        {arcs.map((arc) => (
          <li key={arc.cle} className="flex items-start gap-2.5">
            <span
              className="mt-1.5 size-2.5 shrink-0 rounded-[2px]"
              style={{ background: arc.couleur }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-[14px]">
                <span className="font-medium">{arc.libelle}</span>
                <span className="tabulaire font-semibold">
                  {somme > 0 ? `${Math.round(arc.ratio * 100)} %` : "—"}
                </span>
              </span>
              {arc.precision && (
                <span className="text-cendre-clair block text-[12px]">{arc.precision}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
