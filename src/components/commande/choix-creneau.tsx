"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarClock } from "lucide-react";
import { choisirCreneau } from "@/server/actions/commande";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Étape 3 — créneau SOUHAITÉ.
 *
 * Le site ne promet jamais une heure ferme à la place du bûcheron : le client
 * exprime une préférence, l'entreprise confirme sous 24 h (docs/02 §3.1).
 *
 * Affichage en LISTE de dates, pas en calendrier mensuel : une audience 55+
 * sur mobile choisit mieux dans une liste verticale (docs/02 §3.3).
 */

export interface CreneauAffiche {
  id: string;
  dateLisible: string;
  label: string;
  dernieresPlaces: boolean;
}

export function ChoixCreneau({
  groupes,
}: {
  groupes: { date: string; dateLisible: string; creneaux: CreneauAffiche[] }[];
}) {
  const router = useRouter();
  const [choix, setChoix] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const valider = (slotId: string | null) => {
    setErreur(null);
    demarrer(async () => {
      const resultat = await choisirCreneau({ slotId });
      if (resultat.ok) router.push("/commande/paiement");
      else setErreur(resultat.message ?? "Une erreur est survenue.");
    });
  };

  return (
    <div className="mt-8">
      <fieldset>
        <legend className="sr-only">Créneau de livraison souhaité</legend>

        <div className="space-y-7">
          {groupes.map((groupe) => (
            <div key={groupe.date}>
              <h2 className="text-[19px] font-semibold first-letter:uppercase">
                {groupe.dateLisible}
              </h2>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {groupe.creneaux.map((creneau) => {
                  const actif = choix === creneau.id;
                  return (
                    <label
                      key={creneau.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 rounded-[6px] border p-4",
                        "transition-colors duration-150",
                        actif
                          ? "border-sapin bg-sapin/8"
                          : "border-aubier-bord hover:bg-encre/3",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="slotId"
                          value={creneau.id}
                          checked={actif}
                          onChange={() => setChoix(creneau.id)}
                          className="accent-braise size-5"
                        />
                        <span className="text-[17px] font-semibold">{creneau.label}</span>
                      </span>
                      {/* Rareté affichée uniquement si elle est réelle */}
                      {creneau.dernieresPlaces && (
                        <span className="bg-seve/25 text-encre rounded-[3px] px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap">
                          dernières places
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {erreur && (
        <p role="alert" className="text-erreur mt-6 text-[17px]">
          {erreur}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="or"
          size="cta"
          disabled={enCours || !choix}
          onClick={() => valider(choix)}
        >
          {enCours ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Enregistrement…
            </>
          ) : (
            "Continuer"
          )}
        </Button>

        {/* Toujours proposé en dernier : capte les indécis sans les perdre */}
        <Button type="button" variant="ghost" size="lg" disabled={enCours} onClick={() => valider(null)}>
          <CalendarClock strokeWidth={1.75} />
          Peu importe, contactez-moi
        </Button>
      </div>
    </div>
  );
}
