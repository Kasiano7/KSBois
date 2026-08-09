"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth";
import { uuidLike } from "@/lib/validation";
import { getOrderSettings } from "@/server/reglages";
import { aujourdHui } from "@/server/creneaux";
import {
  addDays,
  minutesDepuisMinuit,
  plagesSeChevauchent,
  formatPlageHoraire,
} from "@/domain/slots";
import { formatVolume } from "@/domain/units";
import { nomJour, formatDateFr } from "@/lib/jours";

/**
 * Gestion des créneaux de livraison — docs/05-ADMIN.md §6.2
 *
 * Règle structurante : la capacité d'un créneau est une PROMESSE de travail.
 * On ne la descend jamais en dessous de ce qui est déjà réservé, sinon le site
 * afficherait un créneau « complet » sur lequel des livraisons sont pourtant
 * engagées, et l'exploitant croirait sa journée libre.
 */

export interface ResultatCreneau {
  ok: boolean;
  message?: string;
}

const HEURE = z
  .string()
  .trim()
  .refine((v) => minutesDepuisMinuit(v) !== null, "Horaire invalide (par exemple 08:00).");

const DATE_ISO = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

function chemins() {
  revalidatePath("/admin/livraison/creneaux");
  revalidatePath("/admin/tournee");
  // L'étape « créneau » du tunnel lit les mêmes lignes.
  revalidatePath("/commande/creneau");
}

// -----------------------------------------------------------------------------
// Modèles récurrents
// -----------------------------------------------------------------------------

const ModeleSchema = z.object({
  weekday: z.coerce.number().int().min(1).max(7),
  startTime: HEURE,
  endTime: HEURE,
  label: z.string().trim().min(2, "Donnez un nom à ce créneau.").max(60),
  maxDeliveries: z.coerce
    .number()
    .int()
    .min(1, "Au moins une livraison.")
    .max(50, "Cinquante livraisons dans une demi-journée : vérifiez la saisie."),
  maxVolumeM3: z.coerce
    .number()
    .positive("Indiquez un volume maximum.")
    .max(500, "Volume hors limites."),
  vehicleId: uuidLike.nullable().optional(),
  zoneIds: z.array(uuidLike).max(50).default([]),
});

/** Contrôles communs à la création et à la modification d'un modèle. */
async function verifierModele(
  companyId: string,
  d: z.infer<typeof ModeleSchema>,
  modeleId?: string,
): Promise<string | null> {
  const debut = minutesDepuisMinuit(d.startTime)!;
  const fin = minutesDepuisMinuit(d.endTime)!;
  if (fin <= debut) return "L'heure de fin doit être après l'heure de début.";

  const { data: existants } = await createSupabaseAdminClient()
    .from("slot_templates")
    .select("id, weekday, start_time, end_time, label")
    .eq("company_id", companyId)
    .eq("weekday", d.weekday)
    .eq("is_active", true);

  const conflit = (existants ?? [])
    .filter((m) => m.id !== modeleId)
    .find((m) =>
      plagesSeChevauchent(
        { weekday: d.weekday, startTime: d.startTime, endTime: d.endTime },
        { weekday: m.weekday, startTime: m.start_time, endTime: m.end_time },
      ),
    );

  if (conflit) {
    return `Ce créneau chevauche « ${conflit.label} » (${formatPlageHoraire(
      conflit.start_time,
      conflit.end_time,
    )}) le ${nomJour(d.weekday)}. Ajustez les horaires ou modifiez l'existant.`;
  }

  return null;
}

