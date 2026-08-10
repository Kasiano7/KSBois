import { describe, expect, it } from "vitest";
import {
  FactureIncoherenteError,
  construireAvoir,
  construireFacture,
  echeancePaiement,
  mentionsLegales,
  type EntreeFacture,
} from "@/domain/invoices";
import { computeVatBreakdown } from "@/domain/pricing";

const vendeur = {
  name: "Bois de chauffage",
  legalName: "SARL Bois de chauffage",
  addressLine1: "Route du Bois",
  postalCode: "07100",
  city: "Annonay",
  siret: "12345678900012",
  rcs: "Aubenas 123 456 789",
  apeCode: "0220Z",
  vatNumber: "FR12345678900",
  email: "contact@demo.test",
  phone: "0475000000",
  vatMode: "assujetti" as const,
};

const acheteur = {
  name: "Jean Rivière",
  companyName: null,
  siret: null,
  vatNumber: null,
  addressLine1: "12 chemin des Fayards",
  addressLine2: null,
  postalCode: "07100",
  city: "Annonay",
  email: "jean@demo.test",
  phone: "0600000000",
  isProfessional: false,
};

function entree(surcharge: Partial<EntreeFacture> = {}): EntreeFacture {
  const lignes = [
    {
      designation: "Chêne / Hêtre",
      precision: "33 cm · bois sec",
      quantiteM3: 5,
      stackingCoefficient: 0.7,
      unitPriceCents: 10_400,
      lineTotalCents: 52_000,
      vatRate: 10,
    },
  ];
  return {
    seller: vendeur,
    buyer: acheteur,
    orderReference: "CMD-2026-0042",
    saleDate: "2026-08-10",
    lines: lignes,
    options: [],
    delivery: { label: "Livraison Annonay", totalCents: 1_450 },
    discount: null,
    orderTotalCents: 53_450,
    paidCents: 0,
    totalVolumeM3: 5,
    vatBreakdown: computeVatBreakdown(
      lignes.map((l) => ({
        variantId: "v1",
        quantity: l.quantiteM3,
        unitPriceCents: l.unitPriceCents,
        lineTotalCents: l.lineTotalCents,
        lineVolumeM3: l.quantiteM3,
        vatRate: l.vatRate,
      })),
      1_450,
      0,
    ).map((b) => ({
      rate: b.rate,
      baseHtCents: b.baseHtCents,
      vatCents: b.vatCents,
      baseTtcCents: b.baseTtcCents,
    })),
    ...surcharge,
  };
}

describe("construction d'une facture", () => {
  it("boucle au centime et reconstitue le HT depuis le TTC", () => {
    const facture = construireFacture(entree());

    expect(facture.totals.subtotalCents).toBe(52_000);
    expect(facture.totals.deliveryCents).toBe(1_450);
    expect(facture.totals.totalTtcCents).toBe(53_450);
    // 53 450 TTC à 10 % → 48 591 HT + 4 859 de TVA.
    expect(facture.totals.totalHtCents + facture.totals.totalVatCents).toBe(53_450);
    expect(facture.totals.totalVatCents).toBe(4_859);
  });

  it("fige le prix unitaire hors taxe exigé par le CGI", () => {
    const facture = construireFacture(entree());
    // 104,00 € TTC à 10 % → 94,55 € HT.
    expect(facture.lines[0].unitPriceHtCents).toBe(9_455);
  });

  it("refuse d'émettre si les lignes ne retombent pas sur le total encaissé", () => {
    // Une option de rangement oubliée dans la requête : la facture serait
    // inférieure de 100 € à ce que le client a payé.
    expect(() => construireFacture(entree({ orderTotalCents: 63_450 }))).toThrow(
      FactureIncoherenteError,
    );
  });

  it("tient compte des options et de la remise dans le bouclage", () => {
    const facture = construireFacture(
      entree({
        options: [{ name: "Rangement du bois", priceCents: 10_000, vatRate: 20 }],
        discount: { label: "Remise fidélité", amountCents: 5_000 },
        orderTotalCents: 58_450,
      }),
    );
    expect(facture.totals.optionsCents).toBe(10_000);
    expect(facture.totals.discountCents).toBe(5_000);
    expect(facture.totals.totalTtcCents).toBe(58_450);
  });

  it("n'invente aucune TVA en franchise en base", () => {
    const facture = construireFacture(
      entree({
        seller: { ...vendeur, vatMode: "franchise_en_base" },
        vatBreakdown: [],
      }),
    );
    expect(facture.totals.totalVatCents).toBe(0);
    expect(facture.totals.totalHtCents).toBe(facture.totals.totalTtcCents);
  });

  it("n'affiche jamais un reste à payer négatif", () => {
    const facture = construireFacture(entree({ paidCents: 60_000 }));
    expect(facture.totals.remainingCents).toBe(0);
  });

  it("calcule le reste à payer après un acompte", () => {
    const facture = construireFacture(entree({ paidCents: 16_035 }));
    expect(facture.totals.remainingCents).toBe(37_415);
  });
});

