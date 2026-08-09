import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/** Purge mensuelle des sessions de mesure d'audience âgées de plus de 25 mois. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorise(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return process.env.NODE_ENV !== "production" && request.nextUrl.searchParams.get("secret") === secret;
}
export async function GET(request: NextRequest) {
  if (!autorise(request)) return Response.json({ erreur: "Non autorisé." }, { status: 401 });

  const limite = new Date();
  limite.setUTCMonth(limite.getUTCMonth() - 25);

  const { count, error } = await createSupabaseAdminClient()
    .from("analytics_sessions")
    .delete({ count: "exact" })
    .lt("last_seen_at", limite.toISOString());

  if (error) {
    console.error("[cron/purge-analytics]", error.message);
    return Response.json({ erreur: error.message }, { status: 500 });
  }

  return Response.json({ supprimees: count ?? 0, limite: limite.toISOString() });
}
