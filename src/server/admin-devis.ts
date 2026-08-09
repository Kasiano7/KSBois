import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  computeLine,
  computeOrderTotals,
  type OrderLine,
  type OrderTotals,
} from "@/domain/pricing";
import { computeDeliveryFee, selectVehicle, type DeliveryQuote } from "@/domain/delivery";
import { joursDAttente, type QuoteOrigin, type QuoteStatus } from "@/domain/quotes";
import { getDeliveryFeeSettings, getFuelSettings } from "./reglages";
import { resolveZone, listVehicles } from "./zones";
import { aujourdHui } from "./creneaux";
import type { Tenant } from "@/lib/tenant";

/**
 * Demandes de devis, côté administration — docs/02 §7.2 et docs/05
 *
 * Deux faces d'un même objet :
 *  • la DEMANDE, écrite par le client, qu'on ne modifie jamais ;
 *  • la PROPOSITION, écrite par l'exploitant, recalculée à chaque lecture.
 *
 * ⚠️ Aucun prix n'est lu depuis `quote_requests` : `proposal_lines` ne stocke que
 * des identifiants de variante et des quantités, exactement comme le panier.
 * Un devis vieux d'un mois affiche donc les prix du jour, et l'écran le signale.
 */

export interface LignePropose {
  variantId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  cutLengthCm: number | null;
  stackingCoefficient: number | null;
  humidityClass: string | null;
  packaging: string;
  quantity: number;
  unitVolumeM3: number;
  unitPriceCents: number;
  lineTotalCents: number;
  lineVolumeM3: number;
  vatRate: number;
  stockAvailable: number;
  allowBackorder: boolean;
  trackStock: boolean;
}

export interface LivraisonProposee {
  /** Montant retenu, quelle que soit son origine. */
  totalCents: number;
  /** Vrai quand l'exploitant a fixé le montant lui-même. */
  manuelle: boolean;
  commune: string | null;
  codePostal: string | null;
  distanceKm: number | null;
  zoneId: string | null;
  zoneNom: string | null;
  vehiculeId: string | null;
  vehiculeNom: string | null;
  prixCarburantCents: number | null;
  detail: DeliveryQuote | null;
}

export interface Proposition {
  lignes: LignePropose[];
  livraison: LivraisonProposee | null;
  totaux: OrderTotals;
  remiseCents: number;
  remiseLabel: string | null;
  /** Ce qui empêche d'envoyer ou de convertir, en clair. */
  alertes: string[];
}

export interface DemandeDevis {
  id: string;
  reference: string;
  statut: QuoteStatus;
  origine: QuoteOrigin;
  createdAt: string;
  respondedAt: string | null;
  prenom: string | null;
  nom: string | null;
  societe: string | null;
  email: string;
  telephone: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  essence: string | null;
  longueurCm: number | null;
  quantiteM3: number | null;
  preferenceHumidite: string | null;
  message: string | null;
  panierJoint: PanierJoint | null;
  notesInternes: string | null;
  /** Lignes proposées, brutes : uniquement variantId + quantité. */
  lignesProposees: LigneProposition[];
  livraisonIncluse: boolean;
  livraisonCentsSaisie: number | null;
  remiseCents: number;
  remiseLabel: string | null;
  validJusquA: string | null;
  commandeId: string | null;
  commandeReference: string | null;
  totalEstimeCents: number | null;
}

export interface PanierJoint {
  lignes: { produit: string; format: string; quantite: number; totalCents: number }[];
  sousTotalCents: number | null;
  volumeM3: number | null;
  codePostal: string | null;
  ville: string | null;
}

export interface DevisResume {
  id: string;
  reference: string;
  statut: QuoteStatus;
  origine: QuoteOrigin;
  createdAt: string;
  nom: string;
  ville: string | null;
  codePostal: string | null;
  demande: string;
  totalEstimeCents: number | null;
  joursAttente: number;
  converti: boolean;
}

export interface VarianteVendable {
  id: string;
  label: string;
  sku: string;
  prixCents: number;
  stockDisponible: number;
  trackStock: boolean;
}

type LigneProposition = { variantId: string; quantity: number };

