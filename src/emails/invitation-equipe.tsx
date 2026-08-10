import { Heading, Link, Section, Text } from "@react-email/components";
import { Gabarit, styles } from "./gabarit";

/**
 * Invitation à rejoindre l'administration d'une entreprise.
 *
 * Elle ne contient AUCUN jeton et aucun lien d'acceptation : l'invitation se
 * consomme à la première connexion, sur l'adresse vérifiée par Supabase Auth.
 * Un lien d'acceptation serait une clé d'accès à l'administration circulant
 * dans une boîte mail — précisément ce qu'on veut éviter.
 */

const LIBELLES_ROLE: Record<string, string> = {
  owner: "Gérant",
  staff: "Secrétariat",
  driver: "Livreur",
};

const CE_QUE_VOUS_POUVEZ: Record<string, string> = {
  owner: "Vous aurez accès à tout : commandes, tarifs, factures, réglages et utilisateurs.",
  staff:
    "Vous pourrez gérer les commandes, les devis, les clients, le stock et les créneaux de livraison.",
  driver: "Vous aurez accès à la tournée du jour et aux bons de livraison.",
};

export function InvitationEquipe({
  entreprise,
  invitePar,
  role,
  lienConnexion,
}: {
  entreprise: string;
  invitePar: string;
  role: string;
  lienConnexion: string;
}) {
  return (
    <Gabarit apercu={`Rejoignez l'administration de ${entreprise}`} entreprise={entreprise}>
      <Heading style={styles.titre}>Vous êtes invité</Heading>

      <Text style={styles.texte}>
        {invitePar} vous a donné accès à l&apos;administration de <strong>{entreprise}</strong>.
      </Text>

      <Section style={styles.encadre}>
        <Text style={{ ...styles.texte, margin: "0 0 4px" }}>
          <strong>Votre rôle : {LIBELLES_ROLE[role] ?? role}</strong>
        </Text>
        <Text style={{ ...styles.discret, margin: 0 }}>
          {CE_QUE_VOUS_POUVEZ[role] ?? ""}
        </Text>
      </Section>

      <Text style={styles.texte}>
        Connectez-vous avec <strong>cette adresse email</strong> : votre accès s&apos;ouvre
        automatiquement à la première connexion. Si vous n&apos;avez pas encore de compte,
        demandez un lien de connexion depuis la page ci-dessous.
      </Text>

      <Section style={{ margin: "8px 0 4px" }}>
        <Link href={lienConnexion} style={styles.bouton}>
          Se connecter
        </Link>
      </Section>

      <Text style={styles.discret}>
        Cette invitation expire dans 14 jours. Si vous ne l&apos;attendiez pas, ignorez ce
        message : sans connexion de votre part, aucun accès n&apos;est ouvert.
      </Text>
    </Gabarit>
  );
}
