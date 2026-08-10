import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getRawSettings } from "./reglages";
import { slugCommune } from "@/lib/slug";

/**
 * Données des pages de contenu et des pages communes — docs/06 §1.2 et §1.3.
 *
 * ⚠️ **Règle anti-spam, codée et non laissée à la discipline.** Une page
 * commune n'est indexable que si elle porte au moins quatre informations qui
 * lui sont propres. Deux cents pages « bois de chauffage à {commune} » clonées
 * sont traitées par Google comme du contenu de faible valeur, et peuvent
 * pénaliser le site entier. Ici, une page trop pauvre existe quand même — un
 * client qui suit un lien doit trouver une réponse — mais elle passe en
 * `noindex` toute seule.
 */

export { slugCommune };

export interface CommuneLivree {
  slug: string;
  ville: string;
  codePostal: string;
  distanceKm: number | null;
  joursLivraison: number[];
  zone: string;
  fraisBaseCents: number;
  fraisParM3Cents: number;
  gratuitAuDelaCents: number | null;
  minimumCommandeCents: number | null;
  delaiJours: number | null;
  /** Nombre de commandes déjà livrées ici : preuve locale, jamais inventée. */
  commandesLivrees: number;
  /** Communes limitrophes desservies, pour le maillage interne. */
  voisines: Array<{ slug: string; ville: string }>;
  /** Décompte des informations propres, qui décide de l'indexation. */
  informationsPropres: number;
  indexable: boolean;
}

type LigneCommune = {
  city: string;
  postal_code: string;
  distance_km: number | null;
  delivery_days: number[] | null;
  is_served: boolean;
  delivery_zones: {
    name: string;
    base_fee_cents: number;
    fee_per_m3_cents: number;
    free_above_cents: number | null;
    min_order_amount_cents: number | null;
    delivery_days: number[] | null;
    lead_time_days: number | null;
  } | null;
};

export async function listerCommunesLivrees(companyId: string): Promise<CommuneLivree[]> {
  const supabase = createSupabaseAdminClient();

  // Délai de repli : une zone qui ne fixe pas le sien suit celui de
  // l'entreprise. C'est un délai RÉEL, celui qu'annonce déjà le tunnel — pas
  // une valeur inventée pour faire passer la page au-dessus du seuil.
  const reglages = await getRawSettings(companyId);
  const delaiEntreprise =
    typeof reglages["order.lead_time_days"] === "number"
      ? (reglages["order.lead_time_days"] as number)
      : null;

  const [{ data: lignes, error }, { data: commandes }] = await Promise.all([
    supabase
      .from("zone_communes")
      .select(
        `city, postal_code, distance_km, delivery_days, is_served,
         delivery_zones ( name, base_fee_cents, fee_per_m3_cents, free_above_cents,
                          min_order_amount_cents, delivery_days, lead_time_days )`,
      )
      .eq("company_id", companyId)
      .eq("is_served", true)
      .order("distance_km", { ascending: true }),
    supabase
      .from("orders")
      .select("shipping_address")
      .eq("company_id", companyId)
      .eq("status", "livree")
      .limit(5000),
  ]);

  if (error) {
    console.error("[contenu] communes :", error.message);
    return [];
  }

  // Nombre de livraisons par ville, depuis l'instantané d'adresse des commandes.
  const livraisonsPar = new Map<string, number>();
  for (const commande of commandes ?? []) {
    const ville = (commande.shipping_address as { city?: string } | null)?.city;
    if (!ville) continue;
    const cle = slugCommune(ville);
    livraisonsPar.set(cle, (livraisonsPar.get(cle) ?? 0) + 1);
  }

  const brutes = (lignes ?? []) as unknown as LigneCommune[];

  const communes = brutes.map((ligne) => {
    const zone = ligne.delivery_zones;
    const slug = slugCommune(ligne.city);
    const jours = ligne.delivery_days ?? zone?.delivery_days ?? [];
    const commandesLivrees = livraisonsPar.get(slug) ?? 0;

    const delaiJours = zone?.lead_time_days ?? delaiEntreprise;

    // Les quatre informations exigées par docs/06 §1.3, comptées une à une.
    //
    // ⚠️ « Tarif connu » ne veut pas dire « tarif non nul » : une zone où la
    // livraison est OFFERTE est une information distinctive et vendeuse. La
    // première version comptait 0 € comme une absence d'information et mettait
    // toute la zone A en noindex — l'inverse de ce qu'on veut.
    const informationsPropres = [
      ligne.distance_km !== null,
      jours.length > 0,
      zone !== null,
      delaiJours !== null,
    ].filter(Boolean).length;

    return {
      slug,
      ville: ligne.city,
      codePostal: ligne.postal_code,
      distanceKm: ligne.distance_km === null ? null : Number(ligne.distance_km),
      joursLivraison: jours,
      zone: zone?.name ?? "Hors zone",
      fraisBaseCents: zone?.base_fee_cents ?? 0,
      fraisParM3Cents: zone?.fee_per_m3_cents ?? 0,
      gratuitAuDelaCents: zone?.free_above_cents ?? null,
      minimumCommandeCents: zone?.min_order_amount_cents ?? null,
      delaiJours,
      commandesLivrees,
      voisines: [] as CommuneLivree["voisines"],
      informationsPropres,
      // La distance est le SEUL fait réellement propre à la commune : sans
      // elle, la page est un gabarit, quel que soit le décompte.
      indexable: informationsPropres >= 4 && ligne.distance_km !== null,
    } satisfies CommuneLivree;
  });

  // Maillage interne : les trois communes desservies les plus proches, par
  // distance. Un lien vers une commune à 40 km n'aide ni le visiteur ni Google.
  for (const commune of communes) {
    commune.voisines = communes
      .filter((autre) => autre.slug !== commune.slug && autre.distanceKm !== null)
      .toSorted(
        (a, b) =>
          Math.abs((a.distanceKm ?? 0) - (commune.distanceKm ?? 0)) -
          Math.abs((b.distanceKm ?? 0) - (commune.distanceKm ?? 0)),
      )
      .slice(0, 3)
      .map((autre) => ({ slug: autre.slug, ville: autre.ville }));
  }

  return communes;
}

export async function getCommuneLivree(
  companyId: string,
  slug: string,
): Promise<CommuneLivree | null> {
  const communes = await listerCommunesLivrees(companyId);
  return communes.find((commune) => commune.slug === slug) ?? null;
}
