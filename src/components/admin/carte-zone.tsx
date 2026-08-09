"use client";

import { useState, useTransition } from "react";
import { Pencil, Loader2, Check, X, MapPin } from "lucide-react";
import { modifierZone } from "@/server/actions/admin-zones";
import { formatEuros, formatVolume } from "@/domain/units";
import { formatJoursLivraison } from "@/lib/jours";
import type { ZoneAdmin } from "@/server/admin-zones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Carte de zone tarifaire, éditable sur place.
 *
 * La formule appliquée est rappelée en clair sous les champs : l'exploitant doit
 * comprendre le calcul, sinon il ne fera pas confiance au système et continuera
 * à donner ses prix au téléphone (docs/02 §2.4).
 */

const JOURS = [
  { iso: 1, court: "L" },
  { iso: 2, court: "Ma" },
  { iso: 3, court: "Me" },
  { iso: 4, court: "J" },
  { iso: 5, court: "V" },
  { iso: 6, court: "S" },
  { iso: 7, court: "D" },
];

function euros(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toString().replace(".", ",");
}

export function CarteZone({ zone, modifiable }: { zone: ZoneAdmin; modifiable: boolean }) {
  const [edition, setEdition] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [nom, setNom] = useState(zone.nom);
  const [base, setBase] = useState(euros(zone.baseFeeCents));
  const [parM3, setParM3] = useState(euros(zone.feePerM3Cents));
  const [gratuitAu, setGratuitAu] = useState(euros(zone.freeAboveCents));
  const [minVolume, setMinVolume] = useState(String(zone.minOrderVolumeM3));
  const [distance, setDistance] = useState(
    zone.distanceKmEstimate === null ? "" : String(zone.distanceKmEstimate),
  );
  const [jours, setJours] = useState<number[]>(zone.joursLivraison);

  const basculerJour = (iso: number) =>
    setJours((j) => (j.includes(iso) ? j.filter((x) => x !== iso) : [...j, iso].sort()));

  const annuler = () => {
    setEdition(false);
    setErreur(null);
    setNom(zone.nom);
    setBase(euros(zone.baseFeeCents));
    setParM3(euros(zone.feePerM3Cents));
    setGratuitAu(euros(zone.freeAboveCents));
    setMinVolume(String(zone.minOrderVolumeM3));
    setJours(zone.joursLivraison);
  };

  if (!edition) {
    return (
      <li className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[19px] font-semibold">
              {zone.nom}
              {!zone.active && (
                <span className="bg-cendre/25 text-cendre-clair ml-2 rounded-[3px] px-2 py-0.5 text-[13px] font-semibold">
                  désactivée
                </span>
              )}
            </h3>
            <p className="text-cendre-clair mt-1 flex items-center gap-1.5 text-[15px]">
              <MapPin size={15} strokeWidth={1.9} aria-hidden="true" />
              {zone.nbCommunes === 0 ? (
                <span className="text-alerte">Aucune commune rattachée</span>
              ) : (
                `${zone.nbCommunes} commune${zone.nbCommunes > 1 ? "s" : ""}`
              )}
            </p>
          </div>

          {modifiable && (
            <Button type="button" variant="outline" size="default" onClick={() => setEdition(true)}>
              <Pencil strokeWidth={1.75} />
              Modifier
            </Button>
          )}
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-cendre-clair">Forfait</dt>
            <dd className="tabulaire font-semibold">
              {zone.baseFeeCents === 0 ? "Gratuit" : formatEuros(zone.baseFeeCents)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cendre-clair">Par m³ apparent</dt>
            <dd className="tabulaire">
              {zone.feePerM3Cents === 0 ? "—" : formatEuros(zone.feePerM3Cents)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cendre-clair">Offerte à partir de</dt>
            <dd className="tabulaire">
              {zone.freeAboveCents === null ? "jamais" : formatEuros(zone.freeAboveCents)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cendre-clair">Minimum de commande</dt>
            <dd className="tabulaire">
              {zone.minOrderVolumeM3 === 0 ? "aucun" : formatVolume(zone.minOrderVolumeM3)}
            </dd>
          </div>
          <div className="flex justify-between gap-3 sm:col-span-2">
            <dt className="text-cendre-clair">Jours de passage</dt>
            <dd>{formatJoursLivraison(zone.joursLivraison) || "aucun"}</dd>
          </div>
        </dl>
      </li>
    );
  }

  return (
    <li className="border-braise/40 bg-ecorce-eleve rounded-[8px] border p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`nom-${zone.id}`} className="text-cendre-clair">
            Nom de la zone
          </Label>
          <Input
            id={`nom-${zone.id}`}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor={`base-${zone.id}`} className="text-cendre-clair">
            Forfait de déplacement (€)
          </Label>
          <Input
            id={`base-${zone.id}`}
            inputMode="decimal"
            value={base}
            onChange={(e) => setBase(e.target.value.replace(/[^\d.,]/g, ""))}
            className="tabulaire mt-2 w-28 text-center"
          />
        </div>

        <div>
          <Label htmlFor={`m3-${zone.id}`} className="text-cendre-clair">
            Supplément par m³ apparent (€)
          </Label>
          <Input
            id={`m3-${zone.id}`}
            inputMode="decimal"
            value={parM3}
            onChange={(e) => setParM3(e.target.value.replace(/[^\d.,]/g, ""))}
            className="tabulaire mt-2 w-28 text-center"
          />
        </div>

        <div>
          <Label htmlFor={`gratuit-${zone.id}`} className="text-cendre-clair">
            Offerte à partir de (€) <span className="font-normal">— vide = jamais</span>
          </Label>
          <Input
            id={`gratuit-${zone.id}`}
            inputMode="decimal"
            value={gratuitAu}
            onChange={(e) => setGratuitAu(e.target.value.replace(/[^\d.,]/g, ""))}
            className="tabulaire mt-2 w-28 text-center"
          />
        </div>

        <div>
          <Label htmlFor={`min-${zone.id}`} className="text-cendre-clair">
            Minimum de commande (m³ app.)
          </Label>
          <Input
            id={`min-${zone.id}`}
            inputMode="decimal"
            value={minVolume}
            onChange={(e) => setMinVolume(e.target.value.replace(/[^\d.,]/g, ""))}
            className="tabulaire mt-2 w-28 text-center"
          />
        </div>

        <div>
          <Label htmlFor={`dist-${zone.id}`} className="text-cendre-clair">
            Distance indicative (km)
          </Label>
          <Input
            id={`dist-${zone.id}`}
            inputMode="numeric"
            value={distance}
            onChange={(e) => setDistance(e.target.value.replace(/\D/g, ""))}
            className="tabulaire mt-2 w-28 text-center"
          />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="micro-label text-cendre-clair mb-2.5">Jours de passage</legend>
          <div className="flex flex-wrap gap-1.5">
            {JOURS.map((j) => {
              const actif = jours.includes(j.iso);
              return (
                <button
                  key={j.iso}
                  type="button"
                  onClick={() => basculerJour(j.iso)}
                  aria-pressed={actif}
                  className={`min-h-11 min-w-11 rounded-[4px] border px-3 text-[15px] font-semibold transition-colors ${
                    actif ? "border-braise bg-braise/20 text-braise" : "border-ecorce-bord hover:bg-ecorce"
                  }`}
                >
                  {j.court}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* Formule rappelée en clair : l'exploitant doit comprendre le calcul */}
      <p className="text-cendre-clair mt-4 text-[13px] leading-relaxed">
        Frais facturés = forfait + (supplément × volume) + carburant calculé sur la distance
        aller-retour et le véhicule retenu. Utilisez « Tester une adresse » pour vérifier.
      </p>

      {erreur && (
        <p role="alert" className="text-erreur mt-3 text-[15px]">
          {erreur}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="cta"
          size="lg"
          disabled={enCours}
          onClick={() => {
            setErreur(null);
            demarrer(async () => {
              const r = await modifierZone({
                zoneId: zone.id,
                nom,
                baseFeeEuros: base || "0",
                feePerM3Euros: parM3 || "0",
                freeAboveEuros: gratuitAu || null,
                minOrderVolumeM3: minVolume || "0",
                distanceKmEstimate: distance === "" ? null : distance,
                joursLivraison: jours,
                active: zone.active,
              });
              if (r.ok) setEdition(false);
              else setErreur(r.message ?? "Enregistrement impossible.");
            });
          }}
        >
          {enCours ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check strokeWidth={2} />}
          Enregistrer
        </Button>
        <Button type="button" variant="ghost" size="lg" disabled={enCours} onClick={annuler}>
          <X strokeWidth={1.75} />
          Annuler
        </Button>
      </div>
    </li>
  );
}
