"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth";
import { uuidLike } from "@/lib/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { enregistrerMedia } from "@/server/medias";
import { DOSSIERS_MEDIAS } from "@/lib/medias";
import type { ResultatAdmin } from "./admin-commandes";

/**
 * Bibliothèque de médias — docs/04 §4.3 et §4.4.
 *
 * Le fichier ne transite jamais par le serveur Next : le navigateur le dépose
 * directement chez ImageKit avec des paramètres signés, puis appelle
 * `enregistrerMediaTeleverse` avec ce qu'ImageKit a renvoyé. Pas de limite de
 * charge utile, pas de bande passante facturée deux fois.
 */

const TeleverseSchema = z.object({
  imagekitFileId: z.string().trim().min(1).max(120),
  filePath: z.string().trim().min(1).max(500),
  fileName: z.string().trim().min(1).max(300),
  mediaType: z.enum(["image", "video"]),
  mime: z.string().trim().max(120).nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  folder: z.enum(DOSSIERS_MEDIAS),
});

export async function enregistrerMediaTeleverse(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = TeleverseSchema.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Réponse d'ImageKit inexploitable." };

  const donnees = parsed.data;
  const resultat = await enregistrerMedia(session.companyId, session.userId, {
    imagekitFileId: donnees.imagekitFileId,
    filePath: donnees.filePath,
    fileName: donnees.fileName,
    mediaType: donnees.mediaType,
    mime: donnees.mime ?? null,
    sizeBytes: donnees.sizeBytes ?? null,
    width: donnees.width ?? null,
    height: donnees.height ?? null,
    folder: donnees.folder,
    tags: [donnees.folder],
  });

  if (!resultat.ok) return { ok: false, message: resultat.message };

  revalidatePath("/admin/medias");
  return { ok: true, message: `${donnees.fileName} ajouté.` };
}

/**
 * Texte alternatif — obligatoire pour publier (docs/04 §3).
 *
 * On l'impose ici plutôt qu'à l'upload : refuser l'enregistrement d'un fichier
 * déjà monté chez ImageKit le laisserait orphelin, facturé et invisible.
 */
export async function enregistrerTexteAlternatif(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = z
    .object({
      mediaId: uuidLike,
      altText: z
        .string()
        .trim()
        .min(3, "Décrivez l'image en quelques mots : c'est ce que lisent les personnes malvoyantes.")
        .max(300),
      caption: z.string().trim().max(300).optional(),
    })
    .safeParse(entree);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const { error } = await createSupabaseAdminClient()
    .from("media")
    .update({
      alt_text: parsed.data.altText,
      caption: parsed.data.caption?.trim() || null,
    })
    .eq("company_id", session.companyId)
    .eq("id", parsed.data.mediaId);

  if (error) {
    console.error("[medias] texte alternatif :", error.message);
    return { ok: false, message: "La description n'a pas pu être enregistrée." };
  }

  revalidatePath("/admin/medias");
  return { ok: true, message: "Description enregistrée." };
}

/**
 * Supprime un média de la bibliothèque.
 *
 * ⚠️ Refuse si le média est utilisé par un produit. Supprimer à l'aveugle
 * laisserait une fiche produit sans photo, sans que personne s'en aperçoive
 * avant qu'un client tombe dessus.
 *
 * Le fichier reste chez ImageKit : on ne pilote pas encore leur API de
 * suppression, et un fichier orphelin coûte moins cher qu'une image effacée par
 * erreur. Le ménage se fera depuis leur console.
 */
export async function supprimerMedia(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner"]);
  const parsed = z.object({ mediaId: uuidLike }).safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("product_media")
    .select("product_id", { count: "exact", head: true })
    .eq("media_id", parsed.data.mediaId);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: `Ce média est utilisé par ${count} produit${(count ?? 0) > 1 ? "s" : ""}. Retirez-le d'abord de la fiche produit.`,
    };
  }

  const { error } = await supabase
    .from("media")
    .delete()
    .eq("company_id", session.companyId)
    .eq("id", parsed.data.mediaId);

  if (error) {
    console.error("[medias] suppression :", error.message);
    return { ok: false, message: "Le média n'a pas pu être supprimé." };
  }

  revalidatePath("/admin/medias");
  return { ok: true, message: "Média retiré de la bibliothèque." };
}
