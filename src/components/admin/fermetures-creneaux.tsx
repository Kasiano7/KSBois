"use client";

import { useState, useTransition } from "react";
import { CalendarOff, Loader2, Check, X, Trash2 } from "lucide-react";
import { bloquerPeriode, supprimerFermeture } from "@/server/actions/admin-creneaux";
import { formatDateFr } from "@/lib/jours";
import type { FermetureAdmin, Referentiels } from "@/server/admin-creneaux";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Congés, jours fériés, intempéries — docs/05-ADMIN.md §6.2
 *
 * Bloquer une période fait deux choses, et l'écran doit le dire : les dates
 * futures ne seront plus engendrées, ET les créneaux déjà générés sur la période
 * sont fermés. Supprimer la fermeture rouvre exactement ceux-là.
 */

const lisible = formatDateFr;

export function FermeturesCreneaux({
  fermetures,
  referentiels,
  premiereDate,
}: {
  fermetures: FermetureAdmin[];
  referentiels: Referentiels;
  premiereDate: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const [debut, setDebut] = useState(premiereDate);
  const [fin, setFin] = useState(premiereDate);
  const [motif, setMotif] = useState("");
  const [zoneIds, setZoneIds] = useState<string[]>([]);

  const fermer = () => {
    setOuvert(false);
    setMotif("");
    setZoneIds([]);
    setDebut(premiereDate);
    setFin(premiereDate);
  };

  return (
    <div>
      {fermetures.length === 0 ? (
        <p className="text-cendre-clair mt-3 text-[17px]">
          Aucune période bloquée. Vos journées habituelles s&apos;appliquent sans interruption.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {fermetures.map((f) => (
            <li
              key={f.id}
              className="border-ecorce-bord bg-ecorce-eleve flex flex-wrap items-start justify-between gap-3 rounded-[8px] border p-4"
            >
              <div>
                <p className="text-[17px] font-semibold first-letter:uppercase">
                  {f.debut === f.fin
                    ? lisible(f.debut)
                    : `Du ${lisible(f.debut)} au ${lisible(f.fin)}`}
                </p>
                <p className="text-cendre-clair mt-1 text-[15px]">
                  {f.motif ?? "sans motif"}
                  {f.zonesNoms.length > 0 && ` · ${f.zonesNoms.join(", ")} uniquement`}
                  {f.creneauxFermes > 0 &&
                    ` · ${f.creneauxFermes} créneau${f.creneauxFermes > 1 ? "x fermés" : " fermé"}`}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="default"
                disabled={enCours}
                onClick={() => {
                  setMessage(null);
                  demarrer(async () => {
                    const r = await supprimerFermeture({ fermetureId: f.id });
                    setMessage({ ok: r.ok, texte: r.message ?? "" });
                  });
                }}
              >
                {enCours ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 strokeWidth={1.75} />
                )}
                Annuler cette fermeture
              </Button>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`mt-3 text-[15px] ${message.ok ? "text-succes" : "text-erreur"}`}
        >
          {message.texte}
        </p>
      )}

      {!ouvert ? (
        <div className="mt-4">
          <Button type="button" variant="outline" size="lg" onClick={() => setOuvert(true)}>
            <CalendarOff strokeWidth={1.75} />
            Bloquer une période
          </Button>
        </div>
      ) : (
        <div className="border-braise/40 bg-ecorce-eleve mt-4 rounded-[8px] border p-5">
          <h3 className="text-[19px] font-semibold">Bloquer une période</h3>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="fermeture-debut" className="text-cendre-clair">
                Du
              </Label>
              <Input
                id="fermeture-debut"
                type="date"
                value={debut}
                onChange={(e) => {
                  setDebut(e.target.value);
                  // Une fin antérieure au début n'a pas de sens : on suit.
                  if (e.target.value > fin) setFin(e.target.value);
                }}
                className="tabulaire mt-2 w-48"
              />
            </div>

            <div>
              <Label htmlFor="fermeture-fin" className="text-cendre-clair">
                Au <span className="font-normal">(inclus)</span>
              </Label>
              <Input
                id="fermeture-fin"
                type="date"
                min={debut}
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                className="tabulaire mt-2 w-48"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="fermeture-motif" className="text-cendre-clair">
                Motif
              </Label>
              <Input
                id="fermeture-motif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Congés d'été"
                className="mt-2"
              />
              <p className="text-cendre-clair mt-1.5 text-[13px]">
                Ce motif apparaît dans votre calendrier, jamais sur le site public.
              </p>
            </div>

            <fieldset className="sm:col-span-2">
              <legend className="micro-label text-cendre-clair mb-2.5">
                Limiter à certaines zones <span className="normal-case">(facultatif)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {referentiels.zones.map((z) => {
                  const active = zoneIds.includes(z.id);
                  return (
                    <label
                      key={z.id}
                      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border px-3.5 text-[15px] transition-colors ${
                        active ? "border-braise bg-braise/15" : "border-ecorce-bord hover:bg-ecorce"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() =>
                          setZoneIds((ids) =>
                            ids.includes(z.id) ? ids.filter((x) => x !== z.id) : [...ids, z.id],
                          )
                        }
                        className="accent-braise size-5"
                      />
                      {z.nom}
                    </label>
                  );
                })}
              </div>
              <p className="text-cendre-clair mt-2 text-[13px]">
                Aucune case cochée = toute l&apos;activité est arrêtée sur la période. Cochez pour
                une route coupée qui ne concerne qu&apos;un secteur.
              </p>
            </fieldset>
          </div>

          <p className="border-ecorce-bord text-cendre-clair mt-4 rounded-[4px] border border-dashed p-3 text-[13px] leading-relaxed">
            Les créneaux déjà proposés sur cette période seront fermés. Les livraisons déjà
            réservées ne sont pas annulées : vous serez averti du nombre à replanifier.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="cta"
              size="lg"
              disabled={enCours || motif.trim().length < 2}
              onClick={() => {
                setMessage(null);
                demarrer(async () => {
                  const r = await bloquerPeriode({
                    debut,
                    fin,
                    motif,
                    zoneIds,
                  });
                  setMessage({ ok: r.ok, texte: r.message ?? "" });
                  if (r.ok) fermer();
                });
              }}
            >
              {enCours ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Check strokeWidth={2} />
              )}
              Bloquer cette période
            </Button>
            <Button type="button" variant="ghost" size="lg" disabled={enCours} onClick={fermer}>
              <X strokeWidth={1.75} />
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