export async function creerModele(entree: unknown): Promise<ResultatCreneau> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = ModeleSchema.safeParse(entree);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Requête invalide.",
    };
  }

  const probleme = await verifierModele(session.companyId, parsed.data);
  if (probleme) return { ok: false, message: probleme };

  const d = parsed.data;
  const { error } = await createSupabaseAdminClient()
    .from("slot_templates")
    .insert({
      company_id: session.companyId,
      weekday: d.weekday,
      start_time: d.startTime,
      end_time: d.endTime,
      label: d.label,
      max_deliveries: d.maxDeliveries,
      max_volume_m3: d.maxVolumeM3,
      vehicle_id: d.vehicleId ?? null,
      zone_ids: d.zoneIds,
    });

  if (error) {
    console.error("[creneaux] creerModele :", error.message);
    return { ok: false, message: "Création impossible." };
  }

  chemins();
  return {
    ok: true,
    message: `${d.label} le ${nomJour(d.weekday)} est enregistré. Générez les dates pour le proposer aux clients.`,
  };
}

export async function modifierModele(entree: unknown): Promise<ResultatCreneau> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = ModeleSchema.extend({ modeleId: uuidLike }).safeParse(entree);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Requête invalide.",
    };
  }

  const { modeleId, ...d } = parsed.data;
  const probleme = await verifierModele(session.companyId, d, modeleId);
  if (probleme) return { ok: false, message: probleme };

  const { error } = await createSupabaseAdminClient()
    .from("slot_templates")
    .update({
      weekday: d.weekday,
      start_time: d.startTime,
      end_time: d.endTime,
      label: d.label,
      max_deliveries: d.maxDeliveries,
      max_volume_m3: d.maxVolumeM3,
      vehicle_id: d.vehicleId ?? null,
      zone_ids: d.zoneIds,
    })
    .eq("id", modeleId)
    .eq("company_id", session.companyId);

  if (error) {
    console.error("[creneaux] modifierModele :", error.message);
    return { ok: false, message: "Enregistrement impossible." };
  }

  chemins();
  return {
    ok: true,
    // Dit explicitement ce que la modification NE fait PAS : les dates déjà
    // générées gardent leur ancienne capacité, et c'est volontaire.
    message: "Modèle enregistré. Les dates déjà générées conservent leur capacité actuelle.",
  };
}

const BasculeModeleSchema = z.object({
  modeleId: uuidLike,
  actif: z.coerce.boolean(),
  /** Ferme aussi les dates futures encore vides issues de ce modèle. */
  fermerDatesFutures: z.coerce.boolean().default(false),
});

export async function basculerModele(entree: unknown): Promise<ResultatCreneau> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = BasculeModeleSchema.safeParse(entree);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Requête invalide.",
    };
  }

  const { modeleId, actif, fermerDatesFutures } = parsed.data;
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("slot_templates")
    .update({ is_active: actif })
    .eq("id", modeleId)
    .eq("company_id", session.companyId);

  if (error) {
    console.error("[creneaux] basculerModele :", error.message);
    return { ok: false, message: "Enregistrement impossible." };
  }

  let fermes = 0;
  if (!actif && fermerDatesFutures) {
    // On ne ferme QUE les dates sans réservation : une livraison déjà promise
    // reste due, désactiver un modèle ne l'annule pas.
    const { data } = await supabase
      .from("delivery_slots")
      .update({
        is_open: false,
        closed_reason: "Journée de livraison supprimée",
      })
      .eq("company_id", session.companyId)
      .eq("template_id", modeleId)
      .gte("date", aujourdHui())
      .eq("booked_deliveries", 0)
      .select("id");
    fermes = data?.length ?? 0;
  }

  chemins();
  if (!actif) {
    return {
      ok: true,
      message: fermerDatesFutures
        ? `Journée désactivée. ${fermes} date${fermes > 1 ? "s" : ""} à venir fermée${fermes > 1 ? "s" : ""} — celles qui portent déjà des livraisons restent ouvertes.`
        : "Journée désactivée. Les dates déjà générées restent proposées : fermez-les depuis le calendrier si besoin.",
    };
  }
  return {
    ok: true,
    message: "Journée réactivée. Générez les dates pour la proposer.",
  };
}

