import type { NextRequest } from "next/server";
import { cronAutorise, entreprisesActives, refusCron } from "@/lib/cron";
import { envoyerRappelsVeille } from "@/server/notifications-exploitation";

/**
 * Rappel envoyé la veille des livraisons confirmées — docs/02 §9.1.
 *
 * Planifié en fin d'après-midi : assez tôt pour que le client lise le message
 * le soir même et puisse encore prévenir, assez tard pour que les confirmations
 * de la journée soient prises en compte.
 *
 * L'envoi est idempotent par jour et par commande : un rejeu du cron par la
 * plateforme ne réveille personne deux fois.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!cronAutorise(request)) return refusCron();

  const resultats: Array<{ entreprise: string; envoyes: number; ignores: number }> = [];

  for (const entreprise of await entreprisesActives()) {
    try {
      const bilan = await envoyerRappelsVeille(entreprise.id);
      resultats.push({ entreprise: entreprise.name, ...bilan });
    } catch (erreur) {
      // Une entreprise en erreur ne doit pas priver les autres de leur rappel.
      console.error(`[cron/rappel-veille] ${entreprise.name} :`, erreur);
      resultats.push({ entreprise: entreprise.name, envoyes: 0, ignores: 0 });
    }
  }

  return Response.json({ resultats });
}
