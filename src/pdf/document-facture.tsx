import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatEuros, formatVolume, formatStereHintPdf } from "@/domain/units";
import { echeancePaiement, mentionsLegales, type DocumentFacture } from "@/domain/invoices";
import {
  EnTeteDocument,
  EncadreDestinataire,
  MENTION_STERE,
  PiedDocument,
  couleurs,
  styles,
} from "./commun";

/**
 * Facture et avoir — docs/02 §5 et §6.
 *
 * Le document est intégralement rendu depuis l'INSTANTANÉ stocké en base
 * (`invoices.lines`, `.totals`, `.seller`, `.buyer`). Il ne lit ni la commande,
 * ni le catalogue, ni les réglages du moment : une facture rééditée deux ans
 * plus tard doit sortir identique, même si les prix, la raison sociale ou le
 * taux de TVA ont changé entre-temps.
 *
 * Un avoir emprunte exactement la même mise en page, avec des montants
 * négatifs : c'est ce qui permet au client de reconnaître la facture annulée.
 */

/** Taux légal supplétif : taux BCE + 10 points, arrondi. Éditable en réglages. */
const TAUX_PENALITES_DEFAUT = 12;

const formatDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function jour(iso: string): string {
  const date = new Date(`${iso}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? iso : formatDate.format(date);
}

export interface DocumentFactureProps {
  facture: DocumentFacture;
  numero: string;
  emiseLe: string;
  /** Numéro de la facture annulée — sur un avoir uniquement. */
  numeroFactureOrigine?: string | null;
  /** Pied de facture libre, saisi dans les réglages (`invoice.footer`). */
  piedPersonnalise?: string | null;
  tauxPenalitesAnnuel?: number;
}

export function FacturePdf({
  facture,
  numero,
  emiseLe,
  numeroFactureOrigine,
  piedPersonnalise,
  tauxPenalitesAnnuel = TAUX_PENALITES_DEFAUT,
}: DocumentFactureProps) {
  const { seller, buyer, totals } = facture;
  const typeDocument = facture.isCreditNote ? "Avoir" : "Facture";
  const echeance = echeancePaiement(facture.saleDate, buyer.isProfessional);

  const mentions = mentionsLegales({
    vatMode: seller.vatMode,
    isProfessional: buyer.isProfessional,
    tauxPenalitesAnnuel,
  });

  // Identification légale du vendeur : ces lignes sont obligatoires et ne
  // doivent jamais disparaître silencieusement si un champ est vide en base.
  const identiteVendeur = [
    seller.siret ? `SIRET ${seller.siret}` : null,
    seller.rcs ? `RCS ${seller.rcs}` : null,
    seller.apeCode ? `APE ${seller.apeCode}` : null,
    seller.vatMode === "assujetti" && seller.vatNumber ? `TVA ${seller.vatNumber}` : null,
  ].filter(Boolean) as string[];

  const soldeARegler = !facture.isCreditNote && totals.remainingCents > 0;

  return (
    <Document
      title={`${typeDocument} ${numero} — ${seller.name}`}
      author={seller.name}
      creator={seller.name}
      subject={`${typeDocument} relative à la commande ${facture.orderReference}`}
    >
      <Page size="A4" style={styles.page}>
        <EnTeteDocument
          societe={{
            name: seller.name,
            legalName: seller.legalName,
            addressLine1: seller.addressLine1,
            postalCode: seller.postalCode,
            city: seller.city,
            phone: seller.phone,
            email: seller.email,
          }}
          lignesDroite={[
            `${typeDocument} n° ${numero}`,
            `Émise le ${jour(emiseLe)}`,
            `Commande ${facture.orderReference}`,
            `Vente du ${jour(facture.saleDate)}`,
            ...(numeroFactureOrigine ? [`Annule la facture ${numeroFactureOrigine}`] : []),
          ]}
        />

        {identiteVendeur.length > 0 && (
          <Text style={[styles.petit, { marginTop: 6 }]}>{identiteVendeur.join(" · ")}</Text>
        )}

        <Text style={styles.titre}>{typeDocument}</Text>
        <Text style={styles.sousTitre}>
          Bois de chauffage — quantités exprimées en mètres cubes apparents (m³ apparents)
        </Text>

        <EncadreDestinataire
          titre={facture.isCreditNote ? "Bénéficiaire de l'avoir" : "Facturé à"}
          client={{
            nom: buyer.name,
            societe: buyer.companyName,
            adresse: buyer.addressLine1,
            complementAdresse: buyer.addressLine2,
            codePostalVille: [buyer.postalCode, buyer.city].filter(Boolean).join(" ") || null,
            email: buyer.email,
            telephone: buyer.phone,
            siret: buyer.isProfessional ? buyer.siret : null,
          }}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Détail</Text>

          <View style={styles.ligneEnTete}>
            <Text style={[styles.colDesignation, styles.gras]}>Désignation</Text>
            <Text style={[styles.colQte, styles.gras]}>Quantité</Text>
            <Text style={[styles.colPu, styles.gras]}>P.U. HT</Text>
            <Text style={[{ width: 42, textAlign: "right" }, styles.gras]}>TVA</Text>
            <Text style={[styles.colTotal, styles.gras]}>Total TTC</Text>
          </View>

          {facture.lines.map((ligne, index) => (
            <View key={`${ligne.designation}-${index}`} style={styles.ligne} wrap={false}>
              <View style={styles.colDesignation}>
                <Text style={styles.gras}>{ligne.designation}</Text>
                {ligne.precision && <Text style={styles.petit}>{ligne.precision}</Text>}
              </View>
              <View style={styles.colQte}>
                <Text>{formatVolume(ligne.quantiteM3)}</Text>
                {ligne.stackingCoefficient !== null && (
                  <Text style={styles.petit}>
                    {formatStereHintPdf(Math.abs(ligne.quantiteM3), ligne.stackingCoefficient)}
                  </Text>
                )}
              </View>
              <Text style={styles.colPu}>{formatEuros(ligne.unitPriceHtCents)}</Text>
              <Text style={{ width: 42, textAlign: "right" }}>
                {ligne.vatRate.toLocaleString("fr-FR")} %
              </Text>
              <Text style={[styles.colTotal, styles.gras]}>
                {formatEuros(ligne.lineTotalCents)}
              </Text>
            </View>
          ))}

          {facture.options.map((option, index) => (
            <View key={`option-${index}`} style={styles.ligne} wrap={false}>
              <View style={styles.colDesignation}>
                <Text style={styles.gras}>{option.name}</Text>
                <Text style={styles.petit}>Prestation</Text>
              </View>
              <Text style={styles.colQte}>—</Text>
              <Text style={styles.colPu}>
                {formatEuros(Math.round(option.priceCents / (1 + option.vatRate / 100)))}
              </Text>
              <Text style={{ width: 42, textAlign: "right" }}>
                {option.vatRate.toLocaleString("fr-FR")} %
              </Text>
              <Text style={[styles.colTotal, styles.gras]}>{formatEuros(option.priceCents)}</Text>
            </View>
          ))}

          <View style={styles.totaux}>
            <View style={styles.ligneTotal}>
              <Text>Bois</Text>
              <Text>{formatEuros(totals.subtotalCents)}</Text>
            </View>

            {facture.discount && totals.discountCents !== 0 && (
              <View style={styles.ligneTotal}>
                <Text>{facture.discount.label}</Text>
                <Text>-{formatEuros(Math.abs(totals.discountCents))}</Text>
              </View>
            )}

            {facture.delivery && (
              <View style={styles.ligneTotal}>
                <Text>{facture.delivery.label}</Text>
                <Text>{formatEuros(totals.deliveryCents)}</Text>
              </View>
            )}

            <View style={[styles.ligneTotal, { marginTop: 4 }]}>
              <Text>Total HT</Text>
              <Text>{formatEuros(totals.totalHtCents)}</Text>
            </View>

            {facture.vatBreakdown.map((ventilation) => (
              <View key={ventilation.rate} style={styles.ligneTotal}>
                <Text style={styles.petit}>
                  TVA {ventilation.rate.toLocaleString("fr-FR")} % (base{" "}
                  {formatEuros(ventilation.baseHtCents)})
                </Text>
                <Text style={styles.petit}>{formatEuros(ventilation.vatCents)}</Text>
              </View>
            ))}

            <View style={styles.ligneTotalFinal}>
              <Text style={styles.gras}>Total TTC</Text>
              <Text style={styles.montantFinal}>{formatEuros(totals.totalTtcCents)}</Text>
            </View>

            {!facture.isCreditNote && (
              <>
                <View style={styles.ligneTotal}>
                  <Text style={styles.petit}>Déjà réglé</Text>
                  <Text style={styles.petit}>{formatEuros(totals.paidCents)}</Text>
                </View>
                <View style={styles.ligneTotal}>
                  <Text style={styles.gras}>Reste à payer</Text>
                  <Text style={styles.gras}>{formatEuros(totals.remainingCents)}</Text>
                </View>
              </>
            )}

            <View style={styles.ligneTotal}>
              <Text style={styles.petit}>Volume total</Text>
              <Text style={styles.petit}>{formatVolume(Math.abs(totals.totalVolumeM3))}</Text>
            </View>
          </View>
        </View>

        {/* Le solde dû est encadré : c'est l'information que le client cherche,
            et celle qui évite au livreur d'arriver sur un malentendu (docs/02 §6). */}
        {soldeARegler && (
          <View style={styles.encadre}>
            <Text style={styles.encadreTitre}>
              Reste à payer : {formatEuros(totals.remainingCents)}
            </Text>
            <Text style={styles.encadreTexte}>
              {buyer.isProfessional
                ? `À régler au plus tard le ${jour(echeance)}.`
                : "À régler à la livraison, sauf accord contraire."}
            </Text>
          </View>
        )}

        {facture.isCreditNote && (
          <View style={styles.encadre}>
            <Text style={styles.encadreTitre}>Avoir</Text>
            <Text style={styles.encadreTexte}>
              Ce document annule tout ou partie de la facture{" "}
              {numeroFactureOrigine ?? "d'origine"}. Les montants ci-dessus sont portés à votre
              crédit.
            </Text>
          </View>
        )}

        <View style={{ marginTop: 18 }}>
          {mentions.map((mention, index) => (
            <Text key={index} style={[styles.petit, { marginTop: 2 }]}>
              {mention}
            </Text>
          ))}
          {piedPersonnalise && (
            <Text style={[styles.petit, { marginTop: 8, color: couleurs.encre }]}>
              {piedPersonnalise}
            </Text>
          )}
        </View>

        <PiedDocument texte={`${seller.legalName ?? seller.name} — ${MENTION_STERE}`} />
      </Page>
    </Document>
  );
}
