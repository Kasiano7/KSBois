import { describe, it, expect } from "vitest";
import {
  QUOTE_STATUS_LABELS,
  QUOTE_ORIGIN_LABELS,
  isQuoteClosed,
  canSendQuote,
  canConvertQuote,
  defaultValidUntil,
  isQuoteExpired,
  joursDAttente,
  estEnRetard,
} from "@/domain/quotes";

describe("libellés", () => {
  it("parle français courant, sans jargon", () => {
    expect(QUOTE_STATUS_LABELS.nouveau).toBe("À traiter");
    expect(QUOTE_ORIGIN_LABELS.out_of_zone).toBe("Hors zone de livraison");
  });
});

describe("canSendQuote", () => {
  it("refuse d'envoyer un devis sans ligne", () => {
    expect(canSendQuote("nouveau", 0)).toBe(false);
    expect(canSendQuote("nouveau", 1)).toBe(true);
  });

  it("autorise le renvoi d'un devis déjà envoyé", () => {
    // Cas réel : le client demande une correction sur le devis reçu.
    expect(canSendQuote("envoye", 2)).toBe(true);
  });

  it("refuse d'envoyer sur une demande refusée", () => {
    expect(canSendQuote("refuse", 2)).toBe(false);
  });
});

describe("canConvertQuote", () => {
  it("convertit une proposition chiffrée", () => {
    expect(canConvertQuote("envoye", 1, false)).toBe(true);
  });

  it("REFUSE une deuxième conversion — sinon deux commandes et deux réservations", () => {
    expect(canConvertQuote("accepte", 1, true)).toBe(false);
  });

  it("refuse sans ligne ou sur une demande refusée", () => {
    expect(canConvertQuote("accepte", 0, false)).toBe(false);
    expect(canConvertQuote("refuse", 3, false)).toBe(false);
  });
});

describe("isQuoteClosed", () => {
  it("ne considère terminés que les états définitifs", () => {
    expect(isQuoteClosed("accepte")).toBe(true);
    expect(isQuoteClosed("refuse")).toBe(true);
    expect(isQuoteClosed("envoye")).toBe(false);
  });
});

describe("validité", () => {
  it("propose trente jours par défaut", () => {
    expect(defaultValidUntil("2026-08-09")).toBe("2026-09-08");
    expect(defaultValidUntil("2026-08-09", 15)).toBe("2026-08-24");
  });

  it("détecte une offre périmée, jamais l'inverse", () => {
    expect(isQuoteExpired("2026-08-08", "2026-08-09")).toBe(true);
    // Le dernier jour de validité est encore valable.
    expect(isQuoteExpired("2026-08-09", "2026-08-09")).toBe(false);
    expect(isQuoteExpired(null, "2026-08-09")).toBe(false);
  });
});

describe("ancienneté", () => {
  it("compte les jours écoulés depuis la demande", () => {
    expect(joursDAttente("2026-08-09T14:00:00Z", "2026-08-09")).toBe(0);
    expect(joursDAttente("2026-08-06T23:30:00Z", "2026-08-09")).toBe(3);
  });

  it("ne renvoie jamais de négatif", () => {
    expect(joursDAttente("2026-08-12T08:00:00Z", "2026-08-09")).toBe(0);
  });

  it("signale une demande en souffrance, seulement si elle attend encore", () => {
    expect(estEnRetard("nouveau", "2026-08-06T09:00:00Z", "2026-08-09")).toBe(true);
    expect(estEnRetard("nouveau", "2026-08-08T09:00:00Z", "2026-08-09")).toBe(false);
    // Envoyé : la balle est dans le camp du client, ce n'est plus un retard.
    expect(estEnRetard("envoye", "2026-08-01T09:00:00Z", "2026-08-09")).toBe(false);
  });
});
