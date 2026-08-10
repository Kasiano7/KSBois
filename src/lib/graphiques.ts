/**
 * Géométrie des graphiques de l'administration.
 *
 * Fonctions pures, sans React et sans DOM : les graphiques sont rendus en SVG
 * **côté serveur**, sans bibliothèque tierce. Trois raisons :
 *
 * 1. Recharts / Chart.js imposent un composant client et 40 à 120 ko de JS pour
 *    dessiner cinq polylignes. L'objectif de performance (docs/03 §9) ne le
 *    supporte pas, et l'administration est consultée depuis la cabine d'un
 *    camion, en 4G.
 * 2. Leur thème par défaut est étranger à la charte, et le thème white-label
 *    (`company_themes.tokens`) ne les repeindrait pas.
 * 3. Un SVG rendu côté serveur s'imprime — l'exploitant imprime ses tournées,
 *    il imprimera ses courbes.
 */

/** Point d'un tracé, en coordonnées SVG déjà projetées. */
export type PointSvg = readonly [x: number, y: number];

/**
 * Graduations « rondes » couvrant [0, maximum].
 *
 * On force le pas sur 1 · 2 · 2,5 · 5 × 10ⁿ : un axe gradué à 3 214 € ne se lit
 * pas. Retourne toujours au moins [0, pas] pour qu'un graphique vide garde un
 * axe et ne s'effondre pas sur une ligne.
 */
export function graduations(maximum: number, cible = 4): number[] {
  const sommet = Number.isFinite(maximum) && maximum > 0 ? maximum : 1;
  const brut = sommet / Math.max(1, cible);
  const magnitude = 10 ** Math.floor(Math.log10(brut));
  const normalise = brut / magnitude;
  const facteur = normalise <= 1 ? 1 : normalise <= 2 ? 2 : normalise <= 2.5 ? 2.5 : normalise <= 5 ? 5 : 10;
  const pas = facteur * magnitude;

  // ⚠️ Le nombre de crans se déduit du PLAFOND, pas du maximum : arrêter la
  // boucle « tant que valeur <= maximum » tronquait l'axe sous la donnée
  // (3 214 € donnait un axe à 3 000 €, et la courbe sortait du cadre).
  const crans = Math.max(1, Math.ceil(sommet / pas - 1e-9));
  return Array.from({ length: crans + 1 }, (_, index) =>
    // La multiplication flottante dérive (3 × 0,1 = 0,30000000000000004).
    Number((index * pas).toPrecision(12)),
  );
}

/** Plafond de l'axe : la dernière graduation, pour que la courbe rentre. */
export function plafondAxe(maximum: number, cible = 4): number {
  const crans = graduations(maximum, cible);
  return crans[crans.length - 1];
}

/**
 * Projette des valeurs en coordonnées SVG.
 *
 * `index` sur l'axe horizontal, valeur sur l'axe vertical inversé (le SVG
 * compte vers le bas). Un point unique est centré : une série à un seul seau
 * ne doit pas se coller au bord gauche.
 */
export function projeter(
  valeurs: readonly number[],
  options: { largeur: number; hauteur: number; plafond: number; margeHaute?: number },
): PointSvg[] {
  const { largeur, hauteur, plafond } = options;
  const margeHaute = options.margeHaute ?? 0;
  const utile = Math.max(1, hauteur - margeHaute);
  const denominateur = Math.max(1, valeurs.length - 1);
  return valeurs.map((valeur, index) => {
    const x = valeurs.length === 1 ? largeur / 2 : (index / denominateur) * largeur;
    const ratio = plafond > 0 ? Math.min(1, Math.max(0, valeur / plafond)) : 0;
    return [x, margeHaute + utile - ratio * utile] as const;
  });
}

/**
 * Chemin lissé (Catmull-Rom converti en Bézier cubique).
 *
 * ⚠️ Les points de contrôle sont **bornés verticalement au segment**. Sans ce
 * garde-fou, un lissage classique dépasse les données : une courbe de chiffre
 * d'affaires plongeait sous zéro entre deux journées à 0 € et 900 €, ce qui
 * dessine une perte qui n'a jamais eu lieu. Une courbe d'argent ne doit jamais
 * montrer une valeur que la table ne contient pas.
 */
export function cheminLisse(points: readonly PointSvg[], tension = 0.9): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${arrondir(points[0][0])} ${arrondir(points[0][1])}`;

  const borner = (valeur: number, a: number, b: number) =>
    Math.min(Math.max(valeur, Math.min(a, b)), Math.max(a, b));

  let chemin = `M ${arrondir(points[0][0])} ${arrondir(points[0][1])}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];

    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = borner(p1[1] + ((p2[1] - p0[1]) / 6) * tension, p1[1], p2[1]);
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = borner(p2[1] - ((p3[1] - p1[1]) / 6) * tension, p1[1], p2[1]);

    chemin += ` C ${arrondir(c1x)} ${arrondir(c1y)}, ${arrondir(c2x)} ${arrondir(c2y)}, ${arrondir(p2[0])} ${arrondir(p2[1])}`;
  }
  return chemin;
}

/** Le même tracé refermé sur la ligne de base : l'aplat sous la courbe. */
export function cheminAire(points: readonly PointSvg[], baseY: number, tension = 0.9): string {
  if (points.length === 0) return "";
  const dessus = cheminLisse(points, tension);
  const premier = points[0];
  const dernier = points[points.length - 1];
  return `${dessus} L ${arrondir(dernier[0])} ${arrondir(baseY)} L ${arrondir(premier[0])} ${arrondir(baseY)} Z`;
}

/**
 * Arc d'anneau (camembert évidé), en coordonnées centrées sur (0, 0).
 *
 * Une part de 100 % ne peut pas s'écrire avec un seul arc — début et fin se
 * confondent et le chemin disparaît. On la rend comme deux demi-arcs.
 */
export function cheminArc(options: {
  debutRatio: number;
  finRatio: number;
  rayon: number;
  epaisseur: number;
}): string {
  const { rayon, epaisseur } = options;
  const interieur = Math.max(0, rayon - epaisseur);
  const etendue = Math.min(1, Math.max(0, options.finRatio - options.debutRatio));
  if (etendue <= 0) return "";
  if (etendue >= 1) {
    return [
      cheminArc({ ...options, finRatio: options.debutRatio + 0.5 }),
      cheminArc({ ...options, debutRatio: options.debutRatio + 0.5 }),
    ].join(" ");
  }

  // On démarre à midi et on tourne dans le sens des aiguilles.
  const angle = (ratio: number) => (ratio * 2 - 0.5) * Math.PI;
  const a0 = angle(options.debutRatio);
  const a1 = angle(options.debutRatio + etendue);
  const grand = etendue > 0.5 ? 1 : 0;

  const pt = (a: number, r: number) => `${arrondir(Math.cos(a) * r)} ${arrondir(Math.sin(a) * r)}`;

  return [
    `M ${pt(a0, rayon)}`,
    `A ${arrondir(rayon)} ${arrondir(rayon)} 0 ${grand} 1 ${pt(a1, rayon)}`,
    `L ${pt(a1, interieur)}`,
    `A ${arrondir(interieur)} ${arrondir(interieur)} 0 ${grand} 0 ${pt(a0, interieur)}`,
    "Z",
  ].join(" ");
}

function arrondir(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}
