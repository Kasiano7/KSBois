import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { envoyerSansBloquer } from "./notifications";
import { ConfirmationCommande } from "@/emails/confirmation-commande";
import { getTenant } from "@/lib/tenant";

/**
 * Email de confirmation de commande, construit depuis la COMMANDE.
 *
 * ⚠️ Volontairement bâti sur `orders` et non sur le panier : en carte bancaire,
 * le panier est supprimé au moment de l'encaissement, et l'email part APRÈS.
 * Une source unique évite aussi que les deux chemins (modes différés / carte)
 * divergent dans leur contenu.
 *
 * Idempotence : on n'envoie pas deux fois pour la même commande. Un webhook
 * rejoué ne doit pas générer un second email.
 */
export async function envoyerConfirmationCommande(orderId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data: commande } = await supabase
    .from("orders")
    .select(
      `id, company_id, reference, email, first_name, total_cents, delivery_total_cents,
       total_volume_m3, shipping_address, requested_slot_label, payment_method,
       amount_paid_cents, payment_status,
       order_items ( product_name, variant_label, cut_length_cm, line_volume_m3, line_total_cents ),
       order_option_items ( name, price_cents )`,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!commande) {
    console.error("[confirmation] commande introuvable :", orderId);
    return;
  }

  // Déjà envoyé : on sort. C'est ce qui rend un rejeu de webhook inoffensif.
  const { count } = await supabase
    .from("notifications_log")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("template", "confirmation_commande")
    .in("status", ["sent", "queued"]);

  if ((count ?? 0) > 0) return;

  const tenant = await getTenant();
  if (!tenant) {
    console.error("[confirmation] tenant non résolu.");
    return;
  }

  // Coefficients d'empilage, retrouvés par longueur de coupe : l'équivalence en
  // stères en dépend (PLAN.md §3.2), et `order_items` ne stocke que la longueur.
  const { data: longueurs } = await supabase
    .from("cut_lengths")
    .select("cm, stacking_coefficient")
    .eq("company_id", commande.company_id);

  const coefficientPour = (cm: number | null): number | null => {
    if (cm === null) return null;
    const trouve = longueurs?.find((l) => l.cm === cm);
    return trouve ? Number(trouve.stacking_coefficient) : null;
  };

  const { data: acces } = await supabase
    .from("order_access_tokens")
    .select("token")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const adresse = (commande.shipping_address ?? {}) as { city?: string };
  const resteAPayer =
    commande.payment_status === "paid"
      ? 0
      : commande.total_cents - (commande.amount_paid_cents ?? 0);

  await envoyerSansBloquer({
    companyId: commande.company_id,
    destinataire: commande.email,
    sujet: `Votre commande ${commande.reference} est confirmée`,
    modele: "confirmation_commande",
    orderId: commande.id,
    contenu: ConfirmationCommande({
      entreprise: tenant.name,
      telephone: tenant.phoneDisplay ?? tenant.phone,
      reference: commande.reference,
      prenom: commande.first_name ?? "",
      lignes: (commande.order_items ?? []).map((l) => ({
        produit: l.product_name,
        format: l.variant_label,
        volumeM3: Number(l.line_volume_m3),
        totalCents: l.line_total_cents,
        coefficient: coefficientPour(l.cut_length_cm),
      })),
      options: (commande.order_option_items ?? []).map((option) => ({
        nom: option.name,
        totalCents: option.price_cents,
      })),
      volumeTotalM3: Number(commande.total_volume_m3),
      livraisonCents: commande.delivery_total_cents,
      totalCents: commande.total_cents,
      ville: adresse.city ?? null,
      creneauSouhaite: commande.requested_slot_label,
      modePaiement: commande.payment_method ?? "cash",
      resteAPayerCents: resteAPayer,
      lienCommande: acces?.token
        ? `${site}/commande/confirmation/${commande.reference}?jeton=${acces.token}`
        : `${site}/`,
      lienEspaceClient: `${site}/compte/connexion`,
    }),
  });
}
