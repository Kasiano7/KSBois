import type { NextRequest } from "next/server";
import { cronAutorise, entreprisesActives, refusCron } from "@/lib/cron";
import { envoyerRecapQuotidien } from "@/server/notifications-exploitation";

/**
 * Récapitulatif du matin à l'exploitant, alerte de stock comprise — docs/02 §9.3.
 *
 * ⚠️ Vercel planifie ses crons en **UTC**. Pour un envoi à 7 h heure de Paris,
 * l'expression doit donc être `0 5 * * *` en été et `0 6 * * *` en hiver. On
 * retient 5 h UTC : en hiver, le message arrive à 6 h — en avance plutôt qu'en
 * retard, ce qui est le bon sens pour une feuille de route du matin.
 *
 * L'heure exacte souhaitée reste lisible dans les réglages
 * (`notifications.digest_time`) ; elle sert d'affichage, pas de planification.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!cronAutorise(request)) return refusCron();

  const resultats: Array<{ entreprise: string; envoyes: number; raison?: string }> = [];

  for (const entreprise of await entreprisesActives()) {
    try {
      const bilan = await envoyerRecapQuotidien(entreprise.id);
      resultats.push({ entreprise: entreprise.name, ...bilan });
    } catch (erreur) {
      console.error(`[cron/recap-quotidien] ${entreprise.name} :`, erreur);
      resultats.push({ entreprise: entreprise.name, envoyes: 0, raison: "erreur" });
    }
  }

  return Response.json({ resultats });
}