describe("avoir", () => {
  it("inverse exactement la facture d'origine", () => {
    const facture = construireFacture(entree());
    const avoir = construireAvoir(facture);

    expect(avoir.isCreditNote).toBe(true);
    expect(avoir.totals.totalTtcCents).toBe(-facture.totals.totalTtcCents);
    expect(avoir.totals.totalVatCents).toBe(-facture.totals.totalVatCents);
    expect(avoir.lines[0].lineTotalCents).toBe(-facture.lines[0].lineTotalCents);
    expect(avoir.lines[0].quantiteM3).toBe(-facture.lines[0].quantiteM3);
    expect(avoir.vatBreakdown[0].vatCents).toBe(-facture.vatBreakdown[0].vatCents);
    // Un avoir n'appelle aucun paiement.
    expect(avoir.totals.remainingCents).toBe(0);
  });

  it("conserve la référence de commande et le prix unitaire", () => {
    const avoir = construireAvoir(construireFacture(entree()));
    expect(avoir.orderReference).toBe("CMD-2026-0042");
    expect(avoir.lines[0].unitPriceCents).toBe(10_400);
  });
});

describe("échéance et mentions", () => {
  it("met un particulier au comptant et un professionnel à 30 jours", () => {
    expect(echeancePaiement("2026-08-10", false)).toBe("2026-08-10");
    expect(echeancePaiement("2026-08-10", true)).toBe("2026-09-09");
  });

  it("porte les pénalités et l'indemnité de 40 € face à un professionnel", () => {
    const pro = mentionsLegales({
      vatMode: "assujetti",
      isProfessional: true,
      tauxPenalitesAnnuel: 12,
    });
    expect(pro.some((m) => m.includes("12 %"))).toBe(true);
    expect(pro.some((m) => m.includes("40 euros"))).toBe(true);

    const particulier = mentionsLegales({
      vatMode: "assujetti",
      isProfessional: false,
      tauxPenalitesAnnuel: 12,
    });
    expect(particulier.some((m) => m.includes("40 euros"))).toBe(false);
  });

  it("porte l'article 293 B en franchise en base, et lui seul", () => {
    const franchise = mentionsLegales({
      vatMode: "franchise_en_base",
      isProfessional: false,
      tauxPenalitesAnnuel: 12,
    });
    expect(franchise[0]).toContain("293 B");

    const assujetti = mentionsLegales({
      vatMode: "assujetti",
      isProfessional: false,
      tauxPenalitesAnnuel: 12,
    });
    expect(assujetti.some((m) => m.includes("293 B"))).toBe(false);
  });

  it("rappelle toujours que le stère n'est pas une unité légale", () => {
    for (const professionnel of [true, false]) {
      const mentions = mentionsLegales({
        vatMode: "assujetti",
        isProfessional: professionnel,
        tauxPenalitesAnnuel: 12,
      });
      expect(mentions.some((m) => m.includes("stère"))).toBe(true);
    }
  });
});
