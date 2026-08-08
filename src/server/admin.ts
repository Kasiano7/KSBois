import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { aujourdHui } from "./creneaux";
import type { OrderStatus } from "@/domain/orders/state-machine";

/**
 * Lectures de l'administration.
 *
 * Utilise le client d'administration : ces requêtes agrègent des données que la
 * RLS filtrerait ligne à ligne, ce qui serait inutilement coûteux. Chaque
 * requête filtre donc EXPLICITEMENT par `company_id` — l'appelant a déjà vérifié
 * le rôle via `requireRole()`.
 */

export interface ChiffresDuJour {
  date: string;
  livraisons: number;
  volumeM3: number;
  aEncaisserCents: number;
  enEspecesCents: number;
  nouvellesCommandes: number;
}

export interface PointDAttention {
  cle: string;
  libelle: string;
  href: string;
  ton: "alerte" | "info";
}

export interface ResumeMois {
  caCents: number;
  commandes: number;
  volumeM3: number;
  caMoisPrecedentCents: number;
}

function debutDeMois(decalage = 0): string {
  const maintenant = new Date();
  const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() + decalage, 1));
  return d.toISOString().slice(0, 10);
}

export async function getChiffresDuJour(companyId: string): Promise<ChiffresDuJour> {
  const supabase = createSupabaseAdminClient();
  const today = aujourdHui();
  const hier = new Date(Date.now() - 86_400_000).toISOString();

  const [{ data: livraisons }, { count: nouvelles }] = await Promise.all([
    supabase
      .from("orders")
      .select("total_cents, total_volume_m3, payment_method, payment_status")
      .eq("company_id", companyId)
      .eq("confirmed_delivery_date", today)
      .neq("status", "annulee"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", hier)
      .neq("status", "annulee"),
  ]);

  const lignes = livraisons ?? [];
  const nonPayees = lignes.filter((l) => l.payment_status !== "paid");

  return {
    date: today,
    livraisons: lignes.length,
    volumeM3: Math.round(lignes.reduce((s, l) => s + Number(l.total_volume_m3), 0) * 1000) / 1000,
    aEncaisserCents: nonPayees.reduce((s, l) => s + l.total_cents, 0),
    // Isolé volontairement : c'est ce que le livreur doit rapporter le soir.
    enEspecesCents: nonPayees
      .filter((l) => l.payment_method === "cash")
      .reduce((s, l) => s + l.total_cents, 0),
    nouvellesCommandes: nouvelles ?? 0,
  };
}

/**
 * Points d'attention : des LIGNES CLIQUABLES, pas des compteurs.
 * Le tableau de bord répond à « que dois-je faire aujourd'hui ? » (docs/05 §2).
 */
export async function getPointsDAttention(companyId: string): Promise<PointDAttention[]> {
  const supabase = createSupabaseAdminClient();
  const ilYASixJours = new Date(Date.now() - 6 * 86_400_000).toISOString();

  const [aConfirmer, devisEnAttente, virementsEnRetard, stockBas] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("confirmed_delivery_date", null)
      .in("status", ["a_preparer", "payee", "prete"]),
    supabase
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "nouveau"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "en_attente_paiement")
      .lt("created_at", ilYASixJours),
    supabase
      .from("product_variants")
      .select("id, sku, stock_available, low_stock_threshold")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .eq("track_stock", true),
  ]);

  const enRupture = (stockBas.data ?? []).filter(
    (v) => Number(v.stock_available ?? 0) <= Number(v.low_stock_threshold),
  );

  const points: PointDAttention[] = [];

  if ((aConfirmer.count ?? 0) > 0) {
    points.push({
      cle: "a_confirmer",
      libelle: `${aConfirmer.count} commande${aConfirmer.count! > 1 ? "s" : ""} dont la date de livraison n'est pas confirmée`,
      href: "/admin/commandes?filtre=a_confirmer",
      ton: "alerte",
    });
  }
  if ((devisEnAttente.count ?? 0) > 0) {
    points.push({
      cle: "devis",
      libelle: `${devisEnAttente.count} demande${devisEnAttente.count! > 1 ? "s" : ""} de devis en attente de réponse`,
      href: "/admin/devis",
      ton: "alerte",
    });
  }
  if ((virementsEnRetard.count ?? 0) > 0) {
    points.push({
      cle: "virements",
      libelle: `${virementsEnRetard.count} paiement${virementsEnRetard.count! > 1 ? "s" : ""} attendu${virementsEnRetard.count! > 1 ? "s" : ""} depuis plus de 6 jours`,
      href: "/admin/commandes?filtre=en_attente_paiement",
      ton: "alerte",
    });
  }
  if (enRupture.length > 0) {
    points.push({
      cle: "stock",
      libelle: `${enRupture.length} produit${enRupture.length > 1 ? "s" : ""} sous le seuil de stock : ${enRupture.map((v) => v.sku).join(", ")}`,
      href: "/admin/stock",
      ton: "alerte",
    });
  }

  return points;
}

