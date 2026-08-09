"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { assertRole } from "@/lib/auth";
import { uuidLike } from "@/lib/validation";
import { MOTIFS_VALEURS, libelleMotif } from "@/domain/stock";

/**
 * Actions de gestion du stock — docs/05-ADMIN.md §5.2
 *
 * ⚠️ Toute écriture passe par la fonction Postgres `apply_stock_movement` :
 * elle met à jour le compteur ET trace le mouvement dans la même transaction.
 * Aucun `UPDATE` direct sur `stock_on_hand` n'est autorisé depuis le code
 * applicatif (docs/02 §4.2).
 */

export interface ResultatStock {
  ok: boolean;
  message?: string;
  nouveauStock?: number;
}

const ProductionSchema = z.object({
  variantId: uuidLike,
  quantite: z.coerce
    .number()
    .positive("Indiquez une quantité supérieure à zéro.")
    .max(9999, "Quantité trop importante."),
});

/**
 * Ajoute la production du jour.
 * Deux gestes attendus : un pavé numérique, un bouton. Rien de plus.
 */
export async function ajouterProduction(entree: unknown): Promise<ResultatStock> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = ProductionSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const supabase = createSupabaseAdminClient();

  // Contrôle d'appartenance : la fonction Postgres ne connaît pas le tenant.
  const { data: variante } = await supabase
    .from("product_variants")
    .select("id")
    .eq("id", parsed.data.variantId)
    .eq("company_id", session.companyId)
    .maybeSingle();

  if (!variante) return { ok: false, message: "Produit introuvable." };

  const { data, error } = await supabase.rpc("apply_stock_movement", {
    p_variant_id: parsed.data.variantId,
    p_movement_type: "production",
    p_quantity: parsed.data.quantite,
    p_order_id: undefined,
    p_reason: "Production saisie depuis l'administration",
    p_actor: session.userId,
  });

  if (error) {
    console.error("[stock] ajouterProduction :", error.message);
    return { ok: false, message: "Le stock n'a pas pu être mis à jour." };
  }

  revalidatePath("/admin/stock");
  revalidatePath("/admin");
  return { ok: true, nouveauStock: Number(data) };
}

const CorrectionSchema = z.object({
  variantId: uuidLike,
  quantiteReelle: z.coerce
    .number()
    .min(0, "La quantité ne peut pas être négative.")
    .max(99_999, "Quantité trop importante."),
  motif: z.enum(MOTIFS_VALEURS, { message: "Indiquez un motif." }),
  precision: z.string().trim().max(300).optional(),
});

/**
 * Corrige l'inventaire : on saisit la quantité RÉELLEMENT présente, pas un
 * écart. Le motif est obligatoire — un stock corrigé sans raison est un stock
 * qu'on ne pourra jamais auditer.
 */
export async function corrigerInventaire(entree: unknown): Promise<ResultatStock> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = CorrectionSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const supabase = createSupabaseAdminClient();

  const { data: variante } = await supabase
    .from("product_variants")
    .select("id, stock_on_hand, stock_reserved")
    .eq("id", parsed.data.variantId)
    .eq("company_id", session.companyId)
    .maybeSingle();

  if (!variante) return { ok: false, message: "Produit introuvable." };

  // Garde-fou : on ne descend pas sous ce qui est déjà engagé par des
  // commandes, sinon le stock disponible devient négatif sans explication.
  const reserve = Number(variante.stock_reserved);
  if (parsed.data.quantiteReelle < reserve) {
    return {
      ok: false,
      message: `${reserve.toLocaleString("fr-FR")} m³ apparents sont déjà réservés par des commandes en cours. Annulez-les d'abord si le bois n'existe plus.`,
    };
  }

  const motif = libelleMotif(parsed.data.motif);

  const { data, error } = await supabase.rpc("apply_stock_movement", {
    p_variant_id: parsed.data.variantId,
    p_movement_type: "adjustment",
    p_quantity: parsed.data.quantiteReelle,
    p_order_id: undefined,
    p_reason: parsed.data.precision ? `${motif} — ${parsed.data.precision}` : motif,
    p_actor: session.userId,
  });

  if (error) {
    console.error("[stock] corrigerInventaire :", error.message);
    return { ok: false, message: "Le stock n'a pas pu être corrigé." };
  }

  revalidatePath("/admin/stock");
  revalidatePath("/admin");
  return { ok: true, nouveauStock: Number(data) };
}

const SeuilSchema = z.object({
  variantId: uuidLike,
  seuil: z.coerce.number().min(0).max(9999),
});

/** Seuil d'alerte : c'est ce qui déclenche « refaire du stock » à temps. */
export async function definirSeuilAlerte(entree: unknown): Promise<ResultatStock> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = SeuilSchema.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Seuil invalide." };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("product_variants")
    .update({ low_stock_threshold: parsed.data.seuil })
    .eq("id", parsed.data.variantId)
    .eq("company_id", session.companyId);

  if (error) return { ok: false, message: "Enregistrement impossible." };

  revalidatePath("/admin/stock");
  revalidatePath("/admin");
  return { ok: true };
}
