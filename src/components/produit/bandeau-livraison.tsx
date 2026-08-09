"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { estimerLivraison, type ResultatEstimation } from "@/server/actions/estimation";
import { formatEuros, formatVolume } from "@/domain/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Bandeau d'estimation de livraison, sous le configurateur d'accueil.
 *
 * « Est-ce que vous livrez chez moi ? » est LA première question du visiteur.
 * Elle est donc traitée avant qu'il ait mis quoi que ce soit au panier
 * (docs/03 §6.1).
 */
export function BandeauLivraison({ region }: { region: string }) {
  const router = useRouter();
  const [codePostal, setCodePostal] = useState("");
  const [resultat, setResultat] = useState<ResultatEstimation | null>(null);
  const [enCours, demarrer] = useTransition();

  const estimer = (ville?: string) => {
    demarrer(async () => {
      const r = await estimerLivraison({ postalCode: codePostal, city: ville ?? null });
      setResultat(r);
      // Le panneau « Votre sélection » lit le contexte de livraison côté serveur :
      // on le rafraîchit pour qu'il affiche un total livraison comprise.
      if (r.statut === "livree") router.refresh();
    });
  };

  return (
    <section className="border-aubier-bord bg-aubier-pur mt-6 rounded-[10px] border p-6 sm:p-7">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          estimer();
        }}
        className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5"
      >
        <div className="flex items-start gap-4">
          <Truck size={26} strokeWidth={1.6} className="text-sapin mt-1 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-[19px] font-semibold">Estimez votre livraison</p>
            <p className="text-cendre mt-1 text-[15px]">{region}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="cp-accueil" className="text-cendre text-[13px] font-medium">
              Code postal
            </Label>
            <Input
              id="cp-accueil"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              placeholder="07100"
              value={codePostal}
              onChange={(e) => {
                setCodePostal(e.target.value.replace(/\D/g, ""));
                setResultat(null);
              }}
              className="tabulaire mt-1.5 w-32"
            />
          </div>
          <Button type="submit" variant="default" size="lg" disabled={enCours || codePostal.length < 5}>
            {enCours ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Calcul…
              </>
            ) : (
              "Estimer la livraison"
            )}
          </Button>
        </div>
      </form>

      {resultat && <Reponse resultat={resultat} onChoisirVille={estimer} />}
    </section>
  );
}

function Reponse({
  resultat,
  onChoisirVille,
}: {
  resultat: ResultatEstimation;
  onChoisirVille: (ville: string) => void;
}) {
  if (resultat.statut === "ambigu") {
    return (
      <div className="border-aubier-bord mt-5 border-t pt-5">
        <p className="text-[15px] font-semibold">
          Plusieurs communes portent ce code postal. Laquelle est la vôtre ?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {resultat.choix.map((c) => (
            <Button
              key={c.city}
              type="button"
              variant="outline"
              size="default"
              onClick={() => onChoisirVille(c.city)}
            >
              {c.city}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (resultat.statut === "livree") {
    return (
      <div className="border-succes/30 bg-succes/8 mt-5 rounded-[6px] border p-4">
        <p className="flex flex-wrap items-center gap-2 text-[17px] font-semibold">
          <CheckCircle2 size={20} strokeWidth={1.9} className="text-succes" aria-hidden="true" />
          Oui, nous livrons {resultat.ville}
          {resultat.distanceKm !== null && (
            <span className="text-cendre font-normal">· {resultat.distanceKm} km</span>
          )}
        </p>
        <p className="text-cendre mt-2 text-[15px] leading-relaxed">
          {resultat.offerte ? (
            <>Livraison offerte dans votre commune.</>
          ) : (
            <>
              Livraison <strong className="text-encre">à partir de {formatEuros(resultat.fraisCents)}</strong>{" "}
              pour {formatVolume(resultat.volumeReference)} — le montant exact dépend de la quantité.
            </>
          )}
          {resultat.jours && <> Nous passons {resultat.jours}.</>} Comptez {resultat.delaiJours} jours
          de préparation.
          {resultat.minimumVolumeM3 > 1 && (
            <> Commande minimum : {formatVolume(resultat.minimumVolumeM3)}.</>
          )}
        </p>
      </div>
    );
  }

  const titre =
    resultat.statut === "hors_zone"
      ? `Nous ne livrons pas encore ${resultat.ville}`
      : resultat.statut === "inconnu"
        ? `Nous ne connaissons pas le code postal ${resultat.codePostal}`
        : resultat.statut === "sur_devis"
          ? "Votre commune demande un devis"
          : "Une erreur est survenue";

  const texte =
    resultat.statut === "erreur"
      ? resultat.message
      : "Nous étudions toutes les demandes, en particulier pour les volumes importants. Dites-nous ce qu'il vous faut.";

  return (
    <div className="border-alerte/30 bg-alerte/8 mt-5 rounded-[6px] border p-4">
      <p className="flex items-center gap-2 text-[17px] font-semibold">
        <AlertTriangle size={20} strokeWidth={1.9} className="text-alerte" aria-hidden="true" />
        {titre}
      </p>
      <p className="text-cendre mt-2 text-[15px] leading-relaxed">{texte}</p>
      {resultat.statut !== "erreur" && (
        <Button asChild variant="outline" size="lg" className="mt-3">
          <Link href="/devis">Demander un devis</Link>
        </Button>
      )}
    </div>
  );
}
