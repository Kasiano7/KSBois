"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth";
import { uuidLike } from "@/lib/validation";
import { releverPrixCarburant } from "@/server/releve-carburant";

/**
 * Pilotage du prix du carburant — docs/02-MOTEURS-METIER.md §2.4
 *
 * Trois gestes possibles pour le gérant : accepter un relevé que le contrôle de
 * sanité a refusé, saisir un prix à la main, ou relancer le relevé sans attendre
 * le passage du cron.
 */

export interface ResultatCarburant {
  ok: boolean;
  message?: string;
}

/**
 * Accepte un relevé refusé.
 *
 * Cas d'usage réel : une hausse durable du gazole dépasse le seuil de 15 %, et le
 * garde-fou la bloquerait indéfiniment. L'exploitant tranche.
 */
export async function accepterReleve(entree: unknown): Promise<ResultatCarburant> {
  const session = await assertRole(["owner"]);
  const parsed = z.object({ releveId: uuidLike }).safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const supabase = createSupabaseAdminClient();

  const { data: releve } = await supabase
    .from("fuel_prices")
    .select("id, price_per_liter_cents, applied")
    .eq("id", parsed.data.releveId)
    .eq("company_id", session.companyId)
    .maybeSingle();

  if (!releve) return { ok: false, message: "Relevé introuvable." };
  if (releve.applied) return { ok: true };

  const { error } = await supabase
    .from("fuel_prices")
    .update({ applied: true, rejected_reason: null })
    .eq("id", releve.id);

  if (error) return { ok: false, message: "Enregistrement impossible." };

  await supabase.from("audit_log").insert({
    company_id: session.companyId,
    actor_id: session.userId,
    actor_role: session.role,
    action: "fuel_price.accepted",
    entity_type: "fuel_price",
    entity_id: releve.id,
    after: { price_per_liter_cents: releve.price_per_liter_cents },
  });

  revalidatePath("/admin/livraison/zones");
  revalidatePath("/");
  revalidatePath("/panier");
  return { ok: true };
}

const PrixSchema = z.object({
  prixEuros: z
    .union([z.string(), z.number()])
    .transform((v) => {
      const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(",", "."));
      return Math.round(n * 100);
    })
    .refine((c) => Number.isFinite(c) && c >= 50 && c <= 500, "Le prix doit être entre 0,50 € et 5,00 €."),
});

/** Saisie manuelle : fait foi jusqu'au prochain relevé automatique accepté. */
export async function fixerPrixCarburant(entree: unknown): Promise<ResultatCarburant> {
  const session = await assertRole(["owner"]);
  const parsed = PrixSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Prix invalide." };
  }

  const { error } = await createSupabaseAdminClient().from("fuel_prices").insert({
    company_id: session.companyId,
    fuel_type: "gazole",
    price_per_liter_cents: parsed.data.prixEuros,
    source: "manual",
    applied: true,
  });

  if (error) return { ok: false, message: "Enregistrement impossible." };

  revalidatePath("/admin/livraison/zones");
  revalidatePath("/");
  revalidatePath("/panier");
  return { ok: true };
}

/** Relance le relevé immédiatement, sans attendre le cron du matin. */
export async function relancerReleve(): Promise<ResultatCarburant> {
  await assertRole(["owner"]);

  try {
    const resultats = await releverPrixCarburant();
    revalidatePath("/admin/livraison/zones");
    revalidatePath("/");

    const applique = resultats.some((r) => r.enregistre);
    return {
      ok: true,
      message: applique
        ? "Relevé mis à jour."
        : "Relevé effectué, mais le contrôle de sanité l'a refusé : vérifiez ci-dessous.",
    };
  } catch (erreur) {
    return {
      ok: false,
      message: erreur instanceof Error ? erreur.message : "Le relevé a échoué.",
    };
  }
}
