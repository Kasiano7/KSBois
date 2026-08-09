"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Loader2, Check, X, Tag, Ruler } from "lucide-react";
import { ajouterProduction, corrigerInventaire } from "@/server/actions/admin-stock";
import { modifierPrix, ajouterFormat } from "@/server/actions/admin-catalogue";
import { MOTIFS_CORRECTION } from "@/domain/stock";
import { formatEuros, formatVolume } from "@/domain/units";
import type { GroupeStock, LigneStock } from "@/server/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Une gamme d'essence et ses formats — écran stock (docs/05 §5.2).
 *
 * L'exploitant pense « j'ai fendu du chêne » : la carte suit sa logique. Les
 * formats sont en liste, et une seule zone d'action s'ouvre en bas de carte.
 * Quatre gestes possibles par format : ajouter de la production, corriger
 * l'inventaire, changer le prix, et ajouter un format à la gamme.
 *
 * Tout ce qui est modifié ici est visible immédiatement sur la page d'accueil :
 * le configurateur lit le catalogue, il n'a aucun prix en dur.
 */

export interface LongueurDisponible {
  id: string;
  cm: number;
  label: string;
}

const RACCOURCIS = [1, 2, 5, 10, 20];

type Action =
  | { type: "ajout" | "correction" | "prix"; variantId: string }
  | { type: "format" }
  | null;

