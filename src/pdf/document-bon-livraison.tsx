import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatEuros, formatVolume, formatStereHintPdf } from "@/domain/units";
import {
  EnTeteDocument,
  EncadreDestinataire,
  MENTION_STERE,
  PiedDocument,
  couleurs,
  societeDepuisTenant,
  styles,
} from "./commun";
import type { Tenant } from "@/lib/tenant";

/**
 * Bon de livraison — le document de terrain.
 *
 * Trois partis pris, tous dictés par l'usage réel :
 *
 * 1. **Aucun prix de vente, sauf le reste à encaisser.** Le bon accompagne le
 *    bois ; il sert à constater ce qui a été livré, pas à refacturer. Mais le
 *    livreur doit savoir, en gros caractères, ce qu'il rapporte le soir
 *    (docs/02 §6) : c'est ce qui évite le client qui croyait avoir tout payé.
 *
 * 2. **Une colonne « quantité livrée » vide, à remplir à la main.** Un chargement
 *    ne tombe jamais exactement juste. Pré-remplir la case, c'est obtenir une
 *    signature sur un chiffre que personne n'a vérifié.
 *
 * 3. **Pas de numérotation propre.** Le bon porte la référence de la COMMANDE.
 *    Une séquence dédiée obligerait à persister chaque bon pour éviter les
 *    trous, et une réimpression — le cas le plus fréquent, quand l'exemplaire
 *    reste dans le camion — produirait un second numéro pour la même livraison.
 *    Ici, réimprimer redonne exactement le même document.
 */

const formatDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function jour(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? iso : formatDate.format(date);
}

export interface LigneBonLivraison {
  cle: string;
  designation: string;
  precision: string | null;
  quantiteM3: number;
  stackingCoefficient: number | null;
}

export interface BonLivraisonProps {
  tenant: Tenant;
  reference: string;
  editeLe: string;
  client: {
    nom: string;
    societe?: string | null;
    adresse?: string | null;
    complementAdresse?: string | null;
    codePostalVille?: string | null;
    telephone?: string | null;
  };
  livraison: {
    date: string | null;
    creneau: string | null;
    distanceKm: number | null;
    /** Contraintes d'accès saisies par le client — la ligne la plus utile du bon. */
    contraintes: string | null;
    accesCamion: string | null;
  };
  lignes: LigneBonLivraison[];
  volumeTotalM3: number;
  paiement: {
    /** Libellé du moyen retenu : « Espèces à la livraison ». */
    mode: string;
    resteAEncaisserCents: number;
  };
}

export function BonLivraisonPdf({
  tenant,
  reference,
  editeLe,
  client,
  livraison,
  lignes,
  volumeTotalM3,
  paiement,
}: BonLivraisonProps) {
  const dateLivraison = jour(livraison.date);
  const aEncaisser = paiement.resteAEncaisserCents > 0;

  return (
    <Document
      title={`Bon de livraison ${reference} — ${tenant.name}`}
      author={tenant.name}
      creator={tenant.name}
    >
      <Page size="A4" style={styles.page}>
        <EnTeteDocument
          societe={societeDepuisTenant(tenant)}
          lignesDroite={[
            `Bon de livraison`,
            `Commande ${reference}`,
            `Édité le ${editeLe}`,
          ]}
        />

        <Text style={styles.titre}>Bon de livraison</Text>
        <Text style={styles.sousTitre}>
          {dateLivraison
            ? `Livraison prévue le ${dateLivraison}${livraison.creneau ? ` — ${livraison.creneau}` : ""}`
            : "Date de livraison à confirmer"}
        </Text>

        <EncadreDestinataire titre="Livré à" client={client} />

        {(livraison.contraintes || livraison.accesCamion || livraison.distanceKm !== null) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitre}>Accès</Text>
            {livraison.accesCamion && <Text>{livraison.accesCamion}</Text>}
            {livraison.contraintes && (
              <Text style={{ color: couleurs.braise }}>{livraison.contraintes}</Text>
            )}
            {livraison.distanceKm !== null && (
              <Text style={styles.petit}>Environ {livraison.distanceKm} km du dépôt</Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Marchandise</Text>

          <View style={styles.ligneEnTete}>
            <Text style={[styles.colDesignation, styles.gras]}>Désignation</Text>
            <Text style={[{ width: 110, textAlign: "right" }, styles.gras]}>Quantité prévue</Text>
            <Text style={[{ width: 110, textAlign: "right" }, styles.gras]}>Quantité livrée</Text>
          </View>

          {lignes.map((ligne) => (
            <View key={ligne.cle} style={styles.ligne} wrap={false}>
              <View style={styles.colDesignation}>
                <Text style={styles.gras}>{ligne.designation}</Text>
                {ligne.precision && <Text style={styles.petit}>{ligne.precision}</Text>}
              </View>
              <View style={{ width: 110 }}>
                <Text style={{ textAlign: "right" }}>{formatVolume(ligne.quantiteM3)}</Text>
                {ligne.stackingCoefficient !== null && (
                  <Text style={[styles.petit, { textAlign: "right" }]}>
                    {formatStereHintPdf(ligne.quantiteM3, ligne.stackingCoefficient)}
                  </Text>
                )}
              </View>
              {/* Case laissée vide : elle se remplit au stylo, sur le camion. */}
              <View style={{ width: 110, alignItems: "flex-end" }}>
                <View
                  style={{
                    width: 92,
                    height: 20,
                    borderWidth: 0.5,
                    borderColor: couleurs.bord,
                    backgroundColor: couleurs.fondDoux,
                  }}
                />
              </View>
            </View>
          ))}

          <View style={{ flexDirection: "row", marginTop: 10 }}>
            <Text style={[styles.colDesignation, styles.gras]}>Volume total prévu</Text>
            <Text style={[{ width: 110, textAlign: "right" }, styles.gras]}>
              {formatVolume(volumeTotalM3)}
            </Text>
            <View style={{ width: 110 }} />
          </View>
        </View>

        {/* Ce que le livreur rapporte le soir. En gros, et jamais masqué. */}
        <View
          style={[
            styles.encadre,
            aEncaisser ? {} : { borderColor: couleurs.sapin, backgroundColor: couleurs.fondDoux },
          ]}
        >
          <Text style={[styles.encadreTitre, aEncaisser ? {} : { color: couleurs.sapin }]}>
            {aEncaisser
              ? `À encaisser à la livraison : ${formatEuros(paiement.resteAEncaisserCents)}`
              : "Commande déjà réglée — rien à encaisser"}
          </Text>
          <Text style={styles.encadreTexte}>Moyen de paiement prévu : {paiement.mode}</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 18, marginTop: 26 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitre}>Signature du client</Text>
            <Text style={styles.petit}>
              Pour réception, en confirmant la quantité livrée ci-dessus.
            </Text>
            <View
              style={{
                height: 66,
                borderWidth: 0.5,
                borderColor: couleurs.bord,
                marginTop: 6,
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitre}>Signature du livreur</Text>
            <Text style={styles.petit}>Date et heure de livraison :</Text>
            <View
              style={{
                height: 66,
                borderWidth: 0.5,
                borderColor: couleurs.bord,
                marginTop: 6,
              }}
            />
          </View>
        </View>

        <Text style={[styles.petit, { marginTop: 14 }]}>
          Ce bon constate la livraison. Il ne vaut pas facture : la facture est éditée séparément
          et porte les mentions légales.
        </Text>

        <PiedDocument texte={`${tenant.name} — ${MENTION_STERE}`} />
      </Page>
    </Document>
  );
}
