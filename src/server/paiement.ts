import "server-only";

import type Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { canTransition, type OrderStatus } from "@/domain/orders/state-machine";
import { envoyerConfirmationCommande } from "./notifications-commande";
import {
  enregistrerEvenementAnalytics,
  getSessionIdCommande,
} from "./analytics";

/**
 * Paiement par carte — docs/02-MOTEURS-METIER.md §6.2
 *
 * Principe non négociable : **le navigateur ne décide jamais qu'une commande est
 * payée.** Deux chemins d'application, tous deux côté serveur :
 *
 *  1. Le WEBHOOK Stripe, signé — chemin principal et seule source de vérité en
 *     production.
 *  2. Une VÉRIFICATION DIRECTE auprès de l'API Stripe après confirmation du
 *     client, utilisée en secours quand le webhook n'est pas encore configuré
 *     (développement local sans `stripe listen`) ou quand il tarde.
 *
 * Les deux appellent la même fonction `appliquerPaiementReussi`, qui est
 * idempotente : la rejouer ne double ni le paiement ni le mouvement de stock.
 */

export interface IntentionPaiement {
  clientSecret: string;
  publishableKey: string;
  montantCents: number;
}

/**
 * Crée (ou récupère) l'intention de paiement d'une commande.
 *
 * Réutilise une intention existante et encore ouverte : sans cela, un client qui
 * recharge la page de paiement créerait des intentions en série.
 */
export async function creerIntentionPaiement(
  companyId: string,
  orderId: string,
): Promise<IntentionPaiement> {
  const supabase = createSupabaseAdminClient();
  const stripe = getStripe();

  const { data: commande } = await supabase
    .from("orders")
    .select("id, reference, email, total_cents, deposit_required_cents, payment_status")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!commande) throw new Error("Commande introuvable.");
  if (commande.payment_status === "paid") throw new Error("Cette commande est déjà payée.");

  // Acompte le cas échéant : on n'encaisse en ligne que ce qui est dû maintenant.
  const montantCents =
    commande.deposit_required_cents > 0 ? commande.deposit_required_cents : commande.total_cents;

  const { data: paiementExistant } = await supabase
    .from("payments")
    .select("stripe_payment_intent_id")
    .eq("order_id", orderId)
    .eq("method", "card")
    .not("stripe_payment_intent_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paiementExistant?.stripe_payment_intent_id) {
    const existante = await stripe.paymentIntents.retrieve(
      paiementExistant.stripe_payment_intent_id,
    );
    // On ne réutilise que si le montant n'a pas bougé et l'intention est ouverte.
    if (
      existante.client_secret &&
      existante.amount === montantCents &&
      ["requires_payment_method", "requires_confirmation", "requires_action", "processing"].includes(
        existante.status,
      )
    ) {
      return {
        clientSecret: existante.client_secret,
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
        montantCents,
      };
    }
  }

  const intention = await stripe.paymentIntents.create(
    {
      amount: montantCents,
      currency: "eur",
      // `metadata` est ce qui permet au webhook de retrouver la commande.
      metadata: { order_id: orderId, company_id: companyId, reference: commande.reference },
      receipt_email: commande.email,
      description: `Bois de chauffage — commande ${commande.reference}`,
      automatic_payment_methods: { enabled: true },
    },
    // Idempotence Stripe : un double appel (double clic, rechargement) ne crée
    // pas deux intentions pour le même montant.
    { idempotencyKey: `order-${orderId}-${montantCents}` },
  );

  const { error } = await supabase.from("payments").insert({
    company_id: companyId,
    order_id: orderId,
    method: "card",
    kind: commande.deposit_required_cents > 0 ? "deposit" : "full",
    amount_cents: montantCents,
    status: "pending",
    stripe_payment_intent_id: intention.id,
  });

  // Une intention déjà enregistrée (course entre deux onglets) n'est pas une erreur.
  if (error && !error.message.includes("duplicate")) {
    console.error("[paiement] enregistrement de l'intention :", error.message);
  }

  if (!intention.client_secret) throw new Error("Stripe n'a pas renvoyé de secret client.");

  return {
    clientSecret: intention.client_secret,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    montantCents,
  };
}

export type ResultatApplication =
  | { applique: true; dejaFait: boolean; reference: string }
  | { applique: false; raison: string };

/**
 * Marque une commande payée. **Idempotente.**
 *
 * Appelée par le webhook signé ET par la vérification directe. Elle recharge
 * toujours l'état depuis la base avant d'agir, donc deux appels concurrents ne
 * produisent qu'un seul effet.
 */
