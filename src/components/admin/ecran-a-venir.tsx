import Link from "next/link";
import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Écran d'administration pas encore construit.
 *
 * On préfère un chantier VISIBLE à un lien mort : l'exploitant qui découvre
 * l'outil doit comprendre ce qui existe et ce qui vient, sans tomber sur une
 * page d'erreur. Chaque écran indique ce qu'il fera et par quoi le remplacer
 * en attendant.
 */
export function EcranAVenir({
  titre,
  description,
  contournement,
}: {
  titre: string;
  description: string;
  contournement?: { libelle: string; href: string };
}) {
  return (
    <main className="p-5 sm:p-8">
      <h1 className="text-[28px] sm:text-[36px]">{titre}</h1>

      <div className="border-ecorce-bord mt-8 max-w-[62ch] rounded-[8px] border border-dashed p-6">
        <p className="flex items-center gap-2.5 text-[19px] font-semibold">
          <Hammer size={22} strokeWidth={1.9} className="text-seve" aria-hidden="true" />
          Écran en construction
        </p>
        <p className="text-cendre-clair mt-3 text-[17px] leading-relaxed">{description}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          {contournement && (
            <Button asChild variant="default" size="lg">
              <Link href={contournement.href}>{contournement.libelle}</Link>
            </Button>
          )}
          <Button asChild variant="outline" size="lg">
            <Link href="/admin">Retour au tableau de bord</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
