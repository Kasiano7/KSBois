import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { cronAutorise } from "@/lib/cron";
import { releverPrixCarburant } from "@/server/releve-carburant";

/**
 * Relevé quotidien du prix du gazole — docs/02-MOTEURS-METIER.md §2.4
 *
 * Déclenché par Vercel Cron chaque matin à 10 h (voir `vercel.json`).
 *
 * ⚠️ Runtime Node.js et non edge : on écrit en base avec la clé de service.
 * ⚠️ Route PROTÉGÉE par `CRON_SECRET` : sans ce contrôle, n'importe qui pourrait
 *    déclencher des écritures et marteler l'API publique en notre nom.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!cronAutorise(request)) {
    return Response.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  try {
    const resultats = await releverPrixCarburant();

    revalidatePath("/admin/livraison/zones");
    revalidatePath("/panier");
    revalidatePath("/");

    return Response.json({
      horodatage: new Date().toISOString(),
      entreprises: resultats.length,
      enregistres: resultats.filter((r) => r.enregistre).length,
      detail: resultats.map((r) => ({
        entreprise: r.entreprise,
        departement: r.departement,
        prixCents: r.decision?.prixCents ?? null,
        stations: r.decision?.echantillon ?? null,
        ecartees: r.decision?.ecartes ?? null,
        variationPct: r.decision?.variationPct ?? null,
        enregistre: r.enregistre,
        raison: r.decision?.raison ?? r.erreur ?? null,
      })),
    });
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error("[cron/fuel-price]", message);
    // 500 explicite : Vercel signalera l'échec du cron plutôt que de le masquer.
    return Response.json({ erreur: message }, { status: 500 });
  }
}