// -----------------------------------------------------------------------------
// Génération des dates
// -----------------------------------------------------------------------------

/**
 * Engendre les créneaux manquants sur l'horizon de réservation.
 *
 * Idempotent côté base (`on conflict do nothing`) : relancer ne crée pas de
 * doublon et ne touche pas aux capacités ajustées à la main.
 */
export async function genererCreneaux(): Promise<ResultatCreneau> {
  const session = await assertRole(["owner", "staff"]);
  const reglages = await getOrderSettings(session.companyId);

  const { data, error } = await createSupabaseAdminClient().rpc("generate_delivery_slots", {
    p_company_id: session.companyId,
    p_horizon_days: reglages.bookingHorizonDays,
  });

  if (error) {
    console.error("[creneaux] genererCreneaux :", error.message);
    return { ok: false, message: "Génération impossible." };
  }

  const crees = typeof data === "number" ? data : 0;
  chemins();
  return {
    ok: true,
    message:
      crees === 0
        ? "Tout est déjà généré : aucune date à ajouter."
        : `${crees} date${crees > 1 ? "s" : ""} ajoutée${crees > 1 ? "s" : ""} jusqu'au ${formatDateFr(
            addDays(aujourdHui(), reglages.bookingHorizonDays),
          )}.`,
  };
}

// -----------------------------------------------------------------------------
// Ajustement d'une date précise
// -----------------------------------------------------------------------------

const CapaciteSchema = z.object({
  creneauId: uuidLike,
  maxDeliveries: z.coerce.number().int().min(0).max(50),
  maxVolumeM3: z.coerce.number().min(0).max(500),
});

export async function modifierCapaciteCreneau(entree: unknown): Promise<ResultatCreneau> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = CapaciteSchema.safeParse(entree);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Requête invalide.",
    };
  }

  const d = parsed.data;
  const supabase = createSupabaseAdminClient();

  const { data: creneau } = await supabase
    .from("delivery_slots")
    .select("booked_deliveries, booked_volume_m3, label, date")
    .eq("id", d.creneauId)
    .eq("company_id", session.companyId)
    .maybeSingle();

  if (!creneau) return { ok: false, message: "Créneau introuvable." };

  // Garde-fou : descendre la capacité sous le réservé rendrait le compteur
  // incohérent et masquerait des livraisons déjà engagées.
  if (d.maxDeliveries < creneau.booked_deliveries) {
    return {
      ok: false,
      message: `${creneau.booked_deliveries} livraison${creneau.booked_deliveries > 1 ? "s sont" : " est"} déjà réservée${creneau.booked_deliveries > 1 ? "s" : ""} sur ce créneau : le maximum ne peut pas descendre en dessous.`,
    };
  }
  if (d.maxVolumeM3 < Number(creneau.booked_volume_m3)) {
    return {
      ok: false,
      message: `${formatVolume(Number(creneau.booked_volume_m3))} sont déjà réservés sur ce créneau : le volume maximum ne peut pas descendre en dessous.`,
    };
  }

  const { error } = await supabase
    .from("delivery_slots")
    .update({ max_deliveries: d.maxDeliveries, max_volume_m3: d.maxVolumeM3 })
    .eq("id", d.creneauId)
    .eq("company_id", session.companyId);

  if (error) {
    console.error("[creneaux] modifierCapaciteCreneau :", error.message);
    return { ok: false, message: "Enregistrement impossible." };
  }

  chemins();
  return { ok: true, message: "Capacité enregistrée pour cette date." };
}

const BasculeCreneauSchema = z.object({
  creneauId: uuidLike,
  ouvert: z.coerce.boolean(),
  motif: z.string().trim().max(120).optional(),
});

