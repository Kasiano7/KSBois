"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { uuidLike } from "@/lib/validation";
import { formatDateCreneau } from "@/server/creneaux";
import { envoyerEmail } from "@/server/notifications";
import { emettreFactureCommande } from "@/server/factures";
import { envoyerLivraisonEffectuee } from "@/server/notifications-exploitation";
import { LivraisonConfirmee } from "@/emails/livraison-confirmee";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  canTransition,
  holdsStock,
  shortestPath,
  type OrderStatus,
} from "@/domain/orders/state-machine";

/**
 * Actions d'administration sur les commandes.
 *
 * Chaque action commence par `assertRole()` : aucun contrôle implicite.
 * Chaque transition de statut est validée contre la machine à états, jamais
 * écrite directement, et journalisée dans `order_status_history`.
 */

export interface ResultatAdmin {
  ok: boolean;
  message?: string;
  /** Renseigné quand l'action déclenche une notification client. */
  emailEnvoye?: boolean;
}

const ChangementSchema = z.object({
  orderId: uuidLike,
  nouveauStatut: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export async function changerStatutCommande(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = ChangementSchema.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const supabase = createSupabaseAdminClient();
  const { orderId, nouveauStatut, note } = parsed.data;

  const { data: commande } = await supabase
    .from("orders")
    .select("id, status, payment_status, total_cents, amount_paid_cents")
    .eq("id", orderId)
    .eq("company_id", session.companyId)
    .maybeSingle();

  if (!commande) return { ok: false, message: "Commande introuvable." };

  const ancien = commande.status as OrderStatus;

  // Chemin légal vers l'état demandé : le livreur qui marque « livrée » depuis
  // « à préparer » passe automatiquement par « prête », chaque étape journalisée.
  const chemin = shortestPath(ancien, nouveauStatut);

  if (chemin === null) {
    return {
      ok: false,
      message: `Une commande « ${ORDER_STATUS_LABELS[ancien]} » ne peut pas passer à « ${ORDER_STATUS_LABELS[nouveauStatut]} ».`,
    };
  }
  if (chemin.length === 0) return { ok: true };

  // Passage à « livrée » : on décrémente réellement le stock, dans la même
  // transaction que le mouvement (fonction Postgres).
  if (nouveauStatut === "livree" && holdsStock(ancien)) {
    const { error } = await supabase.rpc("ship_order_stock", { p_order_id: orderId });
    if (error) {
      console.error("[admin] ship_order_stock :", error.message);
      return { ok: false, message: "Le stock n'a pas pu être mis à jour." };
    }
  }

  // Annulation : on rend le stock et on libère le créneau.
  if (nouveauStatut === "annulee" && holdsStock(ancien)) {
    await supabase.rpc("release_order_stock", { p_order_id: orderId });
    await supabase.rpc("release_slot", { p_order_id: orderId });
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: nouveauStatut })
    .eq("id", orderId);

  if (error) return { ok: false, message: "Mise à jour impossible." };

  // Facturation automatique à la livraison.
  //
  // La livraison est le fait générateur : c'est à ce moment que la vente est
  // réalisée et que la facture est due. L'émission est idempotente, donc un
  // passage rejoué ne crée pas de doublon. Elle n'est PAS bloquante : si elle
  // échoue, la commande reste livrée et le stock reste décrémenté — le gérant
  // rattrape depuis la fiche commande. Perdre la livraison parce qu'une facture
  // n'a pas pu s'écrire serait le pire des deux maux.
  if (nouveauStatut === "livree") {
    const facturation = await emettreFactureCommande(session.companyId, orderId);
    if (!facturation.ok) {
      console.error(`[admin] facture non émise pour ${orderId} : ${facturation.message}`);
    }
    // L'email part APRÈS la facture, pour pouvoir la joindre. Il ne bloque pas
    // davantage : `envoyerLivraisonEffectuee` avale ses propres erreurs.
    await envoyerLivraisonEffectuee(orderId);
  }

  // Une entrée d'historique par étape franchie : l'historique reste fidèle même
  // quand l'action a emprunté un chemin de deux transitions.
  let precedent = ancien;
  for (const etape of chemin) {
    await supabase.from("order_status_history").insert({
      company_id: session.companyId,
      order_id: orderId,
      from_status: precedent,
      to_status: etape,
      changed_by: session.userId,
      actor: "admin",
      note: etape === nouveauStatut ? (note ?? null) : "Étape franchie automatiquement",
    });
    precedent = etape;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/tournee");

  return { ok: true };
}

const ConfirmationSchema = z.object({
  orderId: uuidLike,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  creneau: z.string().trim().min(1, "Indiquez un créneau.").max(80),
});

/**
 * Confirme la date de livraison au client.
 *
 * C'est l'action pivot du modèle en deux temps : le client a exprimé un
 * souhait, l'entreprise s'engage (docs/02 §3.1). Elle déclenchera l'email et le
 * SMS de confirmation quand Resend sera branché.
 */
export async function confirmerLivraison(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const tenant = await requireTenant();
  const parsed = ConfirmationSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const supabase = createSupabaseAdminClient();
  const { orderId, date, creneau } = parsed.data;

  const { data: commande } = await supabase
    .from("orders")
    .select(
      `id, status, reference, email, first_name, phone, total_cents, amount_paid_cents,
       payment_method, payment_status, total_volume_m3, shipping_address`,
    )
    .eq("id", orderId)
    .eq("company_id", session.companyId)
    .maybeSingle();

  if (!commande) return { ok: false, message: "Commande introuvable." };

  const { error } = await supabase
    .from("orders")
    .update({ confirmed_delivery_date: date, confirmed_slot_label: creneau })
    .eq("id", orderId);

  if (error) return { ok: false, message: "Mise à jour impossible." };

  // La confirmation fait passer la commande en « planifiée » quand c'est permis.
  const ancien = commande.status as OrderStatus;
  if (canTransition(ancien, "planifiee")) {
    await supabase.from("orders").update({ status: "planifiee" }).eq("id", orderId);
    await supabase.from("order_status_history").insert({
      company_id: session.companyId,
      order_id: orderId,
      from_status: ancien,
      to_status: "planifiee",
      changed_by: session.userId,
      actor: "admin",
      note: `Livraison confirmée le ${date} — ${creneau}`,
    });
  }

  // --- Email « votre livraison est confirmée » : le message qui engage ---
  const adresse = (commande.shipping_address ?? {}) as { line1?: string; city?: string };
  const resteAPayer =
    commande.payment_status === "paid"
      ? 0
      : commande.total_cents - (commande.amount_paid_cents ?? 0);

  const envoi = await envoyerEmail({
    companyId: session.companyId,
    destinataire: commande.email,
    sujet: `Votre livraison est confirmée — ${formatDateCreneau(date)}`,
    modele: "livraison_confirmee",
    orderId: commande.id,
    contenu: LivraisonConfirmee({
      entreprise: tenant.name,
      telephone: tenant.phoneDisplay ?? tenant.phone,
      reference: commande.reference,
      prenom: commande.first_name ?? "",
      dateLisible: formatDateCreneau(date),
      creneau,
      volumeM3: Number(commande.total_volume_m3),
      adresse: adresse.line1 ?? "",
      ville: adresse.city ?? "",
      modePaiement: commande.payment_method ?? "cash",
      resteAPayerCents: resteAPayer,
    }),
  });

  // TODO : SMS de confirmation puis rappel la veille (docs/02 §9.1).

  revalidatePath("/admin");
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/tournee");

  return { ok: true, emailEnvoye: envoi.envoye };
}

const PaiementSchema = z.object({
  orderId: uuidLike,
  method: z.enum(["card", "cash", "check", "transfer", "sumup"]),
  amountCents: z.coerce.number().int().positive("Montant invalide."),
  reference: z.string().trim().max(120).optional(),
});

/** Enregistre un encaissement (chèque reçu, espèces au camion, virement arrivé). */
export async function enregistrerPaiement(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = PaiementSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const supabase = createSupabaseAdminClient();
  const { orderId, method, amountCents, reference } = parsed.data;

  const { data: commande } = await supabase
    .from("orders")
    .select("id, total_cents, amount_paid_cents, status")
    .eq("id", orderId)
    .eq("company_id", session.companyId)
    .maybeSingle();

  if (!commande) return { ok: false, message: "Commande introuvable." };

  const { error } = await supabase.from("payments").insert({
    company_id: session.companyId,
    order_id: orderId,
    method,
    kind: "full",
    amount_cents: amountCents,
    status: "succeeded",
    received_at: new Date().toISOString(),
    recorded_by: session.userId,
    reference: reference ?? null,
  });

  if (error) {
    console.error("[admin] enregistrerPaiement :", error.message);
    return { ok: false, message: "Enregistrement impossible." };
  }

  const totalPaye = commande.amount_paid_cents + amountCents;
  await supabase
    .from("orders")
    .update({
      amount_paid_cents: totalPaye,
      payment_status: totalPaye >= commande.total_cents ? "paid" : "deposit_paid",
    })
    .eq("id", orderId);

  revalidatePath("/admin");
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/tournee");

  return { ok: true };
}

const OrdreSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ordre: z.array(uuidLike).max(60),
});

/**
 * Réordonnancement de la tournée.
 * L'ordre est stocké dans `internal_notes` ? Non : il mérite sa colonne.
 * En attendant, on l'écrit dans une table dédiée créée par migration.
 */
export async function reordonnerTournee(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner", "staff", "driver"]);
  const parsed = OrdreSchema.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const supabase = createSupabaseAdminClient();

  // Écriture séquentielle : la tournée compte au plus une dizaine d'arrêts.
  for (const [index, orderId] of parsed.data.ordre.entries()) {
    await supabase
      .from("orders")
      .update({ route_position: index + 1 })
      .eq("id", orderId)
      .eq("company_id", session.companyId)
      .eq("confirmed_delivery_date", parsed.data.date);
  }

  revalidatePath("/admin/tournee");
  return { ok: true };
}
