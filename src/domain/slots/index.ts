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

// -----------------------------------------------------------------------------
// Remplissage — vue ADMINISTRATION (docs/05 §6.2)
//
// Le client voit « disponible ou non » ; l'exploitant doit voir OÙ il en est et
// SURTOUT laquelle des deux contraintes le limite. Une matinée à 5/6 livraisons
// mais 17/18 m³ est pleine, et ce n'est pas le compteur de livraisons qui le dit.
// -----------------------------------------------------------------------------

export interface SlotOccupancy {
  /** Part de la capacité en nombre de livraisons déjà consommée (0 à 1). */
  deliveriesRatio: number;
  /** Part de la capacité en volume déjà consommée (0 à 1). */
  volumeRatio: number;
  remainingDeliveries: number;
  remainingVolumeM3: number;
  /** Plus rien n'est réservable, quelle que soit la taille de la commande. */
  saturated: boolean;
  /** La contrainte la plus avancée — celle qui fermera le créneau en premier. */
  binding: "livraisons" | "volume" | null;
}

type SlotCapacity = Pick<
  Slot,
  "maxDeliveries" | "maxVolumeM3" | "bookedDeliveries" | "bookedVolumeM3"
>;

function ratio(consomme: number, capacite: number): number {
  // Capacité nulle ou aberrante : on considère le créneau plein plutôt que de
  // renvoyer l'infini, qui casserait l'affichage.
  if (!Number.isFinite(capacite) || capacite <= 0) return 1;
  return Math.min(1, Math.max(0, consomme / capacite));
}

export function slotOccupancy(slot: SlotCapacity): SlotOccupancy {
  const remainingDeliveries = slot.maxDeliveries - slot.bookedDeliveries;
  const remainingVolumeM3 = Math.round((slot.maxVolumeM3 - slot.bookedVolumeM3) * 1000) / 1000;

  const deliveriesRatio = ratio(slot.bookedDeliveries, slot.maxDeliveries);
  const volumeRatio = ratio(slot.bookedVolumeM3, slot.maxVolumeM3);

  let binding: SlotOccupancy["binding"] = null;
  if (deliveriesRatio > 0 || volumeRatio > 0) {
    // À égalité, c'est le volume qu'on désigne : c'est la contrainte qui décide
    // réellement d'une journée de livraison (docs/02 §3.2).
    binding = deliveriesRatio > volumeRatio ? "livraisons" : "volume";
  }

  return {
    deliveriesRatio,
    volumeRatio,
    remainingDeliveries,
    remainingVolumeM3,
    saturated: remainingDeliveries < 1 || remainingVolumeM3 <= 0,
    binding,
  };
}

/**
 * Le créneau est-il inutilisable en pratique ?
 *
 * Piège constaté à l'écran : un créneau à 23,5 / 24 m³ s'affiche « ouvert » avec
 * « 0,5 m³ libres », alors qu'aucun client ne peut plus le réserver — la
 * commande minimum est d'un mètre cube. L'exploitant croit avoir de la place,
 * le site ne propose rien, et personne ne comprend pourquoi.
 */
export function isEffectivelyFull(occupancy: SlotOccupancy, minOrderVolumeM3: number): boolean {
  if (occupancy.saturated) return true;
  if (minOrderVolumeM3 <= 0) return false;
  return occupancy.remainingVolumeM3 < minOrderVolumeM3;
}

// -----------------------------------------------------------------------------
// Horaires — saisie et affichage des modèles récurrents
// -----------------------------------------------------------------------------

/** « 08:00 », « 08:00:00 » → minutes depuis minuit. `null` si illisible. */
export function minutesDepuisMinuit(heure: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(heure.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export interface PlageHoraire {
  weekday: number;
  startTime: string;
  endTime: string;
}

/**
 * Deux plages du même jour se chevauchent-elles ?
 *
 * La contrainte d'unicité en base ne rattrape que les doublons EXACTS : sans ce
 * contrôle, on peut créer « 8h–12h » puis « 10h–14h » le même mardi et vendre
 * deux fois la même demi-journée.
 */
export function plagesSeChevauchent(a: PlageHoraire, b: PlageHoraire): boolean {
  if (a.weekday !== b.weekday) return false;
  const debutA = minutesDepuisMinuit(a.startTime);
  const finA = minutesDepuisMinuit(a.endTime);
  const debutB = minutesDepuisMinuit(b.startTime);
  const finB = minutesDepuisMinuit(b.endTime);
  if (debutA === null || finA === null || debutB === null || finB === null) return false;
  // Bornes demi-ouvertes : 8h–12h et 12h–18h s'enchaînent sans se chevaucher.
  return debutA < finB && debutB < finA;
}

/** @example formatHeure("08:00:00") → "8h" · formatHeure("08:30") → "8h30" */
export function formatHeure(heure: string): string {
  const minutes = minutesDepuisMinuit(heure);
  if (minutes === null) return heure;
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  return min === 0 ? `${h}h` : `${h}h${String(min).padStart(2, "0")}`;
}

/** @example formatPlageHoraire("08:00","12:00") → "8h – 12h" */
export function formatPlageHoraire(debut: string, fin: string): string {
  return `${formatHeure(debut)} – ${formatHeure(fin)}`;
}

/**
 * Libellé proposé à la création d'un modèle. L'exploitant peut le remplacer,
 * mais il n'a jamais de champ vide à remplir pour avancer.
 *
 * @example libelleParDefaut("08:00","12:00") → "Matin (8h – 12h)"
 */
export function libelleParDefaut(debut: string, fin: string): string {
  const plage = formatPlageHoraire(debut, fin);
  const debutMin = minutesDepuisMinuit(debut);
  const finMin = minutesDepuisMinuit(fin);
  if (debutMin === null || finMin === null) return plage;

  if (finMin <= 13 * 60) return `Matin (${plage})`;
  if (debutMin >= 12 * 60) return `Après-midi (${plage})`;
  return `Journée (${plage})`;
}
