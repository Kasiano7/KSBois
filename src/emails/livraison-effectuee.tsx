import { Heading, Link, Section, Text } from "@react-email/components";
import { Gabarit, styles } from "./gabarit";
import { formatEuros, formatVolume } from "@/domain/units";

/**
 * Email envoyé APRÈS la livraison, avec la facture en pièce jointe — docs/02 §9.1.
 *
 * Trois rôles, dans cet ordre d'importance :
 *  1. remettre la facture, qui est due dès la livraison (docs/02 §7 bis) ;
 *  2. dire ce qui reste éventuellement à régler, sans ambiguïté ;
 *  3. préparer la recommande — c'est le moment où le client est satisfait,
 *     et la recommande est la fonctionnalité la plus rentable du site.
 *
 * ⚠️ Il ne réclame jamais un paiement déjà encaissé : le montant dû est
 * calculé, jamais supposé.
 */

export interface DonneesLivraisonEffectuee {
  entreprise: string;
  telephone: string | null;
  reference: string;
  prenom: string;
  volumeM3: number;
  dateLisible: string;
  /** Numéro de la facture jointe. Absent si l'émission a échoué. */
  numeroFacture: string | null;
  modePaiement: string;
  resteAPayerCents: number;
  /** Lien vers l'espace client, pour retrouver la facture et recommander. */
  lienCompte: string;
}

const COMMENT_REGLER: Record<string, string> = {
  transfer: "par virement, avec la référence de commande en libellé",
  check: "par chèque, à l'ordre de l'entreprise",
  cash: "en espèces",
  sumup: "par carte",
  card: "par carte",
};

export function LivraisonEffectuee(d: DonneesLivraisonEffectuee) {
  const doitPayer = d.resteAPayerCents > 0;

  return (
    <Gabarit
      apercu={
        doitPayer
          ? `Votre bois est livré — reste ${formatEuros(d.resteAPayerCents)} à régler`
          : "Votre bois est livré, voici votre facture"
      }
      entreprise={d.entreprise}
      pied={
        d.telephone ? (
          <Text style={styles.discret}>
            Une remarque sur la livraison ? Appelez-nous au <strong>{d.telephone}</strong>.
            Nous préférons le savoir.
          </Text>
        ) : undefined
      }
    >
      <Heading style={styles.titre}>Votre bois est livré</Heading>

      <Text style={styles.texte}>Bonjour {d.prenom},</Text>

      <Text style={styles.texte}>
        Nous avons livré {formatVolume(d.volumeM3)} {d.dateLisible}. Merci de votre confiance.
      </Text>

      {d.numeroFacture ? (
        <Section style={styles.encadre}>
          <Text style={{ ...styles.texte, margin: 0 }}>
            <strong>Facture {d.numeroFacture}</strong>
            <br />
            Elle est jointe à cet email, au format PDF.
          </Text>
        </Section>
      ) : (
        <Section style={styles.encadre}>
          <Text style={{ ...styles.texte, margin: 0 }}>
            Votre facture vous parvient séparément, sous deux jours ouvrés.
          </Text>
        </Section>
      )}

      {doitPayer && (
        <>
          <Text style={{ ...styles.texte, margin: "0 0 4px" }}>Reste à régler</Text>
          <Text style={styles.montant}>{formatEuros(d.resteAPayerCents)}</Text>
          <Text style={{ ...styles.discret, margin: "8px 0 20px" }}>
            À régler {COMMENT_REGLER[d.modePaiement] ?? "selon les modalités convenues"}.
          </Text>
        </>
      )}

      <Text style={styles.texte}>
        Vos factures et vos commandes restent accessibles dans votre espace client — et vous
        pourrez y recommander le même bois en deux clics l&apos;hiver prochain.
      </Text>

      <Section style={{ margin: "8px 0 4px" }}>
        <Link href={d.lienCompte} style={styles.boutonSecondaire}>
          Voir mes commandes
        </Link>
      </Section>

      <Text style={styles.discret}>Commande {d.reference}</Text>
    </Gabarit>
  );
}
