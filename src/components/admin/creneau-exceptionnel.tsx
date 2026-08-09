"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Loader2, Check, X } from "lucide-react";
import { ajouterCreneauExceptionnel } from "@/server/actions/admin-creneaux";
import { libelleParDefaut } from "@/domain/slots";
import type { Referentiels } from "@/server/admin-creneaux";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Créneau ajouté à une date précise, hors journées habituelles.
 *
 * Le cas réel : un samedi de rattrapage en pleine saison, ou une matinée
 * rouverte après des intempéries. Ce créneau n'est rattaché à aucun modèle,
 * donc la régénération ne le touche pas.
 */
export function CreneauExceptionnel({
  referentiels,
  premiereDate,
}: {
  referentiels: Referentiels;
  /** Aujourd'hui, dans le fuseau de l'entreprise — jamais lu du navigateur. */
  premiereDate: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const [date, setDate] = useState(premiereDate);
  const [debut, setDebut] = useState("08:00");
  const [fin, setFin] = useState("12:00");
  const [libelle, setLibelle] = useState(libelleParDefaut("08:00", "12:00"));
  const [libelleTouche, setLibelleTouche] = useState(false);
  const [maxLivraisons, setMaxLivraisons] = useState("4");
  const [maxVolume, setMaxVolume] = useState("12");
  const [vehiculeId, setVehiculeId] = useState("");

  const majHoraires = (d: string, f: string) => {
    setDebut(d);
    setFin(f);
    if (!libelleTouche) setLibelle(libelleParDefaut(d, f));
  };

  if (!ouvert) {
    return (
      <div>
        <Button type="button" variant="outline" size="lg" onClick={() => setOuvert(true)}>
          <CalendarPlus strokeWidth={1.75} />
          Ajouter un créneau exceptionnel
        </Button>
        {message?.ok && (
          <p role="status" className="text-succes mt-3 text-[15px]">
            {message.texte}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border-braise/40 bg-ecorce-eleve rounded-[8px] border p-5">
      <h3 className="text-[19px] font-semibold">Créneau exceptionnel</h3>
      <p className="text-cendre-clair mt-1.5 max-w-[62ch] text-[15px]">
        Une date en plus, sans toucher à vos journées habituelles : un samedi de rattrapage, une
        matinée ajoutée en pleine saison.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="exc-date" className="text-cendre-clair">
            Date
          </Label>
          <Input
            id="exc-date"
            type="date"
            min={premiereDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="tabulaire mt-2 w-48"
          />
        </div>

        <div className="flex gap-4">
          <div>
            <Label htmlFor="exc-debut" className="text-cendre-clair">
              Début
            </Label>
            <Input
              id="exc-debut"
              type="time"
              value={debut}
              onChange={(e) => majHoraires(e.target.value, fin)}
              className="tabulaire mt-2 w-32"
            />
          </div>
          <div>
            <Label htmlFor="exc-fin" className="text-cendre-clair">
              Fin
            </Label>
            <Input
              id="exc-fin"
              type="time"
              value={fin}
              onChange={(e) => majHoraires(debut, e.target.value)}
              className="tabulaire mt-2 w-32"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="exc-libelle" className="text-cendre-clair">
            Nom affiché au client
          </Label>
          <Input
            id="exc-libelle"
            value={libelle}
            onChange={(e) => {
              setLibelle(e.target.value);
              setLibelleTouche(true);
            }}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="exc-livraisons" className="text-cendre-clair">
            Livraisons maximum
          </Label>
          <Input
            id="exc-livraisons"
            inputMode="numeric"
            value={maxLivraisons}
            onChange={(e) => setMaxLivraisons(e.target.value.replace(/\D/g, ""))}
            className="tabulaire mt-2 w-24 text-center text-[19px] font-semibold"
          />
        </div>

        <div>
          <Label htmlFor="exc-volume" className="text-cendre-clair">
            Volume maximum (m³ apparents)
          </Label>
          <Input
            id="exc-volume"
            inputMode="decimal"
            value={maxVolume}
            onChange={(e) => setMaxVolume(e.target.value.replace(/[^\d.,]/g, ""))}
            className="tabulaire mt-2 w-24 text-center text-[19px] font-semibold"
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="exc-vehicule" className="text-cendre-clair">
            Véhicule <span className="font-normal">(facultatif)</span>
          </Label>
          <select
            id="exc-vehicule"
            value={vehiculeId}
            onChange={(e) => setVehiculeId(e.target.value)}
            className="border-ecorce-bord bg-ecorce mt-2 h-12 w-full max-w-sm rounded-[4px] border px-3 text-[17px]"
          >
            <option value="">Au choix le jour même</option>
            {referentiels.vehicules.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nom} — {v.capaciteM3} m³
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && !message.ok && (
        <p role="alert" className="text-erreur mt-4 text-[15px]">
          {message.texte}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="cta"
          size="lg"
          disabled={enCours}
          onClick={() => {
            setMessage(null);
            demarrer(async () => {
              const r = await ajouterCreneauExceptionnel({
                date,
                startTime: debut,
                endTime: fin,
                label: libelle,
                maxDeliveries: maxLivraisons || "0",
                maxVolumeM3: (maxVolume || "0").replace(",", "."),
                vehicleId: vehiculeId === "" ? null : vehiculeId,
              });
              setMessage({ ok: r.ok, texte: r.message ?? "" });
              if (r.ok) setOuvert(false);
            });
          }}
        >
          {enCours ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Check strokeWidth={2} />
          )}
          Ajouter ce créneau
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={enCours}
          onClick={() => setOuvert(false)}
        >
          <X strokeWidth={1.75} />
          Annuler
        </Button>
      </div>
    </div>
  );
}
