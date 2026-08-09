"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Leaf, Trees, ShoppingCart, Loader2 } from "lucide-react";
import { ajouterAuPanier } from "@/server/actions/panier";
import { computeLine } from "@/domain/pricing";
import { computeDeliveryFee, selectVehicle } from "@/domain/delivery";
import { formatEuros, formatStereHint, validateQuantity } from "@/domain/units";
import type { CatalogueProduct, CatalogueVariant } from "@/server/catalogue";
import type { ContexteLivraison } from "@/server/livraison-contexte";
import { BucheIllustration } from "./buche-illustration";
import { PileIllustration } from "./pile-illustration";
import { PanneauSelection } from "./panneau-selection";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Configurateur d'accueil en trois volets : longueur, essence, sélection.
 *
 * C'est l'ordre dans lequel un client décide — d'abord ce qui rentre dans son
 * poêle, ensuite la qualité du bois, enfin ce que ça coûte. Le panneau de droite
 * récapitule et porte le total, seule donnée affichée en grand.
 *
 * Modèle de données : une gamme d'essence = un PRODUIT, une longueur = une
 * VARIANTE (PLAN.md §2.2). L'intersection des deux choix désigne la variante.
 */

interface ChoixBoisProps {
  produits: CatalogueProduct[];
  /** Connu seulement si le visiteur a déjà renseigné son code postal. */
  contexteLivraison?: ContexteLivraison | null;
  /** Au-delà, la longueur n'est plus proposée en vignette. */
  longueurVisuelleMaxCm?: number;
}

interface Longueur {
  cm: number;
  label: string;
  hint: string | null;
}

function variantePour(produit: CatalogueProduct, cm: number): CatalogueVariant | undefined {
  return produit.variants.find((v) => v.cutLengthCm === cm);
}

function estVendable(v: CatalogueVariant): boolean {
  return !v.trackStock || v.stockAvailable > 0 || v.allowBackorder;
}

