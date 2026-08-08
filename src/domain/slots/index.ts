/**
 * Moteur de créneaux — docs/02-MOTEURS-METIER.md §3
 *
 * Modèle en deux temps : le client choisit un créneau SOUHAITÉ, l'entreprise
 * confirme. Le site ne promet jamais une heure ferme à la place du bûcheron.
 *
 * La contrainte décisive n'est pas le nombre de livraisons mais le VOLUME :
 * 8 livraisons de 2 m³ tiennent dans une matinée, 8 de 10 m³ font trois jours.
 */

export interface Slot {
  id: string;
  date: string; // ISO "AAAA-MM-JJ"
  startTime: string;
  endTime: string;
  label: string;
  maxDeliveries: number;
  maxVolumeM3: number;
  bookedDeliveries: number;
  bookedVolumeM3: number;
  isOpen: boolean;
  zoneIds: string[];
  vehicleId: string | null;
}

export interface Blackout {
  startDate: string;
  endDate: string;
  reason: string | null;
  zoneIds: string[];
}

export interface SlotContext {
  /** Date du jour au format ISO, injectée : le domaine ne lit jamais l'horloge. */
  today: string;
  leadTimeDays: number;
  bookingHorizonDays: number;
  orderVolumeM3: number;
  zoneId: string | null;
  /** Jours ISO autorisés pour la commune (1 = lundi). */
  allowedWeekdays: number[];
  blackouts: Blackout[];
}

export type SlotUnavailability =
  | "ferme"
  | "delai_trop_court"
  | "hors_horizon"
  | "jour_non_desservi"
  | "hors_zone"
  | "complet_livraisons"
  | "complet_volume"
  | "periode_bloquee";

export interface SlotAvailability {
  slot: Slot;
  available: boolean;
  reason: SlotUnavailability | null;
  remainingDeliveries: number;
  remainingVolumeM3: number;
}

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date « AAAA-MM-JJ ». */
export function isoWeekday(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  const jour = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return jour === 0 ? 7 : jour;
}

/** Ajoute des jours à une date ISO, sans dépendre du fuseau local. */
export function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dansPeriode(dateIso: string, debut: string, fin: string): boolean {
  return dateIso >= debut && dateIso <= fin;
}

/**
 * Évalue un créneau. Retourne toujours un diagnostic, y compris quand le
 * créneau est indisponible : c'est ce qui permet à l'administration de
 * comprendre pourquoi un client ne voit rien.
 */
export function evaluateSlot(slot: Slot, ctx: SlotContext): SlotAvailability {
  const remainingDeliveries = slot.maxDeliveries - slot.bookedDeliveries;
  const remainingVolumeM3 =
    Math.round((slot.maxVolumeM3 - slot.bookedVolumeM3) * 1000) / 1000;

  const base = { slot, remainingDeliveries, remainingVolumeM3 };
  const refus = (reason: SlotUnavailability) => ({ ...base, available: false, reason });

  if (!slot.isOpen) return refus("ferme");

  const premierJour = addDays(ctx.today, ctx.leadTimeDays);
  if (slot.date < premierJour) return refus("delai_trop_court");

  const dernierJour = addDays(ctx.today, ctx.bookingHorizonDays);
  if (slot.date > dernierJour) return refus("hors_horizon");

  if (ctx.allowedWeekdays.length > 0 && !ctx.allowedWeekdays.includes(isoWeekday(slot.date))) {
    return refus("jour_non_desservi");
  }

  const bloque = ctx.blackouts.some(
    (b) =>
      dansPeriode(slot.date, b.startDate, b.endDate) &&
      (b.zoneIds.length === 0 || (ctx.zoneId !== null && b.zoneIds.includes(ctx.zoneId))),
  );
  if (bloque) return refus("periode_bloquee");

  // Un créneau restreint à certaines zones n'est proposé qu'à celles-ci.
  if (slot.zoneIds.length > 0 && (ctx.zoneId === null || !slot.zoneIds.includes(ctx.zoneId))) {
    return refus("hors_zone");
  }

  if (remainingDeliveries < 1) return refus("complet_livraisons");

  // LA contrainte qui compte réellement.
  if (remainingVolumeM3 < ctx.orderVolumeM3) return refus("complet_volume");

  return { ...base, available: true, reason: null };
}

/** Créneaux réellement proposables au client, triés par date puis par heure. */
export function availableSlots(slots: Slot[], ctx: SlotContext): SlotAvailability[] {
  return slots
    .map((slot) => evaluateSlot(slot, ctx))
    .filter((r) => r.available)
    .sort((a, b) =>
      a.slot.date === b.slot.date
        ? a.slot.startTime.localeCompare(b.slot.startTime)
        : a.slot.date.localeCompare(b.slot.date),
    );
}

/**
 * Faut-il afficher un signal de rareté ?
 * Uniquement quand il est VRAI : pas d'urgence fabriquée (docs/03 §10).
 */
export function isLastPlaces(dispo: SlotAvailability, seuil = 2): boolean {
  return dispo.available && dispo.remainingDeliveries <= seuil;
}