/** Lit `proposal_lines` en se méfiant : c'est du jsonb, donc du non-typé. */
function lireLignes(brut: unknown): LigneProposition[] {
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((l) => {
    if (typeof l !== "object" || l === null) return [];
    const { variantId, quantity } = l as Record<string, unknown>;
    const q = Number(quantity);
    if (typeof variantId !== "string" || !Number.isFinite(q) || q <= 0) return [];
    return [{ variantId, quantity: q }];
  });
}

function nomComplet(prenom: string | null, nom: string | null, societe: string | null): string {
  const personne = [prenom, nom].filter(Boolean).join(" ").trim();
  if (societe && personne) return `${societe} (${personne})`;
  return societe || personne || "Sans nom";
}

/** Résumé de ce que le client demande, en une phrase lisible dans un tableau. */
function resumerDemande(ligne: {
  quantity_m3: number | null;
  species: string | null;
  cut_length_cm: number | null;
}): string {
  const morceaux = [
    ligne.quantity_m3 !== null ? `${Number(ligne.quantity_m3)} m³ app.` : null,
    ligne.species,
    ligne.cut_length_cm !== null ? `${ligne.cut_length_cm} cm` : null,
  ].filter(Boolean);
  return morceaux.length > 0 ? morceaux.join(" · ") : "à préciser";
}

const FILTRES: Record<string, QuoteStatus[]> = {
  a_traiter: ["nouveau", "en_cours"],
  envoyes: ["envoye"],
  acceptes: ["accepte"],
  refuses: ["refuse"],
};

export async function listerDevis(companyId: string, filtre = "a_traiter"): Promise<DevisResume[]> {
  const statuts = FILTRES[filtre];
  let requete = createSupabaseAdminClient()
    .from("quote_requests")
    .select(
      `id, reference, status, origin, created_at, first_name, last_name, company_name,
       postal_code, city, species, cut_length_cm, quantity_m3, estimated_total_cents,
       converted_order_id`,
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (statuts) requete = requete.in("status", statuts);

  const { data, error } = await requete;
  if (error) {
    console.error("[devis] listerDevis :", error.message);
    return [];
  }

  const today = aujourdHui();

  return (data ?? []).map((d) => ({
    id: d.id,
    reference: d.reference,
    statut: d.status as QuoteStatus,
    origine: d.origin as QuoteOrigin,
    createdAt: d.created_at,
    nom: nomComplet(d.first_name, d.last_name, d.company_name),
    ville: d.city,
    codePostal: d.postal_code,
    demande: resumerDemande(d),
    totalEstimeCents: d.estimated_total_cents,
    joursAttente: joursDAttente(d.created_at, today),
    converti: d.converted_order_id !== null,
  }));
}

/** Compteurs des onglets : un devis oublié est un client perdu. */
export async function compterDevis(companyId: string): Promise<Record<string, number>> {
  const { data } = await createSupabaseAdminClient()
    .from("quote_requests")
    .select("status")
    .eq("company_id", companyId);

  const compteurs: Record<string, number> = {
    a_traiter: 0,
    envoyes: 0,
    acceptes: 0,
    refuses: 0,
    toutes: 0,
  };

  for (const d of data ?? []) {
    compteurs.toutes += 1;
    for (const [cle, statuts] of Object.entries(FILTRES)) {
      if (statuts.includes(d.status as QuoteStatus)) compteurs[cle] += 1;
    }
  }
  return compteurs;
}

export async function getDemandeDevis(companyId: string, id: string): Promise<DemandeDevis | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("quote_requests")
    .select(`*, orders ( reference )`)
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("[devis] getDemandeDevis :", error.message);
  if (!data) return null;

  const panier = data.cart_snapshot as unknown as PanierJoint | null;

  return {
    id: data.id,
    reference: data.reference,
    statut: data.status as QuoteStatus,
    origine: data.origin as QuoteOrigin,
    createdAt: data.created_at,
    respondedAt: data.responded_at,
    prenom: data.first_name,
    nom: data.last_name,
    societe: data.company_name,
    email: data.email,
    telephone: data.phone,
    adresse: data.address_line1,
    codePostal: data.postal_code,
    ville: data.city,
    essence: data.species,
    longueurCm: data.cut_length_cm,
    quantiteM3: data.quantity_m3 === null ? null : Number(data.quantity_m3),
    preferenceHumidite: data.humidity_preference,
    message: data.message,
    panierJoint: panier && Array.isArray(panier.lignes) ? panier : null,
    notesInternes: data.admin_notes,
    lignesProposees: lireLignes(data.proposal_lines),
    livraisonIncluse: data.delivery_included,
    livraisonCentsSaisie: data.delivery_cents,
    remiseCents: data.discount_cents,
    remiseLabel: data.discount_label,
    validJusquA: data.valid_until,
    commandeId: data.converted_order_id,
    commandeReference: (data.orders as unknown as { reference: string } | null)?.reference ?? null,
    totalEstimeCents: data.estimated_total_cents,
  };
}

