"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth";
import { uuidLike } from "@/lib/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { analyserSecteur, importerCommunes, type AnalyseSecteur } from "@/server/secteur";

/**
 * Secteur de livraison automatique — docs/05-ADMIN.md §6.1
 *
 * Deux gestes, jamais fusionnés : ANALYSER (aucune écriture, on montre ce qui
 * changerait) puis IMPORTER (on écrit ce qui a été coché). Un bouton unique qui
 * ferait les deux irait plus vite à coder et personne n'oserait cliquer dessus.
 */

export type ResultatAnalyse =
  | { ok: true; analyse: AnalyseSecteur }
  | { ok: false; message: string };

const RayonSchema = z.object({
  rayonKm: z.coerce
    .number()
    .int("Indiquez un nombre entier de kilomètres.")
    .min(1, "Le rayon doit valoir au moins 1 km.")
    .max(200, "Au-delà de 200 km, il ne s'agit plus d'une tournée de livraison."),
});

export async function analyserSecteurAction(entree: unknown): Promise<ResultatAnalyse> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = RayonSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  try {
    return await analyserSecteur(session.companyId, parsed.data.rayonKm);
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error("[secteur] analyse :", message);
    return {
      ok: false,
      message: "L'analyse a échoué. Les services publics interrogés sont peut-être indisponibles.",
    };
  }
}

const ImportSchema = z.object({
  rayonKm: RayonSchema.shape.rayonKm,
  communes: z
    .array(
      z.object({
        inseeCode: z.string().trim().regex(/^[0-9AB]{5}$/i, "Code INSEE invalide."),
        codePostal: z.string().trim().regex(/^\d{5}$/, "Code postal invalide."),
        ville: z.string().trim().min(1).max(120),
        distanceKm: z.coerce.number().min(0).max(500),
        sourceDistance: z.enum(["route", "vol_oiseau"]),
        zoneId: uuidLike.nullable(),
      }),
    )
    .min(1, "Sélectionnez au moins une commune.")
    .max(600),
});

export interface ResultatImport {
  ok: boolean;
  message?: string;
}

export async function importerSecteurAction(entree: unknown): Promise<ResultatImport> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = ImportSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const supabase = createSupabaseAdminClient();

  try {
    const resultat = await importerCommunes(session.companyId, parsed.data.communes);

    // Le rayon est mémorisé pour que l'écran s'ouvre sur la valeur du métier,
    // et non sur une valeur par défaut à ressaisir à chaque fois.
    await supabase
      .from("companies")
      .update({ service_radius_km: parsed.data.rayonKm })
      .eq("id", session.companyId);

    await supabase.from("audit_log").insert({
      company_id: session.companyId,
      actor_id: session.userId,
      actor_role: session.role,
      action: "secteur.imported",
      entity_type: "zone_communes",
      after: {
        rayon_km: parsed.data.rayonKm,
        communes_soumises: parsed.data.communes.length,
        inserees: resultat.inserees,
        mises_a_jour: resultat.misesAJour,
        ignorees: resultat.ignorees,
      },
    });

    revalidatePath("/admin/livraison/zones");
    revalidatePath("/livraison");
    revalidatePath("/");

    const morceaux = [
      `${resultat.inserees} commune${resultat.inserees > 1 ? "s" : ""} ajoutée${resultat.inserees > 1 ? "s" : ""}`,
    ];
    if (resultat.misesAJour > 0) {
      morceaux.push(`${resultat.misesAJour} mise${resultat.misesAJour > 1 ? "s" : ""} à jour`);
    }
    // Une ligne écartée est une ligne qui ne correspondait plus à la base
    // officielle : le taire donnerait un compte faux sans explication.
    if (resultat.ignorees > 0) {
      morceaux.push(`${resultat.ignorees} écartée${resultat.ignorees > 1 ? "s" : ""}`);
    }

    return { ok: true, message: `${morceaux.join(", ")}.` };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error("[secteur] import :", message);
    return { ok: false, message: "L'import n'a pas abouti. Rien n'a été modifié." };
  }
}
