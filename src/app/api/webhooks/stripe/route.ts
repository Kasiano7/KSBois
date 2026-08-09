import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, webhookConfigure } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { appliquerPaiementReussi, appliquerPaiementEchoue } from "@/server/paiement";

/**
 * Webhook Stripe — docs/02-MOTEURS-METIER.md §6.2
 *
 * **Seule source de vérité du paiement en production.** Ne jamais faire confiance
 * au retour navigateur pour marquer une commande payée : un client peut fermer
 * l'onglet avant la redirection, ou la falsifier.
 *
 * Trois protections obligatoires :
 *  1. Vérification de SIGNATURE — sans elle, n'importe qui peut poster un faux
 *     « paiement réussi » et se faire livrer gratuitement.
 *  2. IDEMPOTENCE par `event.id` — Stripe rejoue les événements en cas d'échec.
 *  3. Refus des événements TROP ANCIENS — limite les attaques par rejeu.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Au-delà, on considère l'événement comme un rejeu. */
const TOLERANCE_SECONDES = 300;

export async function POST(request: NextRequest) {
  if (!webhookConfigure()) {
    console.error("[webhook stripe] STRIPE_WEBHOOK_SECRET absente : événement ignoré.");
    return Response.json({ erreur: "Webhook non configuré." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ erreur: "Signature absente." }, { status: 400 });
  }

  // ⚠️ Le corps doit être lu BRUT : la signature porte sur les octets exacts.
  // Un `request.json()` reformaterait le contenu et invaliderait la vérification.
  const corpsBrut = await request.text();

  let evenement: Stripe.Event;
  try {
    evenement = getStripe().webhooks.constructEvent(
      corpsBrut,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
      TOLERANCE_SECONDES,
    );
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error("[webhook stripe] signature invalide :", message);
    return Response.json({ erreur: "Signature invalide." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Idempotence : une insertion en conflit signifie « déjà traité ».
  const { error: erreurEnregistrement } = await supabase
    .from("processed_webhook_events")
    .insert({ event_id: evenement.id, provider: "stripe" });

  if (erreurEnregistrement) {
    if (erreurEnregistrement.code === "23505") {
      // Rejeu : on répond 200 pour que Stripe cesse de réessayer.
      return Response.json({ recu: true, deja_traite: true });
    }
    console.error("[webhook stripe] journalisation :", erreurEnregistrement.message);
    // On continue quand même : mieux vaut traiter deux fois (les applications
    // sont idempotentes) que de perdre un paiement.
  }

  try {
    switch (evenement.type) {
      case "payment_intent.succeeded": {
        const resultat = await appliquerPaiementReussi(
          evenement.data.object as Stripe.PaymentIntent,
        );
        if (!resultat.applique) {
          console.error("[webhook stripe] application refusée :", resultat.raison);
        }
        break;
      }

      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        await appliquerPaiementEchoue(evenement.data.object as Stripe.PaymentIntent);
        break;
      }

      default:
        // Les autres événements ne nous concernent pas : on accuse réception
        // pour que Stripe ne les réessaie pas indéfiniment.
        break;
    }

    return Response.json({ recu: true });
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error(`[webhook stripe] traitement de ${evenement.type} :`, message);
    // 500 : Stripe réessaiera. L'événement a été journalisé, mais nos
    // applications étant idempotentes, un nouvel essai est sans danger.
    await supabase.from("processed_webhook_events").delete().eq("event_id", evenement.id);
    return Response.json({ erreur: message }, { status: 500 });
  }
}
