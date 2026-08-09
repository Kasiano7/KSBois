import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatEuros, formatVolume, formatStereHintPdf } from "@/domain/units";
import type { Tenant } from "@/lib/tenant";

/**
 * Document de devis — mise en page commune aux deux devis du projet.
 *
 * Deux entrées, un seul document :
 *  • `src/pdf/devis.tsx` — l'estimation libre-service imprimée depuis le panier,
 *    anonyme et instantanée (docs/02 §7.1) ;
 *  • `src/pdf/devis-commercial.tsx` — la proposition chiffrée que l'exploitant
 *    envoie en réponse à une demande (docs/02 §7.2).
 *
 * Ils diffèrent par l'en-tête, le destinataire et l'encadré de bas de page, pas
 * par la présentation des lignes ni des totaux : un client qui reçoit les deux
 * doit reconnaître le même document.
 *
 * ⚠️ ENCODAGE : tant que les polices standard sont utilisées, tout caractère
 * hors WinAnsi est remplacé SILENCIEUSEMENT par un autre glyphe — « ≈ » sortait
 * en « H ». Aucun caractère exotique dans ce fichier (voir
 * `tests/unit/pdf-encodage.test.ts`).
 */

const couleurs = {
  encre: "#14100D",
  cendre: "#6E6459",
  bord: "#DFD9CD",
  braise: "#A83F12",
  sapin: "#22392C",
  fondAlerte: "#FBF3EE",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 10,
    color: couleurs.encre,
  },
  enTete: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  nomEntreprise: { fontSize: 17, fontWeight: 700, color: couleurs.sapin },
  petit: { fontSize: 8.5, color: couleurs.cendre, lineHeight: 1.5 },
  titre: { fontSize: 22, fontWeight: 700, marginTop: 26 },
  sousTitre: { fontSize: 9.5, color: couleurs.cendre, marginTop: 4 },
  section: { marginTop: 22 },
  sectionTitre: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.1,
    color: couleurs.cendre,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  encadreClient: {
    borderWidth: 0.5,
    borderColor: couleurs.bord,
    padding: 12,
    marginTop: 18,
    maxWidth: 260,
    marginLeft: "auto",
  },
  ligneEnTete: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: couleurs.encre,
    paddingBottom: 5,
  },
  ligne: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: couleurs.bord,
    paddingVertical: 7,
  },
  colDesignation: { flex: 1 },
  colQte: { width: 88, textAlign: "right" },
  colPu: { width: 76, textAlign: "right" },
  colTotal: { width: 76, textAlign: "right" },
  gras: { fontWeight: 700 },
  totaux: { marginTop: 14, marginLeft: "auto", width: 250 },
  ligneTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  ligneTotalFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: couleurs.encre,
    marginTop: 6,
    paddingTop: 7,
  },
  montantFinal: { fontSize: 15, fontWeight: 700, color: couleurs.braise },
  avertissement: {
    marginTop: 26,
    borderWidth: 1,
    borderColor: couleurs.braise,
    backgroundColor: couleurs.fondAlerte,
    padding: 12,
  },
  avertissementTitre: { fontSize: 10, fontWeight: 700, color: couleurs.braise, marginBottom: 5 },
  avertissementTexte: { fontSize: 8.5, lineHeight: 1.55, color: couleurs.encre },
  message: { marginTop: 20, fontSize: 9.5, lineHeight: 1.6 },
  pied: {
    position: "absolute",
    bottom: 28,
    left: 44,
    right: 44,
    fontSize: 7.5,
    color: couleurs.cendre,
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: couleurs.bord,
    paddingTop: 8,
  },
});