/**
 * Recalcule intégralement la proposition à partir des seules quantités.
 *
 * C'est la fonction de référence : l'écran, le PDF, l'email et la conversion en
 * commande l'utilisent tous. Un seul chemin de calcul, donc aucun risque que le
 * client reçoive un montant différent de celui affiché à l'exploitant.
 */
export async function calculerProposition(
  tenant: Tenant,
  demande: DemandeDevis,
): Promise<Proposition> {
  const supabase = createSupabaseAdminClient();
  const demandees = demande.lignesProposees;
  const alertes: string[] = [];

  const lignes: LignePropose[] = [];
  const orderLines: OrderLine[] = [];

  if (demandees.length > 0) {
    const { data: variantes } = await supabase
      .from("product_variants")
      .select(
        `id, sku, humidity_class, packaging, unit_volume_m3, base_price_cents, vat_rate,
         stock_available, allow_backorder, track_stock, is_active,
         cut_lengths ( cm, label, stacking_coefficient ),
         price_tiers ( min_quantity, unit_price_cents ),
         products ( name, is_active )`,
      )
      .eq("company_id", tenant.id)
      .in(
        "id",
        demandees.map((l) => l.variantId),
      );

    for (const ligne of demandees) {
      const v = (variantes ?? []).find((x) => x.id === ligne.variantId);
      if (!v || !v.is_active || !v.products?.is_active) {
        alertes.push("Un produit de cette proposition n'est plus en vente : retirez la ligne.");
        continue;
      }

      const cut = v.cut_lengths as unknown as {
        cm: number;
        label: string;
        stacking_coefficient: number;
      } | null;

      const calculee = computeLine(
        {
          variantId: v.id,
          basePriceCents: v.base_price_cents,
          vatRate: Number(v.vat_rate),
          unitVolumeM3: Number(v.unit_volume_m3),
          tiers: (v.price_tiers ?? []).map((t) => ({
            minQuantity: Number(t.min_quantity),
            unitPriceCents: t.unit_price_cents,
          })),
        },
        ligne.quantity,
      );
      orderLines.push(calculee);

      const stockAvailable = Number(v.stock_available ?? 0);
      if (v.track_stock && !v.allow_backorder && ligne.quantity > stockAvailable) {
        alertes.push(
          `Stock insuffisant sur ${v.products.name} ${cut?.label ?? v.sku} : ` +
            `${stockAvailable.toLocaleString("fr-FR")} m³ disponibles pour ${ligne.quantity.toLocaleString("fr-FR")} proposés. ` +
            `La conversion en commande échouera tant que le stock n'est pas saisi.`,
        );
      }

      lignes.push({
        variantId: v.id,
        productName: v.products.name,
        variantLabel: cut?.label ?? v.sku,
        sku: v.sku,
        cutLengthCm: cut?.cm ?? null,
        stackingCoefficient: cut ? Number(cut.stacking_coefficient) : null,
        humidityClass: v.humidity_class,
        packaging: v.packaging,
        quantity: ligne.quantity,
        unitVolumeM3: Number(v.unit_volume_m3),
        unitPriceCents: calculee.unitPriceCents,
        lineTotalCents: calculee.lineTotalCents,
        lineVolumeM3: calculee.lineVolumeM3,
        vatRate: Number(v.vat_rate),
        stockAvailable,
        allowBackorder: v.allow_backorder,
        trackStock: v.track_stock,
      });
    }
  }

  const livraison = await calculerLivraisonDevis(tenant, demande, orderLines, alertes);

  const totaux = computeOrderTotals({
    lines: orderLines,
    deliveryCents: livraison?.totalCents ?? 0,
    // La remise s'applique AVANT la livraison et est ventilée dans la TVA :
    // c'est le moteur de prix qui s'en charge, pas cet écran (docs/02 §1.2).
    discount:
      demande.remiseCents > 0
        ? {
            kind: "fixed",
            value: demande.remiseCents,
            label: demande.remiseLabel ?? "Remise commerciale",
          }
        : null,
    vatMode: tenant.vatMode,
  });

  return {
    lignes,
    livraison,
    totaux,
    remiseCents: totaux.discountCents,
    remiseLabel: demande.remiseLabel ?? "Remise commerciale",
    alertes,
  };
}

