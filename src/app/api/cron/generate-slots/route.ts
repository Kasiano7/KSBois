import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getOrderSettings } from "@/server/reglages";

/**
 * Génération hebdomadaire des créneaux — docs/02-MOTEURS-METIER.md §3.2
 *
 * Sans ce passage, l'horizon de réservation recule d'un jour par jour écoulé :
 * au bout de quarante-cinq jours, le tunnel de commande ne propose plus aucune
 * date, et rien dans l'application ne le signale. La panne serait silencieuse et
 * coûterait des commandes en pleine saison.
 *
 * `generate_delivery_slots` est idempotent (`on conflict do nothing`) : relancer
 * ne crée pas de doublon et ne touche pas aux capacités ajustées à la main.
 *
 * ⚠️ Runtime Node.js : on écrit en base avec la clé de service.
 * ⚠️ Route PROTÉGÉE par `CRON_SECRET`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorise(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const entete = request.headers.get("authorization");
  if (entete === `Bearer ${secret}`) return true;

  // Déclenchement manuel en développement, pour tester sans attendre lundi.
  return (
    process.env.NODE_ENV !== "production" && request.nextUrl.searchParams.get("secret") === secret
  );
}

export async function GET(request: NextRequest) {
  if (!autorise(request)) {
    return Response.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: entreprises, error } = await supabase
      .from("companies")
      .select("id, name")
      .eq("is_active", true);

    if (error) throw new Error(`Lecture des entreprises : ${error.message}`);

    const detail: { entreprise: string; crees: number; erreur: string | null }[] = [];

    for (const entreprise of entreprises ?? []) {
      const reglages = await getOrderSettings(entreprise.id);
      const { data, error: erreurRpc } = await supabase.rpc("generate_delivery_slots", {
        p_company_id: entreprise.id,
        // On génère un peu au-delà de l'horizon de réservation : le passage est
        // hebdomadaire, l'horizon doit rester couvert entre deux exécutions.
        p_horizon_days: reglages.bookingHorizonDays + 14,
      });

      if (erreurRpc) console.error(`[cron/generate-slots] ${entreprise.name} :`, erreurRpc.message);

      detail.push({
        entreprise: entreprise.name,
        crees: typeof data === "number" ? data : 0,
        erreur: erreurRpc?.message ?? null,
      });
    }

    revalidatePath("/admin/livraison/creneaux");
    revalidatePath("/commande/creneau");

    return Response.json({
      horodatage: new Date().toISOString(),
      entreprises: detail.length,
      crees: detail.reduce((total, d) => total + d.crees, 0),
      detail,
    });
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error("[cron/generate-slots]", message);
    // 500 explicite : Vercel signalera l'échec plutôt que de le masquer.
    return Response.json({ erreur: message }, { status: 500 });
  }
}
