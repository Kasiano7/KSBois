import { Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Tenant } from "@/lib/tenant";

/**
 * Fondations communes aux documents PDF : devis, facture, avoir, bon de livraison.
 *
 * Un client qui reçoit un devis puis une facture doit reconnaître le même
 * document. Ces blocs sont donc partagés — en-tête, encadré destinataire,
 * tableau, pied de page — et seuls le titre, les colonnes et l'encadré de bas
 * de page changent d'un document à l'autre.
 *
 * ⚠️ ENCODAGE : tant que les polices standard sont utilisées, tout caractère
 * hors WinAnsi est remplacé SILENCIEUSEMENT par un autre glyphe — « ≈ » sortait
 * en « H ». Les accents passent, les symboles mathématiques non
 * (`tests/unit/pdf-encodage.test.ts`).
 */

export const couleurs = {
  encre: "#14100D",
  cendre: "#6E6459",
  bord: "#DFD9CD",
  braise: "#A83F12",
  sapin: "#22392C",
  fondAlerte: "#FBF3EE",
  fondDoux: "#F7F5F0",
};

export const styles = StyleSheet.create({
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
  encadre: {
    marginTop: 26,
    borderWidth: 1,
    borderColor: couleurs.braise,
    backgroundColor: couleurs.fondAlerte,
    padding: 12,
  },
  encadreTitre: { fontSize: 10, fontWeight: 700, color: couleurs.braise, marginBottom: 5 },
  encadreTexte: { fontSize: 8.5, lineHeight: 1.55, color: couleurs.encre },
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

/** Identité du vendeur affichée en tête. Reprend le tenant, ou un instantané figé. */
export interface SocieteEnTete {
  name: string;
  legalName?: string | null;
  addressLine1?: string | null;
  postalCode: string | null;
  city: string | null;
  phone?: string | null;
  email?: string | null;
}

export function societeDepuisTenant(tenant: Tenant): SocieteEnTete {
  return {
    name: tenant.name,
    postalCode: tenant.postalCode,
    city: tenant.city,
    phone: tenant.phoneDisplay ?? tenant.phone,
    email: tenant.email,
  };
}

/**
 * En-tête : émetteur à gauche, identification du document à droite.
 *
 * `lignesDroite` porte le type, le numéro et les dates. Chaque document a les
 * siennes — une facture affiche sa date de vente, un bon de livraison sa date
 * de tournée — mais elles s'affichent toujours au même endroit.
 */
export function EnTeteDocument({
  societe,
  lignesDroite,
}: {
  societe: SocieteEnTete;
  lignesDroite: string[];
}) {
  const adresse = [
    societe.addressLine1,
    [societe.postalCode, societe.city].filter(Boolean).join(" ") || null,
    societe.phone,
    societe.email,
  ].filter((ligne): ligne is string => Boolean(ligne));

  return (
    <View style={styles.enTete}>
      <View>
        <Text style={styles.nomEntreprise}>{societe.name}</Text>
        {societe.legalName && societe.legalName !== societe.name && (
          <Text style={styles.petit}>{societe.legalName}</Text>
        )}
        <Text style={styles.petit}>{adresse.join("\n")}</Text>
      </View>
      <View>
        <Text style={[styles.petit, { textAlign: "right" }]}>{lignesDroite.join("\n")}</Text>
      </View>
    </View>
  );
}

export interface DestinataireDocument {
  nom: string;
  societe?: string | null;
  adresse?: string | null;
  complementAdresse?: string | null;
  codePostalVille?: string | null;
  email?: string | null;
  telephone?: string | null;
  /** SIRET du client professionnel — mention obligatoire en B2B. */
  siret?: string | null;
}

export function EncadreDestinataire({
  titre = "Destinataire",
  client,
}: {
  titre?: string;
  client: DestinataireDocument;
}) {
  return (
    <View style={styles.encadreClient}>
      <Text style={styles.sectionTitre}>{titre}</Text>
      <Text style={styles.gras}>{client.societe || client.nom}</Text>
      {client.societe && <Text>{client.nom}</Text>}
      {client.adresse && <Text>{client.adresse}</Text>}
      {client.complementAdresse && <Text>{client.complementAdresse}</Text>}
      {client.codePostalVille && <Text>{client.codePostalVille}</Text>}
      {client.siret && <Text style={[styles.petit, { marginTop: 4 }]}>SIRET {client.siret}</Text>}
      {(client.telephone || client.email) && (
        <Text style={[styles.petit, { marginTop: 4 }]}>
          {[client.telephone, client.email].filter(Boolean).join("\n")}
        </Text>
      )}
    </View>
  );
}

export function PiedDocument({ texte }: { texte: string }) {
  return (
    <Text style={styles.pied} fixed>
      {texte}
    </Text>
  );
}

/** Rappel légal commun à tous les documents portant une quantité de bois. */
export const MENTION_STERE =
  "Le stère n'est plus une unité légale de mesure depuis 1977 : les quantités sont " +
  "exprimées en mètres cubes apparents. La mention « stère » est donnée à titre indicatif.";
