import { DocumentDevis, type LigneDocument } from "./document-devis";
import { formatDateFr } from "@/lib/jours";
import type { DemandeDevis, Proposition } from "@/server/admin-devis";
import type { Tenant } from "@/lib/tenant";

/**
 * Devis envoyé au client par l'exploitant — docs/02-MOTEURS-METIER.md §7.2
 *
 * ⚠️ Différence assumée avec le devis libre-service du panier (`devis.tsx`) :
 * celui-ci porte un ENGAGEMENT. Un document édité par la machine peut se
 * dédire dans la minute ; un document que le patron envoie nommément à un
 * client, non. L'encadré de bas de page annonce donc une durée de validité au
 * lieu de prévenir que le prix peut changer à tout moment. Sans date de
 * validité, on retombe honnêtement sur la mention d'indicativité.
 */

const MENTION_SANS_VALIDITE =
  "Cette proposition est donnée à titre indicatif : aucune durée de validité n'y est attachée. " +
  "Les prix dépendent notamment du cours du bois et du carburant. Seule une commande confirmée " +
  "fixe le prix définitif.";

const LIBELLES_HUMIDITE: Record<string, string> = {
  H1: "bois sec",
  H2: "mi-sec",
  H3: "fraîchement coupé",
};

export interface DevisCommercialProps {
  tenant: Tenant;
  demande: DemandeDevis;
  proposition: Proposition;
  editeLe: string;
  message?: string | null;
}

export function DevisCommercialPdf({
  tenant,
  demande,
  proposition,
  editeLe,
  message,
}: DevisCommercialProps) {
  const lignes: LigneDocument[] = proposition.lignes.map((l, index) => ({
    cle: `${l.variantId}-${index}`,
    designation: l.productName,
    precision:
      [
        l.variantLabel,
        l.humidityClass ? LIBELLES_HUMIDITE[l.humidityClass] : null,
        l.packaging !== "vrac" ? l.packaging : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    volumeM3: l.lineVolumeM3,
    stackingCoefficient: l.stackingCoefficient,
    unitPriceCents: l.unitPriceCents,
    lineTotalCents: l.lineTotalCents,
  }));

  const livraison = proposition.livraison;
  const nom = [demande.prenom, demande.nom].filter(Boolean).join(" ") || demande.email;

  return (
    <DocumentDevis
      tenant={tenant}
      reference={demande.reference}
      editeLe={editeLe}
      titre="Devis"
      sousTitre="Bois de chauffage — quantités exprimées en mètres cubes apparents (m³ apparents)"
      client={{
        nom,
        societe: demande.societe,
        adresse: demande.adresse,
        codePostalVille: [demande.codePostal, demande.ville].filter(Boolean).join(" ") || null,
        email: demande.email,
        telephone: demande.telephone,
      }}
      lignes={lignes}
      livraison={
        livraison
          ? {
              commune:
                [livraison.commune, livraison.codePostal ? `(${livraison.codePostal})` : null]
                  .filter(Boolean)
                  .join(" ") || null,
              distanceKm: livraison.distanceKm,
              baseCents: livraison.detail?.status === "ok" ? livraison.detail.baseCents : 0,
              volumeCents: livraison.detail?.status === "ok" ? livraison.detail.volumeCents : 0,
              fuelCents: livraison.detail?.status === "ok" ? livraison.detail.fuelCents : 0,
              totalCents: proposition.totaux.deliveryCents,
              offerte: livraison.detail?.status === "ok" && livraison.detail.isFree,
              // Un montant fixé à la main ne se décompose pas : l'afficher en
              // « forfait + volume + carburant » serait un détail inventé.
              detaille: !livraison.manuelle && livraison.detail?.status === "ok",
            }
          : null
      }
      remise={
        proposition.remiseCents > 0
          ? {
              label: proposition.remiseLabel ?? "Remise commerciale",
              montantCents: proposition.remiseCents,
            }
          : null
      }
      totaux={{
        subtotalCents: proposition.totaux.subtotalCents,
        totalCents: proposition.totaux.totalCents,
        totalVolumeM3: proposition.totaux.totalVolumeM3,
        vatBreakdown: proposition.totaux.vatBreakdown,
      }}
      message={message}
      encadre={{
        titre: demande.validJusquA ? "Validité de cette proposition" : "Proposition indicative",
        texte: demande.validJusquA
          ? `Cette proposition est valable jusqu'au ${formatDateFr(demande.validJusquA, { jourSemaine: false })} inclus. ` +
            `Passé ce délai, les prix sont susceptibles d'évoluer, notamment en fonction du cours du bois et du carburant. ` +
            `Pour l'accepter, il vous suffit de nous répondre ou de nous appeler.` +
            (livraison === null ? " La livraison n'est pas comprise dans ce montant." : "")
          : MENTION_SANS_VALIDITE,
        complement: `Édité le ${editeLe}`,
      }}
    />
  );
}
