/**
 * Construction des factures et des avoirs — calculs purs, zéro I/O.
 *
 * Trois principes tiennent tout ce fichier :
 *
 * 1. **Une facture est un instantané, pas une vue.** Elle est construite une
 *    fois, à l'émission, et stockée telle quelle dans `invoices`. On ne la
 *    recalcule JAMAIS à l'affichage : un prix révisé, une remise corrigée ou un
 *    taux de TVA modifié six mois plus tard ne doivent pas réécrire un document
 *    déjà remis au client et déjà comptabilisé.
 *
 * 2. **Elle doit se boucler au centime.** Si la somme des lignes, des options,
 *    de la remise et du port ne retombe pas exactement sur le total encaissé,
 *    on n'émet pas. Une facture qui ne s'additionne pas est un problème
 *    juridique, pas un défaut d'affichage.
 *
 * 3. **La quantité légale est le mètre cube apparent.** Le stère n'est plus une
 *    unité légale depuis 1977 : il ne peut apparaître qu'en équivalence
 *    indicative, jamais comme quantité facturée — y compris le jour où
 *    l'entreprise choisira d'exprimer ses PRIX au stère (`companies.pricing_basis`,
 *    PLAN.md §3.1 et §3.3).
 */

export interface IdentiteVendeur {
  name: string;
  legalName: string | null;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  siret: string | null;
  rcs: string | null;
  apeCode: string | null;
  vatNumber: string | null;
  email: string | null;
  phone: string | null;
  vatMode: "assujetti" | "franchise_en_base";
}

export interface IdentiteAcheteur {
  name: string;
  companyName: string | null;
  siret: string | null;
  vatNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  /** Un professionnel déclenche les mentions de pénalités et d'indemnité. */
  isProfessional: boolean;
}

export interface LigneFactureEntree {
  designation: string;
  /** « 33 cm · bois sec » — précisions sous la désignation. */
  precision: string | null;
  /** Quantité légale, en m³ apparents. */
  quantiteM3: number;
  /** Coefficient d'empilage figé à l'émission, pour l'équivalence en stères. */
  stackingCoefficient: number | null;
  unitPriceCents: number;
  lineTotalCents: number;
  vatRate: number;
}

export interface LigneFacture extends LigneFactureEntree {
  /**
   * Prix unitaire hors taxe, figé à l'émission.
   *
   * L'article 242 nonies A du CGI impose le prix unitaire HT sur la facture.
   * L'application raisonne en TTC de bout en bout (c'est ce que le client a vu
   * et accepté), donc on reconstitue le HT ici — une seule fois, à l'émission,
   * et on le range dans l'instantané plutôt que de le recalculer à chaque
   * affichage. Les montants qui font foi restent les totaux par taux.
   */
  unitPriceHtCents: number;
}

export interface VentilationTvaFacture {
  rate: number;
  baseHtCents: number;
  vatCents: number;
  baseTtcCents: number;
}

export interface TotauxFacture {
  /** Bois seul, hors options, hors remise, hors livraison. */
  subtotalCents: number;
  optionsCents: number;
  discountCents: number;
  deliveryCents: number;
  totalHtCents: number;
  totalVatCents: number;
  totalTtcCents: number;
  /** Déjà encaissé au moment de l'émission. */
  paidCents: number;
  /** `totalTtcCents - paidCents`, jamais négatif. */
  remainingCents: number;
  totalVolumeM3: number;
}

export interface DocumentFacture {
  seller: IdentiteVendeur;
  buyer: IdentiteAcheteur;
  lines: LigneFacture[];
  options: Array<{ name: string; priceCents: number; vatRate: number }>;
  delivery: { label: string; totalCents: number } | null;
  discount: { label: string; amountCents: number } | null;
  totals: TotauxFacture;
  vatBreakdown: VentilationTvaFacture[];
  /** Référence de la commande d'origine — le lien comptable. */
  orderReference: string;
  /** Date de la vente : livraison si connue, sinon date de commande. */
  saleDate: string;
  isCreditNote: boolean;
}

export interface EntreeFacture {
  seller: IdentiteVendeur;
  buyer: IdentiteAcheteur;
  orderReference: string;
  saleDate: string;
  lines: LigneFactureEntree[];
  options: Array<{ name: string; priceCents: number; vatRate: number }>;
  delivery: { label: string; totalCents: number } | null;
  discount: { label: string; amountCents: number } | null;
  /** Total réellement dû sur la commande, TTC. Sert de contrôle. */
  orderTotalCents: number;
  paidCents: number;
  totalVolumeM3: number;
  /** Ventilation figée sur la commande. Vide en franchise en base. */
  vatBreakdown: VentilationTvaFacture[];
}

export class FactureIncoherenteError extends Error {
  constructor(
    readonly attenduCents: number,
    readonly calculeCents: number,
  ) {
    super(
      `La facture ne se boucle pas : les lignes totalisent ${calculeCents} centimes ` +
        `alors que la commande en porte ${attenduCents}.`,
    );
    this.name = "FactureIncoherenteError";
  }
}

/**
 * Assemble le document, ou refuse.
 *
 * Le contrôle de bouclage n'est pas une précaution de confort : sans lui, une
 * option oubliée dans la requête produirait une facture d'un montant inférieur
 * à ce que le client a payé, et personne ne s'en apercevrait avant le bilan.
 */
