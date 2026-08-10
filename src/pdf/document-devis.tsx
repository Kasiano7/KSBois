import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatEuros, formatVolume, formatStereHintPdf } from "@/domain/units";
import {
  EnTeteDocument,
  EncadreDestinataire,
  MENTION_STERE,
  PiedDocument,
  societeDepuisTenant,
  styles,
} from "./commun";
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
 * Les blocs partagés avec la facture et le bon de livraison vivent dans
 * `commun.tsx` — y compris la règle d'encodage WinAnsi.
 */

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
        <EnTeteDocument
          societe={societeDepuisTenant(tenant)}
          lignesDroite={[`Devis n° ${reference}`, `Édité le ${editeLe}`]}
        />

        <Text style={styles.titre}>{titre}</Text>
        <Text style={styles.sousTitre}>{sousTitre}</Text>

        {client && <EncadreDestinataire client={client} />}

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

        <View style={styles.encadre}>
          <Text style={styles.encadreTitre}>{encadre.titre}</Text>
          <Text style={styles.encadreTexte}>{encadre.texte}</Text>
          {encadre.complement && (
            <Text style={[styles.encadreTexte, { marginTop: 6, fontWeight: 700 }]}>
              {encadre.complement}
            </Text>
          )}
        </View>

        <PiedDocument texte={`${tenant.name} — ${MENTION_STERE}`} />
      </Page>
    </Document>
  );
}