export function CarteEssence({
  groupe,
  longueurs,
  peutModifierPrix,
}: {
  groupe: GroupeStock;
  longueurs: LongueurDisponible[];
  /** Prix et catalogue sont réservés au gérant (docs/05 §9). */
  peutModifierPrix: boolean;
}) {
  const [action, setAction] = useState<Action>(null);
  const [valeur, setValeur] = useState("");
  const [motif, setMotif] = useState<string>(MOTIFS_CORRECTION[0].valeur);
  const [nouvelleLongueur, setNouvelleLongueur] = useState("");
  const [enCours, demarrer] = useTransition();
  const [retour, setRetour] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);

  const formatActif =
    action && "variantId" in action
      ? groupe.formats.find((f) => f.variantId === action.variantId)
      : undefined;

  const longueursLibres = longueurs.filter(
    (l) => !groupe.formats.some((f) => f.cutLengthId === l.id),
  );

  const fermer = () => {
    setAction(null);
    setValeur("");
    setNouvelleLongueur("");
  };

  const ouvrir = (type: "ajout" | "correction" | "prix", ligne: LigneStock) => {
    setRetour(null);
    setAction({ type, variantId: ligne.variantId });
    setValeur(
      type === "correction"
        ? String(ligne.onHand)
        : type === "prix"
          ? (ligne.basePriceCents / 100).toString().replace(".", ",")
          : "",
    );
  };

  const executer = () => {
    if (!action) return;
    const saisie = valeur.replace(",", ".");
    setRetour(null);

    demarrer(async () => {
      let r: { ok: boolean; message?: string; nouveauStock?: number };
      let succes = "";

      if (action.type === "format") {
        r = await ajouterFormat({
          productId: groupe.productId,
          cutLengthId: nouvelleLongueur,
          prixEuros: saisie,
          stockInitial: 0,
        });
        succes = `Format ajouté à ${groupe.productName}. Il est déjà visible sur le site.`;
      } else if (action.type === "prix") {
        r = await modifierPrix({ variantId: action.variantId, prixEuros: saisie });
        succes = `${formatActif?.format} — prix mis à jour. Le site l'affiche déjà.`;
      } else if (action.type === "ajout") {
        r = await ajouterProduction({ variantId: action.variantId, quantite: saisie });
        succes = `${formatActif?.format} — production enregistrée. Stock physique : ${formatVolume(r.nouveauStock ?? 0)}.`;
      } else {
        r = await corrigerInventaire({
          variantId: action.variantId,
          quantiteReelle: saisie,
          motif,
        });
        succes = `${formatActif?.format} — inventaire corrigé. Stock physique : ${formatVolume(r.nouveauStock ?? 0)}.`;
      }

      if (r.ok) {
        setRetour({ ton: "ok", texte: succes });
        fermer();
      } else {
        setRetour({ ton: "erreur", texte: r.message ?? "Une erreur est survenue." });
      }
    });
  };

  return (
    <li className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border">
      {/* ── En-tête de la gamme ── */}
      <div className="border-ecorce-bord flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b p-5">
        <div>
          <h2 className="text-[19px] font-semibold">{groupe.productName}</h2>
          {groupe.sousTitre && <p className="text-cendre-clair text-[15px]">{groupe.sousTitre}</p>}
        </div>
        <p className="text-cendre-clair text-[15px]">
          <span className="text-aubier tabulaire text-[19px] font-semibold">
            {groupe.disponibleTotal.toLocaleString("fr-FR")}
          </span>{" "}
          m³ apparents disponibles
          {groupe.aRefaire > 0 && (
            <span className="text-alerte ml-2 font-semibold">
              · {groupe.aRefaire} format{groupe.aRefaire > 1 ? "s" : ""} à refaire
            </span>
          )}
        </p>
      </div>

      {/* ── Liste des formats ── */}
      <ul className="divide-ecorce-bord divide-y">
        {groupe.formats.map((f) => {
          const ouvert = action && "variantId" in action && action.variantId === f.variantId;
          return (
            <li
              key={f.variantId}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3",
                ouvert && "bg-ecorce",
              )}
            >
              <span className="tabulaire w-16 shrink-0 text-[17px] font-semibold">{f.format}</span>

              <span className="tabulaire w-14 shrink-0 text-right text-[19px] font-semibold">
                {f.available.toLocaleString("fr-FR")}
              </span>

              <span className="text-cendre-clair min-w-[9rem] flex-1 text-[15px]">
                disponibles
                {f.reserved > 0 && ` · ${f.reserved.toLocaleString("fr-FR")} réservés`}
                {` · ${f.onHand.toLocaleString("fr-FR")} en stock`}
              </span>

              {/* Prix : cliquable pour le gérant, simple information sinon */}
              {peutModifierPrix ? (
                <button
                  type="button"
                  onClick={() => (ouvert && action?.type === "prix" ? fermer() : ouvrir("prix", f))}
                  className={cn(
                    "tabulaire flex min-h-9 items-center gap-1.5 rounded-[4px] px-2 text-[17px] font-semibold transition-colors",
                    ouvert && action?.type === "prix"
                      ? "bg-braise/20 text-braise"
                      : "hover:bg-ecorce",
                  )}
                  title="Modifier le prix du m³ apparent"
                >
                  {formatEuros(f.basePriceCents)}
                  <Tag size={14} strokeWidth={1.9} className="text-cendre-clair" aria-hidden="true" />
                </button>
              ) : (
                <span className="tabulaire text-[17px] font-semibold">
                  {formatEuros(f.basePriceCents)}
                </span>
              )}

              {f.etat === "rupture" && (
                <span className="bg-erreur/20 text-erreur rounded-[3px] px-2 py-0.5 text-[13px] font-semibold">
                  Rupture
                </span>
              )}
              {f.etat === "bas" && (
                <span className="bg-alerte/20 text-alerte rounded-[3px] px-2 py-0.5 text-[13px] font-semibold">
                  Stock bas
                </span>
              )}

              <span className="ml-auto flex gap-1.5">
                <Button
                  type="button"
                  variant={ouvert && action?.type === "ajout" ? "default" : "outline"}
                  size="icon-sm"
                  aria-label={`Ajouter de la production en ${f.format}`}
                  onClick={() => (ouvert && action?.type === "ajout" ? fermer() : ouvrir("ajout", f))}
                >
                  <Plus strokeWidth={2} />
                </Button>
                <Button
                  type="button"
                  variant={ouvert && action?.type === "correction" ? "default" : "outline"}
                  size="icon-sm"
                  aria-label={`Corriger le stock en ${f.format}`}
                  onClick={() =>
                    ouvert && action?.type === "correction" ? fermer() : ouvrir("correction", f)
                  }
                >
                  <Pencil strokeWidth={1.75} />
                </Button>
              </span>
            </li>
          );
        })}
      </ul>

      {/* ── Ajouter un format à la gamme ── */}
      {peutModifierPrix && longueursLibres.length > 0 && action?.type !== "format" && (
        <div className="border-ecorce-bord border-t px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="default"
            onClick={() => {
              setRetour(null);
              setAction({ type: "format" });
              setNouvelleLongueur(longueursLibres[0].id);
              setValeur("");
            }}
          >
            <Ruler strokeWidth={1.75} />
            Ajouter une longueur à {groupe.productName}
          </Button>
        </div>
      )}

      {/* ── Zone d'action unique ── */}
      {action && (
        <div className="border-ecorce-bord bg-ecorce border-t p-5">
          <div className="flex flex-wrap items-end gap-4">
            {action.type === "format" && (
              <div>
                <Label htmlFor={`l-${groupe.productId}`} className="text-cendre-clair">
                  Longueur à ajouter
                </Label>
                <select
                  id={`l-${groupe.productId}`}
                  value={nouvelleLongueur}
                  onChange={(e) => setNouvelleLongueur(e.target.value)}
                  className="border-input bg-card text-foreground mt-2 h-12 rounded-[4px] border px-3 text-[17px]"
                >
                  {longueursLibres.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label htmlFor={`v-${groupe.productId}`} className="text-cendre-clair">
                {action.type === "ajout" && `Production ajoutée en ${formatActif?.format}`}
                {action.type === "correction" &&
                  `Stock réellement présent en ${formatActif?.format}`}
                {action.type === "prix" && `Prix du m³ apparent en ${formatActif?.format}`}
                {action.type === "format" && "Prix du m³ apparent"}
              </Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  id={`v-${groupe.productId}`}
                  inputMode="decimal"
                  autoFocus
                  value={valeur}
                  onChange={(e) => setValeur(e.target.value.replace(/[^\d.,]/g, ""))}
                  className="tabulaire w-24 text-center text-[22px] font-semibold"
                />
                <span className="text-cendre-clair text-[15px]">
                  {action.type === "prix" || action.type === "format" ? "€" : "m³ apparents"}
                </span>
              </div>
            </div>

            {action.type === "ajout" && (
              <div className="flex flex-wrap gap-2 pb-1">
                {RACCOURCIS.map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={() => setValeur(String(n))}
                  >
                    +{n}
                  </Button>
                ))}
              </div>
            )}

            {action.type === "correction" && (
              <div>
                <Label htmlFor={`m-${groupe.productId}`} className="text-cendre-clair">
                  Motif
                </Label>
                <select
                  id={`m-${groupe.productId}`}
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  className="border-input bg-card text-foreground mt-2 h-12 rounded-[4px] border px-3 text-[17px]"
                >
                  {MOTIFS_CORRECTION.map((m) => (
                    <option key={m.valeur} value={m.valeur}>
                      {m.libelle}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="ml-auto flex gap-2 pb-1">
              <Button
                type="button"
                variant="cta"
                size="lg"
                disabled={enCours || valeur === ""}
                onClick={executer}
              >
                {enCours ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Check strokeWidth={2} />
                )}
                Enregistrer
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label="Annuler"
                onClick={fermer}
              >
                <X strokeWidth={1.75} />
              </Button>
            </div>
          </div>

          {action.type === "prix" && (
            <p className="text-cendre-clair mt-3 text-[13px]">
              Les tarifs dégressifs sont décalés automatiquement du même écart.
            </p>
          )}
        </div>
      )}

      {retour && (
        <p
          role="status"
          className={cn(
            "border-ecorce-bord flex items-start gap-2 border-t px-5 py-3 text-[15px]",
            retour.ton === "ok" ? "text-succes" : "text-erreur",
          )}
        >
          {retour.ton === "ok" && (
            <Check size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
          )}
          {retour.texte}
        </p>
      )}
    </li>
  );
}
