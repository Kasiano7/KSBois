import { DocumentDevis, type LigneDocument } from "./document-devis";
import type { PanierResume } from "@/server/panier";
import type { Tenant } from "@/lib/tenant";

/**
 * Devis imprimable depuis le panier — docs/02-MOTEURS-METIER.md §7.1
 *
 * Fonctionnalité de conversion : le client télécharge un PDF immédiatement,
 * sans compte, sans email, sans validation. Dans ce métier, beaucoup de clients
 * comparent trois fournisseurs et présentent un papier au conjoint avant de
 * décider. Aucun concurrent local ne le propose.
 *
 * ⚠️ La mention d'indicativité est OBLIGATOIRE et non discrète : ce document est
 * édité par la machine, sans qu'aucun humain ne se soit engagé. Les prix
 * dépendent du cours du bois et du carburant et peuvent bouger dans la minute.
 * La proposition envoyée par l'exploitant (`devis-commercial.tsx`) porte au
 * contraire un engagement daté — les deux encadrés ne disent donc PAS la même
 * chose, et c'est voulu.
 */

const MENTION_DEFAUT =
  "Ce document est une estimation indicative. Il ne constitue pas une offre commerciale ferme. " +
  "Les prix affichés dépendent notamment du cours du bois et du carburant et peuvent évoluer à tout " +
  "moment, y compris dans les minutes qui suivent l'édition de ce document. Seule une commande " +
  "confirmée fixe le prix définitif.";

const LIBELLES_HUMIDITE: Record<string, string> = {
  H1: "bois sec",
  H2: "mi-sec",
  H3: "fraîchement coupé",
};

interface DevisPdfProps {
  tenant: Tenant;
  panier: PanierResume;
  editeLe: string;
  mention?: string;
  reference: string;
}

export function DevisPdf({ tenant, panier, editeLe, mention, reference }: DevisPdfProps) {
  const devis = panier.livraison.devis;
  const livraisonChiffree = devis?.status === "ok";
  const commune =
    panier.livraison.resolution?.status === "ok" ? panier.livraison.resolution.commune : null;

  const lignes: LigneDocument[] = panier.lignes.map((ligne) => ({
    cle: ligne.itemId,
    designation: ligne.productName,
    precision:
      [
        ligne.variantLabel,
        ligne.humidityClass ? LIBELLES_HUMIDITE[ligne.humidityClass] : null,
        ligne.packaging !== "vrac" ? ligne.packaging : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    volumeM3: ligne.lineVolumeM3,
    stackingCoefficient: ligne.stackingCoefficient,
    unitPriceCents: ligne.unitPriceCents,
    lineTotalCents: ligne.lineTotalCents,
  }));

  return (
    <DocumentDevis
      tenant={tenant}
      reference={reference}
      editeLe={editeLe}
      titre="Estimation de commande"
      sousTitre="Bois de chauffage — quantités exprimées en mètres cubes apparents (m³ apparents)"
      lignes={lignes}
      livraison={
        commune
          ? {
              commune: `${commune.city} (${commune.postalCode})`,
              distanceKm: commune.distanceKm,
              baseCents: livraisonChiffree ? devis.baseCents : 0,
              volumeCents: livraisonChiffree ? devis.volumeCents : 0,
              fuelCents: livraisonChiffree ? devis.fuelCents : 0,
              totalCents: panier.totaux.deliveryCents,
              offerte: livraisonChiffree && devis.isFree,
              detaille: livraisonChiffree,
            }
          : null
      }
      totaux={{
        subtotalCents: panier.totaux.subtotalCents,
        totalCents: panier.totaux.totalCents,
        totalVolumeM3: panier.totaux.totalVolumeM3,
        vatBreakdown: panier.totaux.vatBreakdown,
      }}
      encadre={{
        titre: "Ce document est une estimation indicative",
        texte: mention ?? MENTION_DEFAUT,
        complement:
          `Édité le ${editeLe}` +
          (panier.livraison.prixCarburantCents > 0
            ? ` · Prix du gazole retenu : ${(panier.livraison.prixCarburantCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €/L`
            : ""),
      }}
    />
  );
}
