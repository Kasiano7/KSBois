import { Heading, Section, Text } from "@react-email/components";
import { Gabarit, styles } from "./gabarit";

/**
 * Accusé de réception d'une demande de devis — docs/02 §9.1
 *
 * Son rôle n'est pas de vendre : c'est de dire au prospect qu'un humain a bien
 * reçu sa demande et sous quel délai il aura une réponse. Sans ce message, un
 * client qui n'entend rien pendant deux jours appelle un concurrent.
 *
 * Il ne promet donc PAS de prix : la réponse chiffrée viendra du patron.
 */

export interface DonneesDevisRecu {
  entreprise: string;
  telephone: string | null;
  reference: string;
  prenom: string | null;
  /** Ce que le client a demandé, résumé en une ligne. */
  resume: string;
  delaiReponse: string;
}

export function DevisRecu(d: DonneesDevisRecu) {
  return (
    <Gabarit
      apercu={`Nous avons bien reçu votre demande ${d.reference}`}
      entreprise={d.entreprise}
      pied={
        d.telephone ? (
          <Text style={styles.discret}>
            Pressé ? Appelez-nous au <strong>{d.telephone}</strong>, c&apos;est toujours plus
            rapide.
          </Text>
        ) : undefined
      }
    >
      <Heading style={styles.titre}>Nous avons bien reçu votre demande</Heading>

      <Text style={styles.texte}>Bonjour{d.prenom ? ` ${d.prenom}` : ""},</Text>

      <Text style={styles.texte}>
        Votre demande de devis nous est bien parvenue. Nous l&apos;étudions et nous vous répondons
        sous <strong>{d.delaiReponse}</strong>, avec un prix ferme et le détail de la livraison.
      </Text>

      <Section style={styles.encadre}>
        <Text style={{ ...styles.discret, margin: "0 0 4px" }}>Votre demande</Text>
        <Text style={{ ...styles.texte, margin: 0 }}>{d.resume}</Text>
      </Section>

      <Text style={styles.discret}>Référence à rappeler : {d.reference}</Text>
    </Gabarit>
  );
}