export interface LigneDocument {
  cle: string;
  designation: string;
  /** « 33 cm · bois sec » — précisions sous la désignation. */
  precision: string | null;
  volumeM3: number;
  /** Nécessaire à l'équivalence en stères : elle dépend de la longueur de coupe. */
  stackingCoefficient: number | null;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface LivraisonDocument {
  /** « Annonay (07100) » */
  commune: string | null;
  distanceKm: number | null;
  baseCents: number;
  volumeCents: number;
  fuelCents: number;
  totalCents: number;
  offerte: boolean;
  /** Détaille forfait / volume / carburant, ou n'affiche qu'un montant global. */
  detaille: boolean;
}

export interface VentilationTva {
  rate: number;
  baseHtCents: number;
  vatCents: number;
}

export interface DocumentDevisProps {
  tenant: Tenant;
  reference: string;
  editeLe: string;
  titre: string;
  sousTitre: string;
  client?: {
    nom: string;
    societe?: string | null;
    adresse?: string | null;
    codePostalVille?: string | null;
    email?: string | null;
    telephone?: string | null;
  } | null;
  lignes: LigneDocument[];
  livraison: LivraisonDocument | null;
  remise?: { label: string; montantCents: number } | null;
  totaux: {
    subtotalCents: number;
    totalCents: number;
    totalVolumeM3: number;
    vatBreakdown: VentilationTva[];
  };
  /** Message libre de l'exploitant, au-dessus de l'encadré. */
  message?: string | null;
  /** Encadré de bas de page : indicativité, ou durée de validité. */
  encadre: { titre: string; texte: string; complement?: string | null };
}

export function DocumentDevis({
  tenant,
  reference,
  editeLe,
  titre,
  sousTitre,
  client,
  lignes,
  livraison,
  remise,
  totaux,
  message,
  encadre,
}: DocumentDevisProps) {
  return (
    <Document
      title={`${titre} ${reference} — ${tenant.name}`}
      author={tenant.name}
      creator={tenant.name}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.enTete}>
          <View>
            <Text style={styles.nomEntreprise}>{tenant.name}</Text>
            <Text style={styles.petit}>
              {[tenant.postalCode, tenant.city].filter(Boolean).join(" ")}
              {"\n"}
              {tenant.phoneDisplay ?? tenant.phone ?? ""}
              {tenant.phoneDisplay || tenant.phone ? "\n" : ""}
              {tenant.email}
            </Text>
          </View>
          <View>
            <Text style={[styles.petit, { textAlign: "right" }]}>
              Devis n° {reference}
              {"\n"}
              Édité le {editeLe}
            </Text>
          </View>
        </View>

        <Text style={styles.titre}>{titre}</Text>
        <Text style={styles.sousTitre}>{sousTitre}</Text>

        {client && (
          <View style={styles.encadreClient}>
            <Text style={styles.sectionTitre}>Destinataire</Text>
            <Text style={styles.gras}>{client.societe || client.nom}</Text>
            {client.societe && <Text>{client.nom}</Text>}
            {client.adresse && <Text>{client.adresse}</Text>}
            {client.codePostalVille && <Text>{client.codePostalVille}</Text>}
            {(client.telephone || client.email) && (
              <Text style={[styles.petit, { marginTop: 4 }]}>
                {[client.telephone, client.email].filter(Boolean).join("\n")}
              </Text>
            )}
          </View>
        )}

        {livraison?.commune && (
          <View style={styles.section}>
            <Text style={styles.sectionTitre}>Livraison</Text>
            <Text>
              {livraison.commune}
              {livraison.distanceKm !== null
                ? ` — environ ${livraison.distanceKm} km du dépôt`
                : ""}
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Détail</Text>

          <View style={styles.ligneEnTete}>
            <Text style={[styles.colDesignation, styles.gras]}>Désignation</Text>
            <Text style={[styles.colQte, styles.gras]}>Quantité</Text>
            <Text style={[styles.colPu, styles.gras]}>P.U. TTC</Text>
            <Text style={[styles.colTotal, styles.gras]}>Total TTC</Text>
          </View>

          {lignes.map((ligne) => (
            <View key={ligne.cle} style={styles.ligne} wrap={false}>
              <View style={styles.colDesignation}>
                <Text style={styles.gras}>{ligne.designation}</Text>
                {ligne.precision && <Text style={styles.petit}>{ligne.precision}</Text>}
              </View>
              <View style={styles.colQte}>
                <Text>{formatVolume(ligne.volumeM3)}</Text>
                {ligne.stackingCoefficient !== null && (
                  <Text style={styles.petit}>
                    {formatStereHintPdf(ligne.volumeM3, ligne.stackingCoefficient)}
                  </Text>
                )}
              </View>
              <Text style={styles.colPu}>{formatEuros(ligne.unitPriceCents)}</Text>
              <Text style={[styles.colTotal, styles.gras]}>
                {formatEuros(ligne.lineTotalCents)}
              </Text>
            </View>
          ))}

          <View style={styles.totaux}>
            <View style={styles.ligneTotal}>
              <Text>Bois</Text>
              <Text>{formatEuros(totaux.subtotalCents)}</Text>
            </View>

            {remise && remise.montantCents > 0 && (
              <View style={styles.ligneTotal}>
                <Text>{remise.label}</Text>
                <Text>-{formatEuros(remise.montantCents)}</Text>
              </View>
            )}

            {livraison && !livraison.offerte && livraison.detaille && (
              <>
                <View style={styles.ligneTotal}>
                  <Text>Livraison — forfait</Text>
                  <Text>{formatEuros(livraison.baseCents)}</Text>
                </View>
                {livraison.volumeCents > 0 && (
                  <View style={styles.ligneTotal}>
                    <Text>Livraison — part volume</Text>
                    <Text>{formatEuros(livraison.volumeCents)}</Text>
                  </View>
                )}
                {livraison.fuelCents > 0 && (
                  <View style={styles.ligneTotal}>
                    <Text>Livraison — carburant</Text>
                    <Text>{formatEuros(livraison.fuelCents)}</Text>
                  </View>
                )}
              </>
            )}

            {livraison && !livraison.offerte && !livraison.detaille && (
              <View style={styles.ligneTotal}>
                <Text>Livraison</Text>
                <Text>{formatEuros(livraison.totalCents)}</Text>
              </View>
            )}

            {livraison?.offerte && (
              <View style={styles.ligneTotal}>
                <Text>Livraison offerte</Text>
                <Text>
                  -{formatEuros(livraison.baseCents + livraison.volumeCents + livraison.fuelCents)}
                </Text>
              </View>
            )}

            {totaux.vatBreakdown.map((b) => (
              <View key={b.rate} style={styles.ligneTotal}>
                <Text style={styles.petit}>
                  dont TVA {b.rate.toLocaleString("fr-FR")} % (base {formatEuros(b.baseHtCents)})
                </Text>
                <Text style={styles.petit}>{formatEuros(b.vatCents)}</Text>
              </View>
            ))}

            {tenant.vatMode === "franchise_en_base" && (
              <Text style={[styles.petit, { marginTop: 4 }]}>
                TVA non applicable, article 293 B du CGI
              </Text>
            )}

            <View style={styles.ligneTotalFinal}>
              <Text style={styles.gras}>Total TTC</Text>
              <Text style={styles.montantFinal}>{formatEuros(totaux.totalCents)}</Text>
            </View>

            <View style={styles.ligneTotal}>
              <Text style={styles.petit}>Volume total</Text>
              <Text style={styles.petit}>{formatVolume(totaux.totalVolumeM3)}</Text>
            </View>
          </View>
        </View>

        {message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.avertissement}>
          <Text style={styles.avertissementTitre}>{encadre.titre}</Text>
          <Text style={styles.avertissementTexte}>{encadre.texte}</Text>
          {encadre.complement && (
            <Text style={[styles.avertissementTexte, { marginTop: 6, fontWeight: 700 }]}>
              {encadre.complement}
            </Text>
          )}
        </View>

        <Text style={styles.pied} fixed>
          {tenant.name}
          {" — "}
          Le stère n&apos;est plus une unité légale de mesure depuis 1977 : les quantités sont
          exprimées en mètres cubes apparents. La mention « stère » est donnée à titre indicatif.
        </Text>
      </Page>
    </Document>
  );
}
