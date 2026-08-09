import "server-only";

import { render } from "@react-email/components";
import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Envoi des notifications — docs/02-MOTEURS-METIER.md §9
 *
 * Principes :
 *  • TOUT envoi est journalisé dans `notifications_log`, réussi ou non. Sans
 *    cela, impossible de savoir si un client a été prévenu — et c'est la
 *    première question qu'on se pose en cas de litige.
 *  • Sans clé Resend, on ne casse RIEN : la notification est enregistrée en
 *    `queued` et le contenu est écrit dans la console en développement. La
 *    commande reste valide, l'exploitant la voit dans son administration.
 *  • Un email qui échoue ne doit JAMAIS faire échouer la commande. On rattrape
 *    toutes les erreurs.
 */

export type ModeleEmail =
  | "confirmation_commande"
  | "livraison_confirmee"
  | "rappel_veille"
  | "livraison_effectuee"
  | "devis_recu"
  | "devis_propose"
  | "devis_alerte_interne";

export interface PieceJointe {
  nomFichier: string;
  contenu: Buffer;
}

export interface DemandeEnvoi {
  companyId: string;
  destinataire: string;
  sujet: string;
  modele: ModeleEmail;
  /** Élément React Email déjà construit. */
  contenu: React.ReactElement;
  orderId?: string;
  expediteur?: string;
  /** Adresse de réponse : sur un devis, le client répond au patron. */
  repondreA?: string;
  pieces?: PieceJointe[];
}

export interface ResultatEnvoi {
  envoye: boolean;
  raison?: "non_configure" | "erreur_fournisseur";
}

export function resendConfigure(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function envoyerEmail(demande: DemandeEnvoi): Promise<ResultatEnvoi> {
  const supabase = createSupabaseAdminClient();

  const journaliser = async (
    statut: "sent" | "failed" | "queued",
    detail?: { providerId?: string; erreur?: string },
  ) => {
    const { error } = await supabase.from("notifications_log").insert({
      company_id: demande.companyId,
      channel: "email",
      template: demande.modele,
      recipient: demande.destinataire,
      order_id: demande.orderId ?? null,
      status: statut,
      provider_id: detail?.providerId ?? null,
      error: detail?.erreur ?? null,
      sent_at: statut === "sent" ? new Date().toISOString() : null,
    });
    if (error) console.error("[notifications] journalisation :", error.message);
  };

  let html: string;
  let texte: string;
  try {
    html = await render(demande.contenu);
    texte = await render(demande.contenu, { plainText: true });
  } catch (erreur) {
    console.error("[notifications] rendu du modèle :", erreur);
    await journaliser("failed", { erreur: "Rendu du modèle impossible" });
    return { envoye: false, raison: "erreur_fournisseur" };
  }

  if (!resendConfigure()) {
    // Dégradation volontaire : la notification est en attente, pas perdue.
    await journaliser("queued", { erreur: "RESEND_API_KEY absente" });
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `\n──── EMAIL NON ENVOYÉ (Resend non configuré) ────\n` +
          `À       : ${demande.destinataire}\n` +
          `Sujet   : ${demande.sujet}\n` +
          `Modèle  : ${demande.modele}\n` +
          (demande.pieces?.length
            ? `Pièces  : ${demande.pieces.map((p) => p.nomFichier).join(", ")}\n`
            : "") +
          `─── contenu texte ───\n${texte}\n─────────────────────────\n`,
      );
    }
    return { envoye: false, raison: "non_configure" };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: demande.expediteur ?? process.env.RESEND_FROM_EMAIL!,
      to: demande.destinataire,
      replyTo: demande.repondreA,
      subject: demande.sujet,
      html,
      text: texte,
      attachments: demande.pieces?.map((p) => ({
        filename: p.nomFichier,
        content: p.contenu,
      })),
    });

    if (error) {
      await journaliser("failed", { erreur: error.message });
      return { envoye: false, raison: "erreur_fournisseur" };
    }

    await journaliser("sent", { providerId: data?.id });
    return { envoye: true };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    console.error("[notifications] envoi :", message);
    await journaliser("failed", { erreur: message });
    return { envoye: false, raison: "erreur_fournisseur" };
  }
}

/**
 * Enveloppe à utiliser depuis les Server Actions.
 *
 * Un email raté ne doit jamais empêcher une commande d'aboutir : le client a
 * payé, la commande existe, l'exploitant la voit. On avale donc l'erreur après
 * l'avoir journalisée.
 */
export async function envoyerSansBloquer(demande: DemandeEnvoi): Promise<void> {
  try {
    await envoyerEmail(demande);
  } catch (erreur) {
    console.error("[notifications] échec silencieux :", erreur);
  }
}
