"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RotateCcw, Loader2, TriangleAlert } from "lucide-react";
import { recommander } from "@/server/actions/compte";
import { Button } from "@/components/ui/button";

/**
 * « Recommander la même chose » — docs/03-DESIGN-SYSTEM.md §6.4
 *
 * Le bouton le plus rentable du site. Deux clics : celui-ci, puis le choix du
 * créneau. L'adresse, les contraintes d'accès et les coordonnées sont déjà
 * connues, le panier est rempli à l'identique.
 *
 * Exception assumée : si quelque chose a changé depuis (format retiré, prix
 * révisé, stock insuffisant), on N'ENVOIE PAS le client au créneau. On affiche
 * ce qui a bougé et on l'emmène au panier. Un client qui découvre au paiement
 * qu'il ne commande pas ce qu'il croyait ne revient pas.
 */
export function BoutonRecommander({
  reference,
  taille = "cta",
}: {
  reference: string;
  taille?: "cta" | "lg";
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);

  const lancer = () =>
    demarrer(async () => {
      setErreur(null);
      setAvertissements([]);

      const r = await recommander({ reference });

      if (!r.ok) {
        setErreur(r.message ?? "La recommande a échoué.");
        setAvertissements(r.avertissements ?? []);
        return;
      }

      if (r.avertissements && r.avertissements.length > 0) {
        // On laisse le client lire avant de continuer : pas de redirection.
        setAvertissements(r.avertissements);
        return;
      }

      router.push(r.redirection ?? "/panier");
    });

  return (
    <div>
      <Button
        type="button"
        variant="or"
        size={taille}
        className={taille === "cta" ? "w-full sm:w-auto" : undefined}
        disabled={enCours}
        onClick={lancer}
      >
        {enCours ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw strokeWidth={1.9} />
        )}
        Recommander la même chose
      </Button>

      {erreur && (
        <p role="alert" className="text-erreur mt-3 text-[17px]">
          {erreur}
        </p>
      )}

      {avertissements.length > 0 && (
        <div
          role="status"
          className="border-alerte/40 bg-alerte/8 mt-4 rounded-[8px] border p-4 text-[17px]"
        >
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert size={20} strokeWidth={1.9} className="text-alerte" aria-hidden="true" />
            Deux ou trois choses ont changé depuis
          </p>
          <ul className="mt-2.5 space-y-1.5 leading-relaxed">
            {avertissements.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>

          {!erreur && (
            <Button asChild variant="or" size="lg" className="mt-4">
              <Link href="/panier">Voir mon panier et continuer</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