export async function appliquerPaiementReussi(
  intention: Stripe.PaymentIntent,
): Promise<ResultatApplication> {
  const orderId = intention.metadata?.order_id;
  if (!orderId) return { applique: false, raison: "Intention sans order_id." };

  const supabase = createSupabaseAdminClient();

  const { data: commande } = await supabase
    .from("orders")
    .select("id, reference, company_id, status, payment_status, total_cents, amount_paid_cents")
    .eq("id", orderId)
    .maybeSingle();

  if (!commande) return { applique: false, raison: `Commande ${orderId} introuvable.` };

  const { data: paiement } = await supabase
    .from("payments")
    .select("id, status, amount_cents")
    .eq("stripe_payment_intent_id", intention.id)
    .maybeSingle();

  // Déjà traité : on sort sans rien refaire. C'est le cœur de l'idempotence.
  if (paiement?.status === "succeeded") {
    return { applique: true, dejaFait: true, reference: commande.reference };
  }

  const montant = intention.amount_received || intention.amount;

  if (paiement) {
    await supabase
      .from("payments")
      .update({
        status: "succeeded",
        received_at: new Date().toISOString(),
        stripe_charge_id:
          typeof intention.latest_charge === "string" ? intention.latest_charge : null,
      })
      .eq("id", paiement.id);
  } else {
    // Webhook arrivé avant l'enregistrement local : on crée la ligne.
    await supabase.from("payments").insert({
      company_id: commande.company_id,
      order_id: commande.id,
      method: "card",
      kind: "full",
      amount_cents: montant,
      status: "succeeded",
      stripe_payment_intent_id: intention.id,
      received_at: new Date().toISOString(),
    });
  }

  const totalPaye = (commande.amount_paid_cents ?? 0) + montant;
  const solde = totalPaye >= commande.total_cents;

  await supabase
    .from("orders")
    .update({
      amount_paid_cents: totalPaye,
      payment_status: solde ? "paid" : "deposit_paid",
    })
    .eq("id", commande.id);

  // Transition de statut : « payée » puis « à préparer », en respectant la
  // machine à états. Un paiement d'acompte ne fait pas passer à « payée ».
  const statut = commande.status as OrderStatus;
  const cible: OrderStatus = solde ? "payee" : "a_preparer";

  if (canTransition(statut, cible)) {
    await supabase.from("orders").update({ status: cible }).eq("id", commande.id);
    await supabase.from("order_status_history").insert({
      company_id: commande.company_id,
      order_id: commande.id,
      from_status: statut,
      to_status: cible,
      actor: "system",
      note: `Paiement Stripe confirmé (${intention.id})`,
    });

    // Enchaînement automatique vers la préparation.
    if (cible === "payee" && canTransition("payee", "a_preparer")) {
      await supabase.from("orders").update({ status: "a_preparer" }).eq("id", commande.id);
      await supabase.from("order_status_history").insert({
        company_id: commande.company_id,
        order_id: commande.id,
        from_status: "payee",
        to_status: "a_preparer",
        actor: "system",
        note: "Paiement encaissé, commande à préparer",
      });
    }
  }

  // ⚠️ L'email de confirmation part ICI et non à la création de la commande :
  // en carte, annoncer « commande confirmée » avant l'encaissement serait
  // mensonger. La fonction est idempotente, un rejeu de webhook n'enverra pas
  // un second message.
  await envoyerConfirmationCommande(commande.id);

  return { applique: true, dejaFait: false, reference: commande.reference };
}

/** Échec de paiement : on libère stock et créneau plutôt que de les bloquer. */
export async function appliquerPaiementEchoue(intention: Stripe.PaymentIntent): Promise<void> {
  const orderId = intention.metadata?.order_id;
  if (!orderId) return;

  const supabase = createSupabaseAdminClient();

  const { data: commande } = await supabase
    .from("orders")
    .select("company_id, total_cents, total_volume_m3, analytics_session_id")
    .eq("id", orderId)
    .maybeSingle();

  await supabase
    .from("payments")
    .update({ status: "failed", notes: intention.last_payment_error?.message ?? null })
    .eq("stripe_payment_intent_id", intention.id);

  await supabase.from("orders").update({ payment_status: "failed" }).eq("id", orderId);

  if (commande) {
    await enregistrerEvenementAnalytics(commande.company_id, {
      type: "lost_demand",
      sessionId: commande.analytics_session_id ?? (await getSessionIdCommande(orderId)),
      orderId,
      motif: "payment_failed",
      caPotentielCents: commande.total_cents,
      volumePotentielM3: Number(commande.total_volume_m3),
      metadata: { stripeStatus: intention.status },
    });
  }

  // ⚠️ On ne libère PAS le stock immédiatement : le client peut retenter avec une
  // autre carte dans la minute. La libération est faite par l'expiration
  // (commande restée « nouvelle » sans paiement), à brancher en tâche planifiée.
}

/**
 * Vérifie l'état réel du paiement auprès de Stripe et l'applique si besoin.
 *
 * Chemin de secours du webhook. On ne croit pas le navigateur : on redemande à
 * Stripe. Utilisable sans `STRIPE_WEBHOOK_SECRET`.
 */
export async function verifierEtAppliquerPaiement(
  companyId: string,
  orderId: string,
): Promise<ResultatApplication> {
  const supabase = createSupabaseAdminClient();

  const { data: paiement } = await supabase
    .from("payments")
    .select("stripe_payment_intent_id, orders!inner ( company_id )")
    .eq("order_id", orderId)
    .eq("method", "card")
    .not("stripe_payment_intent_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const proprietaire = paiement?.orders as unknown as { company_id: string } | null;
  if (!paiement?.stripe_payment_intent_id || proprietaire?.company_id !== companyId) {
    return { applique: false, raison: "Aucun paiement par carte pour cette commande." };
  }

  const intention = await getStripe().paymentIntents.retrieve(paiement.stripe_payment_intent_id);

  if (intention.status !== "succeeded") {
    return { applique: false, raison: `Paiement non abouti (${intention.status}).` };
  }

  return appliquerPaiementReussi(intention);
}
