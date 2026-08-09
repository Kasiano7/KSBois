import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  deciderReleve,
  departementDepuisCodePostal,
  type DecisionReleve,
} from "@/domain/carburant";

/**
 * Relevé automatique du prix du gazole — docs/02-MOTEURS-METIER.md §2.4
 *
 * Source : open data officiel `data.economie.gouv.fr`, jeu de données « prix des
 * carburants en France — flux instantané ». Gratuit, sans clé, officiel. On ne
 * scrape aucun site de distributeur : ça casserait au premier changement de page
 * et ce serait juridiquement discutable.
 */

const API =
  "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/" +
  "prix-des-carburants-en-france-flux-instantane-v2/records";

/** Le département compte rarement plus de 200 stations. */
const LIMITE = 100;

export interface ResultatReleve {
  companyId: string;
  entreprise: string;
  departement: string | null;
  decision: DecisionReleve | null;
  enregistre: boolean;
  erreur?: string;
}

interface StationApi {
  gazole_prix: number | null;
}

/**
 * Interroge l'API pour un département donné et renvoie les prix du gazole.
 * Toute erreur réseau est remontée : on préfère ne rien écrire plutôt
 * qu'écrire une valeur douteuse.
 */
async function lirePrixDepartement(departement: string): Promise<number[]> {
  const parametres = new URLSearchParams({
    where: `code_departement="${departement}" AND gazole_prix IS NOT NULL`,
    select: "gazole_prix",
    limit: String(LIMITE),
  });

  const reponse = await fetch(`${API}?${parametres}`, {
    headers: { Accept: "application/json" },
    // Un relevé quotidien ne doit jamais être servi depuis un cache.
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!reponse.ok) {
    throw new Error(`API carburant : HTTP ${reponse.status}`);
  }

  const donnees = (await reponse.json()) as { results?: StationApi[] };
  return (donnees.results ?? [])
    .map((s) => s.gazole_prix)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p));
}

/**
 * Relève le prix pour toutes les entreprises actives.
 *
 * Le relevé est fait par département : deux entreprises du même département
 * partagent le même appel réseau grâce au cache local.
 */
export async function releverPrixCarburant(): Promise<ResultatReleve[]> {
  const supabase = createSupabaseAdminClient();

  const { data: entreprises, error } = await supabase
    .from("companies")
    .select("id, name, postal_code")
    .eq("is_active", true);

  if (error) throw new Error(`Lecture des entreprises : ${error.message}`);

  const parDepartement = new Map<string, number[]>();
  const resultats: ResultatReleve[] = [];

  for (const entreprise of entreprises ?? []) {
    const departement = entreprise.postal_code
      ? departementDepuisCodePostal(entreprise.postal_code)
      : null;

    if (!departement) {
      resultats.push({
        companyId: entreprise.id,
        entreprise: entreprise.name,
        departement: null,
        decision: null,
        enregistre: false,
        erreur: "Code postal de l'entreprise absent ou invalide.",
      });
      continue;
    }

    try {
      let prix = parDepartement.get(departement);
      if (!prix) {
        prix = await lirePrixDepartement(departement);
        parDepartement.set(departement, prix);
      }

      // Référence : uniquement le dernier relevé APPLIQUÉ. Comparer à un relevé
      // refusé ferait dériver le contrôle de sanité.
      const { data: dernier } = await supabase
        .from("fuel_prices")
        .select("price_per_liter_cents")
        .eq("company_id", entreprise.id)
        .eq("applied", true)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const decision = deciderReleve(prix, dernier?.price_per_liter_cents ?? null);

      if (!decision.applicable) {
        console.warn(
          `[carburant] ${entreprise.name} : relevé refusé (${decision.raison}), ` +
            `${decision.prixCents} c/L sur ${decision.echantillon} station(s).`,
        );
      }

      // On enregistre TOUJOURS, en marquant si le relevé fait foi. Un relevé
      // refusé mais conservé permet à l'exploitant de l'accepter en un clic si la
      // hausse est réelle, et rend visible une source défaillante.
      const { error: erreurInsert } = await supabase.from("fuel_prices").insert({
        company_id: entreprise.id,
        fuel_type: "gazole",
        price_per_liter_cents: decision.prixCents,
        source: "data.economie.gouv.fr",
        sample_size: decision.echantillon,
        department: departement,
        applied: decision.applicable,
        rejected_reason: decision.applicable ? null : decision.raison,
      });

      if (erreurInsert) throw new Error(erreurInsert.message);

      resultats.push({
        companyId: entreprise.id,
        entreprise: entreprise.name,
        departement,
        decision,
        enregistre: decision.applicable,
      });
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      console.error(`[carburant] ${entreprise.name} :`, message);
      resultats.push({
        companyId: entreprise.id,
        entreprise: entreprise.name,
        departement,
        decision: null,
        enregistre: false,
        erreur: message,
      });
    }
  }

  return resultats;
}
