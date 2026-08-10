import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { DEPARTEMENTS_FRANCE } from "@/data/departements-france";
import {
  bornerDistanceRoute,
  cleCommune,
  COEFFICIENT_SINUOSITE,
  communesDansLeRayon,
  departementsCandidats,
  distanceVolOiseauKm,
  suggererZone,
  type Point,
  type SourceDistance,
  type ZoneParDistance,
} from "@/domain/secteur";
import { listerCommunesDepartements, geocoderAdresse } from "@/server/geo-communes";
import { distancesDepuisDepot } from "@/server/routage";

/**
 * Scan du secteur de livraison — docs/02-MOTEURS-METIER.md §2.1
 *
 * « Mon dépôt est à Villevocance, je livre à 25 km » : l'exploitant décrit son
 * métier, le système en déduit la liste des communes. Saisir les communes une
 * par une, c'est y passer une soirée ET en oublier — et une commune oubliée
 * n'est pas un détail : c'est un client qui lit « nous ne livrons pas chez
 * vous » alors que le camion passe devant chez lui.
 */

/** Au-delà, on n'appelle pas le routeur : c'est un rayon mal saisi. */
const MAX_COMMUNES = 400;

export interface CommuneProposee {
  /** Clé stable pour les cases à cocher : code INSEE + code postal. */
  cle: string;
  inseeCode: string;
  codePostal: string;
  ville: string;
  distanceKm: number;
  sourceDistance: SourceDistance;
  population: number | null;
  /** Déjà dans `zone_communes` : l'import ne fera que compléter la fiche. */
  dejaPresente: boolean;
  zoneActuelleNom: string | null;
  zoneSuggereeId: string | null;
  zoneSuggereeNom: string | null;
}

export interface CommuneHorsRayon {
  ville: string;
  codePostal: string;
  distanceKm: number | null;
}

export interface AnalyseSecteur {
  depot: Point;
  /** D'où viennent les coordonnées : réglages, ou déduites de l'adresse. */
  origineDepot: "reglages" | "geocodage";
  rayonKm: number;
  propositions: CommuneProposee[];
  nouvelles: number;
  /**
   * Communes à portée à vol d'oiseau mais trop loin par la route. Les compter
   * évite le « pourquoi ma voisine n'apparaît pas ? » : elle est à 12 km à vol
   * d'oiseau et à 40 km de route.
   */
  ecarteesParLaRoute: number;
  /** Communes actuellement desservies mais désormais au-delà du rayon. */
  horsRayon: CommuneHorsRayon[];
  avertissements: string[];
  tronque: boolean;
}

export type ResultatAnalyse =
  | { ok: true; analyse: AnalyseSecteur }
  | { ok: false; message: string };

interface EntrepriseSecteur {
  depot: Point;
  origineDepot: "reglages" | "geocodage";
}

/**
 * Point de départ des tournées.
 *
 * S'il n'est pas renseigné, on le déduit de l'adresse de l'entreprise et on
 * l'enregistre : demander une latitude à un exploitant de bois de chauffage
 * serait le meilleur moyen qu'il n'utilise jamais la fonctionnalité.
 */
async function resoudreDepot(companyId: string): Promise<EntrepriseSecteur | string> {
  const supabase = createSupabaseAdminClient();
  const { data: entreprise } = await supabase
    .from("companies")
    .select("depot_lat, depot_lng, address_line1, postal_code, city")
    .eq("id", companyId)
    .maybeSingle();

  if (!entreprise) return "Entreprise introuvable.";

  if (entreprise.depot_lat !== null && entreprise.depot_lng !== null) {
    return {
      depot: { lat: Number(entreprise.depot_lat), lng: Number(entreprise.depot_lng) },
      origineDepot: "reglages",
    };
  }

  const adresse = [entreprise.address_line1, entreprise.postal_code, entreprise.city]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!adresse) {
    return "Renseignez l'adresse ou les coordonnées du dépôt dans les réglages avant d'analyser le secteur.";
  }

  const geocodee = await geocoderAdresse(adresse);
  if (!geocodee) {
    return `L'adresse « ${adresse} » n'a pas été retrouvée. Saisissez la latitude et la longitude du dépôt dans les réglages.`;
  }

  await supabase
    .from("companies")
    .update({ depot_lat: geocodee.lat, depot_lng: geocodee.lng })
    .eq("id", companyId);

  return { depot: { lat: geocodee.lat, lng: geocodee.lng }, origineDepot: "geocodage" };
}

async function lireZones(companyId: string): Promise<ZoneParDistance[]> {
  const { data } = await createSupabaseAdminClient()
    .from("delivery_zones")
    .select("id, name, distance_km_estimate")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("sort_order");

  return (data ?? []).map((z) => ({
    id: z.id,
    nom: z.name,
    distanceKmEstimate: z.distance_km_estimate,
  }));
}

