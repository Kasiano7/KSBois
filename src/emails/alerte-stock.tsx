import { Heading, Link, Section, Text } from "@react-email/components";
import { Gabarit, styles } from "./gabarit";
import { formatVolume } from "@/domain/units";

/**
 * Alerte de stock bas, envoyée à l'exploitant — docs/02 §4.4.
 *
 * Elle ne dit pas seulement « il reste peu » : elle dit **combien de temps il
 * reste** au rythme de vente observé, et à quelle date la rupture tombe. Un
 * seuil franchi ne déclenche pas une décision ; une date, si.
 *
 * Envoyée par le récapitulatif quotidien, jamais à chaque commande : une alerte
 * qui arrive dix fois par jour n'est plus lue au bout d'une semaine.
 */

export interface LigneAlerteStock {
  libelle: string;
  sku: string;
  disponibleM3: number;
  seuilM3: number;
  /** Jours d'autonomie au rythme récent. `null` si les ventes sont trop rares. */
  joursRestants: number | null;
  rupturePrevueLisible: string | null;
}

export interface DonneesAlerteStock {
  entreprise: string;
  lienStock: string;
  lignes: LigneAlerteStock[];
}

export function AlerteStock(d: DonneesAlerteStock) {
  const urgentes = d.lignes.filter(
    (ligne) => ligne.joursRestants !== null && ligne.joursRestants <= 14,
  );

  return (
    <Gabarit
      apercu={
        urgentes.length > 0
          ? `${urgentes[0].libelle} : rupture dans ${urgentes[0].joursRestants} jours`
          : `${d.lignes.length} produit${d.lignes.length > 1 ? "s" : ""} sous le seuil de stock`
      }
      entreprise={d.entreprise}
    >
      <Heading style={styles.titre}>
        {urgentes.length > 0 ? "Il faut produire" : "Stock à surveiller"}
      </Heading>

      <Text style={styles.texte}>
        {d.lignes.length === 1
          ? "Un produit est passé sous son seuil de stock."
          : `${d.lignes.length} produits sont passés sous leur seuil de stock.`}
      </Text>

      {d.lignes.map((ligne) => (
        <Section key={ligne.sku} style={styles.encadre}>
          <Text style={{ ...styles.texte, margin: "0 0 4px" }}>
            <strong>{ligne.libelle}</strong>
          </Text>
          <Text style={{ ...styles.discret, margin: 0 }}>
            {formatVolume(ligne.disponibleM3)} disponibles · seuil à{" "}
            {formatVolume(ligne.seuilM3)}
          </Text>
          {ligne.joursRestants !== null && (
            <Text
              style={{
                ...styles.discret,
                margin: "6px 0 0",
                color: ligne.joursRestants <= 14 ? styles.montant.color : styles.discret.color,
              }}
            >
              <strong>
                Environ {ligne.joursRestants} jour{ligne.joursRestants > 1 ? "s" : ""} de stock
              </strong>
              {ligne.rupturePrevueLisible ? ` — rupture vers le ${ligne.rupturePrevueLisible}` : ""}
            </Text>
          )}
          {ligne.joursRestants === null && (
            <Text style={{ ...styles.discret, margin: "6px 0 0" }}>
              Pas assez de ventes récentes pour estimer une date de rupture.
            </Text>
          )}
        </Section>
      ))}

      <Section style={{ margin: "20px 0 0" }}>
        <Link href={d.lienStock} style={styles.bouton}>
          Ajouter de la production
        </Link>
      </Section>
    </Gabarit>
  );
}