async function calculerLivraisonDevis(
  tenant: Tenant,
  demande: DemandeDevis,
  lignes: OrderLine[],
  alertes: string[],
): Promise<LivraisonProposee | null> {
  if (!demande.livraisonIncluse) return null;

  // Montant fixé à la main : il prime sur tout calcul. C'est le cas normal d'un
  // devis hors zone, où le moteur n'a par définition aucune grille à appliquer.
  if (demande.livraisonCentsSaisie !== null) {
    return {
      totalCents: demande.livraisonCentsSaisie,
      manuelle: true,
      commune: demande.ville,
      codePostal: demande.codePostal,
      distanceKm: null,
      zoneId: null,
      zoneNom: null,
      vehiculeId: null,
      vehiculeNom: null,
      prixCarburantCents: null,
      detail: null,
    };
  }

  if (!demande.codePostal || lignes.length === 0) return null;

  const resolution = await resolveZone(tenant.id, demande.codePostal, demande.ville);

  if (resolution.status !== "ok") {
    alertes.push(
      resolution.status === "not_served"
        ? `${demande.ville ?? demande.codePostal} n'est pas dans vos zones : indiquez vous-même le prix de la livraison.`
        : `Le code postal ${demande.codePostal} est inconnu de vos zones : indiquez vous-même le prix de la livraison.`,
    );
    return null;
  }

  const [carburant, reglages, vehicules] = await Promise.all([
    getFuelSettings(tenant.id, tenant.features.fuelSurcharge),
    getDeliveryFeeSettings(tenant.id),
    listVehicles(tenant.id),
  ]);

  const volume = lignes.reduce((s, l) => s + l.lineVolumeM3, 0);
  const sousTotal = lignes.reduce((s, l) => s + l.lineTotalCents, 0);
  const distanceKm = resolution.commune.distanceKm ?? 0;
  const vehicule = selectVehicle(volume, "camion", vehicules, distanceKm);

  if (!vehicule) {
    alertes.push(
      `Aucun véhicule ne peut emporter ${volume.toLocaleString("fr-FR")} m³ en une fois : ` +
        `prévoyez plusieurs livraisons et fixez le prix à la main.`,
    );
    return null;
  }

  const detail = computeDeliveryFee({
    zone: resolution.zone,
    vehicle: vehicule,
    distanceKm,
    volumeM3: volume,
    subtotalCents: sousTotal,
    fuel: carburant,
    settings: reglages,
  });

  if (detail.status !== "ok") {
    alertes.push(
      `Les frais calculés dépassent votre plafond : fixez vous-même le prix de la livraison.`,
    );
    return null;
  }

  return {
    totalCents: detail.totalCents,
    manuelle: false,
    commune: resolution.commune.city,
    codePostal: resolution.commune.postalCode,
    distanceKm,
    zoneId: resolution.zone.id,
    zoneNom: resolution.zone.name,
    vehiculeId: vehicule.id,
    vehiculeNom: vehicule.name,
    prixCarburantCents: carburant.pricePerLiterCents,
    detail,
  };
}

/** Formats vendables, pour composer la proposition sans quitter l'écran. */
export async function listerVariantesVendables(companyId: string): Promise<VarianteVendable[]> {
  const { data } = await createSupabaseAdminClient()
    .from("product_variants")
    .select(
      `id, sku, base_price_cents, stock_available, track_stock, is_active,
       cut_lengths ( label, sort_order ), products ( name, is_active, sort_order )`,
    )
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sku");

  return (data ?? [])
    .filter((v) => v.products?.is_active)
    .map((v) => {
      const cut = v.cut_lengths as unknown as { label: string } | null;
      const produit = v.products as unknown as { name: string } | null;
      return {
        id: v.id,
        label: `${produit?.name ?? "Produit"} — ${cut?.label ?? v.sku}`,
        sku: v.sku,
        prixCents: v.base_price_cents,
        stockDisponible: Number(v.stock_available ?? 0),
        trackStock: v.track_stock,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
