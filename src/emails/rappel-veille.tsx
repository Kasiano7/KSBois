import { Heading, Section, Text } from "@react-email/components";
import { Gabarit, styles } from "./gabarit";
import { formatEuros, formatVolume } from "@/domain/units";

/**
 * Rappel envoyé la VEILLE de la livraison — docs/02 §9.1.
 *
 * Son seul métier : éviter la livraison ratée. Un camion qui se déplace pour
 * rien coûte le carburant, la place dans la tournée, et souvent le client.
 *
 * Il ne répète donc pas la confirmation : il demande trois choses concrètes —
 * dégager l'accès, préparer le règlement, prévenir en cas d'empêchement. Le
 * ton est celui d'un voisin, pas d'un service client.
 */

export interface DonneesRappel {
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
  /** Contraintes d'accès saisies à la commande, rappelées telles quelles. */
  contraintesAcces: string | null;
}

const A_PREPARER: Record<string, (montant: string) => string> = {
  cash: (m) => `Préparez ${m} en espèces, avec l'appoint si possible.`,
  check: (m) => `Préparez un chèque de ${m} à l'ordre de l'entreprise.`,
  sumup: (m) => `Vous réglerez ${m} par carte : le livreur a un terminal.`,
  transfer: (m) => `Il reste ${m} à régler par virement.`,
};

export function RappelVeille(d: DonneesRappel) {
  const montant = formatEuros(d.resteAPayerCents);
  const aPreparer =
    d.resteAPayerCents > 0
      ? (A_PREPARER[d.modePaiement]?.(montant) ?? `Reste à régler : ${montant}.`)
      : null;

  return (
    <Gabarit
      apercu={`Votre bois arrive demain — ${d.creneau}`}
      entreprise={d.entreprise}
      pied={
        d.telephone ? (
          <Text style={styles.discret}>
            Un empêchement de dernière minute ? Appelez-nous au{" "}
            <strong>{d.telephone}</strong> : mieux vaut décaler que manquer le rendez-vous.
          </Text>
        ) : undefined
      }
    >
      <Heading style={styles.titre}>Votre bois arrive demain</Heading>

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

      <Text style={styles.texte}>Deux choses à préparer d&apos;ici demain :</Text>

      <Text style={styles.texte}>
        <strong>1. L&apos;accès et l&apos;emplacement.</strong> Dégagez le passage du camion et
        repérez où le bois sera déposé.
        {d.contraintesAcces ? ` Vous nous aviez signalé : « ${d.contraintesAcces} ».` : ""}
      </Text>

      {aPreparer && (
        <Text style={styles.texte}>
          <strong>2. Le règlement.</strong> {aPreparer}
        </Text>
      )}

      {!aPreparer && (
        <Text style={styles.texte}>
          <strong>2. Rien à régler.</strong> Votre commande est déjà payée.
        </Text>
      )}

      <Text style={styles.discret}>
        Le livreur vous appelle avant de passer. Commande {d.reference}
      </Text>
    </Gabarit>
  );
}
