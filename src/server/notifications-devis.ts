import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { envoyerEmail, envoyerSansBloquer, type ResultatEnvoi } from "./notifications";
import { getDemandeDevis, calculerProposition } from "./admin-devis";
import { DevisRecu } from "@/emails/devis-recu";
import { DevisPropose } from "@/emails/devis-propose";
import { DevisCommercialPdf } from "@/pdf/devis-commercial";
import { formatVolume } from "@/domain/units";
import { formatDateFr } from "@/lib/jours";
import type { Tenant } from "@/lib/tenant";

/**
 * Notifications du parcours devis — docs/02-MOTEURS-METIER.md §7.2 et §9.1
 *
 * Deux moments, deux messages :
 *  • à l'arrivée de la demande : un accusé au client ET une alerte à
 *    l'entreprise. Un devis qui dort dans une base que personne ne regarde ne
 *    vaut rien ;
 *  • à l'envoi de la proposition : le devis PDF en pièce jointe.
 *
 * Tout est construit DEPUIS LA BASE, jamais depuis le formulaire ou l'écran :
 * les deux chemins ne peuvent donc pas diverger.
 */

const horodatage = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** Résumé d'une demande en une ligne — sert l'accusé et l'alerte interne. */
function resumerDemande(d: {
  quantiteM3: number | null;
  essence: string | null;
  longueurCm: number | null;
  ville: string | null;
  codePostal: string | null;
}): string {
  const morceaux = [
    d.quantiteM3 !== null ? formatVolume(d.quantiteM3) : null,
    d.essence,
    d.longueurCm !== null ? `bûches de ${d.longueurCm} cm` : null,
    [d.codePostal, d.ville].filter(Boolean).join(" ") || null,
  ].filter(Boolean);
  return morceaux.join(" · ") || "Demande sans précision";
}

/**
 * Accusé de réception au client + alerte à l'entreprise.
 *
 * Appelé à la création de la demande. Ne bloque jamais : une demande enregistrée
 * sans email parti reste une demande valide, visible dans l'administration.
 */
export async function envoyerAccuseDevis(tenant: Tenant, quoteId: string): Promise<void> {
  const demande = await getDemandeDevis(tenant.id, quoteId);
  if (!demande) return;

  const resume = resumerDemande(demande);

  await envoyerSansBloquer({
    companyId: tenant.id,
    destinataire: demande.email,
    sujet: `Votre demande de devis ${demande.reference}`,
    modele: "devis_recu",
    repondreA: tenant.email,
    contenu: DevisRecu({
      entreprise: tenant.name,
      telephone: tenant.phoneDisplay ?? tenant.phone,
      reference: demande.reference,
      prenom: demande.prenom,
      resume,
      // Même délai que celui annoncé sur la page publique après envoi du
      // formulaire : deux promesses différentes seraient vues par le client.
      delaiReponse: "48 heures ouvrées",
    }),
  });

  // Alerte interne : le patron doit savoir sans ouvrir l'administration.
  await envoyerSansBloquer({
    companyId: tenant.id,
    destinataire: tenant.email,
    sujet: `Nouvelle demande de devis — ${demande.reference}`,
    modele: "devis_alerte_interne",
    repondreA: demande.email,
    contenu: DevisRecu({
      entreprise: tenant.name,
      telephone: demande.telephone,
      reference: demande.reference,
      prenom: null,
      resume:
        `${[demande.prenom, demande.nom].filter(Boolean).join(" ")} — ${demande.email}` +
        `${demande.telephone ? ` — ${demande.telephone}` : ""}\n${resume}` +
        `${demande.message ? `\n« ${demande.message} »` : ""}`,
      // Même délai que celui annoncé sur la page publique après envoi du
      // formulaire : deux promesses différentes seraient vues par le client.
      delaiReponse: "48 heures ouvrées",
    }),
  });
}

export interface ResultatEnvoiDevis extends ResultatEnvoi {
  /** Vrai si le PDF a pu être produit : sans lui, on n'envoie rien. */
  pdfGenere: boolean;
}

/**
 * Envoie la proposition chiffrée, PDF joint.
 *
 * ⚠️ Contrairement aux notifications de commande, cet envoi n'est PAS silencieux :
 * l'exploitant vient de cliquer « Envoyer », il doit savoir si c'est parti. Le
 * résultat remonte donc jusqu'à l'écran.
 */
export async function envoyerDevisAuClient(
  tenant: Tenant,
  quoteId: string,
  message: string | null,
): Promise<ResultatEnvoiDevis> {
  const demande = await getDemandeDevis(tenant.id, quoteId);
  if (!demande) return { envoye: false, pdfGenere: false, raison: "erreur_fournisseur" };

  const proposition = await calculerProposition(tenant, demande);
  const editeLe = horodatage.format(new Date());

  let pdf: Buffer;
  try {
    pdf = await renderToBuffer(
      DevisCommercialPdf({ tenant, demande, proposition, editeLe, message }),
    );
  } catch (erreur) {
    console.error("[devis] génération du PDF :", erreur);
    return { envoye: false, pdfGenere: false, raison: "erreur_fournisseur" };
  }

  const resultat = await envoyerEmail({
    companyId: tenant.id,
    destinataire: demande.email,
    sujet: `Votre devis ${demande.reference} — ${tenant.name}`,
    modele: "devis_propose",
    // Le client répond au patron, pas à une adresse d'envoi automatique.
    repondreA: tenant.email,
    contenu: DevisPropose({
      entreprise: tenant.name,
      telephone: tenant.phoneDisplay ?? tenant.phone,
      reference: demande.reference,
      prenom: demande.prenom,
      lignes: proposition.lignes.map((l) => ({
        designation: `${l.productName} — ${l.variantLabel}`,
        volumeM3: l.lineVolumeM3,
        totalCents: l.lineTotalCents,
      })),
      livraisonCents: proposition.livraison ? proposition.totaux.deliveryCents : null,
      totalCents: proposition.totaux.totalCents,
      volumeTotalM3: proposition.totaux.totalVolumeM3,
      validJusquA: demande.validJusquA
        ? formatDateFr(demande.validJusquA, { jourSemaine: false })
        : null,
      message,
    }),
    pieces: [{ nomFichier: `devis-${demande.reference}.pdf`, contenu: pdf }],
  });

  // La date de réponse est posée par l'action appelante, pas ici : même quand
  // l'email échoue, l'exploitant enverra le PDF lui-même et la demande aura bien
  // reçu une réponse ce jour-là.
  return { ...resultat, pdfGenere: true };
}
