"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Check, X, Pencil, Lock, LockOpen, Truck } from "lucide-react";
import { modifierCapaciteCreneau, basculerCreneau } from "@/server/actions/admin-creneaux";
import { formatPlageHoraire, isEffectivelyFull } from "@/domain/slots";
import { formatVolume } from "@/domain/units";
import { formatDateFr } from "@/lib/jours";
import type { CreneauCalendrier, SemaineCalendrier } from "@/server/admin-creneaux";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Calendrier des huit prochaines semaines — docs/05-ADMIN.md §6.2
 *
 * Chaque créneau affiche le remplissage de SES DEUX contraintes, en chiffres et
 * en barre. Jamais la couleur seule : le libellé porte toujours l'information
 * (docs/03 §9). La contrainte la plus avancée est désignée en toutes lettres,
 * parce que « 2/6 livraisons » sur un créneau à 17/18 m³ ferait croire à tort
 * qu'il reste de la place.
 */

/** Virgule décimale française : un volume s'écrit « 16,5 », jamais « 16.5 ». */
const nombreFr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

function Barre({ ratio, sature }: { ratio: number; sature: boolean }) {
  return (
    <div className="bg-ecorce h-1.5 w-full overflow-hidden rounded-full" aria-hidden="true">
      <div
        className={`h-full rounded-full ${sature ? "bg-braise" : "bg-seve"}`}
        style={{ width: `${Math.round(ratio * 100)}%` }}
      />
    </div>
  );
}

