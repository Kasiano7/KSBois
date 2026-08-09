"use client";

import { useState, useTransition } from "react";
import { MapPinned, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { testerAdresse, type ResultatTest } from "@/server/actions/admin-zones";
import { formatEuros, formatVolume } from "@/domain/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * « Tester une adresse » — docs/05-ADMIN.md §6.1
 *
 * Reproduit exactement ce que verrait un client, avec le DÉTAIL du calcul.
 * Sans cet outil, l'exploitant ne peut pas vérifier sa propre grille tarifaire,
 * et il ne fera pas confiance au système : il continuera à donner ses prix au
 * téléphone. C'est donc une fonctionnalité de confiance, pas un gadget.
 */
export function TesteurAdresse() {
  const [codePostal, setCodePostal] = useState("");
  const [ville, setVille] = useState("");
  const [volume, setVolume] = useState("3");
  const [resultat, setResultat] = useState<ResultatTest | null>(null);
  const [enCours, demarrer] = useTransition();

  return (
    <section className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
      <h2 className="flex items-center gap-2.5 text-[19px] font-semibold">
        <MapPinned size={21} strokeWidth={1.9} className="text-seve" aria-hidden="true" />
        Tester une adresse
      </h2>
      <p className="text-cendre-clair mt-1.5 text-[15px]">
        Vérifiez ce que verra un client avant de modifier vos tarifs.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          demarrer(async () => {
            setResultat(
              await testerAdresse({ codePostal, ville: ville || null, volumeM3: volume }),
            );
          });
        }}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <div>
          <Label htmlFor="test-cp" className="text-cendre-clair">
            Code postal
          </Label>
          <Input
            id="test-cp"
            inputMode="numeric"
            maxLength={5}
            placeholder="07100"
            value={codePostal}
            onChange={(e) => setCodePostal(e.target.value.replace(/\D/g, ""))}
            className="tabulaire mt-2 w-28 text-center"
          />
        </div>
        <div>
          <Label htmlFor="test-ville" className="text-cendre-clair">
            Commune <span className="font-normal">(si doute)</span>
          </Label>
          <Input
            id="test-ville"
            placeholder="Annonay"
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            className="mt-2 w-40"
          />
        </div>
        <div>
          <Label htmlFor="test-volume" className="text-cendre-clair">
            Volume
          </Label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id="test-volume"
              inputMode="decimal"
              value={volume}
              onChange={(e) => setVolume(e.target.value.replace(/[^\d.,]/g, ""))}
              className="tabulaire w-20 text-center"
            />
            <span className="text-cendre-clair text-[15px]">m³ app.</span>
          </div>
        </div>
        <Button type="submit" variant="default" size="lg" disabled={enCours || codePostal.length < 5}>
          {enCours ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Calcul…
            </>
          ) : (
            "Tester"
          )}
        </Button>
      </form>

      {resultat && !resultat.ok && (
        <p
          role="status"
          className="bg-alerte/15 text-alerte mt-4 flex items-start gap-2 rounded-[6px] p-3.5 text-[15px]"
        >
          <AlertTriangle size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
          {resultat.message}
        </p>
      )}

      {resultat?.ok && resultat.detail && (
        <div className="border-succes/30 bg-succes/8 mt-4 rounded-[6px] border p-4">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <CheckCircle2 size={19} strokeWidth={1.9} className="text-succes" aria-hidden="true" />
            {resultat.detail.commune} · {resultat.detail.zone} · {resultat.detail.distanceKm} km
          </p>

          <dl className="text-cendre-clair mt-3 space-y-1.5 text-[15px]">
            {resultat.detail.baseCents > 0 && (
              <div className="flex justify-between gap-3">
                <dt>Forfait de zone</dt>
                <dd className="tabulaire">{formatEuros(resultat.detail.baseCents)}</dd>
              </div>
            )}
            {resultat.detail.volumeCents > 0 && (
              <div className="flex justify-between gap-3">
                <dt>Part liée au volume</dt>
                <dd className="tabulaire">{formatEuros(resultat.detail.volumeCents)}</dd>
              </div>
            )}
            {resultat.detail.carburantCents > 0 && (
              <div className="flex justify-between gap-3">
                <dt>
                  Carburant — {resultat.detail.vehicule}, {resultat.detail.distanceKm * 2} km
                  aller-retour,{" "}
                  {resultat.detail.litres.toLocaleString("fr-FR")} L à{" "}
                  {(resultat.detail.prixGazoleCents / 100).toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  €/L
                </dt>
                <dd className="tabulaire">{formatEuros(resultat.detail.carburantCents)}</dd>
              </div>
            )}
          </dl>

          {/* Le plafond de sécurité ne doit JAMAIS s'appliquer en silence : sinon
              l'exploitant sous-facture ses livraisons lointaines sans le savoir. */}
          {resultat.detail.carburantPlafonne && (
            <p className="bg-alerte/15 text-alerte mt-3 flex items-start gap-2 rounded-[6px] p-3 text-[15px]">
              <AlertTriangle
                size={18}
                strokeWidth={2}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              Le carburant réel serait de{" "}
              <strong>{formatEuros(resultat.detail.carburantBrutCents)}</strong>, mais votre plafond
              de sécurité le limite à {formatEuros(resultat.detail.carburantCents)}. Vous perdez la
              différence sur chaque livraison de ce type — relevez le plafond dans les réglages, ou
              augmentez le forfait de cette zone.
            </p>
          )}

          <p className="border-ecorce-bord mt-3 flex items-baseline justify-between gap-3 border-t pt-3">
            <span className="font-semibold">Le client paiera</span>
            <span className="tabulaire text-[22px] font-bold">
              {resultat.detail.offerte ? "Livraison offerte" : formatEuros(resultat.detail.totalCents)}
            </span>
          </p>

          <p className="text-cendre-clair mt-3 text-[15px] leading-relaxed">
            Passages {resultat.detail.jours || "non définis"} · {resultat.detail.delaiJours} jours de
            préparation.
            {!resultat.detail.minimumAtteint && (
              <span className="text-alerte">
                {" "}
                Ce volume est sous votre minimum de {formatVolume(resultat.detail.minimumVolumeM3)} :
                le client ne pourra pas commander.
              </span>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
