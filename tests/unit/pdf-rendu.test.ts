import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { renderToBuffer } from "@react-pdf/renderer";
import { construireAvoir, construireFacture, type EntreeFacture } from "@/domain/invoices";
import { FacturePdf } from "@/pdf/document-facture";
import { BonLivraisonPdf } from "@/pdf/document-bon-livraison";
import { DocumentDevis } from "@/pdf/document-devis";
import type { Tenant } from "@/lib/tenant";

/**
 * Rendu réel des documents PDF.
 *
 * Ces documents ne sont vérifiables ni à l'œil dans un navigateur, ni par le
 * DOM : ils sortent en binaire. Or ce sont les seuls artefacts du projet qui
 * partent chez un client et chez un comptable. On les rend donc pour de vrai,
 * et on relit le texte qu'ils contiennent.
 *
 * Ce que ce test attrape concrètement :
 *  • une mention légale obligatoire qui disparaît (SIRET, article 293 B) ;
 *  • un montant absent ou faux dans le document remis ;
 *  • un caractère hors WinAnsi qui s'imprimerait en glyphe erroné — le bug
 *    « ≈ 5 stères » devenu « H 5 stères » (`pdf-encodage.test.ts`) ;
 *  • un composant qui lève à la construction, ce que personne ne verrait avant
 *    le premier téléchargement en production.
 */

/**
 * Plage WinAnsi 0x80–0x9F, qui ne correspond PAS à latin-1.
 *
 * C'est là que vivent le tiret cadratin, les guillemets courbes et l'euro —
 * exactement les caractères que ces documents utilisent. Les décoder en latin-1
 * donnerait des caractères de contrôle et ferait passer le test à côté.
 */
const WINANSI_HAUT: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
  0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘",
  0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜",
  0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

function decoderWinAnsi(octets: Buffer): string {
  return [...octets].map((o) => WINANSI_HAUT[o] ?? String.fromCharCode(o)).join("");
}

/**
 * Extrait le texte affiché d'un PDF rendu.
 *
 * react-pdf compresse les flux de contenu et écrit les chaînes en HEXADÉCIMAL
 * dans des tableaux `TJ` (`[<426f6973> 0] TJ`), pas en littéraux entre
 * parenthèses — les deux formes sont gérées ici.
 */
function texteDuPdf(buffer: Buffer): string {
  const brut = buffer.toString("latin1");
  const morceaux: string[] = [];

  const regexFlux = /stream\r?\n([\s\S]*?)endstream/g;
  let trouve: RegExpExecArray | null;
  while ((trouve = regexFlux.exec(brut)) !== null) {
    const donnees = Buffer.from(trouve[1], "latin1");
    try {
      morceaux.push(inflateSync(donnees).toString("latin1"));
    } catch {
      morceaux.push(trouve[1]); // flux non compressé
    }
  }

  const contenu = morceaux.join("\n");
  const sorties: string[] = [];

  for (const bloc of contenu.matchAll(/\[([^\]]*)\]\s*TJ|\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
    const tableau = bloc[1];
    if (tableau !== undefined) {
      for (const jeton of tableau.matchAll(/<([0-9a-fA-F]+)>|\(((?:\\.|[^\\)])*)\)/g)) {
        if (jeton[1] !== undefined) {
          sorties.push(decoderWinAnsi(Buffer.from(jeton[1], "hex")));
        } else if (jeton[2] !== undefined) {
          sorties.push(litteral(jeton[2]));
        }
      }
      sorties.push(" ");
    } else if (bloc[2] !== undefined) {
      sorties.push(litteral(bloc[2]), " ");
    }
  }

  return sorties.join("");
}

function litteral(brut: string): string {
  return decoderWinAnsi(
    Buffer.from(
      brut
        .replace(/\\([()\\])/g, "$1")
        .replace(/\\(\d{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8))),
      "latin1",
    ),
  );
}

