import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { urlTransformation } from "@/lib/imagekit";
import { TRANSFORMATIONS } from "@/lib/imagekit/transformations";
import type { MediaSource } from "@/lib/imagekit";

/**
 * Bibliothèque de médias — docs/04 §3 et §4.3.
 *
 * On stocke `file_path`, jamais l'URL complète : changer d'endpoint ou brancher
 * un domaine personnalisé ne doit toucher aucune ligne de la base.
 */

export interface MediaAdmin extends MediaSource {
  id: string;
  fileName: string;
  imagekitFileId: string;
  mediaType: "image" | "video";
  sizeBytes: number | null;
  folder: string | null;
  tags: string[];
  createdAt: string;
  /** Nombre de produits qui l'utilisent — bloque la suppression à l'aveugle. */
  utilisations: number;
}

export interface FiltresMedias {
  dossier?: string | null;
  recherche?: string | null;
}

export async function listerMedias(
  companyId: string,
  filtres: FiltresMedias = {},
): Promise<MediaAdmin[]> {
  const supabase = createSupabaseAdminClient();

  let requete = supabase
    .from("media")
    .select(
      `id, imagekit_file_id, file_path, file_name, media_type, size_bytes, width, height,
       lqip, alt_text, tags, folder, created_at,
       product_media ( product_id )`,
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (filtres.dossier) requete = requete.eq("folder", filtres.dossier);
  if (filtres.recherche?.trim()) {
    const motif = `%${filtres.recherche.trim()}%`;
    // Recherche sur le nom de fichier ET le texte alternatif : l'exploitant se
    // souvient plus souvent de « bûcheron » que de « IMG_4821.jpg ».
    requete = requete.or(`file_name.ilike.${motif},alt_text.ilike.${motif}`);
  }

  const { data, error } = await requete;
  if (error) {
    console.error("[medias] liste :", error.message);
    return [];
  }

  return (data ?? []).map((ligne) => ({
    id: ligne.id,
    imagekitFileId: ligne.imagekit_file_id,
    filePath: ligne.file_path,
    fileName: ligne.file_name,
    mediaType: ligne.media_type as "image" | "video",
    sizeBytes: ligne.size_bytes === null ? null : Number(ligne.size_bytes),
    width: ligne.width,
    height: ligne.height,
    lqip: ligne.lqip,
    altText: ligne.alt_text,
    tags: ligne.tags ?? [],
    folder: ligne.folder,
    createdAt: ligne.created_at,
    utilisations: (ligne.product_media ?? []).length,
  }));
}

export async function listerDossiers(companyId: string): Promise<string[]> {
  const { data } = await createSupabaseAdminClient()
    .from("media")
    .select("folder")
    .eq("company_id", companyId)
    .not("folder", "is", null);

  return [...new Set((data ?? []).map((ligne) => ligne.folder as string))].sort();
}

/**
 * Génère le placeholder flouté d'une image.
 *
 * On télécharge la variante 20 px et on l'encode en data-URI. Elle pèse moins
 * d'un kilo-octet et supprime le saut de mise en page au chargement (CLS).
 *
 * Non bloquant : sans LQIP, l'image s'affiche quand même. Un upload ne doit pas
 * échouer parce qu'une vignette n'a pas pu être récupérée.
 */
export async function genererLqip(filePath: string): Promise<string | null> {
  const url = urlTransformation(filePath, TRANSFORMATIONS.lqip);
  if (!url) return null;

  try {
    const reponse = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!reponse.ok) return null;
    const type = reponse.headers.get("content-type") ?? "image/jpeg";
    const octets = Buffer.from(await reponse.arrayBuffer());
    // Un LQIP volumineux irait à l'encontre de son but : on renonce au-delà de 4 ko.
    if (octets.byteLength > 4096) return null;
    return `data:${type};base64,${octets.toString("base64")}`;
  } catch (erreur) {
    console.error("[medias] LQIP non généré :", erreur);
    return null;
  }
}

export interface MediaTeleverse {
  imagekitFileId: string;
  filePath: string;
  fileName: string;
  mediaType: "image" | "video";
  mime: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  folder: string | null;
  tags: string[];
}

/**
 * Enregistre un média fraîchement téléversé.
 *
 * Le texte alternatif n'est PAS demandé ici : il l'est dans l'écran, juste
 * après, et il bloque la publication (docs/04 §3). Refuser l'enregistrement
 * sans `alt` ferait perdre le fichier déjà monté chez ImageKit.
 */
export async function enregistrerMedia(
  companyId: string,
  userId: string,
  media: MediaTeleverse,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const supabase = createSupabaseAdminClient();
  const lqip = media.mediaType === "image" ? await genererLqip(media.filePath) : null;

  const { data, error } = await supabase
    .from("media")
    .upsert(
      {
        company_id: companyId,
        imagekit_file_id: media.imagekitFileId,
        file_path: media.filePath,
        file_name: media.fileName,
        media_type: media.mediaType,
        mime: media.mime,
        size_bytes: media.sizeBytes,
        width: media.width,
        height: media.height,
        lqip,
        folder: media.folder,
        tags: media.tags,
        created_by: userId,
      },
      { onConflict: "company_id,imagekit_file_id" },
    )
    .select("id")
    .single();

  if (error || !data) {
    console.error("[medias] enregistrement :", error?.message);
    return { ok: false, message: "Le média n'a pas pu être enregistré." };
  }
  return { ok: true, id: data.id };
}

export async function getMedia(companyId: string, mediaId: string): Promise<MediaAdmin | null> {
  const medias = await listerMedias(companyId);
  return medias.find((media) => media.id === mediaId) ?? null;
}
