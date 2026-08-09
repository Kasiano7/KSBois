import { describe, it, expect } from "vitest";
import { prepareReorder, type LigneCommandePassee, type VarianteActuelle } from "@/domain/reorder";

const variante = (over: Partial<VarianteActuelle> = {}): VarianteActuelle => ({
  id: "v1",
  isActive: true,
  basePriceCents: 10_400,
  stockAvailable: 40,
  trackStock: true,
  allowBackorder: false,
  tiers: [],
  minQuantity: 1,
  maxQuantity: null,
  quantityStep: 1,
  ...over,
});

const ligne = (over: Partial<LigneCommandePassee> = {}): LigneCommandePassee => ({
  variantId: "v1",
  productName: "Chêne / Hêtre",
  variantLabel: "33 cm",
  quantity: 4,
  unitPriceCents: 10_400,
  ...over,
});

describe("prepareReorder — cas nominal", () => {
  it("reprend la commande à l'identique sans rien signaler", () => {
    const r = prepareReorder([ligne()], [variante()]);
    expect(r.lignes).toEqual([{ variantId: "v1", quantity: 4 }]);
    expect(r.avertissements).toEqual([]);
    expect(r.vide).toBe(false);
  });

  it("reprend plusieurs lignes", () => {
    const r = prepareReorder(
      [ligne(), ligne({ variantId: "v2", variantLabel: "50 cm", quantity: 2 })],
      [variante(), variante({ id: "v2" })],
    );
    expect(r.lignes).toHaveLength(2);
  });
});

describe("prepareReorder — produit disparu", () => {
  it("écarte une variante désactivée et le dit", () => {
    const r = prepareReorder([ligne()], [variante({ isActive: false })]);
    expect(r.lignes).toEqual([]);
    expect(r.vide).toBe(true);
    expect(r.avertissements[0].motif).toBe("produit_retire");
    expect(r.avertissements[0].message).toContain("Chêne / Hêtre 33 cm");
  });

  it("écarte une variante supprimée du catalogue", () => {
    const r = prepareReorder([ligne({ variantId: null })], []);
    expect(r.vide).toBe(true);
    expect(r.avertissements[0].motif).toBe("produit_retire");
  });

  it("garde les autres lignes quand une seule a disparu", () => {
    const r = prepareReorder(
      [ligne(), ligne({ variantId: "v2", quantity: 3 })],
      [variante({ id: "v2" })],
    );
    expect(r.lignes).toEqual([{ variantId: "v2", quantity: 3 }]);
    expect(r.avertissements).toHaveLength(1);
    expect(r.vide).toBe(false);
  });
});

describe("prepareReorder — le prix a bougé", () => {
  it("annonce une hausse AVANT le paiement", () => {
    const r = prepareReorder([ligne()], [variante({ basePriceCents: 10_800 })]);
    const avert = r.avertissements.find((a) => a.motif === "prix_change");
    expect(avert?.message).toContain("104,00");
    expect(avert?.message).toContain("108,00");
    // La ligne est tout de même reprise : c'est au client de décider.
    expect(r.lignes).toHaveLength(1);
  });

  it("annonce aussi une baisse — la transparence marche dans les deux sens", () => {
    const r = prepareReorder([ligne()], [variante({ basePriceCents: 9_900 })]);
    expect(r.avertissements.some((a) => a.motif === "prix_change")).toBe(true);
  });

  it("ne dit rien quand le prix n'a pas changé", () => {
    const r = prepareReorder([ligne()], [variante()]);
    expect(r.avertissements.some((a) => a.motif === "prix_change")).toBe(false);
  });

  it("compare le prix RÉELLEMENT applicable, palier dégressif compris", () => {
    // Défaut constaté à l'écran : la cliente avait payé 104 €/m³, le palier des
    // 3 m³ et plus la ramène à 100 €, et rien ne le signalait — parce qu'on
    // comparait le prix de base, resté à 104 €.
    const r = prepareReorder(
      [ligne({ quantity: 4, unitPriceCents: 10_400 })],
      [variante({ basePriceCents: 10_400, tiers: [{ minQuantity: 3, unitPriceCents: 10_000 }] })],
    );
    const avert = r.avertissements.find((a) => a.motif === "prix_change");
    expect(avert?.message).toContain("100,00");
  });

  it("se tait quand le palier appliqué est le même qu'à l'époque", () => {
    const r = prepareReorder(
      [ligne({ quantity: 4, unitPriceCents: 10_000 })],
      [variante({ basePriceCents: 10_400, tiers: [{ minQuantity: 3, unitPriceCents: 10_000 }] })],
    );
    expect(r.avertissements.some((a) => a.motif === "prix_change")).toBe(false);
  });

  it("ignore un palier hors d'atteinte pour la quantité reprise", () => {
    const r = prepareReorder(
      [ligne({ quantity: 1, unitPriceCents: 10_400 })],
      [variante({ basePriceCents: 10_400, tiers: [{ minQuantity: 10, unitPriceCents: 9_000 }] })],
    );
    expect(r.avertissements.some((a) => a.motif === "prix_change")).toBe(false);
  });
});

