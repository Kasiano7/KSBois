import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { addDays, isoWeekday, slotOccupancy, type SlotOccupancy } from "@/domain/slots";
import { getOrderSettings } from "./reglages";
import { aujourdHui } from "./creneaux";

/**
 * Lectures de l'écran créneaux — docs/05-ADMIN.md §6.2
 *
 * Deux objets distincts, souvent confondus :
 *   - les MODÈLES (`slot_templates`) décrivent les journées de travail
 *     habituelles : « le mardi matin, 6 livraisons, 18 m³ » ;
 *   - les CRÉNEAUX (`delivery_slots`) sont les dates réelles engendrées à partir
 *     de ces modèles, avec leur remplissage.
 *
 * Modifier un modèle ne touche PAS aux créneaux déjà générés — c'est voulu :
 * une commande déjà réservée ne doit pas voir sa capacité changer sous elle.
 * L'écran doit donc le dire, et permettre l'ajustement ponctuel d'une date.
 */

export interface ModeleCreneau {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  label: string;
  maxDeliveries: number;
  maxVolumeM3: number;
  vehicleId: string | null;
  vehiculeNom: string | null;
  zoneIds: string[];
  zonesNoms: string[];
  active: boolean;
}

export interface CreneauCalendrier {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  maxDeliveries: number;
  maxVolumeM3: number;
  bookedDeliveries: number;
  bookedVolumeM3: number;
  ouvert: boolean;
  motifFermeture: string | null;
  /** Fermé par une période bloquée : se rouvrira en supprimant la fermeture. */
  fermeParFermeture: boolean;
  vehiculeNom: string | null;
  zonesNoms: string[];
  occupation: SlotOccupancy;
}

export interface JourneeCalendrier {
  date: string;
  creneaux: CreneauCalendrier[];
  volumeReserveM3: number;
  livraisonsReservees: number;
}

export interface FermetureAdmin {
  id: string;
  debut: string;
  fin: string;
  motif: string | null;
  zoneIds: string[];
  zonesNoms: string[];
  /** Nombre de créneaux effectivement fermés par cette période. */
  creneauxFermes: number;
}

export interface EtatGeneration {
  /** Dernière date couverte par les créneaux générés. */
  derniereDate: string | null;
  /** Dernière date que la réservation en ligne peut atteindre. */
  horizonSouhaite: string;
  bookingHorizonDays: number;
  leadTimeDays: number;
  /** Des jours réservables ne sont pas encore générés. */
  generationNecessaire: boolean;
  /** Premier jour proposable au client, délai de préparation compris. */
  premierJourProposable: string;
  /** Plus petite commande possible : en dessous, un créneau ne sert plus à rien. */
  minVolumeM3: number;
}

interface ZoneSimple {
  id: string;
  nom: string;
}

/** Noms de zones et de véhicules, pour traduire des identifiants en mots. */
async function referentiels(companyId: string) {
  const supabase = createSupabaseAdminClient();
  const [{ data: zones }, { data: vehicules }] = await Promise.all([
    supabase
      .from("delivery_zones")
      .select("id, name, is_active")
      .eq("company_id", companyId)
      .order("sort_order"),
    supabase
      .from("vehicles")
      .select("id, name, capacity_m3, is_active")
      .eq("company_id", companyId)
      .order("capacity_m3"),
  ]);

  return {
    zones: (zones ?? []).map((z) => ({
      id: z.id,
      nom: z.name,
      active: z.is_active,
    })),
    vehicules: (vehicules ?? []).map((v) => ({
      id: v.id,
      nom: v.name,
      capaciteM3: Number(v.capacity_m3),
      active: v.is_active,
    })),
  };
}

export type Referentiels = Awaited<ReturnType<typeof referentiels>>;

export async function listerReferentiels(companyId: string): Promise<Referentiels> {
  return referentiels(companyId);
}

function nomsDeZones(ids: string[], zones: ZoneSimple[]): string[] {
  return ids.map((id) => zones.find((z) => z.id === id)?.nom ?? "zone supprimée");
}

export async function listerModeles(
  companyId: string,
  refs: Referentiels,
): Promise<ModeleCreneau[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("slot_templates")
    .select(
      `id, weekday, start_time, end_time, label, max_deliveries, max_volume_m3,
       vehicle_id, zone_ids, is_active`,
    )
    .eq("company_id", companyId)
    .order("weekday")
    .order("start_time");

  if (error) {
    console.error("[creneaux] listerModeles :", error.message);
    return [];
  }

  return (data ?? []).map((m) => ({
    id: m.id,
    weekday: m.weekday,
    startTime: m.start_time,
    endTime: m.end_time,
    label: m.label,
    maxDeliveries: m.max_deliveries,
    maxVolumeM3: Number(m.max_volume_m3),
    vehicleId: m.vehicle_id,
    vehiculeNom: refs.vehicules.find((v) => v.id === m.vehicle_id)?.nom ?? null,
    zoneIds: m.zone_ids ?? [],
    zonesNoms: nomsDeZones(m.zone_ids ?? [], refs.zones),
    active: m.is_active,
  }));
}

/**
 * Calendrier des prochaines semaines, groupé par journée.
 *
 * On part d'aujourd'hui et non du premier jour proposable : l'exploitant a
 * besoin de voir ce qui est déjà réservé cette semaine, même si ces dates ne
 * sont plus commandables en ligne.
 */
