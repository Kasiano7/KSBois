import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Fil des étapes du tunnel — visible en permanence (docs/03 §6.3).
 * Quatre étapes, jamais plus. Les étapes franchies restent cliquables :
 * corriger une erreur ne doit pas obliger à tout recommencer.
 */

const ETAPES = [
  { cle: "panier", libelle: "Panier", href: "/panier" },
  { cle: "coordonnees", libelle: "Coordonnées", href: "/commande/livraison" },
  { cle: "creneau", libelle: "Créneau", href: "/commande/creneau" },
  { cle: "paiement", libelle: "Paiement", href: "/commande/paiement" },
] as const;

export type CleEtape = (typeof ETAPES)[number]["cle"];

export function Etapes({ courante }: { courante: CleEtape }) {
  const indexCourant = ETAPES.findIndex((e) => e.cle === courante);

  return (
    <nav aria-label="Étapes de la commande">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {ETAPES.map((etape, index) => {
          const franchie = index < indexCourant;
          const active = index === indexCourant;

          const contenu = (
            <span
              className={cn(
                "micro-label",
                active && "text-encre",
                franchie && "text-braise-texte",
                !active && !franchie && "text-cendre",
              )}
            >
              {index + 1}. {etape.libelle}
            </span>
          );

          return (
            <li key={etape.cle} className="flex items-center gap-2">
              {franchie ? (
                <Link href={etape.href} className="underline-offset-4 hover:underline">
                  {contenu}
                </Link>
              ) : (
                <span aria-current={active ? "step" : undefined}>{contenu}</span>
              )}
              {index < ETAPES.length - 1 && (
                <span className="text-cendre-clair" aria-hidden="true">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
