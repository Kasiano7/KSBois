import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";

/**
 * Gabarit commun des emails transactionnels.
 *
 * Contraintes propres à l'email, différentes du site :
 *  • styles EN LIGNE uniquement — les clients mail ignorent les feuilles ;
 *  • pas de police externe : on retombe sur les polices système ;
 *  • un seul niveau de mise en page, pas de grille ;
 *  • lisible en diagonale sur un téléphone (docs/02 §9.2).
 */

export const couleurs = {
  ecorce: "#171310",
  aubier: "#f4f2ec",
  blanc: "#ffffff",
  encre: "#14100d",
  cendre: "#6e6459",
  bord: "#dfd9cd",
  braise: "#a83f12",
  sapin: "#22392c",
  succes: "#2f6b45",
};

const police =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const styles = {
  body: { backgroundColor: couleurs.aubier, fontFamily: police, margin: 0, padding: "24px 0" },
  container: {
    backgroundColor: couleurs.blanc,
    borderRadius: "8px",
    margin: "0 auto",
    maxWidth: "560px",
    padding: "32px",
  },
  enTete: { color: couleurs.sapin, fontSize: "15px", fontWeight: 700, margin: "0 0 24px" },
  titre: { color: couleurs.encre, fontSize: "26px", lineHeight: 1.2, margin: "0 0 16px" },
  texte: { color: couleurs.encre, fontSize: "17px", lineHeight: 1.6, margin: "0 0 16px" },
  discret: { color: couleurs.cendre, fontSize: "15px", lineHeight: 1.6, margin: "0 0 12px" },
  encadre: {
    backgroundColor: couleurs.aubier,
    borderRadius: "6px",
    padding: "16px",
    margin: "0 0 20px",
  },
  ligne: { borderColor: couleurs.bord, margin: "24px 0" },
  bouton: {
    backgroundColor: couleurs.braise,
    borderRadius: "4px",
    color: couleurs.blanc,
    display: "inline-block",
    fontSize: "17px",
    fontWeight: 700,
    padding: "14px 28px",
    textDecoration: "none",
  },
  boutonSecondaire: {
    border: `1px solid ${couleurs.bord}`,
    borderRadius: "4px",
    color: couleurs.encre,
    display: "inline-block",
    fontSize: "16px",
    fontWeight: 600,
    padding: "12px 24px",
    textDecoration: "none",
  },
  pied: { color: couleurs.cendre, fontSize: "13px", lineHeight: 1.6, margin: "0" },
  montant: { color: couleurs.braise, fontSize: "24px", fontWeight: 700, margin: "0" },
};

export function Gabarit({
  apercu,
  entreprise,
  children,
  pied,
}: {
  apercu: string;
  entreprise: string;
  children: React.ReactNode;
  pied?: React.ReactNode;
}) {
  return (
    <Html lang="fr">
      <Head />
      {/* Texte d'aperçu : la première ligne visible dans la liste des messages */}
      <Preview>{apercu}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.enTete}>{entreprise}</Text>
          {children}
          <Hr style={styles.ligne} />
          <Section>
            {pied}
            <Text style={styles.pied}>
              Les quantités sont exprimées en mètres cubes apparents. Le stère n&apos;est plus une
              unité légale de mesure depuis 1977 ; la mention « stère » est donnée à titre
              indicatif.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