function LigneCreneau({
  creneau,
  minVolumeM3,
}: {
  creneau: CreneauCalendrier;
  minVolumeM3: number;
}) {
  const [mode, setMode] = useState<"vue" | "capacite" | "fermeture">("vue");
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const [maxLivraisons, setMaxLivraisons] = useState(String(creneau.maxDeliveries));
  const [maxVolume, setMaxVolume] = useState(String(creneau.maxVolumeM3));
  const [motif, setMotif] = useState("");

  const o = creneau.occupation;
  const complet = creneau.ouvert && o.saturated;
  // Reste trop peu de volume pour la plus petite commande possible : le créneau
  // n'est plus proposé au client, même si la base le dit encore ouvert.
  const inutilisable = creneau.ouvert && !complet && isEffectivelyFull(o, minVolumeM3);

  const etat = !creneau.ouvert
    ? { texte: "Fermé", classe: "bg-cendre/25 text-cendre-clair" }
    : complet
      ? { texte: "Complet", classe: "bg-braise/20 text-braise" }
      : inutilisable
        ? { texte: "Plus réservable", classe: "bg-alerte/20 text-alerte" }
        : { texte: "Ouvert", classe: "bg-succes/20 text-succes" };

  return (
    <li className="border-ecorce-bord border-t py-3 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold">
            {creneau.label}
            <span
              className={`ml-2 rounded-[3px] px-2 py-0.5 text-[13px] font-semibold ${etat.classe}`}
            >
              {etat.texte}
            </span>
          </p>
          <p className="text-cendre-clair mt-0.5 text-[13px]">
            {formatPlageHoraire(creneau.startTime, creneau.endTime)}
            {creneau.vehiculeNom && (
              <>
                {" · "}
                <Truck
                  size={13}
                  strokeWidth={1.9}
                  className="inline align-[-2px]"
                  aria-hidden="true"
                />{" "}
                {creneau.vehiculeNom}
              </>
            )}
            {creneau.zonesNoms.length > 0 && ` · ${creneau.zonesNoms.join(", ")}`}
          </p>
          {!creneau.ouvert && creneau.motifFermeture && (
            <p className="text-cendre-clair mt-1 text-[13px]">
              Motif : {creneau.motifFermeture}
              {creneau.fermeParFermeture && " (période bloquée)"}
            </p>
          )}
        </div>

        {mode === "vue" && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => setMode("capacite")}
            >
              <Pencil strokeWidth={1.75} />
              Ajuster
            </Button>
            {creneau.ouvert ? (
              <Button
                type="button"
                variant="ghost"
                size="default"
                onClick={() => setMode("fermeture")}
              >
                <Lock strokeWidth={1.75} />
                Fermer
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="default"
                disabled={enCours}
                onClick={() =>
                  demarrer(async () => {
                    const r = await basculerCreneau({
                      creneauId: creneau.id,
                      ouvert: true,
                    });
                    setMessage({ ok: r.ok, texte: r.message ?? "" });
                  })
                }
              >
                {enCours ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <LockOpen strokeWidth={1.75} />
                )}
                Rouvrir
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Remplissage : chiffres ET barre, jamais la couleur seule. */}
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="tabulaire flex justify-between text-[13px]">
            <span className={o.binding === "livraisons" ? "font-semibold" : "text-cendre-clair"}>
              {creneau.bookedDeliveries}/{creneau.maxDeliveries} livraisons
            </span>
            <span className="text-cendre-clair">
              {o.remainingDeliveries > 0
                ? `${o.remainingDeliveries} place${o.remainingDeliveries > 1 ? "s" : ""}`
                : "plus de place"}
            </span>
          </p>
          <div className="mt-1">
            <Barre ratio={o.deliveriesRatio} sature={o.remainingDeliveries < 1} />
          </div>
        </div>

        <div>
          <p className="tabulaire flex justify-between text-[13px]">
            <span className={o.binding === "volume" ? "font-semibold" : "text-cendre-clair"}>
              {nombreFr.format(creneau.bookedVolumeM3)}/{nombreFr.format(creneau.maxVolumeM3)} m³
              apparents
            </span>
            <span className="text-cendre-clair">
              {o.remainingVolumeM3 > 0
                ? `${nombreFr.format(o.remainingVolumeM3)} m³ libres`
                : "plus de volume"}
            </span>
          </p>
          <div className="mt-1">
            <Barre ratio={o.volumeRatio} sature={o.remainingVolumeM3 <= 0} />
          </div>
        </div>
      </div>

      {complet && (
        <p className="text-braise mt-2 text-[13px] font-semibold">
          Complet {o.binding === "volume" ? "en volume" : "en nombre de livraisons"} — ce créneau
          n&apos;est plus proposé aux clients.
        </p>
      )}

      {inutilisable && (
        <p className="text-alerte mt-2 text-[13px] font-semibold">
          Il reste {nombreFr.format(o.remainingVolumeM3)} m³, moins que la commande minimum de{" "}
          {nombreFr.format(minVolumeM3)} m³ : ce créneau n&apos;est plus proposé aux clients.
        </p>
      )}

      {/* Ajustement ponctuel de la capacité */}
      {mode === "capacite" && (
        <div className="border-braise/40 mt-3 rounded-[6px] border p-3">
          <p className="text-[15px] font-semibold">Capacité de cette date uniquement</p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div>
              <Label htmlFor={`liv-${creneau.id}`} className="text-cendre-clair">
                Livraisons
              </Label>
              <Input
                id={`liv-${creneau.id}`}
                inputMode="numeric"
                value={maxLivraisons}
                onChange={(e) => setMaxLivraisons(e.target.value.replace(/\D/g, ""))}
                className="tabulaire mt-2 w-20 text-center"
              />
            </div>
            <div>
              <Label htmlFor={`vol-${creneau.id}`} className="text-cendre-clair">
                Volume (m³ app.)
              </Label>
              <Input
                id={`vol-${creneau.id}`}
                inputMode="decimal"
                value={maxVolume}
                onChange={(e) => setMaxVolume(e.target.value.replace(/[^\d.,]/g, ""))}
                className="tabulaire mt-2 w-24 text-center"
              />
            </div>
            <Button
              type="button"
              variant="cta"
              size="default"
              disabled={enCours}
              onClick={() =>
                demarrer(async () => {
                  const r = await modifierCapaciteCreneau({
                    creneauId: creneau.id,
                    maxDeliveries: maxLivraisons || "0",
                    maxVolumeM3: (maxVolume || "0").replace(",", "."),
                  });
                  setMessage({ ok: r.ok, texte: r.message ?? "" });
                  if (r.ok) setMode("vue");
                })
              }
            >
              {enCours ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Check strokeWidth={2} />
              )}
              Enregistrer
            </Button>
            <Button type="button" variant="ghost" size="default" onClick={() => setMode("vue")}>
              Annuler
            </Button>
          </div>
          <p className="text-cendre-clair mt-2.5 text-[13px]">
            Modifie ce jour-là seulement. Pour changer toutes les semaines, modifiez la journée de
            livraison plus haut.
          </p>
        </div>
      )}

      {/* Fermeture d'une date : le motif s'affiche ensuite dans le calendrier */}
      {mode === "fermeture" && (
        <div className="border-alerte/40 mt-3 rounded-[6px] border p-3">
          <Label htmlFor={`motif-${creneau.id}`} className="text-cendre-clair">
            Pourquoi fermer ce créneau ?
          </Label>
          <Input
            id={`motif-${creneau.id}`}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Camion en révision"
            className="mt-2"
          />
          {creneau.bookedDeliveries > 0 && (
            <p className="text-alerte mt-2.5 text-[15px]">
              Attention : {creneau.bookedDeliveries} livraison
              {creneau.bookedDeliveries > 1 ? "s sont" : " est"} déjà prévue
              {creneau.bookedDeliveries > 1 ? "s" : ""} sur ce créneau. Fermer empêche de nouvelles
              commandes mais n&apos;annule pas celles-ci.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="cta"
              size="default"
              disabled={enCours}
              onClick={() =>
                demarrer(async () => {
                  const r = await basculerCreneau({
                    creneauId: creneau.id,
                    ouvert: false,
                    motif: motif || undefined,
                  });
                  setMessage({ ok: r.ok, texte: r.message ?? "" });
                  if (r.ok) setMode("vue");
                })
              }
            >
              {enCours ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Lock strokeWidth={1.75} />
              )}
              Fermer ce créneau
            </Button>
            <Button type="button" variant="ghost" size="default" onClick={() => setMode("vue")}>
              <X strokeWidth={1.75} />
              Annuler
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`mt-2.5 text-[15px] ${message.ok ? "text-succes" : "text-erreur"}`}
        >
          {message.texte}
        </p>
      )}
    </li>
  );
}

