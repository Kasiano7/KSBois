import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/lib/tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getCartId, getPanier } from "@/server/panier";
import {
  COOKIE_SESSION_STATISTIQUES,
  enregistrerEvenementAnalytics,
  type SourceAcquisition,
} from "@/server/analytics";

const CorpsSchema = z.object({
  stage: z.enum(["cart", "slot", "payment"]).nullable().optional(),
  perte: z.enum(["no_slot"]).nullable().optional(),
  path: z.string().startsWith("/").max(300),
  referrer: z.string().max(500).optional().default(""),
  utmSource: z.string().max(100).optional().nullable(),
  utmMedium: z.string().max(100).optional().nullable(),
  utmCampaign: z.string().max(160).optional().nullable(),
});

function hostnameSain(valeur: string): string | null {
  if (!valeur) return null;
  try {
    return new URL(valeur).hostname.toLowerCase().slice(0, 160);
  } catch {
    return null;
  }
}

function classerSource(
  referrer: string,
  utmSource?: string | null,
  utmMedium?: string | null,
): SourceAcquisition {
  if (utmSource || utmMedium) return "campaign";
  const host = hostnameSain(referrer);
  if (!host) return "direct";
  if (
    ["google.", "bing.", "duckduckgo.", "qwant.", "ecosia.", "yahoo."].some((moteur) =>
      host.includes(moteur),
    )
  ) {
    return "seo";
  }
  return "referral";
}

export async function POST(request: Request) {
  const contexteNavigation = request.headers.get("sec-fetch-site");
  if (contexteNavigation === "cross-site") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  if (/bot|crawler|spider|slurp|headless/i.test(request.headers.get("user-agent") ?? "")) {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = CorpsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();
  const cookieSession = request.headers.get("cookie")
    ?.split(";")
    .map((partie) => partie.trim())
    .find((partie) => partie.startsWith(`${COOKIE_SESSION_STATISTIQUES}=`))
    ?.slice(COOKIE_SESSION_STATISTIQUES.length + 1);

  let sessionId = cookieSession ? decodeURIComponent(cookieSession) : null;
  if (sessionId) {
    const { data: existante } = await supabase
      .from("analytics_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("company_id", tenant.id)
      .maybeSingle();
    if (!existante) sessionId = null;
  }

  const source = classerSource(
    parsed.data.referrer,
    parsed.data.utmSource,
    parsed.data.utmMedium,
  );
  if (!sessionId) {
    const { data: creee } = await supabase
      .from("analytics_sessions")
      .insert({
        company_id: tenant.id,
        acquisition_source: source,
        landing_path: parsed.data.path.split("?")[0],
        referrer_host: hostnameSain(parsed.data.referrer),
        campaign: parsed.data.utmCampaign ?? null,
      })
      .select("id")
      .single();
    sessionId = creee?.id ?? null;
  } else {
    await supabase
      .from("analytics_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("company_id", tenant.id);
  }

  if (!sessionId) return NextResponse.json({ ok: false }, { status: 503 });

  await enregistrerEvenementAnalytics(tenant.id, {
    type: "visit",
    sessionId,
    metadata: { path: parsed.data.path.split("?")[0] },
  });

  const cartId = await getCartId();
  if (parsed.data.stage) {
    let autorise = parsed.data.stage !== "cart";
    if (parsed.data.stage === "cart" && cartId) {
      const { count } = await supabase
        .from("cart_items")
        .select("id", { count: "exact", head: true })
        .eq("cart_id", cartId);
      autorise = (count ?? 0) > 0;
    }
    if (autorise) {
      await enregistrerEvenementAnalytics(tenant.id, {
        type: parsed.data.stage,
        sessionId,
        cartId,
      });
    }
  }

  if (parsed.data.perte === "no_slot") {
    const panier = await getPanier(tenant);
    await enregistrerEvenementAnalytics(tenant.id, {
      type: "lost_demand",
      sessionId,
      cartId,
      motif: "no_slot",
      caPotentielCents: panier.totaux.totalCents,
      volumePotentielM3: panier.totaux.totalVolumeM3,
    });
  }

  const reponse = NextResponse.json({ ok: true });
  reponse.cookies.set(COOKIE_SESSION_STATISTIQUES, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });
  return reponse;
}
