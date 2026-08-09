"use client";

import { ShoppingBag, ShoppingCart, Loader2, Lock, Info } from "lucide-react";
import { formatEuros, formatVolume, formatEquivalenceSteres } from "@/domain/units";
import type { OrderLine } from "@/domain/pricing";
import type { CatalogueVariant } from "@/server/catalogue";
import type { DeliveryQuote } from "@/domain/delivery";
import { PileIllustration } from "./pile-illustration";
import { Button } from "@/components/ui/button";

/**
 * Panneau « Votre sélection » — troisième colonne du configurateur d'accueil.
 *
 * Objectif : rendre le TOTAL immédiatement lisible. Le client doit voir en un
 * coup d'œil ce qu'il va payer, sans additionner mentalement. Le total est donc
 * la seule donnée en grand, tout le reste est une ligne de détail discrète.
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
  const fraisCents =
    livraison?.devis.status === "ok" ? livraison.devis.totalCents : null;
  const totalCents = ligne.lineTotalCents + (fraisCents ?? 0);

  const equivalence = formatEquivalenceSteres(
    ligne.lineVolumeM3,
    variante.cutLengthCm,
    variante.stackingCoefficient,
  );

  return (
    <aside className="border-aubier-bord bg-aubier overflow-hidden rounded-[10px] border">
      {/* En-tête sombre : le panneau se détache des deux volets de choix */}
      <p className="bg-sapin flex items-center gap-2.5 px-5 py-4 text-[17px] font-semibold text-white">
        <ShoppingBag size={20} strokeWidth={1.75} aria-hidden="true" />
        Votre sélection
      </p>

      <PileIllustration graine={variante.cutLengthCm ?? 33} className="h-32 w-full" />

      <div className="bg-aubier-pur p-5">
        <p className="text-[21px] font-semibold">{essence}</p>
        <p className="text-cendre text-[17px]">Bûches de {variante.cutLengthLabel}</p>

        {/* ─── Quantité ─── */}
        <div className="mt-5">
          <p className="micro-label text-cendre">Quantité</p>
          <p className="mt-2 text-[17px]">
            <span className="tabulaire text-[21px] font-semibold">
              {ligne.quantity.toLocaleString("fr-FR")}
            </span>{" "}
            <span className="text-cendre">{formatVolume(ligne.lineVolumeM3)}</span>
          </p>
          {equivalence && (
            <p className="text-cendre mt-1.5 text-[13px] leading-snug">{equivalence}</p>
          )}
        </div>

        {/* ─── Détail chiffré, volontairement discret ─── */}
        <dl className="border-aubier-bord mt-5 space-y-2 border-t pt-4 text-[15px]">
          <div className="text-cendre flex justify-between gap-3">
            <dt>Prix unitaire</dt>
            <dd className="tabulaire">{formatEuros(ligne.unitPriceCents)}</dd>
          </div>
          <div className="text-cendre flex justify-between gap-3">
            <dt>Sous-total</dt>
            <dd className="tabulaire">{formatEuros(ligne.lineTotalCents)}</dd>
          </div>
          <div className="text-cendre flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5">
              Livraison estimée
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
        <div className="border-encre/15 mt-4 flex items-end justify-between gap-3 border-t pt-4">
          <span className="text-[17px] font-semibold">Total TTC</span>
          <span className="font-display tabulaire text-encre text-[38px] leading-none font-bold">
            {formatEuros(totalCents)}
          </span>
        </div>
        {fraisCents === null && (
          <p className="text-cendre mt-1.5 text-right text-[13px]">hors livraison</p>
        )}

        <Button
          type="button"
          variant="cta"
          size="cta"
          className="mt-5 w-full"
          disabled={enCours || desactive}
          onClick={onAjouter}
        >
          {enCours ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Ajout…
            </>
          ) : (
            <>
              <ShoppingCart strokeWidth={1.75} />
              Ajouter au panier
            </>
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
      </div>
    </aside>
  );
}
