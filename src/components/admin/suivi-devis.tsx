"use client";

import { useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";
import { changerStatutDevis, enregistrerNotesDevis } from "@/server/actions/admin-devis";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/domain/quotes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Suivi d'une demande : statut manuel et notes internes.
 *
 * Le statut n'est pas une machine à états stricte comme celle des commandes :
 * une demande de devis se traite au téléphone, dans le désordre. L'exploitant
 * doit pouvoir dire « refusé » puis se raviser sans se battre avec l'outil.
 */

const STATUTS: QuoteStatus[] = ["nouveau", "en_cours", "envoye", "accepte", "refuse"];

export function SuiviDevis({
  devisId,
  statut,
  notes,
  converti,
}: {
  devisId: string;
  statut: QuoteStatus;
  notes: string | null;
  converti: boolean;
}) {
  const [texte, setTexte] = useState(notes ?? "");
  const [enCours, demarrer] = useTransition();
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);

  return (
    <section className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
      <h2 className="text-[19px] font-semibold">Suivi</h2>

      <fieldset className="mt-4">
        <legend className="micro-label text-cendre-clair mb-2.5">Où en est cette demande ?</legend>
        <div className="flex flex-wrap gap-2">
          {STATUTS.map((s) => {
            const actif = s === statut;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={actif}
                // Un devis converti en commande ne redevient pas « à traiter » :
                // la commande existe, le stock est réservé.
                disabled={enCours || (converti && s !== "accepte")}
                onClick={() =>
                  demarrer(async () => {
                    const r = await changerStatutDevis({ devisId, statut: s });
                    setRetour({ ok: r.ok, texte: r.message ?? "" });
                  })
                }
                className={`min-h-11 rounded-[4px] border px-4 text-[15px] font-semibold transition-colors disabled:opacity-40 ${
                  actif
                    ? "border-braise bg-braise/20 text-braise"
                    : "border-ecorce-bord hover:bg-ecorce"
                }`}
              >
                {QUOTE_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
        {converti && (
          <p className="text-cendre-clair mt-2 text-[13px]">
            Ce devis a produit une commande : son statut reste « accepté ».
          </p>
        )}
      </fieldset>

      <div className="mt-5">
        <Label htmlFor="notes-devis" className="text-cendre-clair">
          Notes internes <span className="font-normal">— jamais visibles du client</span>
        </Label>
        <Textarea
          id="notes-devis"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={4}
          placeholder="Rappelé le 12, veut être livré après le 20. Accès difficile, prévoir le fourgon."
          className="mt-2"
        />
        <Button
          type="button"
          variant="outline"
          size="default"
          className="mt-3"
          disabled={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await enregistrerNotesDevis({ devisId, notes: texte });
              setRetour({ ok: r.ok, texte: r.message ?? "" });
            })
          }
        >
          {enCours ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Check strokeWidth={2} />
          )}
          Enregistrer la note
        </Button>
      </div>

      {retour && (
        <p
          role={retour.ok ? "status" : "alert"}
          className={`mt-3 text-[15px] ${retour.ok ? "text-succes" : "text-erreur"}`}
        >
          {retour.texte}
        </p>
      )}
    </section>
  );
}