export async function getResumeMois(companyId: string): Promise<ResumeMois> {
  const supabase = createSupabaseAdminClient();

  const [ceMois, moisPrecedent] = await Promise.all([
    supabase
      .from("orders")
      .select("total_cents, total_volume_m3")
      .eq("company_id", companyId)
      .neq("status", "annulee")
      .gte("created_at", debutDeMois()),
    supabase
      .from("orders")
      .select("total_cents")
      .eq("company_id", companyId)
      .neq("status", "annulee")
      .gte("created_at", debutDeMois(-1))
      .lt("created_at", debutDeMois()),
  ]);

  const lignes = ceMois.data ?? [];

  return {
    caCents: lignes.reduce((s, l) => s + l.total_cents, 0),
    commandes: lignes.length,
    volumeM3: Math.round(lignes.reduce((s, l) => s + Number(l.total_volume_m3), 0) * 1000) / 1000,
    caMoisPrecedentCents: (moisPrecedent.data ?? []).reduce((s, l) => s + l.total_cents, 0),
  };
}

export interface LigneCommande {
  id: string;
  reference: string;
  createdAt: string;
  nom: string;
  ville: string | null;
  status: OrderStatus;
  paymentMethod: string | null;
  paymentStatus: string;
  totalCents: number;
  volumeM3: number;
  confirmedDeliveryDate: string | null;
}

export async function listerCommandes(
  companyId: string,
  filtre?: string,
): Promise<LigneCommande[]> {
  const supabase = createSupabaseAdminClient();

  let requete = supabase
    .from("orders")
    .select(
      `id, reference, created_at, first_name, last_name, status, payment_method,
       payment_status, total_cents, total_volume_m3, confirmed_delivery_date, shipping_address`,
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filtre === "a_confirmer") {
    requete = requete.is("confirmed_delivery_date", null).in("status", ["a_preparer", "payee", "prete"]);
  } else if (filtre === "a_traiter") {
    // « Prête » et « planifiée » restent à traiter : le bois n'est pas livré.
    requete = requete.in("status", [
      "nouvelle",
      "en_attente_paiement",
      "payee",
      "a_preparer",
      "prete",
      "planifiee",
    ]);
  } else if (filtre && filtre !== "toutes") {
    requete = requete.eq("status", filtre);
  }

  const { data, error } = await requete;
  if (error) {
    console.error("[admin] listerCommandes :", error.message);
    return [];
  }

  return (data ?? []).map((o) => ({
    id: o.id,
    reference: o.reference,
    createdAt: o.created_at,
    nom: `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim() || "—",
    ville: (o.shipping_address as { city?: string } | null)?.city ?? null,
    status: o.status as OrderStatus,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    totalCents: o.total_cents,
    volumeM3: Number(o.total_volume_m3),
    confirmedDeliveryDate: o.confirmed_delivery_date,
  }));
}