export function CalendrierCreneaux({
  semaines,
  minVolumeM3,
}: {
  semaines: SemaineCalendrier[];
  minVolumeM3: number;
}) {
  if (semaines.length === 0) {
    return (
      <p className="border-ecorce-bord text-cendre-clair mt-4 rounded-[8px] border border-dashed p-5 text-[17px]">
        Aucune date générée. Réglez vos journées de livraison ci-dessus, puis utilisez « Générer les
        dates » : sans dates, aucun client ne peut choisir de créneau.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-6">
      {semaines.map((semaine) => (
        <section key={semaine.debut}>
          <h3 className="micro-label text-cendre-clair">
            Semaine du {formatDateFr(semaine.debut, { jourSemaine: false })}
          </h3>

          <div className="mt-2.5 space-y-3">
            {semaine.journees.map((journee) => (
              <div
                key={journee.date}
                className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[17px] font-semibold first-letter:uppercase">
                    {formatDateFr(journee.date)}
                  </p>
                  {journee.livraisonsReservees > 0 && (
                    <Link
                      href={`/admin/tournee?date=${journee.date}`}
                      className="text-seve min-h-11 text-[15px] font-semibold underline underline-offset-4"
                    >
                      {journee.livraisonsReservees} livraison
                      {journee.livraisonsReservees > 1 ? "s" : ""} ·{" "}
                      {formatVolume(journee.volumeReserveM3)} — voir la tournée
                    </Link>
                  )}
                </div>

                <ul className="mt-2">
                  {journee.creneaux.map((creneau) => (
                    <LigneCreneau key={creneau.id} creneau={creneau} minVolumeM3={minVolumeM3} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
