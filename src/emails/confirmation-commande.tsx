import { Heading, Link, Section, Text } from "@react-email/components";
import { Gabarit, styles } from "./gabarit";
import { formatEuros, formatVolume, formatStereHint } from "@/domain/units";

/**
 * Email de confirmation de commande — docs/02-MOTEURS-METIER.md §9.2
 *
 * Rédigé pour être lu EN DIAGONALE sur un téléphone. Le bouton « Créer mon
 * compte en un clic » est placé ici parce que c'est le moment exact où le client
 * est satisfait : c'est là qu'on convertit un acheteur invité en client fidèle.
 */

export interface DonneesConfirmation {
  entreprise: string;
  telephone: string | null;
  reference: string;
  prenom: string;
  lignes: {
    produit: string;
    format: string;
    volumeM3: number;
    totalCents: number;
    /** L'équivalence en stères dépend de la longueur de coupe. */
    coefficient: number | null;
  }[];
  options: { nom: string; totalCents: number }[];
  volumeTotalM3: number;
  livraisonCents: number;
  totalCents: number;
  ville: string | null;
  creneauSouhaite: string | null;
  modePaiement: string;
  resteAPayerCents: number;
  lienCommande: string;
  /** Espace client : c'est ici qu'un acheteur invité devient un client fidèle. */
  lienEspaceClient: string;
}

const SUITE_PAIEMENT: Record<string, string> = {
  card: "Votre paiement par carte a été enregistré.",
  cash: "Vous réglerez en espèces à la livraison. Pensez à faire l'appoint si possible.",
  check: "Vous réglerez par chèque à la livraison.",
  transfer:
    "Réglez par virement en indiquant la référence de commande en libellé. Notre RIB figure au bas de ce message.",
  sumup: "Vous réglerez par carte à la livraison, sur le terminal du livreur.",
};

export function ConfirmationCommande(d: DonneesConfirmation) {
  const resume = `${formatVolume(d.volumeTotalM3)} de bois de chauffage — commande ${d.reference}`;

  return (
    <Gabarit
      apercu={resume}
      entreprise={d.entreprise}
      pied={
        d.telephone ? (
          <Text style={styles.discret}>
            Une question ? Appelez-nous au <strong>{d.telephone}</strong>.
          </Text>
        ) : undefined
      }
    >
      <Heading style={styles.titre}>Votre commande est confirmée</Heading>

      <Text style={styles.texte}>
        Bonjour {d.prenom}, merci pour votre commande. Voici ce que nous avons enregistré.
      </Text>

      <Section style={styles.encadre}>
        {d.lignes.map((l, i) => (
          <Text key={i} style={{ ...styles.texte, margin: i === 0 ? "0 0 8px" : "8px 0" }}>
            <strong>
              {formatVolume(l.volumeM3)}
              {l.coefficient !== null && ` (${formatStereHint(l.volumeM3, l.coefficient)})`}
            </strong>
            <br />
            {l.produit} · {l.format} — {formatEuros(l.totalCents)}
          </Text>
        ))}
        {d.options.map((option, i) => (
          <Text key={`option-${i}`} style={{ ...styles.discret, margin: "8px 0" }}>
            {option.nom} : <strong>{formatEuros(option.totalCents)}</strong>
          </Text>
        ))}

        <Text style={{ ...styles.discret, margin: "12px 0 4px" }}>
          Livraison{d.ville ? ` à ${d.ville}` : ""} :{" "}
          {d.livraisonCents === 0 ? "offerte" : formatEuros(d.livraisonCents)}
        </Text>
        <Text style={styles.montant}>Total {formatEuros(d.totalCents)}</Text>
        {d.resteAPayerCents > 0 && d.resteAPayerCents < d.totalCents && (
          <Text style={{ ...styles.discret, margin: "8px 0 0" }}>
            Reste à régler à la livraison : <strong>{formatEuros(d.resteAPayerCents)}</strong>
          </Text>
        )}
      </Section>

      <Text style={styles.texte}>
        <strong>
          {d.creneauSouhaite
            ? `Créneau souhaité : ${d.creneauSouhaite}.`
            : "Vous n'avez pas choisi de créneau."}
        </strong>
        <br />
        Nous vous confirmons la date de livraison par email sous 24 heures. Le livreur vous appelle
        avant de passer.
      </Text>

      <Text style={styles.texte}>{SUITE_PAIEMENT[d.modePaiement] ?? ""}</Text>

      <Section style={{ margin: "24px 0 8px" }}>
        <Link href={d.lienCommande} style={styles.bouton}>
          Voir ma commande
        </Link>
      </Section>

      <Section style={{ margin: "16px 0 0" }}>
        <Link href={d.lienEspaceClient} style={styles.boutonSecondaire}>
          Créer mon espace en 1 clic
        </Link>
        <Text style={{ ...styles.discret, margin: "10px 0 0" }}>
          Sans mot de passe. Vous y retrouverez cette commande, et vous pourrez commander le même
          bois en deux clics l&apos;hiver prochain.
        </Text>
      </Section>
    </Gabarit>
  );
}
