import "server-only";

import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  computeLine,
  computeOrderTotals,
  type OrderLine,
  type OrderTotals,
} from "@/domain/pricing";
import {
  checkZoneEligibility,
  computeDeliveryFee,
  selectVehicle,
  type DeliveryQuote,
  type TruckAccess,
  type Vehicle,
  type ZoneEligibility,
} from "@/domain/delivery";
import { getDeliveryFeeSettings, getFuelSettings } from "./reglages";
import { joursDeLivraison, resolveZone, listVehicles, type ResolutionZone } from "./zones";
import type { Tenant } from "@/lib/tenant";

/**
 * Panier serveur — docs/02-MOTEURS-METIER.md §10
 *
 * Le panier est persisté en base et identifié par un cookie httpOnly. Le client
 * n'envoie JAMAIS de prix : seulement un `variant_id` et une quantité.
 * Les tables `carts` / `cart_items` n'ont aucun privilège pour `anon` ni
 * `authenticated` : elles ne sont accessibles qu'avec la clé serveur.
 */

const COOKIE_PANIER = "panier_id";
const DUREE_COOKIE = 60 * 60 * 24 * 30; // 30 jours

export interface LignePanier {
  itemId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  sku: string;
  cutLengthCm: number | null;
  humidityClass: string | null;
  packaging: string;
  quantity: number;
  unitPriceCents: number;
  basePriceCents: number;
  lineTotalCents: number;
  lineVolumeM3: number;
  vatRate: number;
  stockAvailable: number;
  allowBackorder: boolean;
  trackStock: boolean;
}

/** Divergence détectée à la revalidation : jamais corrigée en silence. */
export interface DivergencePanier {
  type: "prix_change" | "stock_insuffisant" | "produit_indisponible";
  message: string;
}

export interface LivraisonResume {
  resolution: ResolutionZone | null;
  vehicule: Vehicle | null;
  devis: DeliveryQuote | null;
  eligibilite: ZoneEligibility | null;
  joursLivraison: number[] | null;
  prixCarburantCents: number;
  distanceKm: number | null;
}

export interface PanierResume {
  cartId: string | null;
  lignes: LignePanier[];
  totaux: OrderTotals;
  livraison: LivraisonResume;
  divergences: DivergencePanier[];
  codePostal: string | null;
  ville: string | null;
}

const PANIER_VIDE_TOTAUX: OrderTotals = {
  subtotalCents: 0,
  optionsCents: 0,
  discountCents: 0,
  deliveryCents: 0,
  deliveryOfferedCents: 0,
  totalCents: 0,
  totalVolumeM3: 0,
  vatBreakdown: [],
};

/** Lit l'identifiant de panier sans en créer : utilisable en rendu. */
export async function getCartId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_PANIER)?.value ?? null;
}

/**
 * Récupère ou crée le panier et pose le cookie.
 * ⚠️ Appelable uniquement depuis une Server Action ou un Route Handler :
 * un Server Component ne peut pas écrire de cookie.
 */
