import { Heading, Section, Text } from "@react-email/components";
import { Gabarit, styles } from "./gabarit";
import { formatEuros, formatVolume } from "@/domain/units";

/**
 * Email « votre livraison est confirmée ».
 *
 * C'est le message le plus important du parcours : celui où l'entreprise
 * s'engage sur une date (docs/02 §3.1). Il doit tenir en un écran de téléphone
 * et répondre à trois questions : quand, quoi, combien à préparer.
 */

export interface DonneesLivraison {
  entreprise: string;
  telephone: string | null;
  reference: string;
  prenom: string;
  dateLisible: string;
  creneau: string;
  volumeM3: number;
  adresse: string;
  ville: string;
  modePaiement: string;
  resteAPayerCents: number;
}

const A_PREVOIR: Record<string, (montant: string) => string> = {
  cash: (m) => `Prévoyez ${m} en espèces. Faites l'appoint si possible.`,
  check: (m) => `Prévoyez un chèque de ${m}.`,
  sumup: (m) => `Vous pourrez régler ${m} par carte, le livreur a un terminal.`,
  transfer: (m) => `Il reste ${m} à régler par virement.`,
  card: () => "Votre commande est déjà payée : rien à prévoir.",
};

export function LivraisonConfirmee(d: DonneesLivraison) {
  const montant = formatEuros(d.resteAPayerCents);
  const aPrevoir =
    d.resteAPayerCents > 0
      ? (A_PREVOIR[d.modePaiement]?.(montant) ?? `Reste à régler : ${montant}.`)
      : "Votre commande est déjà payée : rien à prévoir.";

  return (
    <Gabarit
      apercu={`Livraison ${d.dateLisible} — ${d.creneau}`}
      entreprise={d.entreprise}
      pied={
        d.telephone ? (
          <Text style={styles.discret}>
            Un empêchement ? Appelez-nous au <strong>{d.telephone}</strong>, nous décalerons.
          </Text>
        ) : undefined
      }
    >
      <Heading style={styles.titre}>Votre livraison est confirmée</Heading>

      <Text style={styles.texte}>Bonjour {d.prenom},</Text>

      <Section style={styles.encadre}>
        <Text style={{ ...styles.texte, margin: "0 0 6px", fontSize: "21px" }}>
          <strong style={{ textTransform: "capitalize" }}>{d.dateLisible}</strong>
          <br />
          {d.creneau}
        </Text>
        <Text style={{ ...styles.discret, margin: "10px 0 0" }}>
          {formatVolume(d.volumeM3)} · {d.adresse}, {d.ville}
        </Text>
      </Section>

      <Text style={styles.texte}>
        Le livreur vous appelle avant de passer. Merci de dégager l&apos;accès et de prévoir
        l&apos;emplacement de déchargement.
      </Text>

      <Text style={styles.texte}>
        <strong>{aPrevoir}</strong>
      </Text>

      <Text style={styles.discret}>Commande {d.reference}</Text>
    </Gabarit>
  );
}