describe("prepareReorder — quantités", () => {
  it("arrondit au pas de vente, vers le haut", () => {
    const r = prepareReorder([ligne({ quantity: 2.5 })], [variante({ quantityStep: 1 })]);
    expect(r.lignes[0].quantity).toBe(3);
    expect(r.avertissements.some((a) => a.motif === "quantite_ajustee")).toBe(true);
  });

  it("respecte un pas d'un demi-mètre cube", () => {
    const r = prepareReorder([ligne({ quantity: 2.5 })], [variante({ quantityStep: 0.5 })]);
    expect(r.lignes[0].quantity).toBe(2.5);
    expect(r.avertissements).toEqual([]);
  });

  it("remonte au minimum de vente", () => {
    const r = prepareReorder([ligne({ quantity: 1 })], [variante({ minQuantity: 2 })]);
    expect(r.lignes[0].quantity).toBe(2);
    expect(r.avertissements.some((a) => a.motif === "quantite_ajustee")).toBe(true);
  });

  it("plafonne au maximum de vente", () => {
    const r = prepareReorder([ligne({ quantity: 30 })], [variante({ maxQuantity: 20 })]);
    expect(r.lignes[0].quantity).toBe(20);
  });

  it("ne dérive pas sur les flottants", () => {
    const r = prepareReorder(
      [ligne({ quantity: 0.3 })],
      [variante({ quantityStep: 0.1, minQuantity: 0.1 })],
    );
    expect(r.lignes[0].quantity).toBe(0.3);
    expect(r.avertissements).toEqual([]);
  });
});

describe("prepareReorder — stock", () => {
  it("prévient quand le stock ne suffit plus, sans retirer la ligne", () => {
    const r = prepareReorder([ligne({ quantity: 10 })], [variante({ stockAvailable: 3 })]);
    expect(r.lignes[0].quantity).toBe(10);
    const avert = r.avertissements.find((a) => a.motif === "stock_limite");
    expect(avert?.message).toContain("3 m³");
  });

  it("ne prévient pas si la précommande est autorisée", () => {
    const r = prepareReorder(
      [ligne({ quantity: 10 })],
      [variante({ stockAvailable: 0, allowBackorder: true })],
    );
    expect(r.avertissements.some((a) => a.motif === "stock_limite")).toBe(false);
  });

  it("ne prévient pas quand le stock n'est pas suivi", () => {
    const r = prepareReorder(
      [ligne({ quantity: 10 })],
      [variante({ stockAvailable: 0, trackStock: false })],
    );
    expect(r.avertissements.some((a) => a.motif === "stock_limite")).toBe(false);
  });
});

describe("prepareReorder — commande vide", () => {
  it("ne casse pas sur une commande sans ligne", () => {
    expect(prepareReorder([], [])).toEqual({ lignes: [], avertissements: [], vide: true });
  });
});