export function construireFacture(entree: EntreeFacture): DocumentFacture {
  const subtotalCents = entree.lines.reduce((somme, ligne) => somme + ligne.lineTotalCents, 0);
  const optionsCents = entree.options.reduce((somme, option) => somme + option.priceCents, 0);
  const deliveryCents = entree.delivery?.totalCents ?? 0;
  const discountCents = entree.discount?.amountCents ?? 0;

  const calcule = subtotalCents + optionsCents - discountCents + deliveryCents;
  if (calcule !== entree.orderTotalCents) {
    throw new FactureIncoherenteError(entree.orderTotalCents, calcule);
  }

  // En franchise en base, `vatBreakdown` est vide et le HT vaut le TTC : il n'y
  // a pas de TVA à reconstituer, et en inventer une serait une fausse facture.
  const totalVatCents = entree.vatBreakdown.reduce((somme, ligne) => somme + ligne.vatCents, 0);
  const totalHtCents = entree.orderTotalCents - totalVatCents;

  return {
    seller: entree.seller,
    buyer: entree.buyer,
    lines: entree.lines.map((ligne) => ({
      ...ligne,
      unitPriceHtCents: Math.round(ligne.unitPriceCents / (1 + ligne.vatRate / 100)),
    })),
    options: entree.options,
    delivery: entree.delivery,
    discount: entree.discount,
    orderReference: entree.orderReference,
    saleDate: entree.saleDate,
    isCreditNote: false,
    vatBreakdown: entree.vatBreakdown,
    totals: {
      subtotalCents,
      optionsCents,
      discountCents,
      deliveryCents,
      totalHtCents,
      totalVatCents,
      totalTtcCents: entree.orderTotalCents,
      paidCents: entree.paidCents,
      // Un trop-perçu ne se montre pas comme un « reste à payer négatif » : il
      // se règle par un avoir, pas par une soustraction dans un coin de page.
      remainingCents: Math.max(0, entree.orderTotalCents - entree.paidCents),
      totalVolumeM3: entree.totalVolumeM3,
    },
  };
}

/**
 * Avoir : la facture d'origine, tous montants inversés.
 *
 * On ne supprime jamais une facture et on ne la modifie jamais — on en émet la
 * contrepartie. C'est la seule façon d'annuler une vente sans trouer la
 * numérotation, qui doit rester continue et sans lacune.
 */
export function construireAvoir(facture: DocumentFacture): DocumentFacture {
  const inverser = (cents: number) => -cents;

  return {
    ...facture,
    isCreditNote: true,
    lines: facture.lines.map((ligne) => ({
      ...ligne,
      quantiteM3: -ligne.quantiteM3,
      lineTotalCents: inverser(ligne.lineTotalCents),
    })),
    options: facture.options.map((option) => ({
      ...option,
      priceCents: inverser(option.priceCents),
    })),
    delivery: facture.delivery
      ? { ...facture.delivery, totalCents: inverser(facture.delivery.totalCents) }
      : null,
    discount: facture.discount
      ? { ...facture.discount, amountCents: inverser(facture.discount.amountCents) }
      : null,
    vatBreakdown: facture.vatBreakdown.map((ligne) => ({
      rate: ligne.rate,
      baseHtCents: inverser(ligne.baseHtCents),
      vatCents: inverser(ligne.vatCents),
      baseTtcCents: inverser(ligne.baseTtcCents),
    })),
    totals: {
      subtotalCents: inverser(facture.totals.subtotalCents),
      optionsCents: inverser(facture.totals.optionsCents),
      discountCents: inverser(facture.totals.discountCents),
      deliveryCents: inverser(facture.totals.deliveryCents),
      totalHtCents: inverser(facture.totals.totalHtCents),
      totalVatCents: inverser(facture.totals.totalVatCents),
      totalTtcCents: inverser(facture.totals.totalTtcCents),
      paidCents: 0,
      remainingCents: 0,
      totalVolumeM3: -facture.totals.totalVolumeM3,
    },
  };
}

/**
 * Échéance de paiement.
 *
 * Le délai légal supplétif entre professionnels est de 30 jours à compter de la
 * livraison (art. L441-10 du code de commerce). Pour un particulier, le
 * paiement est comptant : l'échéance est la date de vente.
 */
export function echeancePaiement(saleDate: string, isProfessional: boolean): string {
  const date = new Date(`${saleDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return saleDate;
  if (!isProfessional) return saleDate;
  return new Date(date.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Mentions légales obligatoires au bas d'une facture.
 *
 * Elles ne sont pas décoratives : l'absence de la mention de pénalités de
 * retard sur une facture entre professionnels est sanctionnable, et la mention
 * « TVA non applicable » est ce qui rend une facture en franchise recevable.
 * Elles sont donc calculées ici, à côté des montants, et testées.
 */
export function mentionsLegales(options: {
  vatMode: IdentiteVendeur["vatMode"];
  isProfessional: boolean;
  tauxPenalitesAnnuel: number;
}): string[] {
  const mentions: string[] = [];

  if (options.vatMode === "franchise_en_base") {
    mentions.push("TVA non applicable, article 293 B du CGI.");
  }

  if (options.isProfessional) {
    mentions.push(
      `En cas de retard de paiement, une pénalité au taux annuel de ` +
        `${options.tauxPenalitesAnnuel.toLocaleString("fr-FR")} % est exigible, sans rappel préalable.`,
    );
    mentions.push(
      "Indemnité forfaitaire pour frais de recouvrement : 40 euros (art. D441-5 du code de commerce).",
    );
  } else {
    mentions.push("Paiement comptant à la livraison, sauf accord écrit contraire.");
  }

  mentions.push(
    "Le stère n'est plus une unité légale de mesure depuis 1977 : les quantités sont exprimées " +
      "en mètres cubes apparents. Toute mention en stères est donnée à titre indicatif.",
  );

  return mentions;
}
