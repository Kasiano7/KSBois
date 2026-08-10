import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Socle commun des tâches planifiées.
 *
 * Trois crons existaient déjà avec leur propre copie du contrôle d'accès. À
 * partir de cinq, la duplication devient un risque : il suffit d'en oublier un
 * pour exposer un point d'entrée qui écrit en base sans authentification.
 */

/**
 * Un cron n'est jamais public.
 *
 * En production, seul l'en-tête `Authorization: Bearer <CRON_SECRET>` est
 * accepté — c'est ce que Vercel envoie. Le secret en paramètre d'URL n'est
 * toléré qu'en développement, pour pouvoir déclencher depuis un navigateur :
 * une URL se retrouve dans les journaux d'accès et l'historique, un en-tête non.
 */
export function cronAutorise(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return (
    process.env.NODE_ENV !== "production" &&
    request.nextUrl.searchParams.get("secret") === secret
  );
}

export function refusCron(): Response {
  return Response.json({ erreur: "Non autorisé." }, { status: 401 });
}

/**
 * Entreprises actives à traiter par un cron.
 *
 * Les crons ne passent par aucun domaine : ils ne peuvent donc pas résoudre le
 * tenant par l'hôte comme le reste de l'application. Ils itèrent explicitement.
 */
export async function entreprisesActives(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await createSupabaseAdminClient()
    .from("companies")
    .select("id, name")
    .eq("is_active", true);

  if (error) {
    console.error("[cron] lecture des entreprises :", error.message);
    return [];
  }
  return data ?? [];
}
