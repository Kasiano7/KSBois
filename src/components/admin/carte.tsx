import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Surfaces communes de l'administration (docs/03 §9 quater).
 *
 * Un seul composant de carte pour tous les écrans : c'est ce qui donne au
 * tableau de bord et aux statistiques l'unité visuelle de la maquette client.
 */

export function Carte({
  children,
  className,
  ton = "surface",
}: {
  children: ReactNode;
  className?: string;
  /** `creuse` = simple contour, pour les blocs secondaires qui ne doivent pas peser. */
  ton?: "surface" | "creuse" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] border p-5",
        ton === "surface" && "border-ecorce-bord bg-ecorce-eleve",
        ton === "creuse" && "border-ecorce-bord bg-transparent",
        ton === "accent" && "border-seve/35 bg-seve/[0.07]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EnteteCarte({
  titre,
  description,
  action,
  Icone,
}: {
  titre: string;
  description?: string;
  action?: ReactNode;
  Icone?: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {Icone && (
          <Icone size={19} strokeWidth={1.75} className="text-seve mt-0.5 shrink-0" />
        )}
        <div className="min-w-0">
          <h3 className="text-[17px] leading-snug">{titre}</h3>
          {description && (
            <p className="text-cendre-clair mt-1 max-w-[70ch] text-[13px] leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

/**
 * Pastille d'évolution.
 *
 * ⚠️ Le sens n'est pas toujours « plus, c'est mieux » : une hausse des
 * annulations est une mauvaise nouvelle. D'où `sensInverse`, qui inverse la
 * couleur sans inverser le signe affiché.
 */
export function PuceEvolution({
  valeur,
  suffixe = "vs période précédente",
  sensInverse = false,
}: {
  valeur: number | null;
  suffixe?: string;
  sensInverse?: boolean;
}) {
  if (valeur === null) {
    return (
      <span className="text-cendre-clair text-[12px]">Pas de comparaison possible</span>
    );
  }

  const hausse = valeur >= 0;
  const favorable = sensInverse ? !hausse : hausse;
  const Fleche = hausse ? TrendingUp : TrendingDown;

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
      <span
        className={cn(
          "tabulaire inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
          favorable
            ? "bg-graphique-positif/15 text-graphique-positif"
            : "bg-graphique-negatif/15 text-graphique-negatif",
        )}
      >
        <Fleche size={13} strokeWidth={2.2} aria-hidden="true" />
        {hausse ? "+" : ""}
        {valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
      </span>
      <span className="text-cendre-clair">{suffixe}</span>
    </span>
  );
}
