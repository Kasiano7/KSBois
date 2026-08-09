"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Banknote, Loader2, Check } from "lucide-react";
import {
  changerStatutCommande,
  confirmerLivraison,
  enregistrerPaiement,
} from "@/server/actions/admin-commandes";
import { formatEuros } from "@/domain/units";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/domain/orders/state-machine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Colonne d'actions de la fiche commande.
 *
 * Les boutons portent des libellés EXPLICITES (« Marquer prête »), jamais un
 * sélecteur de statut technique. Chaque action confirme visiblement son effet.
 */

const CRENEAUX = ["Matin (8h – 12h)", "Après-midi (14h – 18h)", "Journée"];

export function ActionsCommande({
  orderId,
  statut,
  statutsPossibles,
  totalCents,
  dejaPayeCents,
  modePaiement,
  dateConfirmee,
  creneauConfirme,
}: {
  orderId: string;
  statut: OrderStatus;
  statutsPossibles: OrderStatus[];
  totalCents: number;
  dejaPayeCents: number;
  modePaiement: string | null;
  dateConfirmee: string | null;
  creneauConfirme: string | null;
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);
  const [date, setDate] = useState(dateConfirmee ?? "");
  const [creneau, setCreneau] = useState(creneauConfirme ?? CRENEAUX[0]);

  const resteAPayer = Math.max(0, totalCents - dejaPayeCents);

  /**
   * `succes` reçoit le résultat pour pouvoir dire la VÉRITÉ sur la notification :
   * « le client a été prévenu par email » n'est affiché que si l'email est
   * réellement parti. Sinon on annonce qu'il est en attente d'envoi.
   */
  const lancer = (
    fn: () => Promise<{ ok: boolean; message?: string; emailEnvoye?: boolean }>,
    succes: (r: { emailEnvoye?: boolean }) => string,
  ) => {
    setMessage(null);
    demarrer(async () => {
      const r = await fn();
      setMessage(
        r.ok
          ? { ton: "ok", texte: succes(r) }
          : { ton: "erreur", texte: r.message ?? "Une erreur est survenue." },
      );
    });
  };

  return (
    <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
      {/* ---- Confirmer la date : l'action pivot du modèle en deux temps ---- */}
      <section className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
        <h2 className="flex items-center gap-2 text-[19px] font-semibold">
          <CalendarCheck size={21} strokeWidth={1.9} className="text-seve" aria-hidden="true" />
          Confirmer la livraison
        </h2>
        <p className="text-cendre-clair mt-2 text-[15px] leading-relaxed">
          {dateConfirmee
            ? "Une date a déjà été confirmée au client. La modifier le prévient à nouveau."
            : "Le client a exprimé un souhait. En confirmant, vous vous engagez sur une date."}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="date-livraison" className="text-cendre-clair">
              Date
            </Label>
            <Input
              id="date-livraison"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="creneau-livraison" className="text-cendre-clair">
              Créneau
            </Label>
            <select
              id="creneau-livraison"
              value={creneau}
              onChange={(e) => setCreneau(e.target.value)}
              className="border-input bg-card text-foreground mt-2 h-12 w-full rounded-[4px] border px-3 text-[17px]"
            >
              {CRENEAUX.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          type="button"
          variant="cta"
          size="lg"
          disabled={enCours || !date}
          className="mt-4 w-full"
          onClick={() =>
            lancer(
              () => confirmerLivraison({ orderId, date, creneau }),
              (r) =>
                r.emailEnvoye
                  ? "Livraison confirmée. Le client a reçu un email avec la date."
                  : "Livraison confirmée. ⚠️ L'email n'a pas pu partir (envoi non configuré) — prévenez le client par téléphone.",
            )
          }
        >
          {enCours ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CalendarCheck strokeWidth={1.9} />}
          {dateConfirmee ? "Modifier la date" : "Confirmer cette date"}
        </Button>
      </section>

      {/* ---- Encaissement ---- */}
      {resteAPayer > 0 && (
        <section className="border-ecorce-bord rounded-[8px] border p-5">
          <h2 className="flex items-center gap-2 text-[19px] font-semibold">
            <Banknote size={21} strokeWidth={1.9} className="text-seve" aria-hidden="true" />
            Encaissement
          </h2>
          <p className="text-cendre-clair mt-2 text-[15px]">
            Reste à percevoir : <strong className="text-aubier">{formatEuros(resteAPayer)}</strong>
          </p>
          <Button
            type="button"
            variant="default"
            size="lg"
            disabled={enCours}
            className="mt-4 w-full"
            onClick={() =>
              lancer(
                () =>
                  enregistrerPaiement({
                    orderId,
                    method: modePaiement ?? "cash",
                    amountCents: resteAPayer,
                  }),
                () => `Paiement de ${formatEuros(resteAPayer)} enregistré.`,
              )
            }
          >
            Encaisser {formatEuros(resteAPayer)}
          </Button>
        </section>
      )}

      {/* ---- Changements de statut, en libellés explicites ---- */}
      <section className="border-ecorce-bord rounded-[8px] border p-5">
        <h2 className="text-[19px] font-semibold">Suivi</h2>
        <p className="text-cendre-clair mt-2 text-[15px]">
          État actuel : <strong className="text-aubier">{ORDER_STATUS_LABELS[statut]}</strong>
        </p>

        {statutsPossibles.length === 0 ? (
          <p className="text-cendre-clair mt-4 text-[15px]">
            Cette commande est terminée : plus aucun changement n&apos;est possible.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {statutsPossibles.map((cible) => (
              <Button
                key={cible}
                type="button"
                variant={cible === "annulee" ? "destructive" : "outline"}
                size="lg"
                disabled={enCours}
                className="w-full justify-start"
                onClick={() =>
                  lancer(
                    () => changerStatutCommande({ orderId, nouveauStatut: cible }),
                    () => `Commande passée en « ${ORDER_STATUS_LABELS[cible]} ».`,
                  )
                }
              >
                {cible === "annulee" ? "Annuler la commande" : `Marquer « ${ORDER_STATUS_LABELS[cible]} »`}
              </Button>
            ))}
          </div>
        )}
      </section>

      {message && (
        <p
          role="status"
          className={`flex items-start gap-2 rounded-[6px] p-4 text-[15px] ${
            message.ton === "ok" ? "bg-succes/15 text-succes" : "bg-erreur/15 text-erreur"
          }`}
        >
          {message.ton === "ok" && <Check size={19} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />}
          {message.texte}
        </p>
      )}
    </aside>
  );
}
