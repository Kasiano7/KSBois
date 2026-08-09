"use client";

import { useState, useTransition } from "react";
import { TreePine, Loader2, Check, X } from "lucide-react";
import { creerEssence } from "@/server/actions/admin-catalogue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LongueurDisponible } from "./carte-essence";

/**
 * Création d'une gamme d'essence.
 *
 * Le patron doit pouvoir mettre une nouvelle essence en vente sans développeur.
 * Trois informations suffisent : un nom, un prix, et les longueurs proposées.
 * Le reste (référence, TVA, pas de quantité, seuil d'alerte) prend des valeurs
 * par défaut cohérentes, ajustables ensuite depuis la liste.
 */
export function NouvelleEssence({ longueurs }: { longueurs: LongueurDisponible[] }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [sousTitre, setSousTitre] = useState("");
  const [prix, setPrix] = useState("");
  const [choisies, setChoisies] = useState<string[]>([]);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const fermer = () => {
    setOuvert(false);
    setNom("");
    setSousTitre("");
    setPrix("");
    setChoisies([]);
    setErreur(null);
  };

  const basculer = (id: string) =>
    setChoisies((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  if (!ouvert) {
    return (
      <div>
        <Button type="button" variant="outline" size="lg" onClick={() => setOuvert(true)}>
          <TreePine strokeWidth={1.75} />
          Nouvelle essence
        </Button>
        {succes && (
          <p role="status" className="text-succes mt-3 flex items-center gap-2 text-[15px]">
            <Check size={18} strokeWidth={2} aria-hidden="true" />
            {succes}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[19px] font-semibold">Nouvelle essence</h2>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Fermer" onClick={fermer}>
          <X strokeWidth={1.75} />
        </Button>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="essence-nom" className="text-cendre-clair">
            Nom affiché sur le site
          </Label>
          <Input
            id="essence-nom"
            autoFocus
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Charme"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="essence-sous-titre" className="text-cendre-clair">
            Sous-titre <span className="font-normal">(facultatif)</span>
          </Label>
          <Input
            id="essence-sous-titre"
            value={sousTitre}
            onChange={(e) => setSousTitre(e.target.value)}
            placeholder="Le plus calorifique"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="essence-prix" className="text-cendre-clair">
            Prix du m³ apparent
          </Label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id="essence-prix"
              inputMode="decimal"
              value={prix}
              onChange={(e) => setPrix(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="104"
              className="tabulaire w-28 text-center text-[19px] font-semibold"
            />
            <span className="text-cendre-clair text-[15px]">€</span>
          </div>
          <p className="text-cendre-clair mt-1.5 text-[13px]">
            Même prix pour toutes les longueurs au départ ; ajustable ensuite format par format.
          </p>
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="micro-label text-cendre-clair mb-2.5">Longueurs proposées</legend>
          <div className="flex flex-wrap gap-2">
            {longueurs.map((l) => {
              const active = choisies.includes(l.id);
              return (
                <label
                  key={l.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border px-3.5 text-[17px] transition-colors ${
                    active ? "border-braise bg-braise/15" : "border-ecorce-bord hover:bg-ecorce"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => basculer(l.id)}
                    className="accent-braise size-5"
                  />
                  {l.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      {erreur && (
        <p role="alert" className="text-erreur mt-4 text-[15px]">
          {erreur}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="cta"
          size="lg"
          disabled={enCours || nom.trim().length < 2 || prix === "" || choisies.length === 0}
          onClick={() => {
            setErreur(null);
            demarrer(async () => {
              const r = await creerEssence({
                nom,
                sousTitre: sousTitre || undefined,
                prixEuros: prix.replace(",", "."),
                cutLengthIds: choisies,
              });
              if (r.ok) {
                setSucces(`${nom} est en vente sur le site.`);
                fermer();
              } else {
                setErreur(r.message ?? "Création impossible.");
              }
            });
          }}
        >
          {enCours ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check strokeWidth={2} />}
          Mettre en vente
        </Button>
        <Button type="button" variant="ghost" size="lg" disabled={enCours} onClick={fermer}>
          Annuler
        </Button>
      </div>

      <p className="text-cendre-clair mt-4 text-[13px]">
        La gamme apparaît immédiatement sur la page d&apos;accueil, avec un stock à zéro. Saisissez
        votre production juste après pour la rendre commandable.
      </p>
    </div>
  );
}
