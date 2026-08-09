import { describe, it, expect } from "vitest";
import {
  resolveUnitPrice,
  computeLine,
  computeOrderTotals,
  computeVatBreakdown,
  type PricedVariant,
} from "@/domain/pricing";

const chene33: PricedVariant = {
  variantId: "chene-33",
  basePriceCents: 10_400, // 104,00 € le m³ apparent
  vatRate: 10,
  unitVolumeM3: 1,
  tiers: [
    { minQuantity: 3, unitPriceCents: 9_900 },
    { minQuantity: 6, unitPriceCents: 9_500 },
    { minQuantity: 10, unitPriceCents: 9_000 },
  ],
};

describe("resolveUnitPrice", () => {
  it("applique le prix de base sous le premier palier", () => {
    expect(resolveUnitPrice(1, chene33)).toBe(10_400);
    expect(resolveUnitPrice(2.5, chene33)).toBe(10_400);
  });

  it("applique le palier atteint, borne incluse", () => {
    expect(resolveUnitPrice(3, chene33)).toBe(9_900);
    expect(resolveUnitPrice(5.9, chene33)).toBe(9_900);
    expect(resolveUnitPrice(6, chene33)).toBe(9_500);
    expect(resolveUnitPrice(42, chene33)).toBe(9_000);
  });

  it("retient le palier le plus élevé même si les paliers sont désordonnés", () => {
    const desordre: PricedVariant = {
      ...chene33,
      tiers: [
        { minQuantity: 10, unitPriceCents: 9_000 },
        { minQuantity: 3, unitPriceCents: 9_900 },
      ],
    };
    expect(resolveUnitPrice(12, desordre)).toBe(9_000);
  });
});

describe("computeLine", () => {
  it("calcule le total et le volume d'une ligne", () => {
    const line = computeLine(chene33, 5);
    expect(line.unitPriceCents).toBe(9_900);
    expect(line.lineTotalCents).toBe(49_500);
    expect(line.lineVolumeM3).toBe(5);
  });

  it("gère une quantité fractionnaire sans erreur d'arrondi", () => {
    const line = computeLine(chene33, 2.5);
    expect(line.lineTotalCents).toBe(26_000); // 104 × 2,5 = 260,00 €
  });

  it("multiplie le volume par le volume unitaire (palette)", () => {
    const palette: PricedVariant = { ...chene33, unitVolumeM3: 1.8, tiers: [] };
    expect(computeLine(palette, 2).lineVolumeM3).toBe(3.6);
  });
});

describe("computeOrderTotals", () => {
  it("calcule le scénario nominal du plan : 5 m³app livrés à 20 km", () => {
    const totals = computeOrderTotals({
      lines: [computeLine(chene33, 5)],
      deliveryCents: 1_450,
    });
    expect(totals.subtotalCents).toBe(49_500);
    expect(totals.deliveryCents).toBe(1_450);
    expect(totals.totalCents).toBe(50_950);
    expect(totals.totalVolumeM3).toBe(5);
  });

  it("applique une remise en pourcentage avant les frais de livraison", () => {
    const totals = computeOrderTotals({
      lines: [computeLine(chene33, 5)],
      deliveryCents: 1_450,
      discount: { kind: "percent", value: 10, label: "-10 %" },
    });
    expect(totals.discountCents).toBe(4_950);
    expect(totals.totalCents).toBe(49_500 - 4_950 + 1_450);
  });

  it("plafonne une remise fixe au montant des produits", () => {
    const totals = computeOrderTotals({
      lines: [computeLine(chene33, 1)],
      discount: { kind: "fixed", value: 999_999, label: "trop" },
    });
    expect(totals.discountCents).toBe(10_400);
    expect(totals.totalCents).toBe(0);
  });

  it("annule les frais de port et conserve le montant offert comme remise", () => {
    const totals = computeOrderTotals({
      lines: [computeLine(chene33, 5)],
      deliveryCents: 1_450,
      discount: { kind: "free_delivery", value: 0, label: "Port offert" },
    });
    // Le port offert annule la ligne de livraison sans réduire le prix des
    // produits : le montant reste affichable, il n'est pas déduit deux fois.
    expect(totals.discountCents).toBe(0);
    expect(totals.deliveryCents).toBe(0);
    expect(totals.deliveryOfferedCents).toBe(1_450);
    expect(totals.totalCents).toBe(49_500);
  });

  it("ne produit aucune ventilation TVA en franchise en base", () => {
    const totals = computeOrderTotals({
      lines: [computeLine(chene33, 3)],
      vatMode: "franchise_en_base",
    });
    expect(totals.vatBreakdown).toEqual([]);
  });

  it("ajoute le rangement au volume et le ventile à 20 %", () => {
    const totals = computeOrderTotals({
      lines: [computeLine(chene33, 3)],
      options: [
        { code: "rangement", name: "Rangement du bois", totalCents: 6_000, vatRate: 20 },
      ],
    });

    expect(totals.optionsCents).toBe(6_000);
    expect(totals.totalCents).toBe(35_700);
    expect(totals.vatBreakdown.map((bucket) => bucket.rate)).toEqual([10, 20]);
    expect(totals.vatBreakdown.reduce((somme, bucket) => somme + bucket.baseTtcCents, 0)).toBe(
      totals.totalCents,
    );
  });
});

describe("computeVatBreakdown", () => {
  it("reconstitue la TVA à 10 % depuis un montant TTC", () => {
    const [bucket] = computeVatBreakdown([computeLine(chene33, 5)], 1_450);
    expect(bucket.rate).toBe(10);
    expect(bucket.baseTtcCents).toBe(50_950);
    expect(bucket.baseHtCents).toBe(46_318); // 509,50 / 1,10 = 463,18 €
    expect(bucket.vatCents).toBe(4_632);
  });

  it("ventile les frais de port au prorata entre deux taux", () => {
    const service: PricedVariant = {
      variantId: "rangement",
      basePriceCents: 5_000,
      vatRate: 20,
      unitVolumeM3: 0,
      tiers: [],
    };
    const lines = [computeLine(chene33, 5), computeLine(service, 1)];
    const buckets = computeVatBreakdown(lines, 1_450);

    expect(buckets).toHaveLength(2);
    // La somme des bases TTC doit être EXACTEMENT le total de la commande.
    const somme = buckets.reduce((s, b) => s + b.baseTtcCents, 0);
    expect(somme).toBe(49_500 + 5_000 + 1_450);
  });

  it("reste équilibré quand une remise est ventilée sur trois taux", () => {
    const lines = [
      computeLine(chene33, 3),
      computeLine({ ...chene33, variantId: "b", vatRate: 20, tiers: [] }, 1),
      computeLine({ ...chene33, variantId: "c", vatRate: 5.5, tiers: [] }, 1),
    ];
    const buckets = computeVatBreakdown(lines, 2_000, 1_337);
    const somme = buckets.reduce((s, b) => s + b.baseTtcCents, 0);
    const attendu = lines.reduce((s, l) => s + l.lineTotalCents, 0) + 2_000 - 1_337;
    expect(somme).toBe(attendu);
  });
});
