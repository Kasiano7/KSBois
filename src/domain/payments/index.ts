/**
 * Moyens de paiement — docs/02-MOTEURS-METIER.md §6.1
 *
 * Le filtrage est CALCULÉ CÔTÉ SERVEUR et renvoyé au tunnel. Le client ne voit
 * jamais un mode qu'il ne peut pas utiliser, et ne peut pas en forcer un en
 * modifiant le formulaire : la sélection est revalidée à la création de la
 * commande.
 */

import type { Cents } from "../pricing";

export type PaymentMethod = "card" | "cash" | "check" | "transfer" | "sumup";

export type FulfillmentType = "delivery" | "pickup";

export interface PaymentAvailabilityInput {
  /** Modes activés par l'entreprise dans ses réglages. */
  enabledMethods: PaymentMethod[];
  totalCents: Cents;
  volumeM3: number;
  distanceKm: number;
  fulfillmentType: FulfillmentType;
  /** Plafond légal du paiement en espèces par un particulier (1 000 € en France). */
  cashLimitCents: Cents;
  depositPercent: number;
  depositTriggerVolumeM3: number;
  depositTriggerKm: number;
  /** Faux si les clés Stripe manquent : on n'affiche pas un bouton qui échouera. */
  cardConfigured: boolean;
}

export type PaymentUnavailability =
  | "desactive"
  | "plafond_especes"
  | "livraison_uniquement"
  | "non_configure";

export interface PaymentOption {
  method: PaymentMethod;
  available: boolean;
  reason: PaymentUnavailability | null;
  /** Montant réellement encaissé en ligne (acompte le cas échéant). */
  payableNowCents: Cents;
  /** Reste à régler à la livraison. */
  dueOnDeliveryCents: Cents;
}

export interface DepositDecision {
  required: boolean;
  amountCents: Cents;
  reason: "volume" | "distance" | null;
}

/**
 * Un acompte est demandé au-delà d'un volume ou d'une distance : c'est ce qui
 * filtre les commandes fantômes, vrai fléau du métier.
 */
export function evaluateDeposit(input: PaymentAvailabilityInput): DepositDecision {
  const parVolume = input.volumeM3 >= input.depositTriggerVolumeM3;
  const parDistance =
    input.fulfillmentType === "delivery" && input.distanceKm >= input.depositTriggerKm;

  if (!parVolume && !parDistance) {
    return { required: false, amountCents: 0, reason: null };
  }

  return {
    required: true,
    amountCents: Math.round((input.totalCents * input.depositPercent) / 100),
    reason: parVolume ? "volume" : "distance",
  };
}

const TOUS: PaymentMethod[] = ["card", "cash", "check", "transfer", "sumup"];

/** Modes exigeant une livraison : on n'encaisse pas au camion pour un retrait. */
const LIVRAISON_SEULE: PaymentMethod[] = ["cash", "sumup"];

export function evaluatePaymentMethods(input: PaymentAvailabilityInput): PaymentOption[] {
  const acompte = evaluateDeposit(input);

  return TOUS.map((method): PaymentOption => {
    const paiementImmediat =
      method === "card" && acompte.required ? acompte.amountCents : input.totalCents;
    const solde = method === "card" ? input.totalCents - paiementImmediat : 0;

    const base = {
      method,
      payableNowCents: method === "card" ? paiementImmediat : 0,
      dueOnDeliveryCents: method === "card" ? solde : input.totalCents,
    };

    if (!input.enabledMethods.includes(method)) {
      return { ...base, available: false, reason: "desactive" };
    }

    if (method === "card" && !input.cardConfigured) {
      return { ...base, available: false, reason: "non_configure" };
    }

    if (LIVRAISON_SEULE.includes(method) && input.fulfillmentType !== "delivery") {
      return { ...base, available: false, reason: "livraison_uniquement" };
    }

    // Plafond légal : un professionnel ne peut encaisser plus de 1 000 € en
    // espèces d'un particulier résident en France.
    if (method === "cash" && input.totalCents > input.cashLimitCents) {
      return { ...base, available: false, reason: "plafond_especes" };
    }

    return { ...base, available: true, reason: null };
  });
}

/** Vérifie qu'un mode soumis par le client est réellement autorisé. */
export function isPaymentMethodAllowed(
  method: PaymentMethod,
  input: PaymentAvailabilityInput,
): boolean {
  return evaluatePaymentMethods(input).some((o) => o.method === method && o.available);
}
