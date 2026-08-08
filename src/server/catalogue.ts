import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PricedVariant } from "@/domain/pricing";

/**
 * Accès au catalogue.
 *
 * Utilise le client lié à la session : la RLS s'applique, et un visiteur ne
 * voit que les produits actifs. Chaque requête filtre explicitement par
 * `company_id` — la RLS est une seconde barrière, pas la seule.
 */

export interface CatalogueVariant {
  id: string;
  sku: string;
  cutLengthCm: number | null;
  cutLengthLabel: string | null;
  cutLengthHint: string | null;
  stackingCoefficient: number | null;
  humidityClass: string | null;
  measuredHumidityPct: number | null;
  measuredAt: string | null;
  batchLabel: string | null;
  packaging: string;
  unit: string;
  minQuantity: number;
  maxQuantity: number | null;
  quantityStep: number;
  stockAvailable: number;
  lowStockThreshold: number;
  allowBackorder: boolean;
  trackStock: boolean;
  /** Forme attendue par `@/domain/pricing` — même moteur client et serveur. */
  pricing: PricedVariant;
}

export interface CatalogueProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  badges: string[];
  variants: CatalogueVariant[];
}

type VariantRow = {
  id: string;
  sku: string;
  humidity_class: string | null;
  measured_humidity_pct: number | null;
  measured_at: string | null;
  batch_label: string | null;
  packaging: string;
  unit: string;
  unit_volume_m3: number;
  base_price_cents: number;
  vat_rate: number;
  min_quantity: number;
  max_quantity: number | null;
  quantity_step: number;
  stock_available: number | null;
  low_stock_threshold: number;
  allow_backorder: boolean;
  track_stock: boolean;
  sort_order: number;
  cut_lengths: {
    cm: number;
    label: string;
    hint: string | null;
    stacking_coefficient: number;
  } | null;
  price_tiers: { min_quantity: number; unit_price_cents: number }[];
};

function toCatalogueVariant(row: VariantRow): CatalogueVariant {
  return {
    id: row.id,
    sku: row.sku,
    cutLengthCm: row.cut_lengths?.cm ?? null,
    cutLengthLabel: row.cut_lengths?.label ?? null,
    cutLengthHint: row.cut_lengths?.hint ?? null,
    stackingCoefficient: row.cut_lengths?.stacking_coefficient ?? null,
    humidityClass: row.humidity_class,
    measuredHumidityPct: row.measured_humidity_pct,
    measuredAt: row.measured_at,
    batchLabel: row.batch_label,
    packaging: row.packaging,
    unit: row.unit,
    minQuantity: Number(row.min_quantity),
    maxQuantity: row.max_quantity === null ? null : Number(row.max_quantity),
    quantityStep: Number(row.quantity_step),
    stockAvailable: Number(row.stock_available ?? 0),
    lowStockThreshold: Number(row.low_stock_threshold),
    allowBackorder: row.allow_backorder,
    trackStock: row.track_stock,
    pricing: {
      variantId: row.id,
      basePriceCents: row.base_price_cents,
      vatRate: Number(row.vat_rate),
      unitVolumeM3: Number(row.unit_volume_m3),
      tiers: (row.price_tiers ?? [])
        .map((t) => ({
          minQuantity: Number(t.min_quantity),
          unitPriceCents: t.unit_price_cents,
        }))
        .sort((a, b) => a.minQuantity - b.minQuantity),
    },
  };
}

const PRODUCT_SELECT = `
  id, slug, name, short_description, description, badges,
  product_variants (
    id, sku, humidity_class, measured_humidity_pct, measured_at, batch_label,
    packaging, unit, unit_volume_m3, base_price_cents, vat_rate,
    min_quantity, max_quantity, quantity_step,
    stock_available, low_stock_threshold, allow_backorder, track_stock, sort_order,
    cut_lengths ( cm, label, hint, stacking_coefficient ),
    price_tiers ( min_quantity, unit_price_cents )
  )
`;

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  badges: string[];
  product_variants: VariantRow[];
};

function toCatalogueProduct(row: ProductRow): CatalogueProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    badges: row.badges ?? [],
    variants: (row.product_variants ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(toCatalogueVariant),
  };
}

/** Produit mis en avant sur l'accueil. */
export const getFeaturedProduct = cache(
  async (companyId: string): Promise<CatalogueProduct | null> => {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[catalogue] getFeaturedProduct", error.message);
      return null;
    }
    return data ? toCatalogueProduct(data as unknown as ProductRow) : null;
  },
);

/** Catalogue complet. */
export const listProducts = cache(async (companyId: string): Promise<CatalogueProduct[]> => {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("[catalogue] listProducts", error.message);
    return [];
  }
  return (data as unknown as ProductRow[]).map(toCatalogueProduct);
});

/** Fiche produit par slug. */
export const getProductBySlug = cache(
  async (companyId: string, slug: string): Promise<CatalogueProduct | null> => {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("company_id", companyId)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[catalogue] getProductBySlug", error.message);
      return null;
    }
    return data ? toCatalogueProduct(data as unknown as ProductRow) : null;
  },
);
