"use client";

import { useState, useTransition } from "react";
import { Fuel, RefreshCw, Loader2, Check, AlertTriangle } from "lucide-react";
import {
  accepterReleve,
  fixerPrixCarburant,
  relancerReleve,
} from "@/server/actions/admin-carburant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Prix du carburant — docs/02-MOTEURS-METIER.md §2.4
 *
 * Le prix est relevé chaque matin sur l'open data officiel. Trois choses doivent
 * être visibles ici, sinon l'exploitant ne peut pas faire confiance au calcul :
 * le prix en vigueur, son âge, et tout relevé que le contrôle de sanité a refusé.
 */

export interface ReleveAffiche {
  id: string;
  prixCents: number;
  source: string;
  applique: boolean;
  motifRefus: string | null;
  stations: number | null;
  departement: string | null;
  date: string;
}

const MOTIFS: Record<string, string> = {
  variation_excessive: "écart de plus de 15 % avec le prix en vigueur",
  echantillon_insuffisant: "trop peu de stations relevées",
};

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
}

const formatDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export function PanneauCarburant({
  enVigueur,
  refuses,
  ageJours,
  modifiable,
}: {
  enVigueur: ReleveAffiche | null;
  /** Relevés récents rejetés par le contrôle de sanité. */
  refuses: ReleveAffiche[];
  /**
   * Âge du relevé, calculé côté serveur. On ne lit PAS l'horloge pendant le
   * rendu : ce serait impur et ferait diverger le HTML serveur du client.
   */
  ageJours: number | null;
  modifiable: boolean;
}) {
  const [saisie, setSaisie] = useState("");
  const [enCours, demarrer] = useTransition();
  const [retour, setRetour] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);

  const perime = ageJours !== null && ageJours > 7;

  const lancer = (fn: () => Promise<{ ok: boolean; message?: string }>, succes: string) => {
    setRetour(null);
    demarrer(async () => {
      const r = await fn();
      setRetour(
        r.ok
          ? { ton: "ok", texte: r.message ?? succes }
          : { ton: "erreur", texte: r.message ?? "Une erreur est survenue." },
      );
      if (r.ok) setSaisie("");
    });
  };

  return (
    <section className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-[19px] font-semibold">
            <Fuel size={21} strokeWidth={1.9} className="text-seve" aria-hidden="true" />
            Prix du gazole
          </h2>
          <p className="text-cendre-clair mt-1.5 text-[15px]">
            Relevé chaque matin sur l&apos;open data officiel, filtré sur votre département.
          </p>
        </div>

        {modifiable && (
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={enCours}
            onClick={() => lancer(relancerReleve, "Relevé effectué.")}
          >
            {enCours ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw strokeWidth={1.75} />
            )}
            Relever maintenant
          </Button>
        )}
      </div>

      {enVigueur ? (
        <p className="mt-4">
          <span className="font-display tabulaire text-[34px] leading-none font-bold">
            {euros(enVigueur.prixCents)} €
          </span>
          <span className="text-cendre-clair ml-2 text-[15px]">le litre</span>
          <span className="text-cendre-clair mt-1.5 block text-[15px]">
            {enVigueur.source === "manual"
              ? "Saisi à la main"
              : enVigueur.source === "seed"
                ? "Valeur initiale de démonstration"
                : `Médiane de ${enVigueur.stations ?? "?"} stations du département ${enVigueur.departement ?? ""}`}{" "}
            · {formatDate.format(new Date(enVigueur.date))}
            {ageJours !== null && ageJours > 0 && ` (il y a ${ageJours} jour${ageJours > 1 ? "s" : ""})`}
          </span>
        </p>
      ) : (
        <p className="text-alerte mt-4 text-[17px]">
          Aucun relevé enregistré : le prix de repli des réglages est utilisé.
        </p>
      )}

      {perime && (
        <p className="bg-alerte/15 text-alerte mt-3 flex items-start gap-2 rounded-[6px] p-3 text-[15px]">
          <AlertTriangle size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
          Ce relevé a plus de sept jours : le calcul utilise votre prix de repli. Vérifiez que le
          relevé automatique fonctionne.
        </p>
      )}

      {/* Relevés refusés : sans cet affichage, une hausse réelle resterait
          bloquée indéfiniment par le garde-fou, sans que personne le sache. */}
      {refuses.length > 0 && (
        <div className="border-alerte/30 bg-alerte/8 mt-4 rounded-[6px] border p-4">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={19} strokeWidth={1.9} className="text-alerte" aria-hidden="true" />
            {refuses.length} relevé{refuses.length > 1 ? "s" : ""} refusé
            {refuses.length > 1 ? "s" : ""} par le contrôle de sécurité
          </p>

          <ul className="mt-3 space-y-3">
            {refuses.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[15px]">
                  <strong className="tabulaire">{euros(r.prixCents)} €/L</strong> —{" "}
                  {MOTIFS[r.motifRefus ?? ""] ?? r.motifRefus} ·{" "}
                  {formatDate.format(new Date(r.date))}
                  {r.stations && ` · ${r.stations} stations`}
                </span>
                {modifiable && (
                  <Button
                    type="button"
                    variant="default"
                    size="default"
                    disabled={enCours}
                    onClick={() =>
                      lancer(
                        () => accepterReleve({ releveId: r.id }),
                        `Prix passé à ${euros(r.prixCents)} €/L.`,
                      )
                    }
                  >
                    <Check strokeWidth={2} />
                    Appliquer ce prix
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <p className="text-cendre-clair mt-3 text-[13px] leading-relaxed">
            Le relevé est refusé automatiquement au-delà de 15 % d&apos;écart : c&apos;est le plus
            souvent le signe d&apos;une source défaillante. Mais si la hausse est réelle, appliquez-la
            — sinon vos frais de livraison resteront calculés sur un prix dépassé.
          </p>
        </div>
      )}

      {modifiable && (
        <div className="border-ecorce-bord mt-5 border-t pt-4">
          <Label htmlFor="prix-manuel" className="text-cendre-clair">
            Ou fixez le prix à la main
          </Label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Input
                id="prix-manuel"
                inputMode="decimal"
                placeholder="2,20"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value.replace(/[^\d.,]/g, ""))}
                className="tabulaire w-24 text-center"
              />
              <span className="text-cendre-clair text-[15px]">€/L</span>
            </div>
            <Button
              type="button"
              variant="cta"
              size="default"
              disabled={enCours || saisie === ""}
              onClick={() =>
                lancer(
                  () => fixerPrixCarburant({ prixEuros: saisie }),
                  `Prix fixé à ${saisie} €/L.`,
                )
              }
            >
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {retour && (
        <p
          role="status"
          className={`mt-4 text-[15px] ${retour.ton === "ok" ? "text-succes" : "text-erreur"}`}
        >
          {retour.texte}
        </p>
      )}
    </section>
  );
}
