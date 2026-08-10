import { cheminAire, cheminLisse, graduations, plafondAxe, projeter } from "@/lib/graphiques";

/**
 * Courbe temporelle — le graphique principal de l'administration.
 *
 * Composant SERVEUR : aucun JavaScript n'est envoyé au navigateur. Les
 * infobulles sont des `<title>` SVG natifs, et la lecture assistée passe par le
 * tableau `sr-only` en fin de composant, jamais par la seule image.
 *
 * Deux séries au maximum, et c'est délibéré : au-delà, on ne compare plus, on
 * décore. La seconde est toujours la période précédente, en pointillé.
 *
 * ⚠️ Aucun `<text>` dans le SVG. Le repère est étiré horizontalement
 * (`preserveAspectRatio="none"`) pour occuper la largeur disponible, ce qui
 * écraserait les lettres. La hauteur du viewBox est en revanche égale à la
 * hauteur CSS : l'axe vertical est donc au pixel près, et les étiquettes HTML
 * peuvent se positionner sur les mêmes ordonnées que les lignes de grille.
 */

export interface PointCourbe {
  cle: string;
  /** Libellé complet, lu à voix haute et affiché dans l'infobulle. */
  libelle: string;
  /** Libellé abrégé de l'axe horizontal. Toutes les étiquettes ne sont pas rendues. */
  libelleCourt: string;
  valeur: number;
}

const LARGEUR = 1000;
const MARGE_HAUTE = 14;
/** Réserve à droite : le marqueur du dernier point doit tenir dans le cadre. */
const MARGE_DROITE = 10;