const tenant = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "demo",
  name: "Bois de chauffage",
  tagline: "Bois de chauffage",
  logoUrl: null,
  email: "contact@demo.test",
  phone: "0475000000",
  phoneDisplay: "04 75 00 00 00",
  postalCode: "07100",
  city: "Annonay",
  vatMode: "assujetti",
  pricingBasis: "map_delivered",
  theme: { tokens: {}, fontDisplay: "Fraunces", fontBody: "Archivo" },
  features: {} as Tenant["features"],
} as Tenant;

const entreeFacture: EntreeFacture = {
  seller: {
    name: "Bois de chauffage",
    legalName: "SARL Bois de chauffage",
    addressLine1: "Route du Bois",
    postalCode: "07100",
    city: "Annonay",
    siret: "12345678900012",
    rcs: "Aubenas 123 456 789",
    apeCode: "0220Z",
    vatNumber: "FR12345678900",
    email: "contact@demo.test",
    phone: "04 75 00 00 00",
    vatMode: "assujetti",
  },
  buyer: {
    name: "Jean Rivière",
    companyName: null,
    siret: null,
    vatNumber: null,
    addressLine1: "12 chemin des Fayards",
    addressLine2: null,
    postalCode: "07100",
    city: "Annonay",
    email: "jean@demo.test",
    phone: "06 00 00 00 00",
    isProfessional: false,
  },
  orderReference: "CMD-2026-0042",
  saleDate: "2026-08-10",
  lines: [
    {
      designation: "Chêne / Hêtre",
      precision: "33 cm · bois sec",
      quantiteM3: 5,
      stackingCoefficient: 0.7,
      unitPriceCents: 10_400,
      lineTotalCents: 52_000,
      vatRate: 10,
    },
  ],
  options: [],
  delivery: { label: "Livraison — Zone A", totalCents: 1_450 },
  discount: null,
  orderTotalCents: 53_450,
  paidCents: 0,
  totalVolumeM3: 5,
  vatBreakdown: [{ rate: 10, baseHtCents: 48_591, vatCents: 4_859, baseTtcCents: 53_450 }],
};

/** Caractères qui sortiraient en glyphe erroné avec les polices standard. */
function caracteresRisques(texte: string): string[] {
  return [...texte].filter((c) => {
    const code = c.codePointAt(0)!;
    if (code <= 0x7e && code >= 0x20) return false;
    if (code >= 0xa0 && code <= 0xff) return false;
    return !"€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ  ".includes(c);
  });
}

