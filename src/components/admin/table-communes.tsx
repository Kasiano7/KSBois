"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Check, Search, Plus, X } from "lucide-react";
import { affecterCommunes, ajouterCommune } from "@/server/actions/admin-zones";
import { formatJoursLivraison } from "@/lib/jours";
import type { CommuneAdmin, ZoneAdmin } from "@/server/admin-zones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Tableau des communes — le geste le plus fréquent de l'écran zones
 * (docs/05-ADMIN.md §6.1).
 *
 * L'affectation se fait EN MASSE : on coche plusieurs communes, on choisit une
 * zone, c'est fini. Affecter cinquante communes une par une serait le meilleur
 * moyen que personne ne le fasse jamais.
 */

const NON_DESSERVIE = "__aucune__";

export function TableCommunes({
  communes,
  zones,
}: {
  communes: CommuneAdmin[];
  zones: ZoneAdmin[];
}) {
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<string[]>([]);
  const [zoneCible, setZoneCible] = useState<string>(zones[0]?.id ?? NON_DESSERVIE);
  const [enCours, demarrer] = useTransition();
  const [retour, setRetour] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);

  const [nouveauCp, setNouveauCp] = useState("");
  const [nouvelleVille, setNouvelleVille] = useState("");
  const [nouvelleDistance, setNouvelleDistance] = useState("");

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return communes;
    return communes.filter(
      (c) => c.ville.toLowerCase().includes(q) || c.codePostal.includes(q),
    );
  }, [communes, recherche]);

  const toutSelectionne = filtrees.length > 0 && filtrees.every((c) => selection.includes(c.id));

  const basculerTout = () =>
    setSelection((s) =>
      toutSelectionne
        ? s.filter((id) => !filtrees.some((c) => c.id === id))
        : [...new Set([...s, ...filtrees.map((c) => c.id)])],
    );

  const appliquer = () => {
    setRetour(null);
    demarrer(async () => {
      const r = await affecterCommunes({
        communeIds: selection,
        zoneId: zoneCible === NON_DESSERVIE ? null : zoneCible,
      });
      if (r.ok) {
        // L'accord porte aussi sur le participe : « 1 commune affectée »,
        // « 3 communes affectées ». Un pluriel bancal décrédibilise l'outil.
        const pluriel = selection.length > 1;
        const sujet = `${selection.length} commune${pluriel ? "s" : ""}`;
        const cible =
          zoneCible === NON_DESSERVIE
            ? `marquée${pluriel ? "s" : ""} non desservie${pluriel ? "s" : ""}`
            : `affectée${pluriel ? "s" : ""} à ${zones.find((z) => z.id === zoneCible)?.nom}`;
        setRetour({ ton: "ok", texte: `${sujet} ${cible}.` });
        setSelection([]);
      } else {
        setRetour({ ton: "erreur", texte: r.message ?? "Affectation impossible." });
      }
    });
  };

  return (
    <section className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border">
      <div className="border-ecorce-bord flex flex-wrap items-end justify-between gap-4 border-b p-5">
        <div>
          <h2 className="text-[19px] font-semibold">Communes</h2>
          <p className="text-cendre-clair mt-1 text-[15px]">
            {communes.length} commune{communes.length > 1 ? "s" : ""} dans votre liste ·{" "}
            {communes.filter((c) => !c.desservie).length} non desservie
            {communes.filter((c) => !c.desservie).length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="recherche-commune" className="text-cendre-clair">
              Rechercher
            </Label>
            <div className="relative mt-2">
              <Search
                size={17}
                strokeWidth={1.9}
                className="text-cendre-clair pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                id="recherche-commune"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Annonay ou 07100"
                className="w-52 pl-9"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setAjoutOuvert((v) => !v)}
          >
            <Plus strokeWidth={2} />
            Ajouter une commune
          </Button>
        </div>
      </div>

      {/* ── Ajout d'une commune ── */}
      {ajoutOuvert && (
        <div className="border-ecorce-bord bg-ecorce border-b p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="new-cp" className="text-cendre-clair">
                Code postal
              </Label>
              <Input
                id="new-cp"
                inputMode="numeric"
                maxLength={5}
                value={nouveauCp}
                onChange={(e) => setNouveauCp(e.target.value.replace(/\D/g, ""))}
                className="tabulaire mt-2 w-28 text-center"
              />
            </div>
            <div>
              <Label htmlFor="new-ville" className="text-cendre-clair">
                Commune
              </Label>
              <Input
                id="new-ville"
                value={nouvelleVille}
                onChange={(e) => setNouvelleVille(e.target.value)}
                className="mt-2 w-52"
              />
            </div>
            <div>
              <Label htmlFor="new-dist" className="text-cendre-clair">
                Distance routière (km)
              </Label>
              <Input
                id="new-dist"
                inputMode="decimal"
                value={nouvelleDistance}
                onChange={(e) => setNouvelleDistance(e.target.value.replace(/[^\d.,]/g, ""))}
                className="tabulaire mt-2 w-24 text-center"
              />
            </div>
            <div>
              <Label htmlFor="new-zone" className="text-cendre-clair">
                Zone
              </Label>
              <select
                id="new-zone"
                value={zoneCible}
                onChange={(e) => setZoneCible(e.target.value)}
                className="border-input bg-card text-foreground mt-2 h-12 rounded-[4px] border px-3 text-[17px]"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nom}
                  </option>
                ))}
                <option value={NON_DESSERVIE}>Non desservie</option>
              </select>
            </div>
            <Button
              type="button"
              variant="cta"
              size="lg"
              disabled={enCours || nouveauCp.length < 5 || nouvelleVille.trim() === ""}
              onClick={() => {
                setRetour(null);
                demarrer(async () => {
                  const r = await ajouterCommune({
                    codePostal: nouveauCp,
                    ville: nouvelleVille,
                    distanceKm: nouvelleDistance || "0",
                    zoneId: zoneCible === NON_DESSERVIE ? null : zoneCible,
                  });
                  if (r.ok) {
                    setRetour({ ton: "ok", texte: `${nouvelleVille} ajoutée.` });
                    setNouveauCp("");
                    setNouvelleVille("");
                    setNouvelleDistance("");
                    setAjoutOuvert(false);
                  } else {
                    setRetour({ ton: "erreur", texte: r.message ?? "Ajout impossible." });
                  }
                });
              }}
            >
              {enCours ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check strokeWidth={2} />}
              Ajouter
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label="Fermer"
              onClick={() => setAjoutOuvert(false)}
            >
              <X strokeWidth={1.75} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Barre d'affectation en masse ── */}
      {selection.length > 0 && (
        <div className="border-braise/40 bg-braise/10 flex flex-wrap items-center gap-3 border-b p-4">
          <p className="text-[17px] font-semibold">
            {selection.length} commune{selection.length > 1 ? "s" : ""} sélectionnée
            {selection.length > 1 ? "s" : ""}
          </p>
          <select
            aria-label="Zone à affecter"
            value={zoneCible}
            onChange={(e) => setZoneCible(e.target.value)}
            className="border-input bg-card text-foreground h-11 rounded-[4px] border px-3 text-[17px]"
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nom}
              </option>
            ))}
            <option value={NON_DESSERVIE}>Non desservie</option>
          </select>
          <Button type="button" variant="cta" size="default" disabled={enCours} onClick={appliquer}>
            {enCours ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check strokeWidth={2} />}
            Appliquer
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="default"
            onClick={() => setSelection([])}
          >
            Tout désélectionner
          </Button>
        </div>
      )}

      {retour && (
        <p
          role="status"
          className={cn(
            "border-ecorce-bord border-b px-5 py-3 text-[15px]",
            retour.ton === "ok" ? "text-succes" : "text-erreur",
          )}
        >
          {retour.texte}
        </p>
      )}

      {/* ── Tableau ── */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[15px]">
          <thead>
            <tr className="border-ecorce-bord text-cendre-clair border-b text-left">
              <th scope="col" className="w-12 p-3">
                <input
                  type="checkbox"
                  checked={toutSelectionne}
                  onChange={basculerTout}
                  aria-label="Tout sélectionner"
                  className="accent-braise size-5"
                />
              </th>
              <th scope="col" className="py-3 pr-4 font-semibold">Commune</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Code postal</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Distance</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Zone</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Jours</th>
            </tr>
          </thead>
          <tbody>
            {filtrees.map((c) => {
              const coche = selection.includes(c.id);
              return (
                <tr
                  key={c.id}
                  className={cn(
                    "border-ecorce-bord border-b",
                    coche ? "bg-braise/10" : "hover:bg-ecorce",
                  )}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={coche}
                      onChange={() =>
                        setSelection((s) =>
                          s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id],
                        )
                      }
                      aria-label={`Sélectionner ${c.ville}`}
                      className="accent-braise size-5"
                    />
                  </td>
                  <td className="py-3 pr-4 font-medium">{c.ville}</td>
                  <td className="tabulaire py-3 pr-4">{c.codePostal}</td>
                  <td className="tabulaire py-3 pr-4">
                    {c.distanceKm === null ? (
                      <span className="text-alerte">à renseigner</span>
                    ) : (
                      `${c.distanceKm.toLocaleString("fr-FR")} km`
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {c.desservie && c.zoneNom ? (
                      c.zoneNom
                    ) : (
                      <span className="text-cendre-clair">non desservie</span>
                    )}
                  </td>
                  <td className="text-cendre-clair py-3 pr-4">
                    {c.joursLivraison && c.joursLivraison.length > 0
                      ? formatJoursLivraison(c.joursLivraison)
                      : "jours de la zone"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtrees.length === 0 && (
        <p className="text-cendre-clair p-5 text-[17px]">
          Aucune commune ne correspond à « {recherche} ».
        </p>
      )}
    </section>
  );
}
