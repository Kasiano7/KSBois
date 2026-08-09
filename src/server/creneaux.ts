import "server-only";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { availableSlots, type Blackout, type Slot, type SlotAvailability } from "@/domain/slots";
import { formatDateFr } from "@/lib/jours";
import { getOrderSettings } from "./reglages";

/**
 * Accès aux créneaux de livraison.
 *
 * Toute la logique de disponibilité vit dans `@/domain/slots`, testée à part.
 * Cette couche ne fait que charger les données et injecter le contexte —
 * y compris la date du jour, que le domaine ne lit jamais lui-même.
 */

/** Date du jour dans le fuseau de l'entreprise, au format « AAAA-MM-JJ ». */
export function aujourdHui(timeZone = "Europe/Paris"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function listerCreneauxDisponibles(params: {
  companyId: string;
  volumeM3: number;
  zoneId: string | null;
  joursAutorises: number[];
  leadTimeDaysZone?: number | null;
}): Promise<SlotAvailability[]> {
  const supabase = await createSupabaseServerClient();
  const reglages = await getOrderSettings(params.companyId);
  const today = aujourdHui();

  const [{ data: slots }, { data: blackouts }] = await Promise.all([
    supabase
      .from("delivery_slots")
      .select(
        `id, date, start_time, end_time, label, max_deliveries, max_volume_m3,
         booked_deliveries, booked_volume_m3, is_open, zone_ids, vehicle_id`,
      )
      .eq("company_id", params.companyId)
      .eq("is_open", true)
      .gte("date", today)
      .order("date")
      .order("start_time"),
    supabase
      .from("slot_blackouts")
      .select("start_date, end_date, reason, applies_to_zone_ids")
      .eq("company_id", params.companyId)
      .gte("end_date", today),
  ]);

  const creneaux: Slot[] = (slots ?? []).map((s) => ({
    id: s.id,
    date: s.date,
    startTime: s.start_time,
    endTime: s.end_time,
    label: s.label,
    maxDeliveries: s.max_deliveries,
    maxVolumeM3: Number(s.max_volume_m3),
    bookedDeliveries: s.booked_deliveries,
    bookedVolumeM3: Number(s.booked_volume_m3),
    isOpen: s.is_open,
    zoneIds: s.zone_ids ?? [],
    vehicleId: s.vehicle_id,
  }));

  const fermetures: Blackout[] = (blackouts ?? []).map((b) => ({
    startDate: b.start_date,
    endDate: b.end_date,
    reason: b.reason,
    zoneIds: b.applies_to_zone_ids ?? [],
  }));

  return availableSlots(creneaux, {
    today,
    // La zone peut imposer un délai plus long que le réglage global.
    leadTimeDays: params.leadTimeDaysZone ?? reglages.leadTimeDays,
    bookingHorizonDays: reglages.bookingHorizonDays,
    orderVolumeM3: params.volumeM3,
    zoneId: params.zoneId,
    allowedWeekdays: params.joursAutorises,
    blackouts: fermetures,
  });
}

/** Regroupe les créneaux par date, pour un affichage en liste verticale. */
export function grouperParDate(
  creneaux: SlotAvailability[],
): { date: string; creneaux: SlotAvailability[] }[] {
  const parDate = new Map<string, SlotAvailability[]>();
  for (const c of creneaux) {
    const liste = parDate.get(c.slot.date) ?? [];
    liste.push(c);
    parDate.set(c.slot.date, liste);
  }
  return [...parDate.entries()].map(([date, liste]) => ({ date, creneaux: liste }));
}

/** « mardi 13 octobre » — la liste de dates bat le calendrier mensuel (docs/02 §3.3). */
export function formatDateCreneau(dateIso: string): string {
  return formatDateFr(dateIso);
}

/** Vérifie qu'un créneau appartient bien à l'entreprise avant réservation. */
export async function creneauAppartientAuTenant(
  companyId: string,
  slotId: string,
): Promise<boolean> {
  const { data } = await createSupabaseAdminClient()
    .from("delivery_slots")
    .select("id")
    .eq("id", slotId)
    .eq("company_id", companyId)
    .maybeSingle();
  return Boolean(data);
}