describe("facture rendue en PDF", () => {
  it("produit un PDF valide et non vide", async () => {
    const buffer = await renderToBuffer(
      FacturePdf({
        facture: construireFacture(entreeFacture),
        numero: "FAC-2026-0001",
        emiseLe: "2026-08-10",
      }),
    );
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.byteLength).toBeGreaterThan(2000);
  });

  it("porte le numéro, la commande et les montants", async () => {
    const buffer = await renderToBuffer(
      FacturePdf({
        facture: construireFacture(entreeFacture),
        numero: "FAC-2026-0001",
        emiseLe: "2026-08-10",
      }),
    );
    const texte = texteDuPdf(buffer);

    expect(texte).toContain("FAC-2026-0001");
    expect(texte).toContain("CMD-2026-0042");
    expect(texte).toContain("Facture");
    expect(texte).toContain("534,50"); // total TTC
    expect(texte).toContain("485,91"); // total HT
    expect(texte).toContain("48,59"); // TVA
    expect(texte).toContain("94,55"); // prix unitaire HT
  });

  it("porte les mentions d'identification légale du vendeur", async () => {
    const texte = texteDuPdf(
      await renderToBuffer(
        FacturePdf({
          facture: construireFacture(entreeFacture),
          numero: "FAC-2026-0001",
          emiseLe: "2026-08-10",
        }),
      ),
    );
    expect(texte).toContain("12345678900012"); // SIRET
    expect(texte).toContain("FR12345678900"); // TVA intracommunautaire
    expect(texte).toContain("0220Z"); // APE
  });

  it("porte l'article 293 B quand l'entreprise est en franchise en base", async () => {
    const texte = texteDuPdf(
      await renderToBuffer(
        FacturePdf({
          facture: construireFacture({
            ...entreeFacture,
            seller: { ...entreeFacture.seller, vatMode: "franchise_en_base" },
            vatBreakdown: [],
          }),
          numero: "FAC-2026-0002",
          emiseLe: "2026-08-10",
        }),
      ),
    );
    expect(texte).toContain("293 B");
  });

  it("annonce l'indemnité de 40 euros face à un professionnel, et pas à un particulier", async () => {
    const pro = texteDuPdf(
      await renderToBuffer(
        FacturePdf({
          facture: construireFacture({
            ...entreeFacture,
            buyer: {
              ...entreeFacture.buyer,
              isProfessional: true,
              companyName: "Menuiserie du Haut",
              siret: "98765432100019",
            },
          }),
          numero: "FAC-2026-0003",
          emiseLe: "2026-08-10",
        }),
      ),
    );
    expect(pro).toContain("40 euros");
    expect(pro).toContain("98765432100019");

    const particulier = texteDuPdf(
      await renderToBuffer(
        FacturePdf({
          facture: construireFacture(entreeFacture),
          numero: "FAC-2026-0004",
          emiseLe: "2026-08-10",
        }),
      ),
    );
    expect(particulier).not.toContain("40 euros");
  });

  it("affiche le reste à payer, et le masque une fois la commande réglée", async () => {
    const impaye = texteDuPdf(
      await renderToBuffer(
        FacturePdf({
          facture: construireFacture(entreeFacture),
          numero: "FAC-2026-0005",
          emiseLe: "2026-08-10",
        }),
      ),
    );
    expect(impaye).toContain("Reste à payer");

    const regle = texteDuPdf(
      await renderToBuffer(
        FacturePdf({
          facture: construireFacture({ ...entreeFacture, paidCents: 53_450 }),
          numero: "FAC-2026-0006",
          emiseLe: "2026-08-10",
        }),
      ),
    );
    // La ligne du tableau subsiste, mais l'encadré d'alerte disparaît.
    expect(regle).not.toContain("À régler à la livraison");
  });

  it("rend l'avoir avec des montants négatifs et la facture annulée", async () => {
    const texte = texteDuPdf(
      await renderToBuffer(
        FacturePdf({
          facture: construireAvoir(construireFacture(entreeFacture)),
          numero: "FAC-2026-0007",
          emiseLe: "2026-08-12",
          numeroFactureOrigine: "FAC-2026-0001",
        }),
      ),
    );
    expect(texte).toContain("Avoir");
    expect(texte).toContain("FAC-2026-0001");
    expect(texte).toContain("-534,50");
  });

  it("n'émet aucun caractère hors WinAnsi", async () => {
    const texte = texteDuPdf(
      await renderToBuffer(
        FacturePdf({
          facture: construireFacture(entreeFacture),
          numero: "FAC-2026-0008",
          emiseLe: "2026-08-10",
          piedPersonnalise: "Merci de votre confiance — paiement à réception.",
        }),
      ),
    );
    expect(caracteresRisques(texte), texte.slice(0, 200)).toEqual([]);
  });
});

