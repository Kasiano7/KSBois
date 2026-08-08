import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatEuros, formatVolume, formatStereHintPdf } from "@/domain/units";
import type { PanierResume } from "@/server/panier";
import type { Tenant } from "@/lib/tenant";

/**
 * Devis imprimable depuis le panier — docs/02-MOTEURS-METIER.md §7.1
 *
 * Fonctionnalité de conversion : le client télécharge un PDF immédiatement,
 * sans compte, sans email, sans validation. Dans ce métier, beaucoup de clients
 * comparent trois fournisseurs et présentent un papier au conjoint avant de
 * décider. Aucun concurrent local ne le propose.
 *
 * ⚠️ La mention d'indicativité est OBLIGATOIRE et non discrète : les prix
 * dépendent du cours du bois et du carburant et peuvent bouger dans la minute.
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
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontSize: 10, color: couleurs.encre },
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

const MENTION_DEFAUT =
  "Ce document est une estimation indicative. Il ne constitue pas une offre commerciale ferme. " +
  "Les prix affichés dépendent notamment du cours du bois et du carburant et peuvent évoluer à tout " +
  "moment, y compris dans les minutes qui suivent l'édition de ce document. Seule une commande " +
  "confirmée fixe le prix définitif.";

interface DevisPdfProps {
  tenant: Tenant;
  panier: PanierResume;
  editeLe: string;
  mention?: string;
  reference: string;
}

export function DevisPdf({ tenant, panier, editeLe, mention, reference }: DevisPdfProps) {
  const devis = panier.livraison.devis;
  const livraisonChiffree = devis?.status === "ok";
  const commune =
    panier.livraison.resolution?.status === "ok" ? panier.livraison.resolution.commune : null;

  return (
    <Document
      title={`Devis ${reference} — ${tenant.name}`}
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

        <Text style={styles.titre}>Estimation de commande</Text>
        <Text style={styles.sousTitre}>
          Bois de chauffage — quantités exprimées en mètres cubes apparents (m³ apparents)
        </Text>

        {commune && (
          <View style={styles.section}>
            <Text style={styles.sectionTitre}>Livraison</Text>
            <Text>
              {commune.city} ({commune.postalCode})
              {commune.distanceKm !== null ? ` — environ ${commune.distanceKm} km du dépôt` : ""}
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

          {panier.lignes.map((ligne) => (
            <View key={ligne.itemId} style={styles.ligne} wrap={false}>
              <View style={styles.colDesignation}>
                <Text style={styles.gras}>{ligne.productName}</Text>
                <Text style={styles.petit}>
                  {[
                    ligne.variantLabel,
                    ligne.humidityClass === "H1"
                      ? "bois sec"
                      : ligne.humidityClass === "H2"
                        ? "mi-sec"
                        : ligne.humidityClass === "H3"
                          ? "fraîchement coupé"
                          : null,
                    ligne.packaging !== "vrac" ? ligne.packaging : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <View style={styles.colQte}>
                <Text>{formatVolume(ligne.lineVolumeM3)}</Text>
                <Text style={styles.petit}>{formatStereHintPdf(ligne.lineVolumeM3)}</Text>
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
              <Text>{formatEuros(panier.totaux.subtotalCents)}</Text>
            </View>

            {livraisonChiffree && (
              <>
                <View style={styles.ligneTotal}>
                  <Text>Livraison — forfait</Text>
                  <Text>{formatEuros(devis.baseCents)}</Text>
                </View>
                {devis.volumeCents > 0 && (
                  <View style={styles.ligneTotal}>
                    <Text>Livraison — part volume</Text>
                    <Text>{formatEuros(devis.volumeCents)}</Text>
                  </View>
                )}
                {devis.fuelCents > 0 && (
                  <View style={styles.ligneTotal}>
                    <Text>Livraison — carburant</Text>
                    <Text>{formatEuros(devis.fuelCents)}</Text>
                  </View>
                )}
                {devis.isFree && (
                  <View style={styles.ligneTotal}>
                    <Text>Livraison offerte</Text>
                    <Text>
                      −{formatEuros(devis.baseCents + devis.volumeCents + devis.fuelCents)}
                    </Text>
                  </View>
                )}
              </>
            )}

            {panier.totaux.vatBreakdown.map((b) => (
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
              <Text style={styles.gras}>Total TTC estimé</Text>
              <Text style={styles.montantFinal}>{formatEuros(panier.totaux.totalCents)}</Text>
            </View>

            <View style={styles.ligneTotal}>
              <Text style={styles.petit}>Volume total</Text>
              <Text style={styles.petit}>{formatVolume(panier.totaux.totalVolumeM3)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.avertissement}>
          <Text style={styles.avertissementTitre}>
            Ce document est une estimation indicative
          </Text>
          <Text style={styles.avertissementTexte}>{mention ?? MENTION_DEFAUT}</Text>
          <Text style={[styles.avertissementTexte, { marginTop: 6, fontWeight: 700 }]}>
            Édité le {editeLe}
            {panier.livraison.prixCarburantCents > 0
              ? ` · Prix du gazole retenu : ${(panier.livraison.prixCarburantCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €/L`
              : ""}
          </Text>
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
