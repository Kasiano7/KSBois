"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Loader2 } from "lucide-react";
import { ajouterAuPanier } from "@/server/actions/panier";
import { RegleDeCoupe, type CutLengthOption } from "./regle-de-coupe";
import { JaugeHumidite } from "./jauge-humidite";
import { computeLine, computeOrderTotals } from "@/domain/pricing";
import {
  formatEuros,
  formatVolume,
  formatStereHint,
  describeDelivered,
  validateQuantity,
} from "@/domain/units";
import type { CatalogueProduct, CatalogueVariant } from "@/server/catalogue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Configurateur de la fiche produit.
 *
 * ⚠️ Le prix affiché ici est un CONFORT D'ACHAT, pas une source de vérité.
 * L'ajout au panier déclenchera un recalcul serveur complet (PLAN.md §5.1).
 * Le moteur `@/domain/pricing` est volontairement partagé par les deux côtés :
 * c'est ce qui garantit qu'ils ne divergeront pas.
 */

interface ConfigurateurProps {
  product: CatalogueProduct;
  subtitle?: string;
}

export function Configurateur({ product, subtitle }: ConfigurateurProps) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreurServeur, setErreurServeur] = useState<string | null>(null);
  const variants = product.variants;
  const [variantId, setVariantId] = useState(
    () => variants.find((v) => v.cutLengthCm === 33)?.id ?? variants[0]?.id ?? "",
  );

  const variant: CatalogueVariant | undefined =
    variants.find((v) => v.id === variantId) ?? variants[0];

  const [quantite, setQuantite] = useState(() => Math.max(1, variant?.minQuantity ?? 1));

  const options: CutLengthOption[] = variants
    .filter((v) => v.cutLengthCm !== null)
    .map((v) => ({
      id: v.id,
      cm: v.cutLengthCm!,
      label: v.cutLengthLabel ?? `${v.cutLengthCm} cm`,
      hint: v.cutLengthHint ?? undefined,
      isAvailable: v.trackStock ? v.stockAvailable > 0 || v.allowBackorder : true,
    }));

  const totaux = useMemo(() => {
    if (!variant) return null;
    const ligne = computeLine(variant.pricing, quantite);
    return { ligne, ...computeOrderTotals({ lines: [ligne] }) };
  }, [variant, quantite]);

  if (!variant || !totaux) {
    return (
      <div className="border-aubier-bord bg-aubier-pur rounded-[8px] border p-7">
        <p className="text-cendre">Aucun format disponible pour le moment.</p>
      </div>
    );
  }

  const erreurQuantite = validateQuantity(quantite, {
    min: variant.minQuantity,
    max: variant.maxQuantity,
    step: variant.quantityStep,
  });

  const prixUnitaire = totaux.ligne.unitPriceCents;
  const remisePalier = prixUnitaire < variant.pricing.basePriceCents;
  const stockBas =
    variant.trackStock &&
    variant.stockAvailable > 0 &&
    variant.stockAvailable <= variant.lowStockThreshold;
  const enRupture = variant.trackStock && variant.stockAvailable <= 0;
  const depasseStock =
    variant.trackStock && !variant.allowBackorder && quantite > variant.stockAvailable;

  const ajuster = (delta: number) => {
    setQuantite((q) => {
      const suivant = Math.round((q + delta) * 1000) / 1000;
      return Math.min(variant.maxQuantity ?? 99, Math.max(variant.minQuantity, suivant));
    });
  };

  return (
    <div className="border-aubier-bord bg-aubier-pur rounded-[8px] border p-5 sm:p-7">
      {subtitle && <p className="micro-label text-braise-texte">{subtitle}</p>}
      <h2 className="mt-1.5 text-[26px] sm:text-[32px]">{product.name}</h2>

      {variant.measuredHumidityPct !== null && (
        <JaugeHumidite
          pct={variant.measuredHumidityPct}
          dateMesure={variant.measuredAt}
          lot={variant.batchLabel}
          className="mt-5"
        />
      )}

      {options.length > 0 && (
        <RegleDeCoupe
          options={options}
          value={variant.id}
          onChange={(id) => {
            setVariantId(id);
            const suivant = variants.find((v) => v.id === id);
            if (suivant) setQuantite((q) => Math.max(suivant.minQuantity, q));
          }}
          className="mt-7"
        />
      )}

      {/* Quantité */}
      <div className="mt-7">
        <label htmlFor="quantite" className="micro-label text-cendre block">
          Quantité
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="border-aubier-bord flex items-center overflow-hidden rounded-[4px] border">
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => ajuster(-variant.quantityStep)}
              disabled={quantite <= variant.minQuantity}
              aria-label="Diminuer la quantité"
              className="rounded-none"
            >
              <Minus strokeWidth={1.75} />
            </Button>
            <Input
              id="quantite"
              type="text"
              inputMode="decimal"
              value={quantite.toLocaleString("fr-FR")}
              onChange={(e) => {
                const parsed = Number.parseFloat(e.target.value.replace(",", "."));
                if (Number.isFinite(parsed)) setQuantite(parsed);
              }}
              aria-invalid={erreurQuantite !== null}
              aria-describedby={erreurQuantite ? "quantite-erreur" : undefined}
              className="tabulaire border-aubier-bord h-12 w-16 rounded-none border-x border-y-0 px-0 text-center text-lg font-semibold focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => ajuster(variant.quantityStep)}
              disabled={variant.maxQuantity !== null && quantite >= variant.maxQuantity}
              aria-label="Augmenter la quantité"
              className="rounded-none"
            >
              <Plus strokeWidth={1.75} />
            </Button>
          </div>
          <div className="text-[15px] whitespace-nowrap">
            <p className="text-encre font-semibold">{formatVolume(totaux.totalVolumeM3)}</p>
            <p className="text-cendre">{formatStereHint(totaux.totalVolumeM3)}</p>
          </div>
        </div>

        {erreurQuantite && (
          <p id="quantite-erreur" role="alert" className="text-erreur mt-2 text-[15px]">
            {erreurQuantite}
          </p>
        )}

        {/* Phrase calculée, jamais saisie : elle protège d'un litige sur les quantités. */}
        <p className="text-cendre mt-3 text-[15px]">
          {describeDelivered(totaux.totalVolumeM3, variant.cutLengthCm)}.
        </p>

        {enRupture && !variant.allowBackorder && (
          <p className="text-erreur mt-2 text-[15px] font-semibold">Rupture de stock</p>
        )}
        {stockBas && (
          <p className="text-alerte mt-2 text-[15px]">
            Plus que {formatVolume(variant.stockAvailable)} disponibles
          </p>
        )}
        {depasseStock && !enRupture && (
          <p className="text-alerte mt-2 text-[15px]">
            Nous n&apos;avons que {formatVolume(variant.stockAvailable)} en stock pour ce format.
          </p>
        )}
      </div>

      {/* Prix */}
      <div className="border-aubier-bord mt-7 border-t pt-5">
        <div className="text-cendre flex items-baseline justify-between gap-3 text-[15px]">
          <span>
            {quantite.toLocaleString("fr-FR")} × {formatEuros(prixUnitaire)}
            {remisePalier && (
              <span className="bg-seve/20 text-encre ml-2 rounded-[3px] px-1.5 py-0.5 text-[12px] font-semibold whitespace-nowrap">
                tarif dégressif
              </span>
            )}
          </span>
          <span className="tabulaire whitespace-nowrap">{formatEuros(totaux.subtotalCents)}</span>
        </div>
        <div className="text-cendre mt-1.5 flex items-baseline justify-between gap-3 text-[15px]">
          <span>Livraison</span>
          <span>calculée à l&apos;étape suivante</span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <span className="text-cendre text-[15px]">Total</span>
          <span className="text-braise-texte font-display tabulaire text-[36px] leading-none font-bold">
            {formatEuros(totaux.totalCents)}
          </span>
        </div>

        <Button
          type="button"
          variant="cta"
          size="cta"
          disabled={
            enCours || erreurQuantite !== null || (enRupture && !variant.allowBackorder)
          }
          className="mt-5 w-full"
          onClick={() => {
            setErreurServeur(null);
            demarrer(async () => {
              // Le serveur revérifie les bornes et le stock : ce clic est une
              // intention, pas une autorité (PLAN.md §5.1).
              const resultat = await ajouterAuPanier({
                variantId: variant.id,
                quantity: quantite,
              });
              if (resultat.ok) {
                // On enchaîne sur le panier : l'étape suivante est le code postal.
                router.push("/panier");
              } else {
                setErreurServeur(resultat.message ?? "Ajout impossible.");
              }
            });
          }}
        >
          {enCours ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Ajout au panier…
            </>
          ) : (
            <>
              <ShoppingCart strokeWidth={1.75} />
              Ajouter au panier
            </>
          )}
        </Button>

        {erreurServeur && (
          <p role="alert" className="text-erreur mt-3 text-[15px]">
            {erreurServeur}
          </p>
        )}

        <p className="text-cendre mt-3 text-center text-[13px]">
          Prix TTC · TVA {variant.pricing.vatRate.toLocaleString("fr-FR")} % · Paiement à la
          livraison possible
        </p>
      </div>
    </div>
  );
}
