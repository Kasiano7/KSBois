import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { etatStock, type EtatStock } from "@/domain/stock";

/**
 * Lecture du stock — docs/05-ADMIN.md §5.2
 *
 * Écran conçu pour être utilisé DEPUIS UN TÉLÉPHONE, en fin de journée, après
 * une journée de fendage. L'exploitant doit pouvoir mettre son stock à jour en
 * deux gestes.
 */

export interface LigneStock {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  sousTitre: string | null;
  /** Ordre d'affichage de la gamme, tel que défini dans le catalogue. */
  productSortOrder: number;
  format: string;
  formatCm: number | null;
  cutLengthId: string | null;
  /** Prix de base du m³ apparent, éditable directement depuis l'écran stock. */
  basePriceCents: number;
  sku: string;
  humidityClass: string | null;
  packaging: string;
  onHand: number;
  reserved: number;
  available: number;
  seuil: number;
  suitStock: boolean;
  precommandeAutorisee: boolean;
  /** `rupture` | `bas` | `ok` — jamais la couleur seule pour le signaler. */
  etat: EtatStock;
}

/** Une gamme d'essence et ses formats — unité d'affichage de l'écran stock. */
export interface GroupeStock {
  productId: string;
  productName: string;
  productSlug: string;
  sousTitre: string | null;
  sortOrder: number;
  formats: LigneStock[];
  disponibleTotal: number;
  aRefaire: number;
}

export interface MouvementStock {
  id: string;
  type: string;
  quantite: number;
  stockApres: number;
  motif: string | null;
  reference: string | null;
  auteur: string | null;
  date: string;
}

export async function listerStock(companyId: string): Promise<LigneStock[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("product_variants")
    .select(
      `id, sku, humidity_class, packaging, stock_on_hand, stock_reserved,
       stock_available, low_stock_threshold, track_stock, allow_backorder,
       sort_order, is_active, base_price_cents, cut_length_id,
       cut_lengths ( label, cm, sort_order ),
       products ( id, name, slug, short_description, is_active, sort_order )`,
    )
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("[stock] listerStock :", error.message);
    return [];
  }

  return (data ?? [])
    .filter((v) => (v.products as unknown as { is_active: boolean } | null)?.is_active)
    .map((v) => {
      const produit = v.products as unknown as {
        id: string;
        name: string;
        slug: string;
        short_description: string | null;
        sort_order: number;
      };
      const longueur = v.cut_lengths as unknown as { label: string; cm: number } | null;
      const available = Number(v.stock_available ?? 0);
      const seuil = Number(v.low_stock_threshold);

      return {
        variantId: v.id,
        productId: produit.id,
        productName: produit.name,
        productSlug: produit.slug,
        sousTitre: produit.short_description,
        productSortOrder: produit.sort_order ?? 0,
        format: longueur?.label ?? v.sku,
        formatCm: longueur?.cm ?? null,
        cutLengthId: v.cut_length_id,
        basePriceCents: v.base_price_cents,
        sku: v.sku,
        humidityClass: v.humidity_class,
        packaging: v.packaging,
        onHand: Number(v.stock_on_hand),
        reserved: Number(v.stock_reserved),
        available,
        seuil,
        suitStock: v.track_stock,
        precommandeAutorisee: v.allow_backorder,
        etat: etatStock(available, seuil, v.track_stock),
      };
    });
}

/**
 * Regroupe le stock par gamme d'essence.
 *
 * L'exploitant pense « j'ai fendu du chêne », pas « j'ai fendu la variante
 * CHENE-33 ». L'écran suit donc sa logique : une carte par essence, les formats
 * en liste à l'intérieur (docs/05 §5.2).
 */
export async function listerStockParEssence(companyId: string): Promise<GroupeStock[]> {
  const lignes = await listerStock(companyId);
  const groupes = new Map<string, GroupeStock>();

  for (const ligne of lignes) {
    let groupe = groupes.get(ligne.productId);
    if (!groupe) {
      groupe = {
        productId: ligne.productId,
        productName: ligne.productName,
        productSlug: ligne.productSlug,
        sousTitre: ligne.sousTitre,
        sortOrder: ligne.productSortOrder,
        formats: [],
        disponibleTotal: 0,
        aRefaire: 0,
      };
      groupes.set(ligne.productId, groupe);
    }
    groupe.formats.push(ligne);
    groupe.disponibleTotal += ligne.available;
    if (ligne.etat !== "ok") groupe.aRefaire += 1;
  }

  return [...groupes.values()]
    .map((g) => ({
      ...g,
      disponibleTotal: Math.round(g.disponibleTotal * 1000) / 1000,
      // Les formats les plus courts d'abord : c'est l'ordre du catalogue.
      formats: g.formats.sort((a, b) => (a.formatCm ?? 0) - (b.formatCm ?? 0)),
    }))
    // Les gammes suivent l'ordre du catalogue, pas l'ordre d'arrivée des lignes.
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listerMouvements(
  companyId: string,
  variantId: string,
  limite = 20,
): Promise<MouvementStock[]> {
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("stock_movements")
    .select(
      `id, movement_type, quantity, stock_after, reason, created_at,
       orders ( reference ), profiles ( full_name )`,
    )
    .eq("company_id", companyId)
    .eq("variant_id", variantId)
    .order("created_at", { ascending: false })
    .limit(limite);

  return (data ?? []).map((m) => ({
    id: m.id,
    type: m.movement_type,
    quantite: Number(m.quantity),
    stockApres: Number(m.stock_after),
    motif: m.reason,
    reference: (m.orders as unknown as { reference: string } | null)?.reference ?? null,
    auteur: (m.profiles as unknown as { full_name: string } | null)?.full_name ?? null,
    date: m.created_at,
  }));
}

export { LIBELLES_MOUVEMENT } from "@/domain/stock";

/** Longueurs de coupe du catalogue, pour proposer l'ajout d'un format. */
export async function listerLongueurs(companyId: string) {
  const { data } = await createSupabaseAdminClient()
    .from("cut_lengths")
    .select("id, cm, label, stacking_coefficient")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order");

  return (data ?? []).map((l) => ({
    id: l.id,
    cm: l.cm,
    label: l.label,
    coefficient: Number(l.stacking_coefficient),
  }));
}
