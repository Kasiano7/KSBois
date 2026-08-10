import { Heading, Link, Section, Text } from "@react-email/components";
import { Gabarit, styles } from "./gabarit";
import { formatEuros, formatVolume } from "@/domain/units";

/**
 * Récapitulatif quotidien envoyé à l'exploitant — docs/02 §9.3.
 *
 * Ce n'est PAS un tableau de bord par email. C'est la feuille de route du
 * matin : ce qu'il y a à charger aujourd'hui, ce qu'il faut encaisser, et ce
 * qui attend une décision. Un email qu'on lit à 7 h dans la cour, sur un
 * téléphone, avant de monter dans le camion.
 *
 * Règle de rédaction : chaque bloc répond à « qu'est-ce que je fais ? ». Aucun
 * indicateur de pilotage ici — ils sont dans l'écran statistiques.
 */

export interface LigneTournee {
  reference: string;
  client: string;
  ville: string;
  volumeM3: number;
  creneau: string | null;
  modePaiement: string;
  resteAEncaisserCents: number;
  contraintesAcces: string | null;
}

export interface DonneesRecap {
  entreprise: string;
  dateLisible: string;
  lienTournee: string;
  lienAdmin: string;
  tournee: LigneTournee[];
  totalVolumeM3: number;
  totalAEncaisserCents: number;
  totalEspecesCents: number;
  /** Lignes cliquables « à traiter », reprises du tableau de bord. */
  aTraiter: string[];
  /** SKU sous le seuil de stock. */
  stockBas: string[];
}

export function RecapQuotidien(d: DonneesRecap) {
  const rienAFaire = d.tournee.length === 0 && d.aTraiter.length === 0 && d.stockBas.length === 0;

  return (
    <Gabarit
      apercu={
        d.tournee.length > 0
          ? `${d.tournee.length} livraison${d.tournee.length > 1 ? "s" : ""} aujourd'hui — ${formatVolume(d.totalVolumeM3)}`
          : "Aucune livraison prévue aujourd'hui"
      }
      entreprise={d.entreprise}
    >
      <Heading style={styles.titre}>Votre journée</Heading>
      <Text style={{ ...styles.discret, textTransform: "capitalize", margin: "0 0 20px" }}>
        {d.dateLisible}
      </Text>

      {rienAFaire && (
        <Text style={styles.texte}>
          Rien de prévu et rien en attente. Bonne journée.
        </Text>
      )}

      {d.tournee.length > 0 && (
        <>
          <Section style={styles.encadre}>
            <Text style={{ ...styles.texte, margin: "0 0 4px", fontSize: "21px" }}>
              <strong>
                {d.tournee.length} livraison{d.tournee.length > 1 ? "s" : ""} ·{" "}
                {formatVolume(d.totalVolumeM3)} à charger
              </strong>
            </Text>
            {d.totalAEncaisserCents > 0 && (
              <Text style={{ ...styles.discret, margin: "6px 0 0" }}>
                {formatEuros(d.totalAEncaisserCents)} à encaisser
                {d.totalEspecesCents > 0
                  ? `, dont ${formatEuros(d.totalEspecesCents)} en espèces`
                  : ""}
              </Text>
            )}
          </Section>

          {d.tournee.map((ligne) => (
            <Section
              key={ligne.reference}
              style={{ borderTop: `1px solid ${styles.ligne.borderColor}`, padding: "12px 0 0" }}
            >
              <Text style={{ ...styles.texte, margin: "0 0 2px" }}>
                <strong>
                  {ligne.client} — {ligne.ville}
                </strong>
              </Text>
              <Text style={{ ...styles.discret, margin: "0 0 2px" }}>
                {formatVolume(ligne.volumeM3)}
                {ligne.creneau ? ` · ${ligne.creneau}` : ""}
                {ligne.resteAEncaisserCents > 0
                  ? ` · ${formatEuros(ligne.resteAEncaisserCents)} à encaisser (${ligne.modePaiement})`
                  : " · déjà payée"}
              </Text>
              {/* Les contraintes d'accès sont la première cause de livraison
                  ratée : elles remontent dans le récap, pas seulement sur le bon. */}
              {ligne.contraintesAcces && (
                <Text style={{ ...styles.discret, margin: 0, color: styles.montant.color }}>
                  Accès : {ligne.contraintesAcces}
                </Text>
              )}
            </Section>
          ))}

          <Section style={{ margin: "24px 0 8px" }}>
            <Link href={d.lienTournee} style={styles.bouton}>
              Ouvrir la tournée
            </Link>
          </Section>
        </>
      )}

      {d.aTraiter.length > 0 && (
        <>
          <Heading style={{ ...styles.titre, fontSize: "19px", margin: "28px 0 12px" }}>
            À traiter
          </Heading>
          {d.aTraiter.map((point) => (
            <Text key={point} style={{ ...styles.texte, margin: "0 0 8px" }}>
              • {point}
            </Text>
          ))}
        </>
      )}

      {d.stockBas.length > 0 && (
        <>
          <Heading style={{ ...styles.titre, fontSize: "19px", margin: "28px 0 12px" }}>
            Stock à surveiller
          </Heading>
          <Text style={styles.texte}>
            Sous le seuil : <strong>{d.stockBas.join(", ")}</strong>.
          </Text>
        </>
      )}

      {!rienAFaire && (
        <Section style={{ margin: "24px 0 0" }}>
          <Link href={d.lienAdmin} style={styles.boutonSecondaire}>
            Ouvrir l&apos;administration
          </Link>
        </Section>
      )}
    </Gabarit>
  );
}
