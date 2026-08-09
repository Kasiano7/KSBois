"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Pencil, Loader2, Check, X, Truck, MapPin } from "lucide-react";
import { creerModele, modifierModele, basculerModele } from "@/server/actions/admin-creneaux";
import { formatPlageHoraire, libelleParDefaut } from "@/domain/slots";
import { formatVolume } from "@/domain/units";
import { nomJour } from "@/lib/jours";
import type { ModeleCreneau, Referentiels } from "@/server/admin-creneaux";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Une journée de livraison habituelle — docs/05-ADMIN.md §6.2
 *
 * Le mot « modèle » n'apparaît pas à l'écran : l'exploitant règle « ses jours de
 * livraison », pas des gabarits. La double capacité (nombre ET volume) est
 * expliquée sous les champs, parce que c'est elle qui décide réellement de la
 * journée et que personne ne la devine (docs/02 §3.2).
 */

const JOURS = [
  { iso: 1, court: "Lun" },
  { iso: 2, court: "Mar" },
  { iso: 3, court: "Mer" },
  { iso: 4, court: "Jeu" },
  { iso: 5, court: "Ven" },
  { iso: 6, court: "Sam" },
  { iso: 7, court: "Dim" },
];

/** Virgule décimale française : « 3,5 » et jamais « 3.5 ». */
const nombreFr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** Coupe les secondes que Postgres renvoie : `<input type="time">` les refuse. */
function versChampHeure(heure: string): string {
  return heure.slice(0, 5);
}