export async function ensureCart(companyId: string): Promise<string> {
  const store = await cookies();
  const existant = store.get(COOKIE_PANIER)?.value;
  const supabase = createSupabaseAdminClient();

  if (existant) {
    const { data } = await supabase
      .from("carts")
      .select("id")
      .eq("id", existant)
      .eq("company_id", companyId)
      .maybeSingle();
    if (data) return data.id;
  }

  const { data, error } = await supabase
    .from("carts")
    .insert({ company_id: companyId })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Création du panier impossible : ${error?.message}`);

  store.set(COOKIE_PANIER, data.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE_COOKIE,
  });

  return data.id;
}

type ItemRow = {
  id: string;
  quantity: number;
  variant_id: string;
  product_variants: {
    id: string;
    sku: string;
    humidity_class: string | null;
    packaging: string;
    unit_volume_m3: number;
    base_price_cents: number;
    vat_rate: number;
    stock_available: number | null;
    allow_backorder: boolean;
    track_stock: boolean;
    is_active: boolean;
    cut_lengths: { cm: number; label: string } | null;
    price_tiers: { min_quantity: number; unit_price_cents: number }[];
    products: { name: string; slug: string; is_active: boolean } | null;
  } | null;
};

/**
 * Contenu complet du panier, prix et frais RECALCULÉS à chaque lecture.
 *
 * Aucune valeur monétaire n'est lue depuis `cart_items` : seule la quantité y
 * est stockée. C'est ce qui rend la manipulation de prix côté client impossible.
 */
export async function getPanier(tenant: Tenant): Promise<PanierResume> {
  const cartId = await getCartId();
  if (!cartId) {
    return {
      cartId: null,
      lignes: [],
      totaux: PANIER_VIDE_TOTAUX,
      livraison: videLivraison(),
      divergences: [],
      codePostal: null,
      ville: null,
    };
  }

  const supabase = createSupabaseAdminClient();

  const { data: panier } = await supabase
    .from("carts")
    .select("id, postal_code, city")
    .eq("id", cartId)
    .eq("company_id", tenant.id)
    .maybeSingle();

  if (!panier) {
    return {
      cartId: null,
      lignes: [],
      totaux: PANIER_VIDE_TOTAUX,
      livraison: videLivraison(),
      divergences: [],
      codePostal: null,
      ville: null,
    };
  }

  const { data: items } = await supabase
    .from("cart_items")
    .select(
      `id, quantity, variant_id,
       product_variants (
         id, sku, humidity_class, packaging, unit_volume_m3, base_price_cents,
         vat_rate, stock_available, allow_backorder, track_stock, is_active,
         cut_lengths ( cm, label ),
         price_tiers ( min_quantity, unit_price_cents ),
         products ( name, slug, is_active )
       )`,
    )
    .eq("cart_id", cartId)
    .order("created_at");

  const lignes: LignePanier[] = [];
  const orderLines: OrderLine[] = [];
  const divergences: DivergencePanier[] = [];

  for (const item of (items ?? []) as unknown as ItemRow[]) {
    const v = item.product_variants;

    if (!v || !v.is_active || !v.products?.is_active) {
      divergences.push({
        type: "produit_indisponible",
        message: "Un produit de votre panier n'est plus disponible et a été retiré.",
      });
      continue;
    }

    const quantity = Number(item.quantity);
    const pricing = {
      variantId: v.id,
      basePriceCents: v.base_price_cents,
      vatRate: Number(v.vat_rate),
      unitVolumeM3: Number(v.unit_volume_m3),
      tiers: (v.price_tiers ?? []).map((t) => ({
        minQuantity: Number(t.min_quantity),
        unitPriceCents: t.unit_price_cents,
      })),
    };

    const ligneCalculee = computeLine(pricing, quantity);
    orderLines.push(ligneCalculee);

    const stockAvailable = Number(v.stock_available ?? 0);
    if (v.track_stock && !v.allow_backorder && quantity > stockAvailable) {
      divergences.push({
        type: "stock_insuffisant",
        message: `Nous n'avons plus que ${stockAvailable.toLocaleString("fr-FR")} m³ apparents de ${v.products.name} en ${v.cut_lengths?.label ?? v.sku}.`,
      });
    }

    lignes.push({
      itemId: item.id,
      variantId: v.id,
      productName: v.products.name,
      productSlug: v.products.slug,
      variantLabel: v.cut_lengths?.label ?? v.sku,
      sku: v.sku,
      cutLengthCm: v.cut_lengths?.cm ?? null,
      humidityClass: v.humidity_class,
      packaging: v.packaging,
      quantity,
      unitPriceCents: ligneCalculee.unitPriceCents,
      basePriceCents: v.base_price_cents,
      lineTotalCents: ligneCalculee.lineTotalCents,
      lineVolumeM3: ligneCalculee.lineVolumeM3,
      vatRate: Number(v.vat_rate),
      stockAvailable,
      allowBackorder: v.allow_backorder,
      trackStock: v.track_stock,
    });
  }

  const livraison = await calculerLivraison(tenant, orderLines, panier.postal_code, panier.city);

  const totaux = computeOrderTotals({
    lines: orderLines,
    deliveryCents:
      livraison.devis?.status === "ok" ? livraison.devis.totalCents : 0,
    vatMode: tenant.vatMode,
  });

  return {
    cartId: panier.id,
    lignes,
    totaux,
    livraison,
    divergences,
    codePostal: panier.postal_code,
    ville: panier.city,
  };
}

function videLivraison(): LivraisonResume {
  return {
    resolution: null,
    vehicule: null,
    devis: null,
    eligibilite: null,
    joursLivraison: null,
    prixCarburantCents: 0,
    distanceKm: null,
  };
}

/**
 * Assemble le calcul de livraison : zone → véhicule → carburant → frais.
 * Toute la logique de calcul vit dans `@/domain/delivery`, testée à part.
 */
async function calculerLivraison(
  tenant: Tenant,
  lignes: OrderLine[],
  codePostal: string | null,
  ville: string | null,
  accesCamion: TruckAccess = "camion",
): Promise<LivraisonResume> {
  if (!codePostal || lignes.length === 0) return videLivraison();

  const resolution = await resolveZone(tenant.id, codePostal, ville);

  const [carburant, reglagesFrais, vehicules] = await Promise.all([
    getFuelSettings(tenant.id, tenant.features.fuelSurcharge),
    getDeliveryFeeSettings(tenant.id),
    listVehicles(tenant.id),
  ]);

  const base = { ...videLivraison(), resolution, prixCarburantCents: carburant.pricePerLiterCents };

  if (resolution.status !== "ok") return base;

  const volume = lignes.reduce((s, l) => s + l.lineVolumeM3, 0);
  const sousTotal = lignes.reduce((s, l) => s + l.lineTotalCents, 0);
  const distanceKm = resolution.commune.distanceKm ?? 0;

  const vehicule = selectVehicle(volume, accesCamion, vehicules, distanceKm);
  const eligibilite = checkZoneEligibility(resolution.zone, sousTotal, volume);
  const jours = joursDeLivraison(resolution.commune, resolution.zone);

  if (!vehicule) {
    // Volume supérieur à toute la flotte → devis (docs/02 §2.2).
    return { ...base, eligibilite, joursLivraison: jours, distanceKm };
  }

  const devis = computeDeliveryFee({
    zone: resolution.zone,
    vehicle: vehicule,
    distanceKm,
    volumeM3: volume,
    subtotalCents: sousTotal,
    fuel: carburant,
    settings: reglagesFrais,
  });

  return {
    resolution,
    vehicule,
    devis,
    eligibilite,
    joursLivraison: jours,
    prixCarburantCents: carburant.pricePerLiterCents,
    distanceKm,
  };
}