export async function basculerCreneau(entree: unknown): Promise<ResultatCreneau> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = BasculeCreneauSchema.safeParse(entree);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Requête invalide.",
    };
  }

  const { creneauId, ouvert, motif } = parsed.data;
  const supabase = createSupabaseAdminClient();

  const { data: creneau } = await supabase
    .from("delivery_slots")
    .select("booked_deliveries, date, label")
    .eq("id", creneauId)
    .eq("company_id", session.companyId)
    .maybeSingle();

  if (!creneau) return { ok: false, message: "Créneau introuvable." };

  const { error } = await supabase
    .from("delivery_slots")
    .update({
      is_open: ouvert,
      closed_reason: ouvert ? null : (motif ?? "Fermé par l'entreprise"),
      // Rouvrir à la main détache le créneau de la période bloquée : sinon la
      // suppression de cette période le refermerait sans raison visible.
      closed_by_blackout_id: null,
    })
    .eq("id", creneauId)
    .eq("company_id", session.companyId);

  if (error) {
    console.error("[creneaux] basculerCreneau :", error.message);
    return { ok: false, message: "Enregistrement impossible." };
  }

  chemins();
  if (!ouvert && creneau.booked_deliveries > 0) {
    return {
      ok: true,
      message: `Créneau fermé à de nouvelles commandes. ⚠ ${creneau.booked_deliveries} livraison${creneau.booked_deliveries > 1 ? "s sont" : " est"} déjà prévue${creneau.booked_deliveries > 1 ? "s" : ""} ce jour-là : prévenez le ou les clients.`,
    };
  }
  return { ok: true, message: ouvert ? "Créneau rouvert." : "Créneau fermé." };
}

const CreneauExceptionnelSchema = z.object({
  date: DATE_ISO,
  startTime: HEURE,
  endTime: HEURE,
  label: z.string().trim().min(2, "Donnez un nom à ce créneau.").max(60),
  maxDeliveries: z.coerce.number().int().min(1).max(50),
  maxVolumeM3: z.coerce.number().positive().max(500),
  vehicleId: uuidLike.nullable().optional(),
});

/** Un samedi exceptionnel, une journée de rattrapage : hors modèle récurrent. */
export async function ajouterCreneauExceptionnel(entree: unknown): Promise<ResultatCreneau> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = CreneauExceptionnelSchema.safeParse(entree);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Requête invalide.",
    };
  }

  const d = parsed.data;
  if (minutesDepuisMinuit(d.endTime)! <= minutesDepuisMinuit(d.startTime)!) {
    return {
      ok: false,
      message: "L'heure de fin doit être après l'heure de début.",
    };
  }
  if (d.date < aujourdHui()) {
    return { ok: false, message: "Cette date est déjà passée." };
  }

  const { error } = await createSupabaseAdminClient()
    .from("delivery_slots")
    .insert({
      company_id: session.companyId,
      // Aucun modèle : ce créneau ne sera pas régénéré ni écrasé.
      template_id: null,
      date: d.date,
      start_time: d.startTime,
      end_time: d.endTime,
      label: d.label,
      max_deliveries: d.maxDeliveries,
      max_volume_m3: d.maxVolumeM3,
      vehicle_id: d.vehicleId ?? null,
    });

  if (error) {
    console.error("[creneaux] ajouterCreneauExceptionnel :", error.message);
    return {
      ok: false,
      message: error.message.includes("duplicate")
        ? "Un créneau existe déjà à cette date et à cet horaire."
        : "Ajout impossible.",
    };
  }

  chemins();
  return { ok: true, message: `${d.label} ajouté le ${formatDateFr(d.date)}.` };
}

// -----------------------------------------------------------------------------
// Fermetures (congés, intempéries)
// -----------------------------------------------------------------------------

const FermetureSchema = z
  .object({
    debut: DATE_ISO,
    fin: DATE_ISO,
    motif: z.string().trim().min(2, "Indiquez le motif (congés, intempéries…).").max(120),
    zoneIds: z.array(uuidLike).max(50).default([]),
  })
  .refine((d) => d.fin >= d.debut, {
    message: "La date de fin doit être après la date de début.",
    path: ["fin"],
  });