export async function listerCalendrier(
  companyId: string,
  refs: Referentiels,
  semaines = 8,
): Promise<JourneeCalendrier[]> {
  const debut = aujourdHui();
  const fin = addDays(debut, semaines * 7);

  const { data, error } = await createSupabaseAdminClient()
    .from("delivery_slots")
    .select(
      `id, date, start_time, end_time, label, max_deliveries, max_volume_m3,
       booked_deliveries, booked_volume_m3, is_open, closed_reason,
       closed_by_blackout_id, vehicle_id, zone_ids`,
    )
    .eq("company_id", companyId)
    .gte("date", debut)
    .lte("date", fin)
    .order("date")
    .order("start_time");

  if (error) {
    console.error("[creneaux] listerCalendrier :", error.message);
    return [];
  }

  const journees = new Map<string, JourneeCalendrier>();

  for (const s of data ?? []) {
    const creneau: CreneauCalendrier = {
      id: s.id,
      date: s.date,
      startTime: s.start_time,
      endTime: s.end_time,
      label: s.label,
      maxDeliveries: s.max_deliveries,
      maxVolumeM3: Number(s.max_volume_m3),
      bookedDeliveries: s.booked_deliveries,
      bookedVolumeM3: Number(s.booked_volume_m3),
      ouvert: s.is_open,
      motifFermeture: s.closed_reason,
      fermeParFermeture: s.closed_by_blackout_id !== null,
      vehiculeNom: refs.vehicules.find((v) => v.id === s.vehicle_id)?.nom ?? null,
      zonesNoms: nomsDeZones(s.zone_ids ?? [], refs.zones),
      occupation: slotOccupancy({
        maxDeliveries: s.max_deliveries,
        maxVolumeM3: Number(s.max_volume_m3),
        bookedDeliveries: s.booked_deliveries,
        bookedVolumeM3: Number(s.booked_volume_m3),
      }),
    };

    const journee = journees.get(s.date) ?? {
      date: s.date,
      creneaux: [],
      volumeReserveM3: 0,
      livraisonsReservees: 0,
    };
    journee.creneaux.push(creneau);
    journee.volumeReserveM3 =
      Math.round((journee.volumeReserveM3 + creneau.bookedVolumeM3) * 1000) / 1000;
    journee.livraisonsReservees += creneau.bookedDeliveries;
    journees.set(s.date, journee);
  }

  return [...journees.values()];
}

export interface SemaineCalendrier {
  /** Lundi de la semaine, au format ISO. */
  debut: string;
  journees: JourneeCalendrier[];
}

/**
 * Regroupe les journées par semaine civile.
 *
 * Une liste de dates à plat sur huit semaines est illisible ; l'exploitant
 * raisonne en semaines de travail (docs/05 §6.2).
 */
export function grouperParSemaine(journees: JourneeCalendrier[]): SemaineCalendrier[] {
  const semaines = new Map<string, JourneeCalendrier[]>();

  for (const journee of journees) {
    const lundi = addDays(journee.date, -(isoWeekday(journee.date) - 1));
    const liste = semaines.get(lundi) ?? [];
    liste.push(journee);
    semaines.set(lundi, liste);
  }

  return [...semaines.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([debut, liste]) => ({ debut, journees: liste }));
}

export async function listerFermetures(
  companyId: string,
  refs: Referentiels,
): Promise<FermetureAdmin[]> {
  const supabase = createSupabaseAdminClient();
  const today = aujourdHui();

  // Les fermetures passées n'ont plus d'usage : on garde celles en cours et à
  // venir, pour ne pas noyer l'écran sous l'historique des congés.
  const [{ data, error }, { data: creneauxFermes }] = await Promise.all([
    supabase
      .from("slot_blackouts")
      .select("id, start_date, end_date, reason, applies_to_zone_ids")
      .eq("company_id", companyId)
      .gte("end_date", today)
      .order("start_date"),
    supabase
      .from("delivery_slots")
      .select("closed_by_blackout_id")
      .eq("company_id", companyId)
      .not("closed_by_blackout_id", "is", null),
  ]);

  if (error) {
    console.error("[creneaux] listerFermetures :", error.message);
    return [];
  }

  const comptes = new Map<string, number>();
  for (const c of creneauxFermes ?? []) {
    const id = c.closed_by_blackout_id;
    if (id) comptes.set(id, (comptes.get(id) ?? 0) + 1);
  }

  return (data ?? []).map((f) => ({
    id: f.id,
    debut: f.start_date,
    fin: f.end_date,
    motif: f.reason,
    zoneIds: f.applies_to_zone_ids ?? [],
    zonesNoms: nomsDeZones(f.applies_to_zone_ids ?? [], refs.zones),
    creneauxFermes: comptes.get(f.id) ?? 0,
  }));
}

/**
 * Les créneaux sont-ils générés assez loin ?
 *
 * Piège silencieux : la génération est idempotente mais ponctuelle. Sans elle,
 * l'horizon recule d'un jour par jour qui passe, jusqu'à ce que plus aucun
 * créneau ne soit proposé au client — sans aucun message d'erreur nulle part.
 */
export async function etatGeneration(companyId: string): Promise<EtatGeneration> {
  const [reglages, { data }] = await Promise.all([
    getOrderSettings(companyId),
    createSupabaseAdminClient()
      .from("delivery_slots")
      .select("date")
      .eq("company_id", companyId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const today = aujourdHui();
  const horizonSouhaite = addDays(today, reglages.bookingHorizonDays);
  const derniereDate = data?.date ?? null;

  return {
    derniereDate,
    horizonSouhaite,
    bookingHorizonDays: reglages.bookingHorizonDays,
    leadTimeDays: reglages.leadTimeDays,
    // Une semaine de marge : on n'alarme pas l'exploitant pour un jour d'écart,
    // le cron hebdomadaire rattrape de toute façon.
    generationNecessaire: derniereDate === null || derniereDate < addDays(horizonSouhaite, -7),
    premierJourProposable: addDays(today, reglages.leadTimeDays),
    minVolumeM3: reglages.minVolumeM3,
  };
}