export function Courbe({
  points,
  comparaison,
  formatValeur,
  legende,
  legendeComparaison,
  hauteur = 240,
  couleur = "var(--graphique-1)",
  couleurComparaison = "var(--graphique-4)",
  titreAccessible,
}: {
  points: PointCourbe[];
  /** Valeurs de la période précédente, alignées par index. */
  comparaison?: number[];
  formatValeur: (valeur: number) => string;
  legende: string;
  legendeComparaison?: string;
  hauteur?: number;
  couleur?: string;
  couleurComparaison?: string;
  titreAccessible: string;
}) {
  const valeurs = points.map((point) => point.valeur);
  const maximum = Math.max(0, ...valeurs, ...(comparaison ?? []));
  const vide = maximum <= 0 || points.length === 0;
  // Sans donnée, l'axe se graduerait au centime et afficherait cinq fois « 0 € ».
  // On garde la seule ligne de base, et on écrit qu'il n'y a rien à montrer.
  const crans = vide ? [0] : graduations(maximum, 4);
  const plafond = vide ? 1 : plafondAxe(maximum, 4);

  const projection = {
    largeur: LARGEUR - MARGE_DROITE,
    hauteur,
    plafond,
    margeHaute: MARGE_HAUTE,
  };
  const coordonnees = projeter(valeurs, projection);
  const coordonneesComparaison =
    comparaison && comparaison.length === points.length && comparaison.some((v) => v > 0)
      ? projeter(comparaison, projection)
      : null;
  const dernier = coordonnees[coordonnees.length - 1];

  const ordonnee = (cran: number) =>
    MARGE_HAUTE + (hauteur - MARGE_HAUTE) * (1 - cran / plafond);

  // Une étiquette sur N : ~7 repères au maximum, le dernier point toujours
  // inclus. Sous 640 px on n'en garde qu'une sur deux — mesuré, « 11 juil. » et
  // « 16 juil. » se chevauchaient sur un téléphone. Le filtrage se fait depuis
  // la FIN : la date la plus récente est celle qu'on cherche du regard.
  const pasEtiquette = Math.max(1, Math.ceil(points.length / 7));
  const indicesEtiquettes = points
    .map((_, index) => index)
    .filter((index) => index % pasEtiquette === 0 || index === points.length - 1);
  const dernierRang = indicesEtiquettes.length - 1;
  const identifiant = `courbe-${legende.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

  return (
    <figure className="m-0">
      <div className="flex gap-3">
        {/* Graduations verticales, alignées sur les lignes de grille. */}
        <div className="relative w-12 shrink-0 sm:w-16" style={{ height: hauteur }} aria-hidden="true">
          {crans.map((cran) => (
            <span
              key={cran}
              className="text-cendre-clair tabulaire absolute right-0 -translate-y-1/2 text-[12px] whitespace-nowrap"
              style={{ top: ordonnee(cran) }}
            >
              {formatValeur(cran)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${LARGEUR} ${hauteur}`}
            preserveAspectRatio="none"
            className="block w-full"
            style={{ height: hauteur }}
            role="img"
            aria-label={titreAccessible}
            focusable="false"
          >
            <defs>
              <linearGradient id={`${identifiant}-fond`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={couleur} stopOpacity="0.32" />
                <stop offset="100%" stopColor={couleur} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Grille horizontale seulement : une grille verticale transforme la
                courbe en tableau et gêne la lecture de la pente. */}
            {crans.map((cran) => (
              <line
                key={cran}
                x1={0}
                y1={ordonnee(cran)}
                x2={LARGEUR}
                y2={ordonnee(cran)}
                stroke="var(--ecorce-bord)"
                strokeWidth={1}
                strokeDasharray={cran === 0 ? undefined : "3 6"}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {!vide && (
              <>
                {coordonneesComparaison && (
                  <path
                    d={cheminLisse(coordonneesComparaison)}
                    fill="none"
                    stroke={couleurComparaison}
                    strokeWidth={2}
                    strokeDasharray="7 6"
                    strokeLinecap="round"
                    opacity={0.9}
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                <path d={cheminAire(coordonnees, hauteur)} fill={`url(#${identifiant}-fond)`} />
                <path
                  d={cheminLisse(coordonnees)}
                  fill="none"
                  stroke={couleur}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}

            {/* Zones de survol invisibles : infobulle native, donc zéro JS. */}
            {points.map((point, index) => {
              const pas = points.length > 1 ? LARGEUR / (points.length - 1) : LARGEUR;
              return (
                <rect
                  key={point.cle}
                  x={Math.max(0, coordonnees[index][0] - pas / 2)}
                  y={0}
                  width={pas}
                  height={hauteur}
                  fill="transparent"
                >
                  <title>{`${point.libelle} — ${formatValeur(point.valeur)}`}</title>
                </rect>
              );
            })}
          </svg>

          {vide && (
            <p className="text-cendre-clair absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[14px]">
              Aucune vente sur cette période.
            </p>
          )}

          {/* Le dernier point est marqué : c'est celui qu'on vient lire. En
              HTML, parce qu'un <circle> serait étiré en ellipse. */}
          {!vide && dernier && (
            <span
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(dernier[0] / LARGEUR) * 100}%`, top: dernier[1] }}
              aria-hidden="true"
            >
              <span
                className="block size-8 rounded-full opacity-15"
                style={{ background: couleur }}
              />
              <span
                className="border-ecorce-eleve absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                style={{ background: couleur }}
              />
            </span>
          )}

          {/* Axe horizontal, en HTML pour ne pas subir l'étirement. */}
          <div className="relative mt-2 h-4" aria-hidden="true">
            {indicesEtiquettes.map((index, rang) => {
              const point = points[index];
              const dernierPoint = index === points.length - 1;
              const gauche = points.length > 1 ? (index / (points.length - 1)) * 100 : 50;
              const surMobile = (dernierRang - rang) % 2 === 0;
              return (
                <span
                  key={point.cle}
                  className={`text-cendre-clair absolute top-0 text-[12px] whitespace-nowrap ${
                    surMobile ? "" : "hidden sm:inline"
                  }`}
                  style={{
                    left: `${gauche}%`,
                    transform:
                      index === 0
                        ? "translateX(0)"
                        : dernierPoint
                          ? "translateX(-100%)"
                          : "translateX(-50%)",
                  }}
                >
                  {point.libelleCourt}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <figcaption className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-[3px] w-6 rounded-full"
            style={{ background: couleur }}
            aria-hidden="true"
          />
          {legende}
        </span>
        {coordonneesComparaison && legendeComparaison ? (
          <span className="text-cendre-clair flex items-center gap-2">
            <span
              className="inline-block h-0 w-6 border-t-2 border-dashed"
              style={{ borderColor: couleurComparaison }}
              aria-hidden="true"
            />
            {legendeComparaison}
          </span>
        ) : null}
      </figcaption>

      {/* La donnée exacte, pour les lecteurs d'écran. Le graphique n'est jamais
          le seul porteur de l'information (docs/03 §9).

          ⚠️ `sr-only` est porté par le <div>, PAS par le <table> : une table CSS
          traite `width: 1px` comme un minimum et refuse de rétrécir. Posée
          directement sur le tableau, la classe le laissait occuper 500 px de
          large en position absolue — d'où un défilement horizontal de la page,
          invisible mais bien réel (docs/03 §9). */}
      <div className="sr-only">
        <table>
          <caption>{titreAccessible}</caption>
          <thead>
            <tr>
              <th scope="col">Période</th>
              <th scope="col">{legende}</th>
              {coordonneesComparaison && legendeComparaison ? (
                <th scope="col">{legendeComparaison}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={point.cle}>
                <th scope="row">{point.libelle}</th>
                <td>{formatValeur(point.valeur)}</td>
                {coordonneesComparaison && legendeComparaison ? (
                  <td>{formatValeur(comparaison?.[index] ?? 0)}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