/**
 * Bloque une période ET ferme les créneaux déjà générés dessus.
 *
 * Sans cette seconde partie, la fermeture n'aurait aucun effet sur les 45 jours
 * déjà en base : le moteur de disponibilité écarte bien les dates bloquées côté
 * client, mais la réservation (`book_slot`) ne regarde que `is_open`, et
 * l'exploitant verrait ses journées de congé encore ouvertes dans son propre
 * calendrier. On ferme donc réellement.
 */
export async function bloquerPeriode(entree: unknown): Promise<ResultatCreneau> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = FermetureSchema.safeParse(entree);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Requête invalide.",
    };
  }

  const d = parsed.data;
  const supabase = createSupabaseAdminClient();

  const { data: fermeture, error } = await supabase
    .from("slot_blackouts")
    .insert({
      company_id: session.companyId,
      start_date: d.debut,
      end_date: d.fin,
      reason: d.motif,
      applies_to_zone_ids: d.zoneIds,
    })
    .select("id")
    .single();

  if (error || !fermeture) {
    console.error("[creneaux] bloquerPeriode :", error?.message);
    return { ok: false, message: "Enregistrement impossible." };
  }

  let requete = supabase
    .from("delivery_slots")
    .update({
      is_open: false,
      closed_reason: d.motif,
      closed_by_blackout_id: fermeture.id,
    })
    .eq("company_id", session.companyId)
    .eq("is_open", true)
    .gte("date", d.debut)
    .lte("date", d.fin);

  // Fermeture ciblée : seuls les créneaux réservés à ces zones sont concernés.
  // Un créneau ouvert à toutes les zones reste ouvert — il sert les autres.
  if (d.zoneIds.length > 0) requete = requete.overlaps("zone_ids", d.zoneIds);

  const { data: fermes } = await requete.select("id, booked_deliveries");

  const nb = fermes?.length ?? 0;
  const avecLivraisons = (fermes ?? []).filter((c) => c.booked_deliveries > 0);
  const livraisons = avecLivraisons.reduce((t, c) => t + c.booked_deliveries, 0);

  chemins();

  let message = `Période bloquée. ${nb} créneau${nb > 1 ? "x" : ""} fermé${nb > 1 ? "s" : ""}.`;
  if (livraisons > 0) {
    message += ` ⚠ ${livraisons} livraison${livraisons > 1 ? "s" : ""} déjà prévue${livraisons > 1 ? "s" : ""} sur cette période : à replanifier depuis les commandes.`;
  }
  return { ok: true, message };
}

export async function supprimerFermeture(entree: unknown): Promise<ResultatCreneau> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = z.object({ fermetureId: uuidLike }).safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: "Requête invalide." };
  }

  const supabase = createSupabaseAdminClient();
  const { fermetureId } = parsed.data;

  // Réouverture AVANT suppression : la contrainte `on delete set null` effacerait
  // le lien, et on ne saurait plus quels créneaux rouvrir.
  const { data: rouverts } = await supabase
    .from("delivery_slots")
    .update({ is_open: true, closed_reason: null, closed_by_blackout_id: null })
    .eq("company_id", session.companyId)
    .eq("closed_by_blackout_id", fermetureId)
    .select("id");

  const { error } = await supabase
    .from("slot_blackouts")
    .delete()
    .eq("id", fermetureId)
    .eq("company_id", session.companyId);

  if (error) {
    console.error("[creneaux] supprimerFermeture :", error.message);
    return { ok: false, message: "Suppression impossible." };
  }

  const nb = rouverts?.length ?? 0;
  chemins();
  return {
    ok: true,
    message:
      nb === 0
        ? "Fermeture supprimée."
        : `Fermeture supprimée, ${nb} créneau${nb > 1 ? "x rouverts" : " rouvert"}.`,
  };
}