/**
 * Analyse le secteur sans rien écrire.
 *
 * La séparation analyse / import est délibérée : l'exploitant voit ce qui va
 * changer AVANT que sa grille tarifaire ne bouge. Un import direct sur clic
 * serait plus court à coder et beaucoup plus difficile à faire confiance.
 */
export async function analyserSecteur(
  companyId: string,
  rayonKm: number,
): Promise<ResultatAnalyse> {
  const resolution = await resoudreDepot(companyId);
  if (typeof resolution === "string") return { ok: false, message: resolution };

  const { depot, origineDepot } = resolution;
  const avertissements: string[] = [];

  const codesDepartements = departementsCandidats(depot, rayonKm, DEPARTEMENTS_FRANCE);
  const { communes, departementsEnEchec } = await listerCommunesDepartements(codesDepartements);

  if (communes.length === 0) {
    return {
      ok: false,
      message: "La base officielle des communes n'a pas répondu. Réessayez dans un instant.",
    };
  }
  if (departementsEnEchec.length > 0) {
    avertissements.push(
      `Départements non consultés : ${departementsEnEchec.join(", ")}. La liste est incomplète, relancez l'analyse plus tard.`,
    );
  }

  // Pré-filtre exact : une route ne peut pas être plus courte que le vol
  // d'oiseau, donc aucune commune éligible n'est écartée ici.
  const proches = communesDansLeRayon(depot, rayonKm, communes);
  const tronque = proches.length > MAX_COMMUNES;
  const retenues = proches.slice(0, MAX_COMMUNES);

  if (tronque) {
    avertissements.push(
      `${proches.length} communes sont dans ce rayon : seules les ${MAX_COMMUNES} plus proches sont analysées. Réduisez le rayon pour traiter le reste.`,
    );
  }

  const routage = await distancesDepuisDepot(depot, retenues);
  if (routage.degrade) {
    avertissements.push(
      `Le calculateur d'itinéraire n'a pas répondu pour toutes les communes : les distances concernées sont estimées à partir du vol d'oiseau (× ${COEFFICIENT_SINUOSITE.toLocaleString("fr-FR")}) et signalées « à vérifier ».`,
    );
  }

  const [zones, existantes] = await Promise.all([
    lireZones(companyId),
    createSupabaseAdminClient()
      .from("zone_communes")
      .select("postal_code, city, distance_km, is_served, delivery_zones ( name )")
      .eq("company_id", companyId),
  ]);

  const dejaConnues = new Map(
    (existantes.data ?? []).map((c) => [
      cleCommune(c.postal_code, c.city),
      {
        zoneNom: (c.delivery_zones as unknown as { name: string } | null)?.name ?? null,
        desservie: c.is_served,
        distanceKm: c.distance_km === null ? null : Number(c.distance_km),
      },
    ]),
  );

  const propositions: CommuneProposee[] = [];
  const clesDansLeRayon = new Set<string>();
  let ecarteesParLaRoute = 0;

  retenues.forEach((commune, i) => {
    const mesure = routage.distances[i];
    const distanceKm = mesure.km;

    // C'est la ROUTE qui décide, pas le vol d'oiseau : une commune de l'autre
    // côté d'une vallée peut être à 12 km à vol d'oiseau et 40 km de lacets.
    // Le pré-filtre géométrique n'était qu'un moyen de limiter les calculs.
    if (distanceKm > rayonKm) {
      ecarteesParLaRoute += 1;
      return;
    }

    const zoneSuggereeId = suggererZone(distanceKm, zones);
    const zoneSuggereeNom = zones.find((z) => z.id === zoneSuggereeId)?.nom ?? null;

    // Une commune porte parfois plusieurs codes postaux : il faut TOUTES les
    // lignes, sinon le client qui saisit le second code postal s'entend
    // répondre qu'on ne le livre pas. C'est exactement le trou constaté sur
    // les 07690 / 07100 / 07340 de la liste saisie à la main.
    for (const codePostal of commune.codesPostaux) {
      const cle = cleCommune(codePostal, commune.nom);
      clesDansLeRayon.add(cle);
      const connue = dejaConnues.get(cle);

      propositions.push({
        cle: `${commune.inseeCode}-${codePostal}`,
        inseeCode: commune.inseeCode,
        codePostal,
        ville: commune.nom,
        distanceKm,
        sourceDistance: mesure.source,
        population: commune.population,
        dejaPresente: connue !== undefined,
        zoneActuelleNom: connue?.zoneNom ?? null,
        zoneSuggereeId,
        zoneSuggereeNom,
      });
    }
  });

  // Le pré-filtre trie à vol d'oiseau ; l'écran, lui, doit afficher l'ordre des
  // kilomètres réellement parcourus — c'est le seul qui parle à l'exploitant.
  propositions.sort((a, b) => a.distanceKm - b.distanceKm || a.ville.localeCompare(b.ville, "fr"));

  // Communes desservies qui sortent du rayon : on ne les touche pas, mais
  // l'exploitant doit les voir — c'est souvent un rayon saisi trop court.
  const horsRayon: CommuneHorsRayon[] = (existantes.data ?? [])
    .filter((c) => c.is_served && !clesDansLeRayon.has(cleCommune(c.postal_code, c.city)))
    .map((c) => ({
      ville: c.city,
      codePostal: c.postal_code,
      distanceKm: c.distance_km === null ? null : Number(c.distance_km),
    }))
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

  return {
    ok: true,
    analyse: {
      depot,
      origineDepot,
      rayonKm,
      propositions,
      nouvelles: propositions.filter((p) => !p.dejaPresente).length,
      ecarteesParLaRoute,
      horsRayon,
      avertissements,
      tronque,
    },
  };
}

