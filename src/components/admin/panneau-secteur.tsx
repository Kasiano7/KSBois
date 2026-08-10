"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radar, Loader2, AlertTriangle, Check, Info } from "lucide-react";
import {
  analyserSecteurAction,
  importerSecteurAction,
} from "@/server/actions/admin-secteur";
import type { AnalyseSecteur } from "@/server/secteur";
import type { SecteurAdmin, ZoneAdmin } from "@/server/admin-zones";
import { formatDistance } from "@/domain/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * « Communes autour du dépôt » — docs/05-ADMIN.md §6.1
 *
 * L'exploitant décrit son métier — « je pars de Villevocance et je livre à
 * 25 km » — et le système propose la liste des communes, distances routières
 * comprises. C'est la différence entre une soirée de saisie (avec des oublis)
 * et deux clics.
 *
 * ⚠️ L'analyse n'écrit RIEN. Tant que l'exploitant n'a pas relu la liste et
 * cliqué sur « Importer », sa grille tarifaire ne bouge pas.
 */

const NON_DESSERVIE = "__aucune__";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PanneauSecteur({
  secteur,
  zones,
}: {
  secteur: SecteurAdmin;
  zones: ZoneAdmin[];
}) {
  const router = useRouter();
  const [rayon, setRayon] = useState(String(secteur.rayonKm));
  const [analyse, setAnalyse] = useState<AnalyseSecteur | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [cochees, setCochees] = useState<Set<string>>(new Set());
  const [zoneParCommune, setZoneParCommune] = useState<Record<string, string>>({});
  const [enCours, demarrer] = useTransition();

  const lancerAnalyse = () => {
    setErreur(null);
    setSucces(null);
    demarrer(async () => {
      const r = await analyserSecteurAction({ rayonKm: rayon });
      if (!r.ok) {
        setAnalyse(null);
        setErreur(r.message);
        return;
      }
      setAnalyse(r.analyse);
      // Les nouvelles communes sont cochées d'office : c'est ce que
      // l'exploitant vient chercher. Celles déjà connues sont décochées, pour
      // qu'un import ne ressemble jamais à une remise à zéro de son travail.
      setCochees(new Set(r.analyse.propositions.filter((p) => !p.dejaPresente).map((p) => p.cle)));
      setZoneParCommune(
        Object.fromEntries(
          r.analyse.propositions.map((p) => [p.cle, p.zoneSuggereeId ?? NON_DESSERVIE]),
        ),
      );
    });
  };

  const importer = () => {
    if (!analyse) return;
    setErreur(null);
    setSucces(null);
    demarrer(async () => {
      const selection = analyse.propositions
        .filter((p) => cochees.has(p.cle))
        .map((p) => ({
          inseeCode: p.inseeCode,
          codePostal: p.codePostal,
          ville: p.ville,
          distanceKm: p.distanceKm,
          sourceDistance: p.sourceDistance === "route" ? "route" : "vol_oiseau",
          zoneId:
            zoneParCommune[p.cle] === NON_DESSERVIE ? null : (zoneParCommune[p.cle] ?? null),
        }));

      const r = await importerSecteurAction({ rayonKm: rayon, communes: selection });
      if (r.ok) {
        setSucces(r.message ?? "Communes importées.");
        setAnalyse(null);
        setCochees(new Set());
        router.refresh();
      } else {
        setErreur(r.message ?? "L'import n'a pas abouti.");
      }
    });
  };

  const nouvelles = useMemo(
    () => analyse?.propositions.filter((p) => !p.dejaPresente) ?? [],
    [analyse],
  );

  const basculer = (cle: string) =>
    setCochees((s) => {
      const suivant = new Set(s);
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });

  return (
    <section className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border">
      <div className="p-5">
        <h2 className="flex items-center gap-2.5 text-[19px] font-semibold">
          <Radar size={21} strokeWidth={1.9} className="text-seve" aria-hidden="true" />
          Communes autour du dépôt
        </h2>
        <p className="text-cendre-clair mt-1.5 max-w-[70ch] text-[15px] leading-relaxed">
          Indiquez jusqu&apos;où vous livrez : les communes sont récupérées dans la base officielle
          des communes, avec leur distance <strong>par la route</strong> depuis votre dépôt.
          {secteur.adresse && <> Départ : {secteur.adresse}.</>}
        </p>

        {!secteur.depotRenseigne && (
          <p className="bg-alerte/15 text-alerte mt-4 flex items-start gap-2 rounded-[6px] p-3.5 text-[15px]">
            <AlertTriangle size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
            Renseignez d&apos;abord l&apos;adresse ou les coordonnées de votre dépôt dans les
            réglages : sans point de départ, un rayon n&apos;a pas de sens.
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            lancerAnalyse();
          }}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div>
            <Label htmlFor="secteur-rayon" className="text-cendre-clair">
              Rayon de livraison
            </Label>
            <div className="mt-2 flex items-center gap-2">
              <Input
                id="secteur-rayon"
                inputMode="numeric"
                maxLength={3}
                value={rayon}
                onChange={(e) => setRayon(e.target.value.replace(/\D/g, ""))}
                className="tabulaire w-20 text-center"
              />
              <span className="text-cendre-clair text-[15px]">km de route</span>
            </div>
          </div>
          <Button
            type="submit"
            variant="default"
            size="lg"
            disabled={enCours || !secteur.depotRenseigne || rayon === ""}
          >
            {enCours ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Analyse…
              </>
            ) : (
              "Analyser le secteur"
            )}
          </Button>
          {secteur.dernierScan && !analyse && (
            <p className="text-cendre-clair text-[15px]">
              Dernier import : {formatDate(secteur.dernierScan)}
            </p>
          )}
        </form>

        {erreur && (
          <p
            role="status"
            className="bg-alerte/15 text-alerte mt-4 flex items-start gap-2 rounded-[6px] p-3.5 text-[15px]"
          >
            <AlertTriangle size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
            {erreur}
          </p>
        )}

        {succes && (
          <p
            role="status"
            className="border-succes/30 bg-succes/8 text-succes mt-4 flex items-start gap-2 rounded-[6px] border p-3.5 text-[15px]"
          >
            <Check size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
            {succes}
          </p>
        )}
      </div>

      {analyse && (
        <>
          <div className="border-ecorce-bord bg-ecorce border-y p-5">
            <p className="text-[17px]">
              <strong>{analyse.propositions.length}</strong> commune
              {analyse.propositions.length > 1 ? "s" : ""} à moins de {analyse.rayonKm} km de route,
              dont <strong>{nouvelles.length}</strong> absente
              {nouvelles.length > 1 ? "s" : ""} de votre liste.
            </p>
            {analyse.ecarteesParLaRoute > 0 && (
              <p className="text-cendre-clair mt-1.5 text-[15px] leading-relaxed">
                {analyse.ecarteesParLaRoute} commune{analyse.ecarteesParLaRoute > 1 ? "s" : ""}{" "}
                proche{analyse.ecarteesParLaRoute > 1 ? "s" : ""} à vol d&apos;oiseau{" "}
                {analyse.ecarteesParLaRoute > 1 ? "ont été écartées" : "a été écartée"} : plus de{" "}
                {analyse.rayonKm} km par la route.
              </p>
            )}
            {analyse.origineDepot === "geocodage" && (
              <p className="text-cendre-clair mt-1.5 text-[15px]">
                Les coordonnées de votre dépôt ont été déduites de votre adresse et enregistrées.
              </p>
            )}

            {analyse.avertissements.map((a) => (
              <p
                key={a}
                className="bg-alerte/15 text-alerte mt-3 flex items-start gap-2 rounded-[6px] p-3 text-[15px]"
              >
                <AlertTriangle
                  size={18}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                {a}
              </p>
            ))}

            {/* Une commune desservie qui sort du rayon n'est PAS supprimée : on
                la signale, l'exploitant tranche. Retirer d'office des communes
                déjà livrées serait la pire surprise possible. */}
            {analyse.horsRayon.length > 0 && (
              <p className="text-cendre-clair mt-3 flex items-start gap-2 text-[15px] leading-relaxed">
                <Info size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  {analyse.horsRayon.length} commune{analyse.horsRayon.length > 1 ? "s" : ""} que
                  vous desservez {analyse.horsRayon.length > 1 ? "sont" : "est"} au-delà de ce rayon
                  : {analyse.horsRayon.map((c) => c.ville).join(", ")}. Rien n&apos;y sera changé —
                  augmentez le rayon si vous voulez les revoir ici.
                </span>
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => setCochees(new Set(analyse.propositions.map((p) => p.cle)))}
              >
                Tout cocher
              </Button>
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => setCochees(new Set(nouvelles.map((p) => p.cle)))}
              >
                Seulement les nouvelles
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="default"
                onClick={() => setCochees(new Set())}
              >
                Tout décocher
              </Button>
              <Button
                type="button"
                variant="cta"
                size="lg"
                className="ml-auto"
                disabled={enCours || cochees.size === 0}
                onClick={importer}
              >
                {enCours ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Check strokeWidth={2} />
                )}
                Importer {cochees.size} commune{cochees.size > 1 ? "s" : ""}
              </Button>
            </div>
          </div>

          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[680px] border-collapse text-[15px]">
              <thead className="bg-ecorce-eleve sticky top-0">
                <tr className="border-ecorce-bord text-cendre-clair border-b text-left">
                  <th scope="col" className="w-12 p-3" />
                  <th scope="col" className="py-3 pr-4 font-semibold">Commune</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Code postal</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Distance</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Zone</th>
                </tr>
              </thead>
              <tbody>
                {analyse.propositions.map((p) => {
                  const coche = cochees.has(p.cle);
                  return (
                    <tr
                      key={p.cle}
                      className={cn(
                        "border-ecorce-bord border-b",
                        coche ? "bg-braise/10" : "hover:bg-ecorce",
                      )}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={coche}
                          onChange={() => basculer(p.cle)}
                          aria-label={`Importer ${p.ville} (${p.codePostal})`}
                          className="accent-braise size-5"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-medium">{p.ville}</span>
                        {p.dejaPresente && (
                          <span className="text-cendre-clair ml-2 text-[13px]">
                            déjà dans votre liste
                            {p.zoneActuelleNom ? ` · ${p.zoneActuelleNom}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="tabulaire py-3 pr-4">{p.codePostal}</td>
                      <td className="tabulaire py-3 pr-4">
                        {formatDistance(p.distanceKm)}
                        {/* Une distance estimée finira sur une facture : elle
                            doit se voir, pas se deviner. */}
                        {p.sourceDistance !== "route" && (
                          <span className="text-alerte ml-2 text-[13px]">estimée</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {/* Une commune déjà rattachée garde sa zone : l'import
                            complète sa fiche (distance, code INSEE), il ne
                            rejoue pas les arbitrages tarifaires déjà rendus. */}
                        {p.dejaPresente && p.zoneActuelleNom ? (
                          <span className="text-cendre-clair">
                            {p.zoneActuelleNom} · inchangée
                          </span>
                        ) : (
                        <select
                          aria-label={`Zone de ${p.ville}`}
                          value={zoneParCommune[p.cle] ?? NON_DESSERVIE}
                          onChange={(e) =>
                            setZoneParCommune((z) => ({ ...z, [p.cle]: e.target.value }))
                          }
                          className="border-input bg-card text-foreground h-10 rounded-[4px] border px-2 text-[15px]"
                        >
                          {zones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.nom}
                            </option>
                          ))}
                          <option value={NON_DESSERVIE}>Non desservie</option>
                        </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
