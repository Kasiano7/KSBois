import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import { RappelVeille } from "@/emails/rappel-veille";
import { LivraisonEffectuee } from "@/emails/livraison-effectuee";
import { RecapQuotidien } from "@/emails/recap-quotidien";
import { AlerteStock } from "@/emails/alerte-stock";

/**
 * Rendu réel des modèles d'email.
 *
 * Un email est aussi invisible qu'un PDF : personne ne le relit avant qu'il ne
 * parte chez un client. Ces tests le rendent pour de vrai et vérifient ce qui
 * compte — le montant à préparer, la facture jointe, l'absence de réclamation
 * sur une commande déjà payée.
 *
 * Ils attrapent aussi le cas le plus bête et le plus fréquent : un modèle qui
 * lève à la construction et dont on ne s'aperçoit qu'au premier envoi réel.
 */

/** Texte visible, balises retirées : on teste ce que le client lit. */
function texte(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const rappel = {
  entreprise: "Bois de chauffage",
  telephone: "04 75 00 00 00",
  reference: "CMD-2026-0042",
  prenom: "Jean",
  dateLisible: "mercredi 12 août",
  creneau: "Matin (8h – 12h)",
  volumeM3: 5,
  adresse: "12 chemin des Fayards",
  ville: "Annonay",
  modePaiement: "cash",
  resteAPayerCents: 53_450,
  contraintesAcces: "Chemin étroit, ne pas monter jusqu'à la maison.",
};

describe("rappel la veille", () => {
  it("dit quand, combien préparer, et rappelle la contrainte d'accès", async () => {
    const contenu = texte(await render(RappelVeille(rappel)));

    expect(contenu).toContain("Votre bois arrive demain");
    expect(contenu).toContain("mercredi 12 août");
    expect(contenu).toContain("534,50");
    expect(contenu).toContain("espèces");
    expect(contenu).toContain("Chemin étroit");
    expect(contenu).toContain("04 75 00 00 00");
  });

  it("ne réclame rien sur une commande déjà payée", async () => {
    const contenu = texte(
      await render(RappelVeille({ ...rappel, modePaiement: "card", resteAPayerCents: 0 })),
    );
    expect(contenu).toContain("Rien à régler");
    expect(contenu).not.toContain("534,50");
  });

  it("adapte la consigne au moyen de paiement", async () => {
    const cheque = texte(await render(RappelVeille({ ...rappel, modePaiement: "check" })));
    expect(cheque).toContain("chèque");

    const terminal = texte(await render(RappelVeille({ ...rappel, modePaiement: "sumup" })));
    expect(terminal).toContain("terminal");
  });
});

describe("livraison effectuée", () => {
  const base = {
    entreprise: "Bois de chauffage",
    telephone: "04 75 00 00 00",
    reference: "CMD-2026-0042",
    prenom: "Jean",
    volumeM3: 5,
    dateLisible: "le 12 août",
    numeroFacture: "FAC-2026-0001",
    modePaiement: "transfer",
    resteAPayerCents: 53_450,
    lienCompte: "https://exemple.fr/compte",
  };

  it("annonce la facture jointe et le solde à régler", async () => {
    const contenu = texte(await render(LivraisonEffectuee(base)));

    expect(contenu).toContain("Votre bois est livré");
    expect(contenu).toContain("FAC-2026-0001");
    expect(contenu).toContain("jointe");
    expect(contenu).toContain("534,50");
    expect(contenu).toContain("virement");
  });

  it("ne réclame aucun paiement quand tout est réglé", async () => {
    const contenu = texte(await render(LivraisonEffectuee({ ...base, resteAPayerCents: 0 })));
    expect(contenu).not.toContain("Reste à régler");
    expect(contenu).toContain("recommander");
  });

  it("reste honnête quand la facture n'a pas pu être émise", async () => {
    const contenu = texte(await render(LivraisonEffectuee({ ...base, numeroFacture: null })));
    expect(contenu).toContain("séparément");
    expect(contenu).not.toContain("FAC-");
  });
});

describe("récapitulatif quotidien", () => {
  const base = {
    entreprise: "Bois de chauffage",
    dateLisible: "lundi 10 août",
    lienTournee: "https://exemple.fr/admin/tournee",
    lienAdmin: "https://exemple.fr/admin",
    tournee: [
      {
        reference: "CMD-2026-0042",
        client: "Jean Rivière",
        ville: "Annonay",
        volumeM3: 5,
        creneau: "Matin",
        modePaiement: "espèces",
        resteAEncaisserCents: 53_450,
        contraintesAcces: "Chemin étroit",
      },
    ],
    totalVolumeM3: 5,
    totalAEncaisserCents: 53_450,
    totalEspecesCents: 53_450,
    aTraiter: ["2 demandes de devis en attente de réponse"],
    stockBas: ["BUCHE-33"],
  };

  it("donne la charge du jour, l'encaissement et les contraintes d'accès", async () => {
    const contenu = texte(await render(RecapQuotidien(base)));

    expect(contenu).toContain("1 livraison");
    expect(contenu).toContain("Jean Rivière");
    expect(contenu).toContain("534,50");
    expect(contenu).toContain("espèces");
    expect(contenu).toContain("Chemin étroit");
    expect(contenu).toContain("devis en attente");
    expect(contenu).toContain("BUCHE-33");
  });

  it("le dit franchement quand il n'y a rien à faire", async () => {
    const contenu = texte(
      await render(
        RecapQuotidien({
          ...base,
          tournee: [],
          totalVolumeM3: 0,
          totalAEncaisserCents: 0,
          totalEspecesCents: 0,
          aTraiter: [],
          stockBas: [],
        }),
      ),
    );
    expect(contenu).toContain("Rien de prévu");
    expect(contenu).toContain("Aucune livraison prévue");
  });
});

describe("alerte de stock", () => {
  it("annonce une date de rupture, pas seulement un seuil franchi", async () => {
    const contenu = texte(
      await render(
        AlerteStock({
          entreprise: "Bois de chauffage",
          lienStock: "https://exemple.fr/admin/stock",
          lignes: [
            {
              libelle: "Chêne / Hêtre · 33 cm",
              sku: "BUCHE-33",
              disponibleM3: 8,
              seuilM3: 10,
              joursRestants: 9,
              rupturePrevueLisible: "19 août",
            },
          ],
        }),
      ),
    );

    expect(contenu).toContain("Il faut produire");
    expect(contenu).toContain("Chêne / Hêtre");
    expect(contenu).toContain("9 jours");
    expect(contenu).toContain("19 août");
  });

  it("ne promet pas de date quand les ventes sont trop rares", async () => {
    const contenu = texte(
      await render(
        AlerteStock({
          entreprise: "Bois de chauffage",
          lienStock: "https://exemple.fr/admin/stock",
          lignes: [
            {
              libelle: "Bois tendre · 50 cm",
              sku: "TENDRE-50",
              disponibleM3: 2,
              seuilM3: 5,
              joursRestants: null,
              rupturePrevueLisible: null,
            },
          ],
        }),
      ),
    );
    expect(contenu).toContain("Stock à surveiller");
    expect(contenu).toContain("Pas assez de ventes récentes");
  });
});
