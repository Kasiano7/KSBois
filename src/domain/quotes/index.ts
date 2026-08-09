/**
 * Cycle de vie d'une demande de devis — docs/02-MOTEURS-METIER.md §7.2
 *
 * Deux objets à ne pas confondre :
 *  • le devis PDF du panier est un libre-service anonyme et instantané (§7.1) ;
 *  • la DEMANDE de devis attend une réponse humaine. C'est elle que gère ce
 *    module : gros volumes, professionnels, hors zone, besoins sur mesure.
 *
 * Comme le reste de `src/domain/`, ce fichier ne connaît ni la base, ni Next :
 * il prend des valeurs, il rend des décisions.
 */

import { addDays } from "../slots";

export type QuoteStatus = "nouveau" | "en_cours" | "envoye" | "accepte" | "refuse";

export type QuoteOrigin = "form" | "out_of_zone" | "large_order" | "fee_too_high";

/** Libellés en français courant — aucun jargon à l'écran (docs/05 §1). */
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  nouveau: "À traiter",
  en_cours: "En préparation",
  envoye: "Envoyé au client",
  accepte: "Accepté",
  refuse: "Refusé",
};

/**
 * L'origine explique POURQUOI le client est arrivé là. C'est l'information qui
 * dit à l'exploitant s'il doit sortir sa calculette ou juste rappeler.
 */
export const QUOTE_ORIGIN_LABELS: Record<QuoteOrigin, string> = {
  form: "Demande spontanée",
  out_of_zone: "Hors zone de livraison",
  large_order: "Volume supérieur à la flotte",
  fee_too_high: "Frais de livraison hors norme",
};

/** Un devis terminé ne se retravaille plus : il se duplique ou se rouvre. */
export function isQuoteClosed(status: QuoteStatus): boolean {
  return status === "accepte" || status === "refuse";
}

/**
 * Peut-on envoyer la proposition au client ?
 * Envoyer un devis sans ligne enverrait un document vide à un prospect.
 */
export function canSendQuote(status: QuoteStatus, lineCount: number): boolean {
  return lineCount > 0 && status !== "refuse";
}

/**
 * Peut-on convertir en commande ?
 *
 * Le garde-fou qui compte est `alreadyConverted` : sans lui, deux clics
 * créeraient deux commandes et réserveraient deux fois le stock.
 */
export function canConvertQuote(
  status: QuoteStatus,
  lineCount: number,
  alreadyConverted: boolean,
): boolean {
  return lineCount > 0 && !alreadyConverted && status !== "refuse";
}

/** Validité par défaut d'une proposition : 30 jours, ajustable à la saisie. */
export function defaultValidUntil(today: string, days = 30): string {
  return addDays(today, days);
}

export function isQuoteExpired(validUntil: string | null, today: string): boolean {
  if (!validUntil) return false;
  return validUntil < today;
}

/**
 * Ancienneté d'une demande, en jours. Sert à l'alerte « en attente depuis
 * 3 jours » : dans ce métier, un prospect qui attend deux jours a déjà appelé
 * un concurrent.
 */
export function joursDAttente(createdAtIso: string, todayIso: string): number {
  const cree = createdAtIso.slice(0, 10);
  const [ya, ma, da] = cree.split("-").map(Number);
  const [yb, mb, db] = todayIso.split("-").map(Number);
  if (!ya || !yb) return 0;
  const debut = Date.UTC(ya, ma - 1, da);
  const fin = Date.UTC(yb, mb - 1, db);
  return Math.max(0, Math.round((fin - debut) / 86_400_000));
}

/**
 * Une demande sans réponse depuis trop longtemps doit être signalée.
 * Deux jours : au-delà, le prospect est probablement perdu.
 */
export function estEnRetard(
  status: QuoteStatus,
  createdAtIso: string,
  todayIso: string,
  seuilJours = 2,
): boolean {
  if (status !== "nouveau" && status !== "en_cours") return false;
  return joursDAttente(createdAtIso, todayIso) >= seuilJours;
}
