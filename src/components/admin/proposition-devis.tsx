"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Trash2, Loader2, Check, X, Send, FileText, ShoppingCart } from "lucide-react";
import {
  enregistrerProposition,
  envoyerDevis,
  convertirDevisEnCommande,
} from "@/server/actions/admin-devis";
import { formatEuros, formatVolume } from "@/domain/units";
import type { DemandeDevis, Proposition, VarianteVendable } from "@/server/admin-devis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Composition de la proposition — docs/02-MOTEURS-METIER.md §7.2
 *
 * ⚠️ Ce composant ne calcule AUCUN prix. Il n'envoie que des identifiants de
 * format et des quantités ; les montants affichés viennent tous du serveur, qui
 * les recalcule après chaque enregistrement (PLAN.md §5.1). C'est ce qui garantit
 * que le total à l'écran, celui du PDF et celui de la commande sont le même.
 */

interface LigneSaisie {
  cle: string;
  variantId: string;
  quantite: string;
}

function euros(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toString().replace(".", ",");
}

export function PropositionDevis({
  demande,
  proposition,
  variantes,
}: {
  demande: DemandeDevis;
  proposition: Proposition;
  variantes: VarianteVendable[];
}) {
  /**
   * ⚠️ Les clés de ligne servent d'`id` de champ, donc de `htmlFor` de label.
   * Un compteur au niveau du module produisait des identifiants DIFFÉRENTS au
   * rendu serveur et à l'hydratation (« variante-ligne-0 » contre
   * « variante-ligne-1 ») : React signalait une divergence et abandonnait
   * l'association label/champ. Les clés initiales sont donc dérivées de l'index,
   * donc identiques des deux côtés ; seules les lignes ajoutées à la main
   * utilisent le compteur, après hydratation.
   */
  const [lignes, setLignes] = useState<LigneSaisie[]>(() =>
    demande.lignesProposees.map((l, index) => ({
      cle: `l${index}`,
      variantId: l.variantId,
      quantite: String(l.quantity),
    })),
  );
  const prochaineCle = useRef(demande.lignesProposees.length);
  const nouvelleCle = () => `l${prochaineCle.current++}`;
  const [livraisonIncluse, setLivraisonIncluse] = useState(demande.livraisonIncluse);
  const [prixManuel, setPrixManuel] = useState(demande.livraisonCentsSaisie !== null);
  const [livraisonEuros, setLivraisonEuros] = useState(euros(demande.livraisonCentsSaisie));
  const [remiseEuros, setRemiseEuros] = useState(
    demande.remiseCents > 0 ? euros(demande.remiseCents) : "",
  );
  const [remiseLabel, setRemiseLabel] = useState(demande.remiseLabel ?? "");
  const [validJusquA, setValidJusquA] = useState(demande.validJusquA ?? "");
  const [messageEmail, setMessageEmail] = useState("");
  const [confirmeConversion, setConfirmeConversion] = useState(false);

  const [enCours, demarrer] = useTransition();
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);

  const lignesValides = lignes.filter(
    (l) => l.variantId && Number(l.quantite.replace(",", ".")) > 0,
  );
  const dejaConverti = demande.commandeId !== null;

  const ajouterLigne = () =>
    setLignes((l) => [...l, { cle: nouvelleCle(), variantId: "", quantite: "1" }]);

  const majLigne = (cle: string, champ: "variantId" | "quantite", valeur: string) =>
    setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: valeur } : x)));

  /** Reprend les formats que le client avait déjà mis dans son panier. */
  const reprendrePanier = () => {
    const duPanier = (demande.panierJoint?.lignes ?? [])
      .map((l) => l as unknown as { variantId?: string; quantite?: number })
      .filter((l) => typeof l.variantId === "string" && variantes.some((v) => v.id === l.variantId))
      .map((l) => ({
        cle: nouvelleCle(),
        variantId: l.variantId!,
        quantite: String(l.quantite ?? 1),
      }));
    if (duPanier.length > 0) setLignes(duPanier);
  };

  const panierReprenable = (demande.panierJoint?.lignes ?? []).some((l) =>
    variantes.some((v) => v.id === (l as unknown as { variantId?: string }).variantId),
  );

  const enregistrer = () =>
    demarrer(async () => {
      setRetour(null);
      const r = await enregistrerProposition({
        devisId: demande.id,
        lignes: lignesValides.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantite.replace(",", "."),
        })),
        livraisonIncluse,
        livraisonEuros: livraisonIncluse && prixManuel ? livraisonEuros || "0" : null,
        remiseEuros: remiseEuros || null,
        remiseLabel: remiseLabel || undefined,
        validJusquA: validJusquA || null,
      });
      setRetour({ ok: r.ok, texte: r.message ?? "" });
    });

  return (
    <section className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
      <h2 className="text-[22px]">Ce que je propose</h2>
      <p className="text-cendre-clair mt-1.5 text-[15px]">
        Les prix sont ceux de votre catalogue au jour d&apos;aujourd&apos;hui, paliers dégressifs
        compris. Ils sont recalculés à chaque enregistrement.
      </p>

      {/* --- Lignes --- */}
      <div className="mt-5 space-y-3">
        {lignes.length === 0 && (
          <p className="text-cendre-clair text-[15px]">
            Aucune ligne. Ajoutez un format pour chiffrer cette demande.
          </p>
        )}

        {lignes.map((ligne, index) => {
          const variante = variantes.find((v) => v.id === ligne.variantId);
          return (
            <div key={ligne.cle} className="border-ecorce-bord rounded-[6px] border p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <Label htmlFor={`variante-${ligne.cle}`} className="text-cendre-clair">
                    Format {index + 1}
                  </Label>
                  <select
                    id={`variante-${ligne.cle}`}
                    value={ligne.variantId}
                    onChange={(e) => majLigne(ligne.cle, "variantId", e.target.value)}
                    className="border-ecorce-bord bg-ecorce mt-2 h-12 w-full rounded-[4px] border px-3 text-[17px]"
                  >
                    <option value="">Choisir un format…</option>
                    {variantes.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} — {formatEuros(v.prixCents)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor={`quantite-${ligne.cle}`} className="text-cendre-clair">
                    Quantité (m³ app.)
                  </Label>
                  <Input
                    id={`quantite-${ligne.cle}`}
                    inputMode="decimal"
                    value={ligne.quantite}
                    onChange={(e) =>
                      majLigne(ligne.cle, "quantite", e.target.value.replace(/[^\d.,]/g, ""))
                    }
                    className="tabulaire mt-2 w-24 text-center text-[19px] font-semibold"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  onClick={() => setLignes((l) => l.filter((x) => x.cle !== ligne.cle))}
                >
                  <Trash2 strokeWidth={1.75} />
                  Retirer
                </Button>
              </div>

              {variante && variante.trackStock && (
                <p className="text-cendre-clair mt-2 text-[13px]">
                  Stock disponible : {formatVolume(variante.stockDisponible)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="default" onClick={ajouterLigne}>
          <Plus strokeWidth={1.9} />
          Ajouter un format
        </Button>
        {panierReprenable && (
          <Button type="button" variant="ghost" size="default" onClick={reprendrePanier}>
            Reprendre le panier du client
          </Button>
        )}
      </div>

      {/* --- Livraison --- */}
      <fieldset className="mt-6">
        <legend className="micro-label text-cendre-clair mb-2.5">Livraison</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { valeur: true, libelle: "Livraison à domicile" },
            { valeur: false, libelle: "Retrait sur place" },
          ].map((choix) => (
            <button
              key={String(choix.valeur)}
              type="button"
              aria-pressed={livraisonIncluse === choix.valeur}
              onClick={() => setLivraisonIncluse(choix.valeur)}
              className={`min-h-11 rounded-[4px] border px-4 text-[15px] font-semibold transition-colors ${
                livraisonIncluse === choix.valeur
                  ? "border-braise bg-braise/20 text-braise"
                  : "border-ecorce-bord hover:bg-ecorce"
              }`}
            >
              {choix.libelle}
            </button>
          ))}
        </div>

        {livraisonIncluse && (
          <div className="mt-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
              <input
                type="checkbox"
                checked={prixManuel}
                onChange={(e) => setPrixManuel(e.target.checked)}
                className="accent-braise size-5"
              />
              Fixer moi-même le prix de la livraison
            </label>

            {prixManuel ? (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  inputMode="decimal"
                  value={livraisonEuros}
                  onChange={(e) => setLivraisonEuros(e.target.value.replace(/[^\d.,]/g, ""))}
                  aria-label="Prix de la livraison en euros"
                  className="tabulaire w-28 text-center"
                />
                <span className="text-cendre-clair text-[15px]">€ TTC</span>
              </div>
            ) : (
              <p className="text-cendre-clair mt-2 text-[13px] leading-relaxed">
                Calculée automatiquement d&apos;après la commune, le volume et le prix du gazole.
                Indispensable de la fixer à la main si la commune n&apos;est pas dans vos zones.
              </p>
            )}
          </div>
        )}
      </fieldset>

      {/* --- Geste commercial --- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="remise" className="text-cendre-clair">
            Remise <span className="font-normal">(facultative)</span>
          </Label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id="remise"
              inputMode="decimal"
              value={remiseEuros}
              onChange={(e) => setRemiseEuros(e.target.value.replace(/[^\d.,]/g, ""))}
              className="tabulaire w-28 text-center"
            />
            <span className="text-cendre-clair text-[15px]">€</span>
          </div>
        </div>

        <div>
          <Label htmlFor="remise-label" className="text-cendre-clair">
            Motif de la remise
          </Label>
          <Input
            id="remise-label"
            value={remiseLabel}
            onChange={(e) => setRemiseLabel(e.target.value)}
            placeholder="Remise gros volume"
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="validite" className="text-cendre-clair">
            Valable jusqu&apos;au
          </Label>
          <Input
            id="validite"
            type="date"
            value={validJusquA}
            onChange={(e) => setValidJusquA(e.target.value)}
            className="tabulaire mt-2 w-48"
          />
          <p className="text-cendre-clair mt-1.5 text-[13px]">
            Sans date, le devis part avec la mention « proposition indicative ».
          </p>
        </div>
      </div>

      {/* --- Totaux, calculés par le serveur --- */}
      <div className="border-ecorce-bord mt-6 rounded-[6px] border p-4">
        <p className="micro-label text-cendre-clair">Total enregistré</p>
        {proposition.lignes.length === 0 ? (
          <p className="text-cendre-clair mt-2 text-[15px]">
            Rien de chiffré pour l&apos;instant. Enregistrez la proposition pour voir le total.
          </p>
        ) : (
          <dl className="mt-2 space-y-1.5 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-cendre-clair">Bois</dt>
              <dd className="tabulaire">{formatEuros(proposition.totaux.subtotalCents)}</dd>
            </div>
            {proposition.totaux.discountCents > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-cendre-clair">{proposition.remiseLabel}</dt>
                <dd className="tabulaire">−{formatEuros(proposition.totaux.discountCents)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-cendre-clair">
                Livraison
                {proposition.livraison?.manuelle && " (fixée à la main)"}
                {proposition.livraison?.zoneNom && ` — ${proposition.livraison.zoneNom}`}
              </dt>
              <dd className="tabulaire">
                {proposition.livraison === null
                  ? "non comprise"
                  : formatEuros(proposition.totaux.deliveryCents)}
              </dd>
            </div>
            <div className="border-ecorce-bord flex justify-between gap-4 border-t pt-2">
              <dt className="font-semibold">Total TTC</dt>
              <dd className="tabulaire text-braise text-[22px] font-bold">
                {formatEuros(proposition.totaux.totalCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-cendre-clair text-[13px]">Volume</dt>
              <dd className="text-cendre-clair tabulaire text-[13px]">
                {formatVolume(proposition.totaux.totalVolumeM3)}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {/* Ce qui empêche d'aller plus loin, dit en clair et jamais masqué. */}
      {proposition.alertes.length > 0 && (
        <ul className="border-alerte/30 bg-alerte/8 mt-4 space-y-1.5 rounded-[6px] border p-4 text-[15px]">
          {proposition.alertes.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      {retour && (
        <p
          role={retour.ok ? "status" : "alert"}
          className={`mt-4 text-[15px] ${retour.ok ? "text-succes" : "text-erreur"}`}
        >
          {retour.texte}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" variant="cta" size="lg" disabled={enCours} onClick={enregistrer}>
          {enCours ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Check strokeWidth={2} />
          )}
          Enregistrer la proposition
        </Button>

        {proposition.lignes.length > 0 && (
          <Button asChild variant="outline" size="lg">
            <a href={`/api/pdf/devis/${demande.id}`} target="_blank" rel="noopener">
              <FileText strokeWidth={1.75} />
              Voir le PDF
            </a>
          </Button>
        )}
      </div>

      {/* --- Envoi au client --- */}
      {proposition.lignes.length > 0 && !dejaConverti && (
        <div className="border-ecorce-bord mt-7 border-t pt-6">
          <h3 className="text-[19px] font-semibold">Envoyer au client</h3>
          <Label htmlFor="message-devis" className="text-cendre-clair mt-3 block">
            Mot d&apos;accompagnement <span className="font-normal">(facultatif)</span>
          </Label>
          <Textarea
            id="message-devis"
            value={messageEmail}
            onChange={(e) => setMessageEmail(e.target.value)}
            rows={3}
            placeholder="Bonjour, voici notre proposition pour votre chargement de chêne. Nous pouvons livrer la semaine du 15."
            className="mt-2"
          />
          <p className="text-cendre-clair mt-1.5 text-[13px]">
            Ce texte apparaît dans l&apos;email et sur le devis PDF, joint automatiquement.
          </p>

          <Button
            type="button"
            variant="default"
            size="lg"
            className="mt-4"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                setRetour(null);
                const r = await envoyerDevis({
                  devisId: demande.id,
                  message: messageEmail || undefined,
                });
                setRetour({ ok: r.ok, texte: r.message ?? "" });
              })
            }
          >
            {enCours ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Send strokeWidth={1.75} />
            )}
            Envoyer le devis par email
          </Button>
          {/* L'adresse est SOUS le bouton et non dedans : un libellé de bouton
              ne se coupe pas, et une adresse longue débordait de l'écran. */}
          <p className="text-cendre-clair mt-2 text-[15px] break-all">
            Destinataire : {demande.email}
          </p>
        </div>
      )}

      {/* --- Conversion en commande --- */}
      {proposition.lignes.length > 0 && (
        <div className="border-ecorce-bord mt-7 border-t pt-6">
          <h3 className="text-[19px] font-semibold">Le client a accepté</h3>

          {dejaConverti ? (
            <p className="text-succes mt-2 text-[15px]">
              Déjà converti en commande {demande.commandeReference}.
            </p>
          ) : !confirmeConversion ? (
            <>
              <p className="text-cendre-clair mt-2 max-w-[62ch] text-[15px] leading-relaxed">
                Crée la commande, réserve le stock et vous emmène sur la fiche pour fixer la date et
                le règlement. Rien n&apos;est ressaisi.
              </p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="mt-4"
                onClick={() => setConfirmeConversion(true)}
              >
                <ShoppingCart strokeWidth={1.75} />
                Convertir en commande
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed">
                Créer une commande de <strong>{formatEuros(proposition.totaux.totalCents)}</strong>{" "}
                pour{" "}
                <strong>
                  {[demande.prenom, demande.nom].filter(Boolean).join(" ") || demande.email}
                </strong>{" "}
                ? Le stock correspondant sera réservé immédiatement.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="cta"
                  size="lg"
                  disabled={enCours}
                  onClick={() =>
                    demarrer(async () => {
                      setRetour(null);
                      const r = await convertirDevisEnCommande({ devisId: demande.id });
                      setRetour({ ok: r.ok, texte: r.message ?? "" });
                      setConfirmeConversion(false);
                      if (r.ok && r.redirection) window.location.assign(r.redirection);
                    })
                  }
                >
                  {enCours ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Check strokeWidth={2} />
                  )}
                  Oui, créer la commande
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => setConfirmeConversion(false)}
                >
                  <X strokeWidth={1.75} />
                  Annuler
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
