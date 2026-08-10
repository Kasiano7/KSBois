import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { listerZones, listerCommunes, listerRelevesCarburant, lireSecteur } from "@/server/admin-zones";
import { TesteurAdresse } from "@/components/admin/testeur-adresse";
import { PanneauCarburant } from "@/components/admin/panneau-carburant";
import { PanneauSecteur } from "@/components/admin/panneau-secteur";
import { CarteZone } from "@/components/admin/carte-zone";
import { TableCommunes } from "@/components/admin/table-communes";

export const metadata: Metadata = {
  title: "Zones de livraison",
  robots: { index: false, follow: false },
};

export default async function PageZones() {
  const session = await requireRole(["owner", "staff"], "/admin/livraison/zones");

  const [zones, communes, carburant, secteur] = await Promise.all([
    listerZones(session.companyId),
    listerCommunes(session.companyId),
    listerRelevesCarburant(session.companyId),
    lireSecteur(session.companyId),
  ]);

  // Les tarifs sont réservés au gérant ; le secrétariat peut affecter les
  // communes et renseigner les distances, mais pas fixer les prix.
  const peutModifierTarifs = session.role === "owner";

  const sansZone = communes.filter((c) => c.desservie && !c.zoneId);
  const sansDistance = communes.filter((c) => c.desservie && c.distanceKm === null);
  const zonesVides = zones.filter((z) => z.active && z.nbCommunes === 0);
  // Distance estimée à vol d'oiseau faute de réponse du calculateur : elle
  // facture du carburant, elle doit être relue.
  const distancesEstimees = communes.filter(
    (c) => c.desservie && c.sourceDistance === "vol_oiseau",
  );

  return (
    <main className="p-5 sm:p-8">
      <h1 className="text-[28px] sm:text-[36px]">Zones de livraison</h1>
      <p className="text-cendre-clair mt-2 max-w-[68ch] text-[17px] leading-relaxed">
        Une zone porte une grille tarifaire ; chaque commune est rattachée à une zone. Un client
        dont la commune n&apos;est rattachée à aucune zone est orienté vers le formulaire de devis.
      </p>

      {/* Incohérences à signaler : une zone vide ou une distance manquante fausse
          silencieusement les frais de livraison. */}
      {(sansZone.length > 0 ||
        sansDistance.length > 0 ||
        zonesVides.length > 0 ||
        distancesEstimees.length > 0) && (
        <div className="border-alerte/30 bg-alerte/8 mt-6 rounded-[6px] border p-4">
          <p className="font-semibold">À vérifier</p>
          <ul className="mt-2 space-y-1 text-[15px]">
            {sansZone.length > 0 && (
              <li>
                {sansZone.length} commune{sansZone.length > 1 ? "s" : ""} marquée
                {sansZone.length > 1 ? "s" : ""} desservie{sansZone.length > 1 ? "s" : ""} sans zone :{" "}
                {sansZone.map((c) => c.ville).join(", ")}
              </li>
            )}
            {sansDistance.length > 0 && (
              <li>
                Distance manquante ({sansDistance.length}) — le carburant sera compté à zéro :{" "}
                {sansDistance.map((c) => c.ville).join(", ")}
              </li>
            )}
            {distancesEstimees.length > 0 && (
              <li>
                Distance estimée à vol d&apos;oiseau ({distancesEstimees.length}) — à confirmer sur
                un itinéraire réel :{" "}
                {distancesEstimees
                  .slice(0, 8)
                  .map((c) => c.ville)
                  .join(", ")}
                {distancesEstimees.length > 8 && "…"}
              </li>
            )}
            {zonesVides.length > 0 && (
              <li>
                Zone{zonesVides.length > 1 ? "s" : ""} sans commune :{" "}
                {zonesVides.map((z) => z.nom).join(", ")}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <TesteurAdresse />
        <PanneauCarburant
          enVigueur={carburant.enVigueur}
          refuses={carburant.refuses}
          ageJours={carburant.ageJours}
          modifiable={peutModifierTarifs}
        />
      </div>

      <section className="mt-9">
        <h2 className="text-[22px]">Grilles tarifaires</h2>
        {zones.length === 0 ? (
          <p className="text-cendre-clair mt-3 text-[17px]">Aucune zone définie.</p>
        ) : (
          <ul className="mt-4 grid gap-4 lg:grid-cols-2">
            {zones.map((zone) => (
              <CarteZone key={zone.id} zone={zone} modifiable={peutModifierTarifs} />
            ))}
          </ul>
        )}
      </section>

      {/* Le scan par rayon est placé AVANT la liste : c'est par lui qu'on
          remplit la liste, pas l'inverse (docs/02 §2.1). */}
      <div className="mt-9">
        <PanneauSecteur secteur={secteur} zones={zones} />
      </div>

      <div className="mt-9">
        <TableCommunes communes={communes} zones={zones} />
      </div>
    </main>
  );
}
