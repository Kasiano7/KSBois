"use client";

import { Loader2, Lock, Info } from "lucide-react";
import { formatEuros, formatVolume, formatEquivalenceSteres } from "@/domain/units";
import type { OrderLine } from "@/domain/pricing";
import type { CatalogueVariant } from "@/server/catalogue";
import type { DeliveryQuote } from "@/domain/delivery";
import { Button } from "@/components/ui/button";

/**
 * Panneau « Votre sélection » — troisième volet du configurateur d'accueil.
 *
 * Objectif : rendre le TOTAL immédiatement lisible. Le client doit voir en un
 * coup d'œil ce qu'il va payer, sans additionner mentalement. Le total est donc
 * la seule donnée en grand, tout le reste est une ligne de détail discrète.
 *
 * ⚠️ Écart de charte assumé (docs/03 §2.1) : le bouton de validation est en
 * `--seve` et non en `--braise`, sur demande du client au vu de la maquette du
 * 9 août 2026. Le texte est en `--encre` et non en blanc — blanc sur sève ne
 * donne que 2:1 de contraste, très en dessous du seuil AA.
 */

interface PanneauSelectionProps {
  essence: string;
  variante: CatalogueVariant;
  ligne: OrderLine;
  /** Devis de livraison si le visiteur a déjà renseigné son code postal. */
  livraison: { devis: DeliveryQuote; ville: string } | null;
  enCours: boolean;
  desactive: boolean;
  messageBlocage: string | null;
  onAjouter: () => void;
}

export function PanneauSelection({
  essence,
  variante,
  ligne,
  livraison,
  enCours,
  desactive,
  messageBlocage,
  onAjouter,
}: PanneauSelectionProps) {
  const fraisCents = livraison?.devis.status === "ok" ? livraison.devis.totalCents : null;
  const totalCents = ligne.lineTotalCents + (fraisCents ?? 0);

  const equivalence = formatEquivalenceSteres(
    ligne.lineVolumeM3,
    variante.cutLengthCm,
    variante.stackingCoefficient,
  );

  return (
    <aside className="bg-aubier flex flex-col p-5 sm:p-7">
      {/* Même hauteur et même graisse que les titres « 1. » et « 2. » : les
          trois colonnes doivent démarrer sur la même ligne. */}
      <p className="flex h-8 items-center text-[19px] font-semibold">Votre sélection</p>

      {/* ─── Ce qui a été choisi, ligne à ligne ─── */}
      <dl className="border-aubier-bord mt-5 space-y-3 border-t pt-5 text-[15px]">
        <div className="flex justify-between gap-4">
          <dt className="text-cendre">Essence</dt>
          <dd className="text-right font-semibold">{essence}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-cendre">Longueur</dt>
          <dd className="tabulaire font-semibold">{variante.cutLengthLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-cendre">Quantité</dt>
          <dd className="tabulaire font-semibold">{formatVolume(ligne.lineVolumeM3)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-cendre">Prix unitaire</dt>
          <dd className="tabulaire">{formatEuros(ligne.unitPriceCents)}</dd>
        </div>
      </dl>

      {equivalence && <p className="text-cendre mt-3 text-[13px] leading-snug">{equivalence}</p>}

      {/* ─── Sous-total et livraison ─── */}
      <dl className="border-aubier-bord mt-5 space-y-2.5 border-t pt-5 text-[15px]">
        <div className="flex justify-between gap-4">
          <dt className="text-cendre">Sous-total</dt>
          <dd className="tabulaire font-semibold">{formatEuros(ligne.lineTotalCents)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-cendre flex items-center gap-1.5">
            Livraison
            <span
              title={
                livraison
                  ? `Estimation pour ${livraison.ville}. Le montant définitif est recalculé au panier.`
                  : "Renseignez votre code postal ci-dessous pour connaître les frais."
              }
              className="text-cendre-clair cursor-help"
            >
              <Info size={15} strokeWidth={1.9} aria-hidden="true" />
            </span>
          </dt>
          <dd className="tabulaire">
            {fraisCents === null ? (
              <span className="text-cendre-clair">à estimer</span>
            ) : fraisCents === 0 ? (
              <span className="text-succes font-semibold">Offerte</span>
            ) : (
              formatEuros(fraisCents)
            )}
          </dd>
        </div>
      </dl>

      {/* ─── LE TOTAL : la seule donnée en grand ─── */}
      <div className="border-encre/15 mt-5 flex items-end justify-between gap-3 border-t pt-5">
        <span className="text-[17px] font-semibold">Total TTC</span>
        <span className="font-display tabulaire text-encre text-[34px] leading-none font-bold">
          {formatEuros(totalCents)}
        </span>
      </div>
      {fraisCents === null && (
        <p className="text-cendre mt-1.5 text-right text-[13px]">hors livraison</p>
      )}

      <Button
        type="button"
        variant="or"
        size="cta"
        className="mt-6 w-full"
        disabled={enCours || desactive}
        onClick={onAjouter}
      >
        {enCours ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Ajout…
          </>
        ) : (
          "Valider ma sélection"
        )}
      </Button>

      {messageBlocage && (
        <p role="alert" className="text-erreur mt-3 text-center text-[15px]">
          {messageBlocage}
        </p>
      )}

      <p className="text-cendre mt-3 flex items-center justify-center gap-1.5 text-[13px]">
        <Lock size={14} strokeWidth={2} aria-hidden="true" />
        Paiement sécurisé · aucune inscription requise
      </p>
    </aside>
  );
}
