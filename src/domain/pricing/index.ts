/**
 * Moteur de prix — docs/02-MOTEURS-METIER.md §1
 *
 * Règles non négociables :
 *  - tous les montants sont des ENTIERS de centimes, jamais des flottants ;
 *  - les prix affichés sont TTC, la TVA est reconstituée à partir du TTC ;
 *  - un seul arrondi par ligne, en fin de calcul.
 */

import { roundVolume, type M3Apparent } from "../units";

export type Cents = number;

export interface PriceTier {
  minQuantity: number;
  unitPriceCents: Cents;
}

export interface PricedVariant {
  variantId: string;
  basePriceCents: Cents;
  vatRate: number;
  /** Volume apparent d'une unité vendue (1 pour du vrac au m³app, 1.8 pour une palette…). */
  unitVolumeM3: number;
  tiers: PriceTier[];
}

export interface OrderLine {
  variantId: string;
  quantity: number;
  unitPriceCents: Cents;
  lineTotalCents: Cents;
  lineVolumeM3: M3Apparent;
  vatRate: number;
}

/**
 * Résout le prix unitaire applicable : le palier ayant le plus grand
 * `minQuantity` inférieur ou égal à la quantité commandée. Sans palier
 * correspondant, on retombe sur le prix de base.
 */
export function resolveUnitPrice(quantity: number, variant: PricedVariant): Cents {
  let price = variant.basePriceCents;
  let bestMin = -1;

  for (const tier of variant.tiers) {
    if (quantity >= tier.minQuantity && tier.minQuantity > bestMin) {
      bestMin = tier.minQuantity;
      price = tier.unitPriceCents;
    }
  }
  return price;
}

/** Calcule une ligne de commande. Arrondi unique, en fin de calcul. */
export function computeLine(variant: PricedVariant, quantity: number): OrderLine {
  const unitPriceCents = resolveUnitPrice(quantity, variant);
  return {
    variantId: variant.variantId,
    quantity,
    unitPriceCents,
    lineTotalCents: Math.round(unitPriceCents * quantity),
    lineVolumeM3: roundVolume(quantity * variant.unitVolumeM3),
    vatRate: variant.vatRate,
  };
}

export type DiscountKind = "percent" | "fixed" | "free_delivery";

export interface AppliedDiscount {
  kind: DiscountKind;
  /** Pourcentage (0-100) pour `percent`, centimes pour `fixed`, ignoré pour `free_delivery`. */
  value: number;
  label: string;
}

export interface OrderTotalsInput {
  lines: OrderLine[];
  /** Options payantes déjà calculées en centimes TTC, avec leur propre taux de TVA. */
  options?: PricedOption[];
  /** Compatibilité avec les anciens appels sans détail de TVA. Préférer `options`. */
  optionsCents?: Cents;
  discount?: AppliedDiscount | null;
  deliveryCents?: Cents;
  /** En franchise en base de TVA, aucune ventilation n'est produite. */
  vatMode?: "assujetti" | "franchise_en_base";
}

export interface PricedOption {
  code: string;
  name: string;
  totalCents: Cents;
  vatRate: number;
}

export interface VatBucket {
  rate: number;
  baseTtcCents: Cents;
  baseHtCents: Cents;
  vatCents: Cents;
}

export interface OrderTotals {
  subtotalCents: Cents;
  optionsCents: Cents;
  discountCents: Cents;
  deliveryCents: Cents;
  /**
   * Montant des frais de port offerts. Sert uniquement à l'affichage
   * (« Livraison offerte — 14,50 € ») : il n'entre PAS dans le total, sans quoi
   * il serait déduit deux fois.
   */
  deliveryOfferedCents: Cents;
  totalCents: Cents;
  totalVolumeM3: M3Apparent;
  vatBreakdown: VatBucket[];
}

/**
 * Totaux de commande.
 *
 * Ordre imposé : la remise s'applique AVANT les frais de livraison, sauf pour
 * une promotion `free_delivery` qui annule les frais après calcul — de sorte
 * que le montant offert reste traçable.
 */
export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const { lines, options = [], discount = null, deliveryCents = 0 } = input;
  const optionsCents =
    options.length > 0
      ? options.reduce((somme, option) => somme + option.totalCents, 0)
      : (input.optionsCents ?? 0);
  const vatMode = input.vatMode ?? "assujetti";

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const totalVolumeM3 = roundVolume(lines.reduce((sum, line) => sum + line.lineVolumeM3, 0));

  let discountCents = 0;
  let effectiveDeliveryCents = deliveryCents;
  let deliveryOfferedCents = 0;

  if (discount) {
    if (discount.kind === "percent") {
      discountCents = Math.round(((subtotalCents + optionsCents) * discount.value) / 100);
    } else if (discount.kind === "fixed") {
      discountCents = Math.min(discount.value, subtotalCents + optionsCents);
    } else {
      // Port offert : on annule la ligne de livraison. Le montant offert est
      // conservé pour l'affichage mais n'est PAS une remise sur les produits.
      deliveryOfferedCents = deliveryCents;
      effectiveDeliveryCents = 0;
    }
  }

  const totalCents = subtotalCents + optionsCents - discountCents + effectiveDeliveryCents;

  return {
    subtotalCents,
    optionsCents,
    discountCents,
    deliveryCents: effectiveDeliveryCents,
    deliveryOfferedCents,
    totalCents,
    totalVolumeM3,
    vatBreakdown:
      vatMode === "franchise_en_base"
        ? []
        : computeVatBreakdown(lines, effectiveDeliveryCents, discountCents, options),
  };
}

/**
 * Ventilation de la TVA par taux, reconstituée depuis le TTC.
 *
 * Les frais de livraison sont une prestation accessoire : ils suivent le taux
 * des produits livrés et sont donc ventilés au prorata du TTC de chaque taux.
 * La remise est ventilée de la même façon.
 */
export function computeVatBreakdown(
  lines: OrderLine[],
  deliveryCents: Cents,
  discountCents: Cents = 0,
  options: PricedOption[] = [],
): VatBucket[] {
  const byRate = new Map<number, Cents>();

  for (const line of lines) {
    byRate.set(line.vatRate, (byRate.get(line.vatRate) ?? 0) + line.lineTotalCents);
  }
  for (const option of options) {
    byRate.set(option.vatRate, (byRate.get(option.vatRate) ?? 0) + option.totalCents);
  }

  const linesTotal = [...byRate.values()].reduce((a, b) => a + b, 0);
  if (linesTotal === 0) return [];

  const rates = [...byRate.keys()].sort((a, b) => a - b);
  const buckets: VatBucket[] = [];
  let allocatedExtra = 0;
  const netExtra = deliveryCents - discountCents;

  rates.forEach((rate, index) => {
    const linesAtRate = byRate.get(rate)!;
    // Le dernier taux absorbe le reliquat d'arrondi : la somme des ventilations
    // est ainsi toujours exactement égale au total de la commande.
    const extra =
      index === rates.length - 1
        ? netExtra - allocatedExtra
        : Math.round((netExtra * linesAtRate) / linesTotal);
    allocatedExtra += extra;

    const baseTtcCents = linesAtRate + extra;
    const baseHtCents = Math.round(baseTtcCents / (1 + rate / 100));

    buckets.push({
      rate,
      baseTtcCents,
      baseHtCents,
      vatCents: baseTtcCents - baseHtCents,
    });
  });

  return buckets;
}
