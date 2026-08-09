/**
 * Recommande — docs/03-DESIGN-SYSTEM.md §6.4
 *
 * « Recommander la même chose » est la fonctionnalité la plus rentable du site :
 * cette clientèle rachète chaque année, et le geste doit tenir en deux clics.
 *
 * Tout l'enjeu est là : reprendre une commande d'il y a un an sans jamais
 * MENTIR. Un format supprimé, un prix qui a bougé, un stock devenu insuffisant
 * doivent être dits — pas corrigés en silence, pas cachés derrière un panier qui
 * « ne ressemble plus à la dernière fois » sans explication.
 */

import { roundVolume } from "../units";
import { resolveUnitPrice, type PriceTier } from "../pricing";

/** Ligne d'une commande passée, telle qu'elle a été figée à l'époque. */
export interface LigneCommandePassee {
  /** `null` si la variante a été supprimée depuis. */
  variantId: string | null;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPriceCents: number;
}

/** État actuel d'une variante au catalogue. */
export interface VarianteActuelle {
  id: string;
  isActive: boolean;
  basePriceCents: number;
  /**
   * Paliers dégressifs. Indispensables à la comparaison de prix : à 4 m³, le
   * client paie le prix du palier, pas le prix de base. Les ignorer annonçait
   * « prix inchangé » à quelqu'un qui allait payer 35 € de moins — et
   * réciproquement, taisait une hausse réelle.
   */
  tiers: PriceTier[];
  stockAvailable: number;
  trackStock: boolean;
  allowBackorder: boolean;
  minQuantity: number;
  maxQuantity: number | null;
  quantityStep: number;
}

export type MotifAvertissement =
  "produit_retire" | "prix_change" | "quantite_ajustee" | "stock_limite";

export interface AvertissementRecommande {
  motif: MotifAvertissement;
  /** Message destiné au client, en français courant. */
  message: string;
}

export interface LigneRecommandee {
  variantId: string;
  quantity: number;
}

export interface ResultatRecommande {
  lignes: LigneRecommandee[];
  avertissements: AvertissementRecommande[];
  /** Aucune ligne reprise : il n'y a rien à remettre au panier. */
  vide: boolean;
}

const formatteurNombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const formatteurEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

/**
 * Ajuste une quantité aux contraintes de la variante.
 * Le pas est comparé en millièmes : `0.1 + 0.2` ne vaut pas `0.3` en flottant.
 */
function ajusterQuantite(souhaitee: number, variante: VarianteActuelle): number {
  const pas = variante.quantityStep > 0 ? variante.quantityStep : 1;
  const pasMillieme = Math.round(pas * 1000);

  let quantite = souhaitee;
  const reste = Math.round(quantite * 1000) % pasMillieme;
  if (reste !== 0) {
    // On arrondit vers le HAUT : mieux vaut proposer un peu plus que livrer
    // moins que ce que le client avait pris la dernière fois.
    quantite = (Math.round(quantite * 1000) - reste + pasMillieme) / 1000;
  }

  quantite = Math.max(quantite, variante.minQuantity);
  if (variante.maxQuantity !== null) quantite = Math.min(quantite, variante.maxQuantity);

  return roundVolume(quantite);
}

/**
 * Prépare le contenu du panier à partir d'une commande passée.
 *
 * Ne touche à aucun prix : le panier serveur les recalcule de toute façon. Cette
 * fonction décide seulement CE QU'ON REMET dedans, et ce qu'il faut dire au
 * client.
 */
export function prepareReorder(
  lignes: LigneCommandePassee[],
  variantes: VarianteActuelle[],
): ResultatRecommande {
  const reprises: LigneRecommandee[] = [];
  const avertissements: AvertissementRecommande[] = [];

  for (const ligne of lignes) {
    const nom = `${ligne.productName} ${ligne.variantLabel}`.trim();
    const variante = ligne.variantId ? variantes.find((v) => v.id === ligne.variantId) : undefined;

    if (!variante || !variante.isActive) {
      avertissements.push({
        motif: "produit_retire",
        message: `${nom} n'est plus proposé : nous ne l'avons pas remis dans votre panier.`,
      });
      continue;
    }

    const quantite = ajusterQuantite(ligne.quantity, variante);

    if (Math.abs(quantite - ligne.quantity) > 0.0005) {
      avertissements.push({
        motif: "quantite_ajustee",
        message:
          `${nom} : la quantité est passée de ${formatteurNombre.format(ligne.quantity)} à ` +
          `${formatteurNombre.format(quantite)} m³ apparents, pour respecter nos conditionnements.`,
      });
    }

    // Le prix a bougé : on le dit AVANT le paiement, jamais après. C'est la
    // différence entre un client qui recommande et un client qui se sent piégé.
    //
    // On compare ce qu'il va PAYER, palier dégressif de la quantité reprise
    // compris, à ce qu'il avait payé — pas deux prix de catalogue.
    const prixApplicable = resolveUnitPrice(quantite, {
      variantId: variante.id,
      basePriceCents: variante.basePriceCents,
      vatRate: 0,
      unitVolumeM3: 1,
      tiers: variante.tiers,
    });

    if (prixApplicable !== ligne.unitPriceCents) {
      avertissements.push({
        motif: "prix_change",
        message:
          `${nom} : le prix est passé de ${formatteurEuros.format(ligne.unitPriceCents / 100)} à ` +
          `${formatteurEuros.format(prixApplicable / 100)} le m³ apparent depuis votre dernière commande.`,
      });
    }

    if (variante.trackStock && !variante.allowBackorder && quantite > variante.stockAvailable) {
      avertissements.push({
        motif: "stock_limite",
        message:
          `${nom} : il ne nous reste que ${formatteurNombre.format(variante.stockAvailable)} m³ ` +
          `apparents disponibles. Ajustez la quantité dans le panier ou appelez-nous.`,
      });
    }

    reprises.push({ variantId: variante.id, quantity: quantite });
  }

  return { lignes: reprises, avertissements, vide: reprises.length === 0 };
}
