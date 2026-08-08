"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { requireTenant } from "@/lib/tenant";
import { getPanier } from "@/server/panier";
import { normaliserCodePostal } from "@/server/zones";

/**
 * Demande de devis — docs/02-MOTEURS-METIER.md §7.2
 *
 * Cette action est la porte de sortie de toutes les impasses du tunnel : hors
 * zone, code postal inconnu, volume supérieur à la flotte, frais hors norme.
 * Elle transforme un client perdu en prospect qualifié.
 */

const DevisSchema = z.object({
  firstName: z.string().trim().min(1, "Indiquez votre prénom.").max(80),
  lastName: z.string().trim().min(1, "Indiquez votre nom.").max(80),
  companyName: z.string().trim().max(160).optional(),
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(160),
  phone: z
    .string()
    .trim()
    .min(1, "Indiquez un numéro de téléphone.")
    .max(30)
    .refine(
      (v) => (v.replace(/\D/g, "").length ?? 0) >= 9,
      "Le numéro de téléphone semble incomplet.",
    ),
  addressLine1: z.string().trim().max(200).optional(),
  postalCode: z
    .string()
    .trim()
    .transform(normaliserCodePostal)
    .refine((v) => /^\d{5}$/.test(v), "Le code postal doit contenir 5 chiffres."),
  city: z.string().trim().min(1, "Indiquez votre commune.").max(120),
  species: z.string().trim().max(120).optional(),
  cutLengthCm: z.coerce.number().int().min(10).max(200).optional(),
  quantityM3: z.coerce.number().positive("Indiquez une quantité.").max(999).optional(),
  humidityPreference: z.enum(["sec", "mi_sec", "vert", "peu_importe"]).optional(),
  message: z.string().trim().max(2000).optional(),
  /** Champ piège invisible : rempli uniquement par un robot. */
  siteWeb: z.string().max(0).optional(),
});

export interface ResultatDevis {
  ok: boolean;
  reference?: string;
  message?: string;
  erreurs?: Record<string, string>;
}

/**
 * Limitation de débit en mémoire.
 *
 * ⚠️ Suffisant en développement et sur une instance unique, INSUFFISANT en
 * serverless où chaque instance a sa propre mémoire. À remplacer par un
 * compteur en base ou Upstash avant la mise en production (docs/06 §2.4).
 */
const compteurs = new Map<string, { total: number; expire: number }>();
const FENETRE_MS = 60 * 60 * 1000;
const MAX_PAR_FENETRE = 5;

function tropDeDemandes(cle: string): boolean {
  const maintenant = Date.now();
  const entree = compteurs.get(cle);

  if (!entree || entree.expire < maintenant) {
    compteurs.set(cle, { total: 1, expire: maintenant + FENETRE_MS });
    return false;
  }
  entree.total += 1;
  return entree.total > MAX_PAR_FENETRE;
}

export async function envoyerDemandeDevis(entree: unknown): Promise<ResultatDevis> {
  const parsed = DevisSchema.safeParse(entree);

  if (!parsed.success) {
    const erreurs: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const champ = String(issue.path[0] ?? "_");
      erreurs[champ] ??= issue.message;
    }
    return { ok: false, message: "Vérifiez les champs signalés.", erreurs };
  }

  // Le piège est rempli : on répond « ok » sans rien enregistrer, pour ne pas
  // renseigner le robot sur la détection.
  if (parsed.data.siteWeb) return { ok: true, reference: "—" };

  const tenant = await requireTenant();

  const entetes = await headers();
  const ip =
    entetes.get("x-forwarded-for")?.split(",")[0]?.trim() ?? entetes.get("x-real-ip") ?? "inconnu";

  if (tropDeDemandes(`${tenant.id}:${ip}`)) {
    return {
      ok: false,
      message:
        "Vous avez envoyé plusieurs demandes récemment. Appelez-nous directement, c'est plus rapide.",
    };
  }

  const supabase = createSupabaseAdminClient();

  const { data: reference, error: erreurRef } = await supabase.rpc("next_document_number", {
    p_company_id: tenant.id,
    p_kind: "quote",
  });

  if (erreurRef || !reference) {
    console.error("[devis] numérotation :", erreurRef?.message);
    return { ok: false, message: "Une erreur est survenue. Merci de nous appeler." };
  }

  // Si le visiteur avait un panier, on l'attache : le patron voit exactement ce
  // que le client voulait, et peut convertir le devis en commande sans ressaisie.
  let cartSnapshot: Json | null = null;
  let origine: "form" | "out_of_zone" = "form";
  try {
    const panier = await getPanier(tenant);
    if (panier.lignes.length > 0) {
      cartSnapshot = {
        lignes: panier.lignes.map((l) => ({
          produit: l.productName,
          format: l.variantLabel,
          quantite: l.quantity,
          volumeM3: l.lineVolumeM3,
          prixUnitaireCents: l.unitPriceCents,
          totalCents: l.lineTotalCents,
        })),
        sousTotalCents: panier.totaux.subtotalCents,
        volumeM3: panier.totaux.totalVolumeM3,
        codePostal: panier.codePostal,
        ville: panier.ville,
      };
      const statut = panier.livraison.resolution?.status;
      if (statut === "not_served" || statut === "unknown") origine = "out_of_zone";
    }
  } catch {
    // Un panier illisible ne doit pas empêcher l'envoi de la demande.
  }

  const d = parsed.data;
  const { error } = await supabase.from("quote_requests").insert({
    company_id: tenant.id,
    reference,
    first_name: d.firstName,
    last_name: d.lastName,
    company_name: d.companyName ?? null,
    email: d.email,
    phone: d.phone,
    address_line1: d.addressLine1 ?? null,
    postal_code: d.postalCode,
    city: d.city,
    species: d.species ?? null,
    cut_length_cm: d.cutLengthCm ?? null,
    quantity_m3: d.quantityM3 ?? null,
    humidity_preference: d.humidityPreference ?? null,
    message: d.message ?? null,
    origin: origine,
    cart_snapshot: cartSnapshot,
  });

  if (error) {
    console.error("[devis] enregistrement :", error.message);
    return { ok: false, message: "Une erreur est survenue. Merci de nous appeler." };
  }

  // TODO lot 1 : notification email au patron + accusé de réception au client
  // (Resend). Non branché tant que le domaine n'est pas configuré.

  return { ok: true, reference };
}
