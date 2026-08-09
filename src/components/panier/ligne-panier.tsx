"use client";

import { useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { modifierQuantite, retirerDuPanier } from "@/server/actions/panier";
import { formatEuros, formatVolume, formatStereHint } from "@/domain/units";
import type { LignePanier as TLignePanier } from "@/server/panier";
import { Button } from "@/components/ui/button";

interface LignePanierProps {
  ligne: TLignePanier;
  /** Pas de quantité de la variante, relu côté serveur à chaque mutation. */
  pas?: number;
}

export function LignePanier({ ligne, pas = 0.5 }: LignePanierProps) {
  const [enCours, demarrer] = useTransition();

  const ajuster = (delta: number) => {
    const suivant = Math.round((ligne.quantity + delta) * 1000) / 1000;
    if (suivant <= 0) return;
    demarrer(async () => {
      await modifierQuantite({ itemId: ligne.itemId, quantity: suivant });
    });
  };

  const retirer = () => {
    demarrer(async () => {
      await retirerDuPanier({ itemId: ligne.itemId });
    });
  };

  const remisePalier = ligne.unitPriceCents < ligne.basePriceCents;

  return (
    <li
      className="border-aubier-bord flex flex-wrap items-start gap-4 border-b py-5 last:border-b-0"
      data-en-cours={enCours || undefined}
    >
      <div className="min-w-[12rem] flex-1">
        <p className="font-semibold">{ligne.productName}</p>
        <p className="text-cendre text-[15px]">
          {[
            ligne.variantLabel,
            ligne.humidityClass === "H1"
              ? "bois sec"
              : ligne.humidityClass === "H2"
                ? "mi-sec"
                : ligne.humidityClass === "H3"
                  ? "fraîchement coupé"
                  : null,
            ligne.packaging !== "vrac" ? ligne.packaging : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-cendre mt-1 text-[15px]">
          {formatVolume(ligne.lineVolumeM3)}
          {ligne.stackingCoefficient !== null && (
            <> · {formatStereHint(ligne.lineVolumeM3, ligne.stackingCoefficient)}</>
          )}
        </p>

        {ligne.trackStock && !ligne.allowBackorder && ligne.quantity > ligne.stockAvailable && (
          <p role="alert" className="text-alerte mt-1.5 text-[15px]">
            Stock disponible : {formatVolume(ligne.stockAvailable)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="border-aubier-bord flex items-center overflow-hidden rounded-[4px] border">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="rounded-none"
            aria-label={`Diminuer la quantité de ${ligne.productName}`}
            disabled={enCours}
            onClick={() => ajuster(-pas)}
          >
            <Minus strokeWidth={1.75} />
          </Button>
          <span className="tabulaire border-aubier-bord flex h-12 w-14 items-center justify-center border-x text-lg font-semibold">
            {ligne.quantity.toLocaleString("fr-FR")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="rounded-none"
            aria-label={`Augmenter la quantité de ${ligne.productName}`}
            disabled={enCours}
            onClick={() => ajuster(pas)}
          >
            <Plus strokeWidth={1.75} />
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={`Retirer ${ligne.productName} du panier`}
          disabled={enCours}
          onClick={retirer}
          className="text-cendre hover:text-erreur"
        >
          <Trash2 strokeWidth={1.75} />
        </Button>
      </div>

      <div className="min-w-[7rem] text-right">
        <p className="tabulaire text-[17px] font-semibold">
          {formatEuros(ligne.lineTotalCents)}
        </p>
        <p className="text-cendre text-[15px]">
          {formatEuros(ligne.unitPriceCents)} / m³app
        </p>
        {remisePalier && (
          <span className="bg-seve/20 text-encre mt-1 inline-block rounded-[3px] px-1.5 py-0.5 text-[12px] font-semibold">
            tarif dégressif
          </span>
        )}
      </div>
    </li>
  );
}
