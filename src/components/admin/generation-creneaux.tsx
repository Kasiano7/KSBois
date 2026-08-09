"use client";

import { useState, useTransition } from "react";
import { CalendarSync, Loader2, TriangleAlert } from "lucide-react";
import { genererCreneaux } from "@/server/actions/admin-creneaux";
import { formatDateFr } from "@/lib/jours";
import type { EtatGeneration } from "@/server/admin-creneaux";
import { Button } from "@/components/ui/button";

/**
 * État de génération des dates.
 *
 * Panne silencieuse à rendre visible : la génération est ponctuelle, mais
 * l'horizon recule d'un jour chaque jour. Le jour où plus aucune date n'est
 * générée, le tunnel de commande ne propose plus rien — sans message d'erreur
 * nulle part. Cet encart est le seul endroit où ça se voit.
 */

const lisible = formatDateFr;

export function GenerationCreneaux({ etat }: { etat: EtatGeneration }) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const alerte = etat.generationNecessaire;

  return (
    <div
      className={`rounded-[8px] border p-5 ${
        alerte ? "border-alerte/40 bg-alerte/8" : "border-ecorce-bord bg-ecorce-eleve"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[60ch]">
          <p className="flex items-center gap-2 text-[17px] font-semibold">
            {alerte && (
              <TriangleAlert
                size={20}
                strokeWidth={1.9}
                className="text-alerte"
                aria-hidden="true"
              />
            )}
            {etat.derniereDate === null
              ? "Aucune date de livraison n'est générée"
              : `Dates proposées jusqu'au ${lisible(etat.derniereDate)}`}
          </p>
          <p className="text-cendre-clair mt-2 text-[15px] leading-relaxed">
            {etat.derniereDate === null
              ? "Tant qu'aucune date n'existe, aucun client ne peut choisir de créneau à la commande."
              : alerte
                ? `Vos clients peuvent réserver jusqu'à ${etat.bookingHorizonDays} jours à l'avance, soit le ${lisible(etat.horizonSouhaite)}. Générez les dates manquantes.`
                : `Les clients réservent jusqu'à ${etat.bookingHorizonDays} jours à l'avance, au plus tôt le ${lisible(etat.premierJourProposable)} (délai de préparation de ${etat.leadTimeDays} jours).`}
          </p>
        </div>

        <Button
          type="button"
          variant={alerte ? "cta" : "outline"}
          size="lg"
          disabled={enCours}
          onClick={() => {
            setMessage(null);
            demarrer(async () => {
              const r = await genererCreneaux();
              setMessage({ ok: r.ok, texte: r.message ?? "" });
            });
          }}
        >
          {enCours ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <CalendarSync strokeWidth={1.75} />
          )}
          Générer les dates
        </Button>
      </div>

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`mt-3 text-[15px] ${message.ok ? "text-succes" : "text-erreur"}`}
        >
          {message.texte}
        </p>
      )}
    </div>
  );
}
