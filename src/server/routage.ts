import "server-only";

import { estimerDistanceRouteKm, distanceVolOiseauKm, type Point } from "@/domain/secteur";

/**
 * Distances ROUTIÈRES depuis le dépôt — docs/02-MOTEURS-METIER.md §2.1
 *
 * L'exploitant raisonne en kilomètres de route, pas à vol d'oiseau : en Ardèche,
 * 20 km à vol d'oiseau peuvent faire 45 km de lacets, et c'est la route qui
 * consomme le gazole facturé au client (§2.3).
 *
 * Moteur : OSRM, service `table`, qui calcule en un appel les distances d'un
 * point vers N destinations. Le serveur public de démonstration est utilisé par
 * défaut ; il est gratuit mais sans engagement de service. `ROUTAGE_OSRM_URL`
 * permet de pointer une instance dédiée le jour où le volume le justifie.
 *
 * ⚠️ En cas d'échec, on ne bloque pas le scan : on retombe sur une estimation à
 * partir du vol d'oiseau, clairement marquée comme telle jusque dans le tableau
 * d'administration. Une distance approximative signalée vaut mieux qu'un écran
 * d'erreur — mais une distance approximative silencieuse serait pire que tout,
 * puisqu'elle finirait sur une facture.
 */

const BASE = process.env.ROUTAGE_OSRM_URL ?? "https://router.project-osrm.org";

/** Le service `table` public plafonne à 100 coordonnées par appel. */
const TAILLE_LOT = 90;

export interface DistanceRoutiere {
  km: number;
  source: "route" | "vol_oiseau";
}

const versKm = (metres: number) => Math.round(metres / 100) / 10;

function repli(origine: Point, destination: Point): DistanceRoutiere {
  return {
    km: estimerDistanceRouteKm(distanceVolOiseauKm(origine, destination)),
    source: "vol_oiseau",
  };
}

async function distancesLot(
  origine: Point,
  destinations: readonly Point[],
): Promise<DistanceRoutiere[]> {
  // OSRM attend « longitude,latitude », dans cet ordre. L'inverser donne des
  // distances absurdes plutôt qu'une erreur : c'est le piège classique.
  const points = [origine, ...destinations]
    .map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`)
    .join(";");

  const reponse = await fetch(
    `${BASE}/table/v1/driving/${points}?sources=0&annotations=distance`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!reponse.ok) throw new Error(`Routeur : HTTP ${reponse.status}`);

  const donnees = (await reponse.json()) as {
    code?: string;
    distances?: (number | null)[][];
  };

  if (donnees.code !== "Ok" || !donnees.distances?.[0]) {
    throw new Error(`Routeur : réponse « ${donnees.code ?? "vide"} »`);
  }

  // La première colonne est l'origine vers elle-même : on la retire.
  const mesures = donnees.distances[0].slice(1);

  return destinations.map((destination, i) => {
    const metres = mesures[i];
    // `null` = point non raccordé au réseau routier (hameau isolé, îlot).
    if (typeof metres !== "number" || !Number.isFinite(metres)) {
      return repli(origine, destination);
    }
    return { km: versKm(metres), source: "route" };
  });
}

export interface ResultatRoutage {
  distances: DistanceRoutiere[];
  /** Vrai dès qu'au moins une distance vient de l'estimation de repli. */
  degrade: boolean;
  motif: string | null;
}

/**
 * Distances du dépôt vers chaque destination, dans le même ordre.
 *
 * Les lots sont enchaînés séquentiellement : le serveur public est une
 * ressource partagée, et un scan de secteur n'est pas une opération pressée.
 */
export async function distancesDepuisDepot(
  depot: Point,
  destinations: readonly Point[],
): Promise<ResultatRoutage> {
  const distances: DistanceRoutiere[] = [];
  let motif: string | null = null;

  for (let debut = 0; debut < destinations.length; debut += TAILLE_LOT) {
    const lot = destinations.slice(debut, debut + TAILLE_LOT);
    try {
      distances.push(...(await distancesLot(depot, lot)));
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      console.error("[secteur] routage :", message);
      motif ??= message;
      distances.push(...lot.map((destination) => repli(depot, destination)));
    }
  }

  const degrade = distances.some((d) => d.source === "vol_oiseau");
  return {
    distances,
    degrade,
    motif: degrade ? (motif ?? "Certains points ne sont pas raccordés au réseau routier.") : null,
  };
}