// -----------------------------------------------------------------------------
// Import
// -----------------------------------------------------------------------------

export interface CommuneAImporter {
  inseeCode: string;
  codePostal: string;
  ville: string;
  distanceKm: number;
  sourceDistance: SourceDistance;
  zoneId: string | null;
}

export interface ResultatImport {
  inserees: number;
  misesAJour: number;
  ignorees: number;
}

/** « 07342 » → « 07 », « 2A004 » → « 2A », « 97105 » → « 971 ». */
function departementDepuisInsee(inseeCode: string): string {
  return inseeCode.startsWith("97") || inseeCode.startsWith("98")
    ? inseeCode.slice(0, 3)
    : inseeCode.slice(0, 2);
}

/**
 * Importe les communes cochées.
 *
 * ⚠️ Les valeurs reçues du navigateur sont RECOUPÉES avec la base officielle
 * avant écriture. La distance alimente la surcharge carburant, donc une
 * facture : elle ne peut pas être ce que le formulaire affirme. Le nom, les
 * coordonnées et la population sont repris de la source officielle, et la
 * distance est bornée par la géométrie (une route n'est jamais plus courte que
 * le vol d'oiseau).
 */
export async function importerCommunes(
  companyId: string,
  selection: readonly CommuneAImporter[],
): Promise<ResultatImport> {
  const supabase = createSupabaseAdminClient();

  const depotResolu = await resoudreDepot(companyId);
  if (typeof depotResolu === "string") throw new Error(depotResolu);
  const { depot } = depotResolu;

  const departements = [...new Set(selection.map((c) => departementDepuisInsee(c.inseeCode)))];
  const { communes } = await listerCommunesDepartements(departements);
  const officielles = new Map(communes.map((c) => [c.inseeCode, c]));

  const { data: zones } = await supabase
    .from("delivery_zones")
    .select("id")
    .eq("company_id", companyId);
  const zonesValides = new Set((zones ?? []).map((z) => z.id));

  const lignes = selection.flatMap((choix) => {
    const officielle = officielles.get(choix.inseeCode);
    if (!officielle) return [];
    if (!officielle.codesPostaux.includes(choix.codePostal)) return [];

    const volOiseauKm = distanceVolOiseauKm(depot, officielle);
    const zoneId = choix.zoneId && zonesValides.has(choix.zoneId) ? choix.zoneId : null;

    return [
      {
        insee_code: officielle.inseeCode,
        postal_code: choix.codePostal,
        city: officielle.nom,
        distance_km: bornerDistanceRoute(choix.distanceKm, volOiseauKm),
        distance_source: choix.sourceDistance === "route" ? "route" : "vol_oiseau",
        centre_lat: officielle.lat,
        centre_lng: officielle.lng,
        population: officielle.population,
        zone_id: zoneId,
      },
    ];
  });

  if (lignes.length === 0) {
    return { inserees: 0, misesAJour: 0, ignorees: selection.length };
  }

  const { data, error } = await supabase.rpc("import_sector_communes", {
    p_company_id: companyId,
    p_communes: lignes,
  });

  if (error) {
    console.error("[secteur] import :", error.message);
    throw new Error("L'import n'a pas abouti.");
  }

  const compte = (data ?? {}) as { inserees?: number; mises_a_jour?: number };
  return {
    inserees: compte.inserees ?? 0,
    misesAJour: compte.mises_a_jour ?? 0,
    ignorees: selection.length - lignes.length,
  };
}
