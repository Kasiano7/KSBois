import { describe, it, expect } from "vitest";
import {
  evaluatePaymentMethods,
  evaluateDeposit,
  isPaymentMethodAllowed,
  type PaymentAvailabilityInput,
} from "@/domain/payments";
import {
  canTransition,
  nextStatuses,
  assertTransition,
  initialStatus,
  holdsStock,
  isTerminal,
  shortestPath,
  InvalidTransitionError,
  ORDER_STATUSES,
} from "@/domain/orders/state-machine";

const entree = (over: Partial<PaymentAvailabilityInput> = {}): PaymentAvailabilityInput => ({
  enabledMethods: ["card", "cash", "check", "transfer", "sumup"],
  totalCents: 50_000,
  volumeM3: 5,
  distanceKm: 12,
  fulfillmentType: "delivery",
  cashLimitCents: 100_000,
  depositPercent: 30,
  depositTriggerVolumeM3: 10,
  depositTriggerKm: 45,
  cardConfigured: true,
  ...over,
});

const dispo = (input: PaymentAvailabilityInput) =>
  evaluatePaymentMethods(input)
    .filter((o) => o.available)
    .map((o) => o.method);

describe("evaluatePaymentMethods", () => {
  it("propose tous les modes activés dans le cas nominal", () => {
    expect(dispo(entree())).toEqual(["card", "cash", "check", "transfer", "sumup"]);
  });

  it("retire les modes désactivés par l'entreprise", () => {
    expect(dispo(entree({ enabledMethods: ["card", "transfer"] }))).toEqual(["card", "transfer"]);
  });

  it("RETIRE LES ESPÈCES au-delà du plafond légal de 1 000 €", () => {
    const options = evaluatePaymentMethods(entree({ totalCents: 100_001 }));
    const especes = options.find((o) => o.method === "cash")!;
    expect(especes.available).toBe(false);
    expect(especes.reason).toBe("plafond_especes");
  });

  it("accepte les espèces pile au plafond", () => {
    expect(dispo(entree({ totalCents: 100_000 }))).toContain("cash");
  });

  it("retire espèces et terminal pour un retrait sur place", () => {
    const modes = dispo(entree({ fulfillmentType: "pickup" }));
    expect(modes).not.toContain("cash");
    expect(modes).not.toContain("sumup");
    expect(modes).toContain("check");
  });

  it("masque la carte quand Stripe n'est pas configuré", () => {
    const carte = evaluatePaymentMethods(entree({ cardConfigured: false })).find(
      (o) => o.method === "card",
    )!;
    expect(carte.available).toBe(false);
    expect(carte.reason).toBe("non_configure");
  });

  it("indique le reste à payer à la livraison pour les modes différés", () => {
    const especes = evaluatePaymentMethods(entree()).find((o) => o.method === "cash")!;
    expect(especes.payableNowCents).toBe(0);
    expect(especes.dueOnDeliveryCents).toBe(50_000);
  });
});

describe("evaluateDeposit", () => {
  it("n'exige aucun acompte sur une commande ordinaire", () => {
    expect(evaluateDeposit(entree())).toEqual({ required: false, amountCents: 0, reason: null });
  });

  it("déclenche l'acompte au-delà du volume seuil", () => {
    const d = evaluateDeposit(entree({ volumeM3: 12, totalCents: 120_000 }));
    expect(d).toEqual({ required: true, amountCents: 36_000, reason: "volume" });
  });

  it("déclenche l'acompte au-delà de la distance seuil", () => {
    expect(evaluateDeposit(entree({ distanceKm: 50 })).reason).toBe("distance");
  });

  it("ignore le seuil de distance pour un retrait sur place", () => {
    expect(
      evaluateDeposit(entree({ distanceKm: 90, fulfillmentType: "pickup" })).required,
    ).toBe(false);
  });

  it("scinde le paiement carte en acompte et solde", () => {
    const carte = evaluatePaymentMethods(entree({ volumeM3: 12, totalCents: 120_000 })).find(
      (o) => o.method === "card",
    )!;
    expect(carte.payableNowCents).toBe(36_000);
    expect(carte.dueOnDeliveryCents).toBe(84_000);
  });
});

describe("isPaymentMethodAllowed", () => {
  it("refuse un mode forcé depuis le navigateur", () => {
    // Le client soumet « cash » sur une commande à 1 500 € : refusé côté serveur.
    expect(isPaymentMethodAllowed("cash", entree({ totalCents: 150_000 }))).toBe(false);
    expect(isPaymentMethodAllowed("check", entree({ totalCents: 150_000 }))).toBe(true);
  });
});

describe("machine à états des commandes", () => {
  it("autorise le chemin nominal du paiement à la livraison", () => {
    expect(canTransition("a_preparer", "prete")).toBe(true);
    expect(canTransition("prete", "planifiee")).toBe(true);
    expect(canTransition("planifiee", "livree")).toBe(true);
  });

  it("interdit les sauts incohérents", () => {
    expect(canTransition("nouvelle", "livree")).toBe(false);
    expect(canTransition("livree", "annulee")).toBe(false);
    expect(canTransition("annulee", "payee")).toBe(false);
  });

  it("lève une erreur explicite et lisible", () => {
    expect(() => assertTransition("nouvelle", "livree")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("nouvelle", "livree")).toThrow(/Transition interdite/);
  });

  it("identifie les états terminaux", () => {
    expect(isTerminal("livree")).toBe(true);
    expect(isTerminal("annulee")).toBe(true);
    expect(nextStatuses("livree")).toEqual([]);
  });

  it("libère le stock uniquement en fin de vie", () => {
    for (const s of ORDER_STATUSES) {
      expect(holdsStock(s)).toBe(s !== "livree" && s !== "annulee");
    }
  });

  it("trouve le chemin légal quand le saut direct est interdit", () => {
    // Cas réel du terrain : le livreur marque « livrée » une commande encore
    // « à préparer ». On emprunte le chemin au lieu de refuser sèchement.
    expect(shortestPath("a_preparer", "livree")).toEqual(["prete", "livree"]);
    expect(shortestPath("nouvelle", "livree")).toEqual(["a_preparer", "prete", "livree"]);
  });

  it("retourne un chemin vide quand l'état est déjà atteint", () => {
    expect(shortestPath("livree", "livree")).toEqual([]);
  });

  it("retourne null quand aucun chemin n'existe", () => {
    expect(shortestPath("livree", "payee")).toBeNull();
    expect(shortestPath("annulee", "a_preparer")).toBeNull();
  });

  it("emprunte le chemin le plus court", () => {
    expect(shortestPath("prete", "livree")).toEqual(["livree"]);
  });

  it("ne marque JAMAIS payée une commande réglée à la livraison", () => {
    expect(initialStatus("cash")).toBe("a_preparer");
    expect(initialStatus("sumup")).toBe("a_preparer");
    expect(initialStatus("card")).toBe("nouvelle");
    expect(initialStatus("check")).toBe("en_attente_paiement");
    expect(initialStatus("transfer")).toBe("en_attente_paiement");
  });
});
