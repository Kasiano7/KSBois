import { Heading, Section, Text } from "@react-email/components";
import { Gabarit, styles } from "./gabarit";
import { formatEuros, formatVolume } from "@/domain/units";

/**
 * Devis chiffré envoyé au client — docs/02 §7.2
 *
 * Le PDF est en pièce jointe ; l'email en donne l'essentiel pour qu'une lecture
 * en diagonale sur un téléphone suffise à décider : ce qu'on propose, combien,
 * jusqu'à quand, et comment dire oui.
 *
 * Accepter un devis ne doit pas demander de formulaire : répondre au message ou
 * appeler suffit. Notre audience ne clique pas sur « valider mon devis ».
 */

export interface DonneesDevisPropose {
  entreprise: string;
  telephone: string | null;
  reference: string;
  prenom: string | null;
  lignes: { designation: string; volumeM3: number; totalCents: number }[];
  livraisonCents: number | null;
  totalCents: number;
  volumeTotalM3: number;
  validJusquA: string | null;
  message: string | null;
}

export function DevisPropose(d: DonneesDevisPropose) {
  return (
    <Gabarit
      apercu={`Votre devis ${d.reference} — ${formatEuros(d.totalCents)}`}
      entreprise={d.entreprise}
      pied={
        d.telephone ? (
          <Text style={styles.discret}>
            Pour accepter ce devis ou poser une question, répondez à ce message ou appelez-nous au{" "}
            <strong>{d.telephone}</strong>.
          </Text>
        ) : (
          <Text style={styles.discret}>
            Pour accepter ce devis ou poser une question, répondez simplement à ce message.
          </Text>
        )
      }
    >
      <Heading style={styles.titre}>Votre devis</Heading>

      <Text style={styles.texte}>Bonjour{d.prenom ? ` ${d.prenom}` : ""},</Text>

      {d.message ? (
        <Text style={styles.texte}>{d.message}</Text>
      ) : (
        <Text style={styles.texte}>
          Voici notre proposition, détaillée dans le document joint à ce message.
        </Text>
      )}

      <Section style={styles.encadre}>
        {d.lignes.map((l) => (
          <Text key={l.designation} style={{ ...styles.texte, margin: "0 0 6px" }}>
            {l.designation}
            <br />
            <span style={{ color: "#6e6459", fontSize: "15px" }}>
              {formatVolume(l.volumeM3)} — {formatEuros(l.totalCents)}
            </span>
          </Text>
        ))}

        {d.livraisonCents !== null && (
          <Text style={{ ...styles.discret, margin: "10px 0 0" }}>
            Livraison : {d.livraisonCents === 0 ? "offerte" : formatEuros(d.livraisonCents)}
          </Text>
        )}
        {d.livraisonCents === null && (
          <Text style={{ ...styles.discret, margin: "10px 0 0" }}>
            Livraison non comprise dans ce montant.
          </Text>
        )}

        <Text style={{ ...styles.montant, margin: "14px 0 0" }}>{formatEuros(d.totalCents)}</Text>
        <Text style={{ ...styles.discret, margin: "4px 0 0" }}>
          Total TTC pour {formatVolume(d.volumeTotalM3)}
        </Text>
      </Section>

      {d.validJusquA && (
        <Text style={styles.texte}>
          Cette proposition est valable jusqu&apos;au <strong>{d.validJusquA}</strong> inclus.
        </Text>
      )}

      <Text style={styles.discret}>Devis {d.reference}</Text>
    </Gabarit>
  );
}
