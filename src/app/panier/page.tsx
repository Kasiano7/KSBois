import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart, FileDown, AlertTriangle } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { getPanier } from "@/server/panier";
import { formatEuros, formatVolume } from "@/domain/units";
import { ChampDestination } from "@/components/panier/champ-destination";
import { LignePanier } from "@/components/panier/ligne-panier";
import { RecapLivraison } from "@/components/panier/recap-livraison";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Mon panier",
  robots: { index: false, follow: false },
};

export default async function PagePanier() {
  const tenant = await requireTenant();
  const panier = await getPanier(tenant);

  if (panier.lignes.length === 0) {
    return (
      <main className="mx-auto max-w-[1240px] px-5 py-20">
        <h1 className="text-[32px] sm:text-[42px]">Votre panier est vide</h1>
        <p className="text-cendre prose-bois mt-4 text-[19px]">
          Choisissez une longueur de bûches et une quantité, nous calculons la livraison jusque chez
          vous.
        </p>
        <Button asChild variant="cta" size="cta" className="mt-8">
          <Link href="/#commander">Voir le bois de chauffage</Link>
        </Button>
      </main>
    );
  }

  const livraisonChiffree = panier.livraison.devis?.status === "ok";
  const peutCommander =
    livraisonChiffree && panier.livraison.eligibilite?.status === "ok" && panier.divergences.length === 0;

  return (
    <main className="mx-auto max-w-[1240px] px-5 py-12 sm:py-16">
      <h1 className="text-[32px] sm:text-[42px]">Votre panier</h1>

      {/* Divergences détectées à la revalidation : jamais corrigées en silence */}
      {panier.divergences.length > 0 && (
        <div className="border-alerte/30 bg-alerte/8 mt-6 rounded-[6px] border p-4">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={19} strokeWidth={1.9} aria-hidden="true" />
            Votre panier a changé
          </p>
          <ul className="mt-2 space-y-1 text-[15px]">
            {panier.divergences.map((d, i) => (
              <li key={i}>{d.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px] lg:gap-12">
        {/* ---- Colonne gauche : destination + lignes ---- */}
        <div>
          <ChampDestination
            codePostalInitial={panier.codePostal}
            villeInitiale={panier.ville}
          />

          <ul className="mt-8">
            {panier.lignes.map((ligne) => (
              <LignePanier key={ligne.itemId} ligne={ligne} />
            ))}
          </ul>

          <div className="border-aubier-bord mt-4 border-t pt-4">
            {/*
              Pas d'équivalence en stères sur le total : un panier peut mêler
              plusieurs longueurs de coupe, dont les coefficients d'empilage
              diffèrent. Un chiffre unique serait faux. L'équivalence reste
              affichée LIGNE PAR LIGNE, où elle a un sens.
            */}
            <p className="text-cendre text-[15px]">
              Total commandé :{" "}
              <strong className="text-encre">{formatVolume(panier.totaux.totalVolumeM3)}</strong>
            </p>
          </div>
        </div>

        {/* ---- Colonne droite : livraison + totaux ---- */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <RecapLivraison livraison={panier.livraison} />

          <div className="border-aubier-bord bg-aubier-pur rounded-[8px] border p-5">
            <dl className="space-y-2 text-[15px]">
              <div className="flex justify-between gap-3">
                <dt className="text-cendre">Bois</dt>
                <dd className="tabulaire">{formatEuros(panier.totaux.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-cendre">Livraison</dt>
                <dd className="tabulaire">
                  {livraisonChiffree
                    ? panier.totaux.deliveryCents === 0
                      ? "Offerte"
                      : formatEuros(panier.totaux.deliveryCents)
                    : "à calculer"}
                </dd>
              </div>
            </dl>

            <div className="border-aubier-bord mt-4 flex items-end justify-between gap-3 border-t pt-4">
              <span className="font-semibold">Total TTC</span>
              <span className="text-braise-texte font-display tabulaire text-[32px] leading-none font-bold">
                {formatEuros(panier.totaux.totalCents)}
              </span>
            </div>

            {panier.totaux.vatBreakdown.length > 0 && (
              <p className="text-cendre mt-2 text-right text-[13px]">
                dont{" "}
                {panier.totaux.vatBreakdown
                  .map(
                    (b) =>
                      `${formatEuros(b.vatCents)} de TVA à ${b.rate.toLocaleString("fr-FR")} %`,
                  )
                  .join(", ")}
              </p>
            )}
            {tenant.vatMode === "franchise_en_base" && (
              <p className="text-cendre mt-2 text-right text-[13px]">
                TVA non applicable, article 293 B du CGI
              </p>
            )}

            <Button
              asChild={peutCommander}
              variant="cta"
              size="cta"
              disabled={!peutCommander}
              className="mt-5 w-full"
            >
              {peutCommander ? (
                <Link href="/commande/livraison">
                  <ShoppingCart strokeWidth={1.75} />
                  Continuer
                </Link>
              ) : (
                <>
                  <ShoppingCart strokeWidth={1.75} />
                  Continuer
                </>
              )}
            </Button>

            {!livraisonChiffree && (
              <p className="text-cendre mt-2.5 text-center text-[13px]">
                Indiquez votre code postal pour continuer.
              </p>
            )}

            {/* Devis PDF immédiat, sans compte ni email — docs/02 §7.1 */}
            <form action="/api/pdf/devis" method="post" className="mt-4">
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={!livraisonChiffree}
              >
                <FileDown strokeWidth={1.75} />
                Imprimer le devis
              </Button>
            </form>
            <p className="text-cendre mt-2 text-center text-[13px]">
              PDF immédiat, sans inscription. Prix indicatif.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
