import "server-only";

import { cookies } from "next/headers";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const COOKIE_SESSION_STATISTIQUES = "bois_stats_session";

export type SourceAcquisition = "direct" | "seo" | "referral" | "campaign" | "unknown";
export type TypeEvenementAnalytics =
  | "visit"
  | "cart"
  | "zone_check"
  | "slot"
  | "payment"
  | "order"
  | "quote_pdf"
  | "lost_demand";
export type MotifDemandePerdue =
  | "out_of_zone"
  | "unknown_postal_code"
  | "out_of_stock"
  | "no_slot"
  | "payment_failed";

export interface EvenementAnalytics {
  type: TypeEvenementAnalytics;
  sessionId?: string | null;
  cartId?: string | null;
  orderId?: string | null;
  quoteRequestId?: string | null;
  variantId?: string | null;
  zoneId?: string | null;
  motif?: MotifDemandePerdue | null;
  caPotentielCents?: number | null;
  volumePotentielM3?: number | null;
  metadata?: Json;
}
export interface SessionAnalytics {
  id: string;
  source: SourceAcquisition;
}

/** Lit la session anonyme sans en créer une pendant le rendu serveur. */
export async function getSessionAnalytics(companyId: string): Promise<SessionAnalytics | null> {
  const sessionId = (await cookies()).get(COOKIE_SESSION_STATISTIQUES)?.value;
  if (!sessionId) return null;

  const { data } = await createSupabaseAdminClient()
    .from("analytics_sessions")
    .select("id, acquisition_source")
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id, source: data.acquisition_source as SourceAcquisition };
}

/**
 * Écriture tolérante : une panne de mesure ne doit jamais bloquer une vente.
 * Les étapes du tunnel sont dédoublonnées par l'index SQL ; les pertes peuvent
 * se répéter, mais pas plusieurs fois sur le même panier en dix minutes.
 */
export async function enregistrerEvenementAnalytics(
  companyId: string,
  evenement: EvenementAnalytics,
): Promise<void> {
  try {
    const session = evenement.sessionId
      ? { id: evenement.sessionId }
      : await getSessionAnalytics(companyId);
    if (!session) return;

    const supabase = createSupabaseAdminClient();

    const { data: sessionValide } = await supabase
      .from("analytics_sessions")
      .select("id")
      .eq("id", session.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!sessionValide) return;

    if (evenement.type === "lost_demand") {
      const depuis = new Date(Date.now() - 10 * 60_000).toISOString();
      let doublon = supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("session_id", session.id)
        .eq("event_type", "lost_demand")
        .eq("reason", evenement.motif ?? "")
        .gte("occurred_at", depuis);
      if (evenement.cartId) doublon = doublon.eq("cart_id", evenement.cartId);
      if ((await doublon).count) return;
    } else {
      const { count } = await supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("session_id", session.id)
        .eq("event_type", evenement.type);
      if (count) return;
    }

    const { error } = await supabase.from("analytics_events").insert({
      company_id: companyId,
      session_id: session.id,
      event_type: evenement.type,
      cart_id: evenement.cartId ?? null,
      order_id: evenement.orderId ?? null,
      quote_request_id: evenement.quoteRequestId ?? null,
      variant_id: evenement.variantId ?? null,
      zone_id: evenement.zoneId ?? null,
      reason: evenement.motif ?? null,
      potential_revenue_cents: evenement.caPotentielCents ?? null,
      potential_volume_m3: evenement.volumePotentielM3 ?? null,
      metadata: evenement.metadata ?? {},
    });

    if (error && !error.message.toLowerCase().includes("duplicate")) {
      console.warn("[statistiques] événement non enregistré :", error.message);
    }
  } catch (erreur) {
    console.warn(
      "[statistiques] mesure indisponible :",
      erreur instanceof Error ? erreur.message : erreur,
    );
  }
}

/** Attribution figée au moment où la commande est créée. */
export async function getAttributionCommande(companyId: string): Promise<{
  sessionId: string | null;
  source: SourceAcquisition | null;
  devisPdfAvantCommande: boolean;
}> {
  const session = await getSessionAnalytics(companyId);
  if (!session) return { sessionId: null, source: null, devisPdfAvantCommande: false };

  const { count } = await createSupabaseAdminClient()
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("session_id", session.id)
    .eq("event_type", "quote_pdf");

  return {
    sessionId: session.id,
    source: session.source,
    devisPdfAvantCommande: (count ?? 0) > 0,
  };
}

/** Retrouve la session d'une commande pour les webhooks, qui n'ont pas de cookie. */
export async function getSessionIdCommande(orderId: string): Promise<string | null> {
  const { data } = await createSupabaseAdminClient()
    .from("orders")
    .select("analytics_session_id")
    .eq("id", orderId)
    .maybeSingle();
  return data?.analytics_session_id ?? null;
}
