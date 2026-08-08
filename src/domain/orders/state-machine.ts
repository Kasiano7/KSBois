/**
 * Machine à états des commandes — docs/02-MOTEURS-METIER.md §5
 *
 * Implémentée comme une TABLE de transitions, pas comme des `if` dispersés :
 * c'est la seule façon de garantir qu'aucun chemin exotique n'existe et de
 * pouvoir afficher, dans l'administration, exactement les actions permises.
 */

export const ORDER_STATUSES = [
  "nouvelle",
  "en_attente_paiement",
  "payee",
  "a_preparer",
  "prete",
  "planifiee",
  "livree",
  "annulee",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Transitions autorisées. Toute transition absente de cette table est un bug. */
const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = Object.freeze({
  nouvelle: ["en_attente_paiement", "payee", "a_preparer", "annulee"],
  en_attente_paiement: ["payee", "a_preparer", "annulee"],
  payee: ["a_preparer", "annulee"],
  a_preparer: ["prete", "planifiee", "annulee"],
  prete: ["planifiee", "livree", "annulee"],
  planifiee: ["livree", "prete", "annulee"],
  livree: [],
  annulee: [],
});

/** Libellés affichés à l'exploitant — jamais les codes techniques. */
export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = Object.freeze({
  nouvelle: "Nouvelle commande",
  en_attente_paiement: "Paiement en attente",
  payee: "Payée",
  a_preparer: "À préparer",
  prete: "Prête",
  planifiee: "Livraison planifiée",
  livree: "Livrée",
  annulee: "Annulée",
});

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Le stock est engagé tant que la commande n'est ni livrée ni annulée. */
export function holdsStock(status: OrderStatus): boolean {
  return status !== "livree" && status !== "annulee";
}

/**
 * Chemin le plus court entre deux états, ou null si aucun n'existe.
 *
 * Sert au terrain : le livreur appuie sur « Marquer comme livrée » sur une
 * commande encore « à préparer ». Refuser avec un message cryptique serait
 * inutilisable ; sauter directement à « livrée » abîmerait le modèle. On
 * emprunte donc le chemin légal (`à préparer → prête → livrée`) en journalisant
 * chaque étape, ce qui laisse un historique honnête.
 */
export function shortestPath(from: OrderStatus, to: OrderStatus): OrderStatus[] | null {
  if (from === to) return [];

  const file: OrderStatus[][] = [[from]];
  const vus = new Set<OrderStatus>([from]);

  while (file.length > 0) {
    const chemin = file.shift()!;
    const dernier = chemin.at(-1)!;

    for (const suivant of TRANSITIONS[dernier]) {
      if (vus.has(suivant)) continue;
      const nouveau = [...chemin, suivant];
      if (suivant === to) return nouveau.slice(1);
      vus.add(suivant);
      file.push(nouveau);
    }
  }
  return null;
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(
      `Transition interdite : « ${ORDER_STATUS_LABELS[from]} » → « ${ORDER_STATUS_LABELS[to]} ».`,
    );
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/**
 * Statut initial d'une commande selon le mode de paiement.
 *
 * Une commande payée à la livraison n'est JAMAIS `payee` avant la livraison :
 * elle part directement en préparation, et l'encaissement est enregistré au
 * passage à `livree`.
 */
export function initialStatus(method: "card" | "cash" | "check" | "transfer" | "sumup"): OrderStatus {
  switch (method) {
    case "card":
      return "nouvelle"; // devient `payee` sur webhook Stripe uniquement
    case "cash":
    case "sumup":
      return "a_preparer";
    case "check":
    case "transfer":
      return "en_attente_paiement";
  }
}