export function CarteModele({
  modele,
  referentiels,
}: {
  /** `null` = formulaire de création. */
  modele: ModeleCreneau | null;
  referentiels: Referentiels;
}) {
  const creation = modele === null;
  const [edition, setEdition] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const [jour, setJour] = useState(modele?.weekday ?? 2);
  const [debut, setDebut] = useState(versChampHeure(modele?.startTime ?? "08:00"));
  const [fin, setFin] = useState(versChampHeure(modele?.endTime ?? "12:00"));
  const [libelle, setLibelle] = useState(modele?.label ?? libelleParDefaut("08:00", "12:00"));
  const [libelleTouche, setLibelleTouche] = useState(!creation);
  const [maxLivraisons, setMaxLivraisons] = useState(String(modele?.maxDeliveries ?? 6));
  const [maxVolume, setMaxVolume] = useState(String(modele?.maxVolumeM3 ?? 18));
  const [vehiculeId, setVehiculeId] = useState(modele?.vehicleId ?? "");
  const [zoneIds, setZoneIds] = useState<string[]>(modele?.zoneIds ?? []);

  // Le libellé suit les horaires tant que l'exploitant ne l'a pas réécrit :
  // aucun champ vide ne doit l'empêcher d'avancer.
  const majHoraires = (nouveauDebut: string, nouvelleFin: string) => {
    setDebut(nouveauDebut);
    setFin(nouvelleFin);
    if (!libelleTouche) setLibelle(libelleParDefaut(nouveauDebut, nouvelleFin));
  };

  const reinitialiser = () => {
    setErreur(null);
    setJour(modele?.weekday ?? 2);
    setDebut(versChampHeure(modele?.startTime ?? "08:00"));
    setFin(versChampHeure(modele?.endTime ?? "12:00"));
    setLibelle(modele?.label ?? libelleParDefaut("08:00", "12:00"));
    setLibelleTouche(!creation);
    setMaxLivraisons(String(modele?.maxDeliveries ?? 6));
    setMaxVolume(String(modele?.maxVolumeM3 ?? 18));
    setVehiculeId(modele?.vehicleId ?? "");
    setZoneIds(modele?.zoneIds ?? []);
  };

  const fermer = () => {
    setEdition(false);
    reinitialiser();
  };

  const enregistrer = () => {
    setErreur(null);
    setSucces(null);
    demarrer(async () => {
      const commun = {
        weekday: jour,
        startTime: debut,
        endTime: fin,
        label: libelle,
        maxDeliveries: maxLivraisons,
        maxVolumeM3: maxVolume.replace(",", "."),
        vehicleId: vehiculeId === "" ? null : vehiculeId,
        zoneIds,
      };
      const r = modele
        ? await modifierModele({ ...commun, modeleId: modele.id })
        : await creerModele(commun);

      if (r.ok) {
        setSucces(r.message ?? "Enregistré.");
        setEdition(false);
        if (creation) reinitialiser();
      } else {
        setErreur(r.message ?? "Enregistrement impossible.");
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Création repliée
  // ---------------------------------------------------------------------------
  if (creation && !edition) {
    return (
      <div>
        <Button type="button" variant="outline" size="lg" onClick={() => setEdition(true)}>
          <CalendarPlus strokeWidth={1.75} />
          Ajouter une journée de livraison
        </Button>
        {succes && (
          <p role="status" className="text-succes mt-3 flex items-start gap-2 text-[15px]">
            <Check size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
            {succes}
          </p>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Affichage d'une journée existante
  // ---------------------------------------------------------------------------
  if (!edition && modele) {
    return (
      <li
        className={`border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5 ${
          modele.active ? "" : "opacity-70"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[19px] font-semibold first-letter:uppercase">
              {nomJour(modele.weekday)} · {modele.label}
              {!modele.active && (
                <span className="bg-cendre/25 text-cendre-clair ml-2 rounded-[3px] px-2 py-0.5 text-[13px] font-semibold">
                  désactivée
                </span>
              )}
            </h3>
            <p className="text-cendre-clair mt-1 text-[15px]">
              {formatPlageHoraire(modele.startTime, modele.endTime)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="default" onClick={() => setEdition(true)}>
              <Pencil strokeWidth={1.75} />
              Modifier
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="default"
              disabled={enCours}
              onClick={() => {
                setErreur(null);
                setSucces(null);
                demarrer(async () => {
                  const r = await basculerModele({
                    modeleId: modele.id,
                    actif: !modele.active,
                    // Désactiver une journée sans fermer les dates déjà générées
                    // ne changerait rien pour le client : on ferme celles qui
                    // sont encore vides.
                    fermerDatesFutures: modele.active,
                  });
                  if (r.ok) setSucces(r.message ?? null);
                  else setErreur(r.message ?? "Action impossible.");
                });
              }}
            >
              {enCours ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {modele.active ? "Désactiver" : "Réactiver"}
            </Button>
          </div>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-cendre-clair">Livraisons maximum</dt>
            <dd className="tabulaire font-semibold">{modele.maxDeliveries}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cendre-clair">Volume maximum</dt>
            <dd className="tabulaire font-semibold">{formatVolume(modele.maxVolumeM3)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cendre-clair flex items-center gap-1.5">
              <Truck size={15} strokeWidth={1.9} aria-hidden="true" />
              Véhicule
            </dt>
            <dd>{modele.vehiculeNom ?? "au choix"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cendre-clair flex items-center gap-1.5">
              <MapPin size={15} strokeWidth={1.9} aria-hidden="true" />
              Zones
            </dt>
            <dd className="text-right">
              {modele.zonesNoms.length === 0 ? "toutes" : modele.zonesNoms.join(", ")}
            </dd>
          </div>
        </dl>

        {erreur && (
          <p role="alert" className="text-erreur mt-3 text-[15px]">
            {erreur}
          </p>
        )}
        {succes && (
          <p role="status" className="text-succes mt-3 text-[15px]">
            {succes}
          </p>
        )}
      </li>
    );
  }

  // ---------------------------------------------------------------------------
  // Formulaire (création ou modification)
  // ---------------------------------------------------------------------------
  const prefixe = modele ? `modele-${modele.id}` : "nouveau-modele";

  // Taille de commande qui sature les deux limites en même temps : c'est le
  // repère qui permet de régler la capacité sans se tromper d'ordre de grandeur.
  const livraisons = Number(maxLivraisons);
  const volume = Number(maxVolume.replace(",", "."));
  const volumeMoyen =
    livraisons > 0 && Number.isFinite(volume) && volume > 0
      ? nombreFr.format(volume / livraisons)
      : null;
  const contenu = (
    <>
      <fieldset>
        <legend className="micro-label text-cendre-clair mb-2.5">Jour de la semaine</legend>
        <div className="flex flex-wrap gap-1.5">
          {JOURS.map((j) => {
            const actif = jour === j.iso;
            return (
              <button
                key={j.iso}
                type="button"
                onClick={() => setJour(j.iso)}
                aria-pressed={actif}
                className={`min-h-11 min-w-14 rounded-[4px] border px-3 text-[15px] font-semibold transition-colors ${
                  actif
                    ? "border-braise bg-braise/20 text-braise"
                    : "border-ecorce-bord hover:bg-ecorce"
                }`}
              >
                {j.court}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${prefixe}-debut`} className="text-cendre-clair">
            Heure de début
          </Label>
          <Input
            id={`${prefixe}-debut`}
            type="time"
            value={debut}
            onChange={(e) => majHoraires(e.target.value, fin)}
            className="tabulaire mt-2 w-36"
          />
        </div>

        <div>
          <Label htmlFor={`${prefixe}-fin`} className="text-cendre-clair">
            Heure de fin
          </Label>
          <Input
            id={`${prefixe}-fin`}
            type="time"
            value={fin}
            onChange={(e) => majHoraires(debut, e.target.value)}
            className="tabulaire mt-2 w-36"
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor={`${prefixe}-libelle`} className="text-cendre-clair">
            Nom affiché au client
          </Label>
          <Input
            id={`${prefixe}-libelle`}
            value={libelle}
            onChange={(e) => {
              setLibelle(e.target.value);
              setLibelleTouche(true);
            }}
            className="mt-2"
          />
          <p className="text-cendre-clair mt-1.5 text-[13px]">
            C&apos;est le texte que le client lira au moment de choisir : « mardi 18 août ·{" "}
            {libelle || "Matin (8h – 12h)"} ».
          </p>
        </div>

        <div>
          <Label htmlFor={`${prefixe}-livraisons`} className="text-cendre-clair">
            Livraisons maximum
          </Label>
          <Input
            id={`${prefixe}-livraisons`}
            inputMode="numeric"
            value={maxLivraisons}
            onChange={(e) => setMaxLivraisons(e.target.value.replace(/\D/g, ""))}
            className="tabulaire mt-2 w-24 text-center text-[19px] font-semibold"
          />
        </div>

        <div>
          <Label htmlFor={`${prefixe}-volume`} className="text-cendre-clair">
            Volume maximum (m³ apparents)
          </Label>
          <Input
            id={`${prefixe}-volume`}
            inputMode="decimal"
            value={maxVolume}
            onChange={(e) => setMaxVolume(e.target.value.replace(/[^\d.,]/g, ""))}
            className="tabulaire mt-2 w-24 text-center text-[19px] font-semibold"
          />
        </div>

        {/* L'explication qui évite l'erreur de réglage la plus coûteuse. */}
        <p className="border-ecorce-bord text-cendre-clair rounded-[4px] border border-dashed p-3 text-[13px] leading-relaxed sm:col-span-2">
          Les deux limites s&apos;appliquent ensemble : la première atteinte ferme le créneau.
          {volumeMoyen !== null &&
            ` Avec ${maxLivraisons} livraisons et ${maxVolume} m³, une commande moyenne de ${volumeMoyen} m³ remplit exactement la demi-journée.`}
        </p>

        <div>
          <Label htmlFor={`${prefixe}-vehicule`} className="text-cendre-clair">
            Véhicule <span className="font-normal">(facultatif)</span>
          </Label>
          <select
            id={`${prefixe}-vehicule`}
            value={vehiculeId}
            onChange={(e) => setVehiculeId(e.target.value)}
            className="border-ecorce-bord bg-ecorce mt-2 h-12 w-full rounded-[4px] border px-3 text-[17px]"
          >
            <option value="">Au choix le jour même</option>
            {referentiels.vehicules.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nom} — {v.capaciteM3} m³
              </option>
            ))}
          </select>
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="micro-label text-cendre-clair mb-2.5">
            Zones desservies ce jour-là
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
            Aucune case cochée = toutes les zones. Cochez uniquement si vous réservez cette
            demi-journée à un secteur précis.
          </p>
        </fieldset>
      </div>

      {erreur && (
        <p role="alert" className="text-erreur mt-4 text-[15px]">
          {erreur}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" variant="cta" size="lg" disabled={enCours} onClick={enregistrer}>
          {enCours ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Check strokeWidth={2} />
          )}
          {creation ? "Ajouter cette journée" : "Enregistrer"}
        </Button>
        <Button type="button" variant="ghost" size="lg" disabled={enCours} onClick={fermer}>
          <X strokeWidth={1.75} />
          Annuler
        </Button>
      </div>
    </>
  );

  return creation ? (
    <div className="border-braise/40 bg-ecorce-eleve rounded-[8px] border p-5">
      <h3 className="mb-5 text-[19px] font-semibold">Nouvelle journée de livraison</h3>
      {contenu}
    </div>
  ) : (
    <li className="border-braise/40 bg-ecorce-eleve rounded-[8px] border p-5">{contenu}</li>
  );
}
