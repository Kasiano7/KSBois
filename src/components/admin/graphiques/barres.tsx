/**
 * Barres classées — « ce qui se vend le plus », en un coup d'œil.
 *
 * Horizontales et non verticales : les libellés sont des noms d'essence et de
 * format (« Chêne / Hêtre », « Bûches 33 cm »), qu'on ne peut pas tourner à 45°
 * sans les rendre pénibles à lire. Chaque barre porte sa valeur en clair à
 * droite : la longueur donne le classement, le nombre donne la mesure.
 */

export interface LigneBarre {
  cle: string;
  libelle: string;
  /** Ce qui pilote la longueur de la barre. */
  valeur: number;
  /** Ce qui est écrit au bout — pas forcément `valeur` (un montant, un prix/m³). */
  valeurAffichee: string;
  precision?: string;
}

export function BarresClassees({
  lignes,
  couleur = "var(--graphique-1)",
  texteVide = "Aucune donnée sur cette période.",
  limite = 6,
}: {
  lignes: LigneBarre[];
  couleur?: string;
  texteVide?: string;
  limite?: number;
}) {
  if (lignes.length === 0) {
    return <p className="text-cendre-clair mt-4 text-[14px]">{texteVide}</p>;
  }

  const visibles = lignes.slice(0, limite);
  const maximum = Math.max(...visibles.map((ligne) => ligne.valeur), 1);

  return (
    <ul className="mt-4 space-y-3.5">
      {visibles.map((ligne) => (
        <li key={ligne.cle}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="min-w-0 truncate font-medium">{ligne.libelle}</span>
            <span className="tabulaire shrink-0 font-semibold">{ligne.valeurAffichee}</span>
          </div>
          <div className="bg-ecorce mt-2 h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full"
              style={{
                // 2 % de plancher : une valeur non nulle doit rester visible.
                width: `${Math.max(2, (ligne.valeur / maximum) * 100)}%`,
                background: couleur,
              }}
            />
          </div>
          {ligne.precision && (
            <p className="text-cendre-clair mt-1.5 text-[12px]">{ligne.precision}</p>
          )}
        </li>
      ))}
      {lignes.length > limite && (
        <li className="text-cendre-clair text-[12px]">
          et {lignes.length - limite} autre{lignes.length - limite > 1 ? "s" : ""} non affiché
          {lignes.length - limite > 1 ? "s" : ""}
        </li>
      )}
    </ul>
  );
}