describe("bon de livraison rendu en PDF", () => {
  const bon = {
    tenant,
    reference: "CMD-2026-0042",
    editeLe: "10 août 2026 à 08:30",
    client: {
      nom: "Jean Rivière",
      societe: null,
      adresse: "12 chemin des Fayards",
      complementAdresse: null,
      codePostalVille: "07100 Annonay",
      telephone: "06 00 00 00 00",
    },
    livraison: {
      date: "2026-08-12",
      creneau: "Matin (8h – 12h)",
      distanceKm: 18,
      contraintes: "Chemin étroit, ne pas monter jusqu'à la maison.",
      accesCamion: "Chemin étroit",
    },
    lignes: [
      {
        cle: "l1",
        designation: "Chêne / Hêtre",
        precision: "33 cm · bois sec",
        quantiteM3: 5,
        stackingCoefficient: 0.7,
      },
    ],
    volumeTotalM3: 5,
    paiement: { mode: "Espèces à la livraison", resteAEncaisserCents: 53_450 },
  };

  it("met en avant le montant à encaisser et les contraintes d'accès", async () => {
    const texte = texteDuPdf(await renderToBuffer(BonLivraisonPdf(bon)));

    expect(texte).toContain("Bon de livraison");
    expect(texte).toContain("CMD-2026-0042");
    expect(texte).toContain("534,50");
    expect(texte).toContain("encaisser");
    expect(texte).toContain("Chemin étroit");
    // Les titres de section sont capitalisés par `textTransform: uppercase`.
    expect(texte).toContain("SIGNATURE DU CLIENT");
    expect(texte).toContain("SIGNATURE DU LIVREUR");
  });

  it("dit clairement quand il n'y a rien à encaisser", async () => {
    const texte = texteDuPdf(
      await renderToBuffer(
        BonLivraisonPdf({
          ...bon,
          paiement: { mode: "Carte bancaire en ligne", resteAEncaisserCents: 0 },
        }),
      ),
    );
    expect(texte).toContain("rien à encaisser");
  });

  it("ne porte aucun prix de vente : ce n'est pas une facture", async () => {
    const texte = texteDuPdf(
      await renderToBuffer(
        BonLivraisonPdf({
          ...bon,
          paiement: { mode: "Carte bancaire en ligne", resteAEncaisserCents: 0 },
        }),
      ),
    );
    expect(texte).not.toContain("104,00");
    expect(texte).not.toContain("Total TTC");
    expect(texte).toContain("ne vaut pas facture");
  });

  it("n'émet aucun caractère hors WinAnsi", async () => {
    const texte = texteDuPdf(await renderToBuffer(BonLivraisonPdf(bon)));
    expect(caracteresRisques(texte), texte.slice(0, 200)).toEqual([]);
  });
});

/**
 * Non-régression du devis.
 *
 * Sa mise en page a été extraite dans `commun.tsx` pour être partagée avec la
 * facture et le bon de livraison. Le devis marchait ; il doit continuer.
 */
describe("devis rendu en PDF", () => {
  it("garde son en-tête, son destinataire, ses totaux et son encadré", async () => {
    const texte = texteDuPdf(
      await renderToBuffer(
        DocumentDevis({
          tenant,
          reference: "DEV-2026-0007",
          editeLe: "10 août 2026 à 09:15",
          titre: "Devis",
          sousTitre: "Bois de chauffage — quantités en mètres cubes apparents",
          client: {
            nom: "Jean Rivière",
            adresse: "12 chemin des Fayards",
            codePostalVille: "07100 Annonay",
            email: "jean@demo.test",
            telephone: "06 00 00 00 00",
          },
          lignes: [
            {
              cle: "l1",
              designation: "Chêne / Hêtre",
              precision: "33 cm · bois sec",
              volumeM3: 5,
              stackingCoefficient: 0.7,
              unitPriceCents: 10_400,
              lineTotalCents: 52_000,
            },
          ],
          livraison: {
            commune: "Annonay (07100)",
            distanceKm: 18,
            baseCents: 1_450,
            volumeCents: 0,
            fuelCents: 0,
            totalCents: 1_450,
            offerte: false,
            detaille: true,
          },
          totaux: {
            subtotalCents: 52_000,
            totalCents: 53_450,
            totalVolumeM3: 5,
            vatBreakdown: [{ rate: 10, baseHtCents: 48_591, vatCents: 4_859 }],
          },
          encadre: {
            titre: "Validité de cette proposition",
            texte: "Cette proposition est valable jusqu'au 30 septembre 2026 inclus.",
            complement: "Édité le 10 août 2026",
          },
        }),
      ),
    );

    expect(texte).toContain("DEV-2026-0007");
    expect(texte).toContain("Jean Rivière");
    expect(texte).toContain("Annonay");
    expect(texte).toContain("534,50");
    expect(texte).toContain("Validité de cette proposition");
    expect(texte).toContain("stère");
    expect(caracteresRisques(texte), texte.slice(0, 200)).toEqual([]);
  });
});
