import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  coutReelLivraisonCents,
  evolutionPourcent,
  pourcentage,
  predireProchaineCommande,
  projeterStock,
  type PrioriteStock,
} from "@/domain/statistics";

const JOUR_MS = 86_400_000;

export type ClePeriode = "30j" | "90j" | "saison" | "12m" | "personnalisee";

export interface PeriodeStatistiques {
  cle: ClePeriode;
  debut: Date;
  fin: Date;
  debutPrecedent: Date;
  finPrecedent: Date;
  libelle: string;
}

function dateValide(valeur: string | undefined): Date | null {
  if (!valeur || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const date = new Date(`${valeur}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ajouterJours(date: Date, jours: number): Date {
  return new Date(date.getTime() + jours * JOUR_MS);
}

function formatterDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function resoudrePeriodeStatistiques(entree: {
  periode?: string;
  debut?: string;
  fin?: string;
}): PeriodeStatistiques {
  const maintenant = new Date();
  const fin = maintenant;
  let cle: ClePeriode = "30j";
  let debut = ajouterJours(fin, -30);

  if (entree.periode === "90j") {
    cle = "90j";
    debut = ajouterJours(fin, -90);
  } else if (entree.periode === "12m") {
    cle = "12m";
    debut = ajouterJours(fin, -365);
  } else if (entree.periode === "saison") {
    cle = "saison";
    const annee = fin.getUTCFullYear();
    const mois = fin.getUTCMonth();
    debut = new Date(Date.UTC(mois >= 8 ? annee : annee - 1, 8, 1));
  } else if (entree.periode === "personnalisee") {
    const personnaliseDebut = dateValide(entree.debut);
    const personnaliseFin = dateValide(entree.fin);
    if (personnaliseDebut && personnaliseFin && personnaliseDebut <= personnaliseFin) {
      cle = "personnalisee";
      debut = personnaliseDebut;
      // Le jour de fin est inclus dans l'interface, donc borne SQL exclusive à J+1.
      const finIncluse = ajouterJours(personnaliseFin, 1);
      const duree = finIncluse.getTime() - debut.getTime();
      return {
        cle,
        debut,
        fin: finIncluse,
        debutPrecedent: new Date(debut.getTime() - duree),
        finPrecedent: debut,
        libelle: `${formatterDate(debut)} – ${formatterDate(personnaliseFin)}`,
      };
    }
  }

  const duree = fin.getTime() - debut.getTime();
  return {
    cle,
    debut,
    fin,
    debutPrecedent: new Date(debut.getTime() - duree),
    finPrecedent: debut,
    libelle:
      cle === "saison"
        ? `Saison depuis le ${formatterDate(debut)}`
        : `${formatterDate(debut)} – ${formatterDate(fin)}`,
  };
}

type ItemCommande = {
  variant_id: string | null;
  product_name: string;
  species_label: string | null;
  cut_length_cm: number | null;
  line_volume_m3: number;
  line_total_cents: number;
};

type CommandeStats = {
  id: string;
  reference: string;
  created_at: string;
  source: string;
  status: string;
  payment_status: string;
  email: string;
  phone: string | null;
  promotion_code: string | null;
  first_name: string | null;
  last_name: string | null;
  subtotal_cents: number;
  discount_cents: number;
  delivery_total_cents: number;
  total_cents: number;
  total_volume_m3: number;
  fulfillment_type: string;
  distance_km: number | null;
  fuel_price_snapshot_cents: number | null;
  zone_id: string | null;
  vehicle_id: string | null;
  acquisition_source: string | null;
  quote_pdf_before_order: boolean;
  delivery_zones: { name: string } | null;
  vehicles: {
    fuel_consumption_l_per_100km: number;
    cost_per_km_cents: number;
  } | null;
  order_items: ItemCommande[];
};

type VarianteStock = {
  id: string;
  sku: string;
  stock_on_hand: number;
  stock_reserved: number;
  stock_available: number | null;
  low_stock_threshold: number;
  products: { name: string } | null;
  cut_lengths: { label: string } | null;
};

export interface LigneRepartition {
  cle: string;
  libelle: string;
  commandes: number;
  caCents: number;
  volumeM3: number;
  partCommandesPct: number | null;
  partCaPct: number | null;
}

export interface LignePrixM3 {
  cle: string;
  libelle: string;
  prixMoyenCents: number;
  volumeM3: number;
  caBoisCents: number;
}

export interface EtapeTunnel {
  cle: string;
  libelle: string;
  total: number;
  abandonAvantSuivante: number | null;
  conversionSuivantePct: number | null;
}

export interface LignePerte {
  motif: string;
  libelle: string;
  occurrences: number;
  caPotentielCents: number;
  volumePotentielM3: number;
}

export interface LigneStock {
  id: string;
  libelle: string;
  sku: string;
  disponibleM3: number;
  reserveM3: number;
  vitesseM3ParSemaine: number;
  joursRestants: number | null;
  rupturePrevueLe: string | null;
  priorite: PrioriteStock;
}

export interface LigneZone {
  zone: string;
  livraisons: number;
  fraisFacturesCents: number;
  coutEstimeCents: number;
  margeCents: number;
  rentabilitePct: number | null;
  delaiMoyenJours: number | null;
  coutIncomplet: number;
}

export interface ClientAReactiver {
  email: string;
  nom: string;
  telephone: string | null;
  commandes: number;
  totalCents: number;
  derniereCommandeLe: string;
  prochaineCommandePrevueLe: string;
  intervalleJours: number;
  ecartJours: number;
}

export interface RapportStatistiques {
  periode: PeriodeStatistiques;
  couvertureAnalyticsDepuis: string | null;
  synthese: {
    caCents: number;
    commandes: number;
    volumeM3: number;
    panierMoyenCents: number | null;
    prixMoyenM3Cents: number | null;
    evolutionCaPct: number | null;
    evolutionCommandesPct: number | null;
  };
  origines: LigneRepartition[];
  tauxAutomatisationCommandesPct: number | null;
  tauxAutomatisationCaPct: number | null;
  tunnel: EtapeTunnel[];
  pertes: LignePerte[];
  pertesTotal: { occurrences: number; caPotentielCents: number; volumePotentielM3: number };
  prixParEssence: LignePrixM3[];
  prixParLongueur: LignePrixM3[];
  prixParZone: LignePrixM3[];
  prixParMois: LignePrixM3[];
  stock: LigneStock[];
  devis: {
    recus: number;
    envoyes: number;
    acceptes: number;
    refuses: number;
    conversionPct: number | null;
    montantGagneCents: number;
    montantPerduCents: number;
    delaiReponseHeures: number | null;
  };
  zones: LigneZone[];
  delaiLivraisonGlobalJours: number | null;
  clientsAReactiver: ClientAReactiver[];
  secondaire: {
    annulations: number;
    montantAnnuleCents: number;
    remboursements: number;
    montantRembourseCents: number;
    promotions: Array<{
      code: string;
      commandes: number;
      caCents: number;
      remiseCents: number;
    }>;
    devisPdfTelecharges: number;
    commandesApresDevisPdf: number;
    caApresDevisPdfCents: number;
    conversionDevisPdfPct: number | null;
    commandesSeo: number;
    caSeoCents: number;
  };
}

function estDansPeriode(dateIso: string, debut: Date, fin: Date): boolean {
  const date = new Date(dateIso).getTime();
  return date >= debut.getTime() && date < fin.getTime();
}

function arrondir3(valeur: number): number {
  return Math.round(valeur * 1000) / 1000;
}

function moyenne(valeurs: number[]): number | null {
  return valeurs.length ? valeurs.reduce((somme, valeur) => somme + valeur, 0) / valeurs.length : null;
}

function regrouperPrix(
  lignes: Array<{ cle: string; libelle: string; revenuCents: number; volumeM3: number }>,
): LignePrixM3[] {
  const groupes = new Map<string, LignePrixM3>();
  for (const ligne of lignes) {
    const existante = groupes.get(ligne.cle) ?? {
      cle: ligne.cle,
      libelle: ligne.libelle,
      prixMoyenCents: 0,
      volumeM3: 0,
      caBoisCents: 0,
    };
    existante.volumeM3 += ligne.volumeM3;
    existante.caBoisCents += ligne.revenuCents;
    groupes.set(ligne.cle, existante);
  }
  return [...groupes.values()]
    .map((groupe) => ({
      ...groupe,
      volumeM3: arrondir3(groupe.volumeM3),
      prixMoyenCents:
        groupe.volumeM3 > 0 ? Math.round(groupe.caBoisCents / groupe.volumeM3) : 0,
    }))
    .sort((a, b) => b.volumeM3 - a.volumeM3);
}

function lireNombreReglage(
  lignes: Array<{ key: string; value: unknown }>,
  cle: string,
  repli: number,
): number {
  const valeur = lignes.find((ligne) => ligne.key === cle)?.value;
  return typeof valeur === "number" && Number.isFinite(valeur) ? valeur : repli;
}

export async function getRapportStatistiques(
  companyId: string,
  periode: PeriodeStatistiques,
): Promise<RapportStatistiques> {
  const supabase = createSupabaseAdminClient();
  const debutHistorique = new Date(Math.min(
    periode.debutPrecedent.getTime(),
    Date.now() - 3 * 365 * JOUR_MS,
  ));

  const typesTunnel = ["visit", "cart", "zone_check", "slot", "payment", "order"] as const;
  const requetesTunnel = typesTunnel.map((type) =>
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("event_type", type)
      .gte("occurred_at", periode.debut.toISOString())
      .lt("occurred_at", periode.fin.toISOString()),
  );

  const [
    commandesResultat,
    variantesResultat,
    devisResultat,
    paiementsResultat,
    livraisonsResultat,
    pertesResultat,
    couvertureResultat,
    reglagesResultat,
    devisPdfResultat,
    ...tunnelResultats
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, reference, created_at, source, status, payment_status, email, phone,
         first_name, last_name, promotion_code, subtotal_cents, discount_cents, delivery_total_cents,
         total_cents, total_volume_m3, fulfillment_type, distance_km,
         fuel_price_snapshot_cents, zone_id, vehicle_id, acquisition_source,
         quote_pdf_before_order,
         delivery_zones ( name ),
         vehicles ( fuel_consumption_l_per_100km, cost_per_km_cents ),
         order_items (
           variant_id, product_name, species_label, cut_length_cm,
           line_volume_m3, line_total_cents
         )`,
      )
      .eq("company_id", companyId)
      .gte("created_at", debutHistorique.toISOString())
      .order("created_at", { ascending: true })
      .range(0, 9999),
    supabase
      .from("product_variants")
      .select(
        `id, sku, stock_on_hand, stock_reserved, stock_available, low_stock_threshold,
         products ( name ), cut_lengths ( label )`,
      )
      .eq("company_id", companyId)
      .eq("is_active", true),
    supabase
      .from("quote_requests")
      .select("id, status, created_at, responded_at, estimated_total_cents")
      .eq("company_id", companyId)
      .gte("created_at", periode.debut.toISOString())
      .lt("created_at", periode.fin.toISOString())
      .range(0, 4999),
    supabase
      .from("payments")
      .select("amount_cents, status, created_at, received_at")
      .eq("company_id", companyId)
      .gte("created_at", periode.debut.toISOString())
      .lt("created_at", periode.fin.toISOString())
      .range(0, 4999),
    supabase
      .from("order_status_history")
      .select("order_id, created_at")
      .eq("company_id", companyId)
      .eq("to_status", "livree")
      .gte("created_at", periode.debut.toISOString())
      .lt("created_at", periode.fin.toISOString())
      .range(0, 4999),
    supabase
      .from("analytics_events")
      .select("reason, potential_revenue_cents, potential_volume_m3")
      .eq("company_id", companyId)
      .eq("event_type", "lost_demand")
      .gte("occurred_at", periode.debut.toISOString())
      .lt("occurred_at", periode.fin.toISOString())
      .range(0, 4999),
    supabase
      .from("analytics_sessions")
      .select("started_at")
      .eq("company_id", companyId)
      .order("started_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("company_settings")
      .select("key, value")
      .eq("company_id", companyId)
      .like("key", "statistics.%"),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("event_type", "quote_pdf")
      .gte("occurred_at", periode.debut.toISOString())
      .lt("occurred_at", periode.fin.toISOString()),
    ...requetesTunnel,
  ]);

  const erreurs = [
    commandesResultat.error,
    variantesResultat.error,
    devisResultat.error,
    paiementsResultat.error,
    livraisonsResultat.error,
    pertesResultat.error,
    couvertureResultat.error,
    reglagesResultat.error,
    devisPdfResultat.error,
    ...tunnelResultats.map((resultat) => resultat.error),
  ].filter(Boolean);
  if (erreurs.length > 0) {
    console.error(
      "[statistiques] chargement incomplet :",
      erreurs.map((erreur) => erreur?.message).join(" · "),
    );
    throw new Error("Les données statistiques ne sont pas disponibles.");
  }

  const commandes = (commandesResultat.data ?? []) as unknown as CommandeStats[];
  const variantes = (variantesResultat.data ?? []) as unknown as VarianteStock[];
  const commandesPeriode = commandes.filter((commande) =>
    estDansPeriode(commande.created_at, periode.debut, periode.fin),
  );
  const commandesPrecedentes = commandes.filter((commande) =>
    estDansPeriode(commande.created_at, periode.debutPrecedent, periode.finPrecedent),
  );
  const ventes = commandesPeriode.filter((commande) => commande.status !== "annulee");
  const ventesPrecedentes = commandesPrecedentes.filter((commande) => commande.status !== "annulee");

  const caCents = ventes.reduce((somme, commande) => somme + commande.total_cents, 0);
  const volumeM3 = ventes.reduce((somme, commande) => somme + Number(commande.total_volume_m3), 0);
  const caPrecedent = ventesPrecedentes.reduce((somme, commande) => somme + commande.total_cents, 0);

  const lignesPrix: Array<{
    essence: string;
    longueur: string;
    zone: string;
    mois: string;
    revenuCents: number;
    volumeM3: number;
  }> = [];
  for (const commande of ventes) {
    const sousTotal = Math.max(0, commande.subtotal_cents);
    const revenuBois = Math.max(0, sousTotal - commande.discount_cents);
    for (const item of commande.order_items ?? []) {
      const part = sousTotal > 0 ? item.line_total_cents / sousTotal : 0;
      lignesPrix.push({
        essence: item.species_label?.trim() || item.product_name,
        longueur: item.cut_length_cm ? `${item.cut_length_cm} cm` : "Longueur non renseignée",
        zone: commande.delivery_zones?.name ?? (commande.fulfillment_type === "pickup" ? "Retrait" : "Sans zone"),
        mois: commande.created_at.slice(0, 7),
        revenuCents: Math.round(revenuBois * part),
        volumeM3: Number(item.line_volume_m3),
      });
    }
  }

  const caBoisCents = lignesPrix.reduce((somme, ligne) => somme + ligne.revenuCents, 0);
  const volumeBoisM3 = lignesPrix.reduce((somme, ligne) => somme + ligne.volumeM3, 0);

  const libellesOrigine: Record<string, string> = {
    web: "Site web",
    phone: "Téléphone",
    admin: "Saisie admin",
  };
  const origines = ["web", "phone", "admin"].map((source) => {
    const lignes = ventes.filter((commande) => commande.source === source);
    const ca = lignes.reduce((somme, commande) => somme + commande.total_cents, 0);
    return {
      cle: source,
      libelle: libellesOrigine[source],
      commandes: lignes.length,
      caCents: ca,
      volumeM3: arrondir3(lignes.reduce((somme, commande) => somme + Number(commande.total_volume_m3), 0)),
      partCommandesPct: pourcentage(lignes.length, ventes.length),
      partCaPct: pourcentage(ca, caCents),
    };
  });

  const totauxTunnel = tunnelResultats.map((resultat) => resultat.count ?? 0);
  const libellesTunnel = [
    "Visiteurs",
    "Panier avec produit",
    "Zone vérifiée",
    "Créneau consulté",
    "Paiement consulté",
    "Commande créée",
  ];
  const tunnel = typesTunnel.map((cle, index) => {
    const suivante = totauxTunnel[index + 1];
    return {
      cle,
      libelle: libellesTunnel[index],
      total: totauxTunnel[index],
      abandonAvantSuivante:
        suivante === undefined ? null : Math.max(0, totauxTunnel[index] - suivante),
      conversionSuivantePct:
        suivante === undefined ? null : pourcentage(suivante, totauxTunnel[index]),
    };
  });

  const libellesPertes: Record<string, string> = {
    out_of_zone: "Commune hors zone",
    unknown_postal_code: "Code postal inconnu",
    out_of_stock: "Produit en rupture",
    no_slot: "Aucun créneau disponible",
    payment_failed: "Paiement échoué",
  };
  const pertesMap = new Map<string, LignePerte>();
  for (const perte of pertesResultat.data ?? []) {
    const motif = perte.reason ?? "inconnu";
    const ligne = pertesMap.get(motif) ?? {
      motif,
      libelle: libellesPertes[motif] ?? "Autre blocage",
      occurrences: 0,
      caPotentielCents: 0,
      volumePotentielM3: 0,
    };
    ligne.occurrences += 1;
    ligne.caPotentielCents += perte.potential_revenue_cents ?? 0;
    ligne.volumePotentielM3 += Number(perte.potential_volume_m3 ?? 0);
    pertesMap.set(motif, ligne);
  }
  const pertes = [...pertesMap.values()].sort((a, b) => b.caPotentielCents - a.caPotentielCents);

  const reglages = (reglagesResultat.data ?? []) as Array<{ key: string; value: unknown }>;
  const joursVitesse = lireNombreReglage(reglages, "statistics.stock_velocity_days", 90);
  const seuilUrgent = lireNombreReglage(reglages, "statistics.stock_urgent_days", 14);
  const seuilAlerte = lireNombreReglage(reglages, "statistics.stock_warning_days", 30);
  const debutVitesse = ajouterJours(new Date(), -joursVitesse);
  const ventesVitesse = commandes.filter(
    (commande) => commande.status !== "annulee" && new Date(commande.created_at) >= debutVitesse,
  );
  const volumeParVariante = new Map<string, number>();
  for (const commande of ventesVitesse) {
    for (const item of commande.order_items ?? []) {
      if (item.variant_id) {
        volumeParVariante.set(
          item.variant_id,
          (volumeParVariante.get(item.variant_id) ?? 0) + Number(item.line_volume_m3),
        );
      }
    }
  }
  const stock = variantes
    .map((variante) => {
      const projection = projeterStock({
        stockDisponibleM3: Number(variante.stock_available ?? 0),
        volumeVenduM3: volumeParVariante.get(variante.id) ?? 0,
        joursObserves: joursVitesse,
        seuilUrgentJours: seuilUrgent,
        seuilAlerteJours: seuilAlerte,
      });
      return {
        id: variante.id,
        libelle: `${variante.products?.name ?? "Produit"}${variante.cut_lengths?.label ? ` · ${variante.cut_lengths.label}` : ""}`,
        sku: variante.sku,
        disponibleM3: Number(variante.stock_available ?? 0),
        reserveM3: Number(variante.stock_reserved),
        vitesseM3ParSemaine: arrondir3(projection.vitesseM3ParJour * 7),
        joursRestants:
          projection.joursRestants === null ? null : Math.round(projection.joursRestants),
        rupturePrevueLe:
          projection.joursRestants === null
            ? null
            : ajouterJours(new Date(), Math.ceil(projection.joursRestants)).toISOString(),
        priorite: projection.priorite,
      } satisfies LigneStock;
    })
    .sort((a, b) => {
      const ordre: Record<PrioriteStock, number> = { urgent: 0, a_produire: 1, a_surveiller: 2, stable: 3 };
      return ordre[a.priorite] - ordre[b.priorite] || (a.joursRestants ?? Infinity) - (b.joursRestants ?? Infinity);
    });

  const devis = devisResultat.data ?? [];
  const decisifs = devis.filter((d) => d.status === "accepte" || d.status === "refuse");
  const delaisDevis = devis
    .filter((d) => d.responded_at)
    .map((d) => (new Date(d.responded_at!).getTime() - new Date(d.created_at).getTime()) / 3_600_000)
    .filter((delai) => delai >= 0);

  const commandeParId = new Map(commandes.map((commande) => [commande.id, commande]));
  const delaisParZone = new Map<string, number[]>();
  const tousDelaisLivraison: number[] = [];
  for (const historique of livraisonsResultat.data ?? []) {
    const commande = commandeParId.get(historique.order_id);
    if (!commande) continue;
    const delai = (new Date(historique.created_at).getTime() - new Date(commande.created_at).getTime()) / JOUR_MS;
    if (delai < 0) continue;
    tousDelaisLivraison.push(delai);
    const zone = commande.delivery_zones?.name ?? "Sans zone";
    delaisParZone.set(zone, [...(delaisParZone.get(zone) ?? []), delai]);
  }

  const zonesMap = new Map<string, LigneZone>();
  for (const commande of ventes.filter(
    (ligne) => ligne.fulfillment_type === "delivery" && ligne.status === "livree",
  )) {
    const zone = commande.delivery_zones?.name ?? "Sans zone";
    const ligne = zonesMap.get(zone) ?? {
      zone,
      livraisons: 0,
      fraisFacturesCents: 0,
      coutEstimeCents: 0,
      margeCents: 0,
      rentabilitePct: null,
      delaiMoyenJours: null,
      coutIncomplet: 0,
    };
    ligne.livraisons += 1;
    ligne.fraisFacturesCents += commande.delivery_total_cents;
    if (commande.distance_km !== null && commande.fuel_price_snapshot_cents && commande.vehicles) {
      ligne.coutEstimeCents += coutReelLivraisonCents({
        distanceKm: Number(commande.distance_km),
        consommationLitres100Km: Number(commande.vehicles.fuel_consumption_l_per_100km),
        prixCarburantCentsLitre: commande.fuel_price_snapshot_cents,
        coutVehiculeCentsKm: commande.vehicles.cost_per_km_cents,
      });
    } else {
      ligne.coutIncomplet += 1;
    }
    zonesMap.set(zone, ligne);
  }
  const zones = [...zonesMap.values()]
    .map((zone) => ({
      ...zone,
      margeCents: zone.fraisFacturesCents - zone.coutEstimeCents,
      rentabilitePct: pourcentage(
        zone.fraisFacturesCents - zone.coutEstimeCents,
        zone.fraisFacturesCents,
      ),
      delaiMoyenJours: moyenne(delaisParZone.get(zone.zone) ?? []),
    }))
    .sort((a, b) => b.fraisFacturesCents - a.fraisFacturesCents);

  const historiqueClients = new Map<string, CommandeStats[]>();
  for (const commande of commandes.filter((ligne) => ligne.status !== "annulee")) {
    const email = commande.email.trim().toLowerCase();
    if (!email) continue;
    historiqueClients.set(email, [...(historiqueClients.get(email) ?? []), commande]);
  }
  const maintenant = new Date();
  const fenetre = lireNombreReglage(reglages, "statistics.reactivation_window_days", 45);
  const retardMax = lireNombreReglage(reglages, "statistics.reactivation_overdue_days", 90);
  const clientsAReactiver: ClientAReactiver[] = [];
  for (const [email, commandesClient] of historiqueClients) {
    const triees = commandesClient.toSorted(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const prediction = predireProchaineCommande(triees.map((commande) => commande.created_at));
    if (!prediction) continue;
    const ecartJours = Math.round(
      (new Date(prediction.datePrevue).getTime() - maintenant.getTime()) / JOUR_MS,
    );
    if (ecartJours < -retardMax || ecartJours > fenetre) continue;
    const derniere = triees.at(-1)!;
    clientsAReactiver.push({
      email,
      nom: `${derniere.first_name ?? ""} ${derniere.last_name ?? ""}`.trim() || email,
      telephone: derniere.phone,
      commandes: triees.length,
      totalCents: triees.reduce((somme, commande) => somme + commande.total_cents, 0),
      derniereCommandeLe: derniere.created_at,
      prochaineCommandePrevueLe: prediction.datePrevue,
      intervalleJours: prediction.intervalleJours,
      ecartJours,
    });
  }
  clientsAReactiver.sort((a, b) => a.ecartJours - b.ecartJours);

  const annulees = commandesPeriode.filter((commande) => commande.status === "annulee");
  const remboursements = (paiementsResultat.data ?? []).filter((paiement) => paiement.status === "refunded");
  const promotionsMap = new Map<string, { code: string; commandes: number; caCents: number; remiseCents: number }>();
  for (const commande of ventes.filter((ligne) => Boolean(ligne.promotion_code))) {
    const code = commande.promotion_code!;
    const promo = promotionsMap.get(code) ?? { code, commandes: 0, caCents: 0, remiseCents: 0 };
    promo.commandes += 1;
    promo.caCents += commande.total_cents;
    promo.remiseCents += commande.discount_cents;
    promotionsMap.set(code, promo);
  }
  const apresPdf = ventes.filter((commande) => commande.quote_pdf_before_order);
  const seo = ventes.filter((commande) => commande.acquisition_source === "seo");

  return {
    periode,
    couvertureAnalyticsDepuis: couvertureResultat.data?.started_at ?? null,
    synthese: {
      caCents,
      commandes: ventes.length,
      volumeM3: arrondir3(volumeM3),
      panierMoyenCents: ventes.length ? Math.round(caCents / ventes.length) : null,
      prixMoyenM3Cents: volumeBoisM3 > 0 ? Math.round(caBoisCents / volumeBoisM3) : null,
      evolutionCaPct: evolutionPourcent(caCents, caPrecedent),
      evolutionCommandesPct: evolutionPourcent(ventes.length, ventesPrecedentes.length),
    },
    origines,
    tauxAutomatisationCommandesPct: pourcentage(
      origines.find((origine) => origine.cle === "web")?.commandes ?? 0,
      ventes.length,
    ),
    tauxAutomatisationCaPct: pourcentage(
      origines.find((origine) => origine.cle === "web")?.caCents ?? 0,
      caCents,
    ),
    tunnel,
    pertes,
    pertesTotal: {
      occurrences: pertes.reduce((somme, perte) => somme + perte.occurrences, 0),
      caPotentielCents: pertes.reduce((somme, perte) => somme + perte.caPotentielCents, 0),
      volumePotentielM3: arrondir3(pertes.reduce((somme, perte) => somme + perte.volumePotentielM3, 0)),
    },
    prixParEssence: regrouperPrix(lignesPrix.map((l) => ({ cle: l.essence, libelle: l.essence, revenuCents: l.revenuCents, volumeM3: l.volumeM3 }))),
    prixParLongueur: regrouperPrix(lignesPrix.map((l) => ({ cle: l.longueur, libelle: l.longueur, revenuCents: l.revenuCents, volumeM3: l.volumeM3 }))),
    prixParZone: regrouperPrix(lignesPrix.map((l) => ({ cle: l.zone, libelle: l.zone, revenuCents: l.revenuCents, volumeM3: l.volumeM3 }))),
    prixParMois: regrouperPrix(lignesPrix.map((l) => ({ cle: l.mois, libelle: l.mois, revenuCents: l.revenuCents, volumeM3: l.volumeM3 }))).sort((a, b) => a.cle.localeCompare(b.cle)),
    stock,
    devis: {
      recus: devis.length,
      envoyes: devis.filter((d) => d.responded_at !== null).length,
      acceptes: devis.filter((d) => d.status === "accepte").length,
      refuses: devis.filter((d) => d.status === "refuse").length,
      conversionPct: pourcentage(
        devis.filter((d) => d.status === "accepte").length,
        decisifs.length,
      ),
      montantGagneCents: devis
        .filter((d) => d.status === "accepte")
        .reduce((somme, d) => somme + (d.estimated_total_cents ?? 0), 0),
      montantPerduCents: devis
        .filter((d) => d.status === "refuse")
        .reduce((somme, d) => somme + (d.estimated_total_cents ?? 0), 0),
      delaiReponseHeures: moyenne(delaisDevis),
    },
    zones,
    delaiLivraisonGlobalJours: moyenne(tousDelaisLivraison),
    clientsAReactiver: clientsAReactiver.slice(0, 20),
    secondaire: {
      annulations: annulees.length,
      montantAnnuleCents: annulees.reduce((somme, commande) => somme + commande.total_cents, 0),
      remboursements: remboursements.length,
      montantRembourseCents: remboursements.reduce((somme, paiement) => somme + paiement.amount_cents, 0),
      promotions: [...promotionsMap.values()].sort((a, b) => b.caCents - a.caCents),
      devisPdfTelecharges: devisPdfResultat.count ?? 0,
      commandesApresDevisPdf: apresPdf.length,
      caApresDevisPdfCents: apresPdf.reduce((somme, commande) => somme + commande.total_cents, 0),
      conversionDevisPdfPct: pourcentage(apresPdf.length, devisPdfResultat.count ?? 0),
      commandesSeo: seo.length,
      caSeoCents: seo.reduce((somme, commande) => somme + commande.total_cents, 0),
    },
  };
}