export function ChoixBois({
  produits,
  contexteLivraison = null,
  longueurVisuelleMaxCm = 50,
}: ChoixBoisProps) {
  const router = useRouter();
  const groupeLongueur = useId();
  const groupeEssence = useId();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const longueurs = useMemo<Longueur[]>(() => {
    const parCm = new Map<number, Longueur>();
    for (const p of produits) {
      for (const v of p.variants) {
        if (v.cutLengthCm === null || parCm.has(v.cutLengthCm)) continue;
        parCm.set(v.cutLengthCm, {
          cm: v.cutLengthCm,
          label: v.cutLengthLabel ?? `${v.cutLengthCm} cm`,
          hint: v.cutLengthHint,
        });
      }
    }
    return [...parCm.values()].sort((a, b) => a.cm - b.cm);
  }, [produits]);

  // Les vignettes ne couvrent que 25–50 cm : au-delà, l'écart d'échelle
  // écraserait les petites longueurs. Le 1 m reste offert, en second rideau.
  const vignettes = longueurs.filter((l) => l.cm <= longueurVisuelleMaxCm);
  const longueursSecondaires = longueurs.filter((l) => l.cm > longueurVisuelleMaxCm);
  const maxCmVignette = Math.max(...vignettes.map((l) => l.cm), 1);

  const [cm, setCm] = useState(
    () =>
      (vignettes.some((l) => l.cm === 33) ? 33 : vignettes[0]?.cm) ?? longueurs[0]?.cm ?? 33,
  );
  const [produitId, setProduitId] = useState(() => produits[0]?.id ?? "");
  const [quantite, setQuantite] = useState(1);

  const produit = produits.find((p) => p.id === produitId) ?? produits[0];
  const variante = produit ? variantePour(produit, cm) : undefined;

  const ligne = useMemo(
    () => (variante ? computeLine(variante.pricing, quantite) : null),
    [variante, quantite],
  );

  /**
   * Estimation de livraison pour la quantité en cours.
   * Utilise LA MÊME fonction que le serveur : aucune divergence possible, et le
   * montant est de toute façon recalculé au panier (PLAN.md §5.1).
   */
  const livraison = useMemo(() => {
    if (!contexteLivraison || !ligne) return null;
    const vehicule = selectVehicle(
      ligne.lineVolumeM3,
      "camion",
      contexteLivraison.vehicules,
      contexteLivraison.distanceKm,
    );
    if (!vehicule) return null;

    return {
      ville: contexteLivraison.ville,
      devis: computeDeliveryFee({
        zone: contexteLivraison.zone,
        vehicle: vehicule,
        distanceKm: contexteLivraison.distanceKm,
        volumeM3: ligne.lineVolumeM3,
        subtotalCents: ligne.lineTotalCents,
        fuel: contexteLivraison.carburant,
        settings: contexteLivraison.reglages,
      }),
    };
  }, [contexteLivraison, ligne]);

  if (!produit || longueurs.length === 0) {
    return (
      <div className="border-aubier-bord bg-aubier-pur rounded-[10px] border p-7">
        <p className="text-cendre">Aucun produit disponible pour le moment.</p>
      </div>
    );
  }

  /**
   * Changement de longueur. Si la gamme choisie ne propose pas cette longueur,
   * on bascule vers la première qui la propose ET on le DIT : un changement
   * silencieux ferait passer le client à la caisse avec autre chose que ce
   * qu'il croyait choisir.
   */
  const choisirLongueur = (nouveauCm: number) => {
    setErreur(null);
    setCm(nouveauCm);

    if (!variantePour(produit, nouveauCm)) {
      const repli = produits.find((p) => variantePour(p, nouveauCm));
      if (repli) {
        setProduitId(repli.id);
        setNote(
          `${produit.name} n'existe pas en ${nouveauCm} cm — nous avons sélectionné ${repli.name}.`,
        );
      }
    } else {
      setNote(null);
    }
  };

  const choisirEssence = (id: string) => {
    setErreur(null);
    setNote(null);
    setProduitId(id);
  };

  const erreurQuantite = variante
    ? validateQuantity(quantite, {
        min: variante.minQuantity,
        max: variante.maxQuantity,
        step: variante.quantityStep,
      })
    : null;

  const ajuster = (delta: number) => {
    if (!variante) return;
    setQuantite((q) => {
      const suivant = Math.round((q + delta) * 1000) / 1000;
      return Math.min(variante.maxQuantity ?? 99, Math.max(variante.minQuantity, suivant));
    });
  };

  const enRupture = variante ? !estVendable(variante) : false;
  const longueurCourante = longueurs.find((l) => l.cm === cm);

  /**
   * Un seul chemin d'ajout pour les deux boutons — celui près du produit et
   * celui du récapitulatif. Deux implémentations divergeraient tôt ou tard.
   */
  const ajouterAuPanierEtRediriger = () => {
    if (!variante) return;
    setErreur(null);
    demarrer(async () => {
      const r = await ajouterAuPanier({ variantId: variante.id, quantity: quantite });
      if (r.ok) router.push("/panier");
      else setErreur(r.message ?? "Ajout impossible.");
    });
  };

  return (
    /* Une seule grande carte claire, en trois volets : longueur, essence,
       sélection. C'est l'ordre dans lequel un client décide, et le récapitulatif
       reste sous les yeux pendant qu'il choisit. */
    <div className="border-aubier-bord bg-aubier-pur grid items-stretch overflow-hidden rounded-[14px] border shadow-[0_18px_50px_-28px_rgba(20,16,13,0.55)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
      {/* ═══════════ 1. Longueur ═══════════ */}
      <fieldset className="border-aubier-bord border-b p-5 sm:p-7 lg:border-r lg:border-b-0">
        <legend className="text-[19px] font-semibold">
          <span className="text-braise-texte font-display">1.</span> Configuration de votre bois
        </legend>

        <div
          className="mt-6 grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${vignettes.length}, minmax(0, 1fr))` }}
        >
          {vignettes.map((l) => {
            const inputId = `${groupeLongueur}-${l.cm}`;
            const active = l.cm === cm;
            return (
              <div key={l.cm}>
                <input
                  type="radio"
                  id={inputId}
                  name={groupeLongueur}
                  checked={active}
                  onChange={() => choisirLongueur(l.cm)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={inputId}
                  className={cn(
                    "flex cursor-pointer flex-col items-center rounded-[8px] border p-2 pb-3 transition-colors duration-150",
                    "peer-focus-visible:outline-braise peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                    active ? "border-encre/25 bg-aubier" : "hover:bg-aubier border-transparent",
                  )}
                >
                  <BucheIllustration
                    cm={l.cm}
                    maxCm={maxCmVignette}
                    selectionnee={active}
                    className="h-16 w-full"
                  />
                  <span
                    className={cn(
                      "tabulaire mt-1 text-[15px]",
                      active ? "text-encre font-semibold" : "text-cendre",
                    )}
                  >
                    {l.label}
                  </span>
                  {/* Pastille : l'état ne repose jamais sur la couleur seule */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-2 flex size-[18px] items-center justify-center rounded-full border-2",
                      active ? "border-encre" : "border-aubier-bord",
                    )}
                  >
                    {active && <span className="bg-encre block size-[9px] rounded-full" />}
                  </span>
                </label>
              </div>
            );
          })}
        </div>

        {longueursSecondaires.map((l) => {
          const inputId = `${groupeLongueur}-${l.cm}`;
          const active = l.cm === cm;
          return (
            <div key={l.cm} className="mt-4">
              <input
                type="radio"
                id={inputId}
                name={groupeLongueur}
                checked={active}
                onChange={() => choisirLongueur(l.cm)}
                className="peer sr-only"
              />
              <label
                htmlFor={inputId}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-[6px] border px-3 py-2.5 text-[15px] transition-colors",
                  "peer-focus-visible:outline-braise peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                  active ? "border-encre/25 bg-aubier" : "border-aubier-bord hover:bg-aubier",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2",
                    active ? "border-encre" : "border-aubier-bord",
                  )}
                >
                  {active && <span className="bg-encre block size-[9px] rounded-full" />}
                </span>
                <span className={cn("leading-snug", active ? "font-semibold" : "text-cendre")}>
                  Aussi en {l.label}, à recouper soi-même
                </span>
              </label>
            </div>
          );
        })}

        {longueurCourante?.hint && (
          <p className="text-cendre mt-5 text-[15px]">
            <span className="text-encre font-semibold">{longueurCourante.label}</span> —{" "}
            {longueurCourante.hint}
          </p>
        )}
      </fieldset>

      {/* ═══════════ 2. Essence ═══════════ */}
      <div className="border-aubier-bord border-b p-5 sm:p-7 lg:border-r lg:border-b-0">
        <fieldset>
          <legend className="text-[19px] font-semibold">
            <span className="text-braise-texte font-display">2.</span> Type de bois
          </legend>

          <div className="mt-6 grid grid-cols-2 gap-2">
            {produits.map((p) => {
              const v = variantePour(p, cm);
              const dispo = Boolean(v);
              const inputId = `${groupeEssence}-${p.id}`;
              const active = p.id === produitId && dispo;
              const resineux = p.slug.includes("tendre");

              return (
                <div key={p.id}>
                  <input
                    type="radio"
                    id={inputId}
                    name={groupeEssence}
                    checked={active}
                    disabled={!dispo}
                    onChange={() => choisirEssence(p.id)}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={inputId}
                    title={dispo ? undefined : `${p.name} n'est pas proposé en ${cm} cm`}
                    className={cn(
                      "flex h-full cursor-pointer flex-col items-center rounded-[8px] border p-3 text-center transition-colors duration-150",
                      "peer-focus-visible:outline-braise peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                      active ? "border-encre/30 bg-aubier" : "border-aubier-bord hover:bg-aubier",
                      !dispo && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {resineux ? (
                      <Trees size={19} strokeWidth={1.6} className="text-sapin" aria-hidden="true" />
                    ) : (
                      <Leaf size={19} strokeWidth={1.6} className="text-sapin" aria-hidden="true" />
                    )}
                    <span
                      className={cn(
                        "mt-2 text-[15px] leading-tight",
                        active ? "text-encre font-semibold" : "text-encre/85",
                      )}
                    >
                      {p.name}
                    </span>
                    {p.shortDescription && (
                      <span className="text-cendre mt-1 text-[12px] leading-tight">
                        {p.shortDescription}
                      </span>
                    )}
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>

        {note && (
          <p role="status" className="bg-seve/15 text-encre mt-4 rounded-[6px] p-3 text-[15px]">
            {note}
          </p>
        )}

        {/* ─── Le bois choisi, en clair ─── */}
        {variante && ligne ? (
          <div className="border-aubier-bord mt-6 border-t pt-5">
            <div className="flex items-start gap-4">
              <PileIllustration
                graine={variante.cutLengthCm ?? 33}
                className="border-aubier-bord h-[86px] w-[104px] shrink-0 overflow-hidden rounded-[8px] border"
              />
              <div className="min-w-0">
                <p className="text-[19px] leading-tight font-semibold">
                  Bûches {variante.cutLengthLabel}
                  <span className="text-cendre block font-normal">{produit.name}</span>
                </p>
                <p className="text-cendre mt-2 text-[15px] leading-snug">
                  {variante.humidityClass === "H1" && "Sec et prêt à brûler"}
                  {variante.humidityClass === "H2" && "Mi-sec, à finir de sécher"}
                  {variante.humidityClass === "H3" && "Fraîchement coupé"}
                  {variante.measuredHumidityPct !== null &&
                    ` — humidité ${variante.measuredHumidityPct.toLocaleString("fr-FR")} %`}
                </p>
              </div>
            </div>

            <p className="mt-4">
              <span className="font-display tabulaire text-braise-texte text-[26px] leading-none font-bold">
                {formatEuros(ligne.unitPriceCents)}
              </span>
              <span className="text-cendre ml-2 text-[15px]">le m³ apparent</span>
            </p>

            {/* Quantité et ajout au panier, côte à côte comme sur la maquette */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="border-aubier-bord flex items-center overflow-hidden rounded-[6px] border">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="rounded-none"
                  aria-label={`Diminuer la quantité de ${produit.name}`}
                  disabled={quantite <= variante.minQuantity}
                  onClick={() => ajuster(-variante.quantityStep)}
                >
                  <Minus strokeWidth={1.75} />
                </Button>
                <span className="tabulaire border-aubier-bord flex h-12 w-14 items-center justify-center border-x text-[19px] font-semibold">
                  {quantite.toLocaleString("fr-FR")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  className="rounded-none"
                  aria-label={`Augmenter la quantité de ${produit.name}`}
                  onClick={() => ajuster(variante.quantityStep)}
                >
                  <Plus strokeWidth={1.75} />
                </Button>
              </div>

              <span className="text-cendre text-[15px]">m³ app.</span>

              <Button
                type="button"
                variant="default"
                size="lg"
                className="ml-auto"
                disabled={enCours || enRupture || erreurQuantite !== null}
                onClick={ajouterAuPanierEtRediriger}
              >
                {enCours ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <ShoppingCart strokeWidth={1.75} />
                )}
                Ajouter au panier
              </Button>
            </div>

            {variante.stackingCoefficient !== null && (
              <p className="text-cendre mt-3 text-[13px]">
                {formatStereHint(ligne.lineVolumeM3, variante.stackingCoefficient)}
              </p>
            )}
          </div>
        ) : (
          <p className="border-aubier-bord text-cendre mt-6 border-t pt-6 text-[15px]">
            {produit.name} n&apos;est pas proposé en {cm} cm. Choisissez une autre essence ou une
            autre longueur.
          </p>
        )}
      </div>

      {/* ═══════════ 3. Votre sélection ═══════════ */}
      {variante && ligne && (
        <PanneauSelection
          essence={produit.name}
          variante={variante}
          ligne={ligne}
          livraison={livraison}
          enCours={enCours}
          desactive={enRupture || erreurQuantite !== null}
          messageBlocage={
            erreur ?? erreurQuantite ?? (enRupture ? "Rupture de stock sur ce format." : null)
          }
          onAjouter={ajouterAuPanierEtRediriger}
        />
      )}
    </div>
  );
}
