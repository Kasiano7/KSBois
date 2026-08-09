"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Authentification — docs/06 §2.1
 *
 * Deux voies :
 *  • lien magique par email (méthode principale : aucun mot de passe à retenir,
 *    et toute une classe de vulnérabilités disparaît) ;
 *  • mot de passe, pour l'exploitation quotidienne depuis le camion où le
 *    va-et-vient vers la boîte mail est pénible.
 */

export interface ResultatAuth {
  ok: boolean;
  message?: string;
  lienEnvoye?: boolean;
}

const EmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(160),
  suite: z.string().trim().max(300).optional(),
});

const MotDePasseSchema = EmailSchema.extend({
  password: z.string().min(1, "Indiquez votre mot de passe.").max(200),
});

/**
 * Normalise la destination après connexion.
 * ⚠️ On n'accepte QUE des chemins internes : une redirection ouverte
 * permettrait d'envoyer l'utilisateur vers un site tiers depuis notre domaine.
 */
function destinationSure(suite: string | undefined): string {
  if (!suite) return "/admin";
  if (!suite.startsWith("/") || suite.startsWith("//")) return "/admin";
  return suite;
}

export async function connexionParLienMagique(entree: unknown): Promise<ResultatAuth> {
  const parsed = EmailSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const supabase = await createSupabaseServerClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${site}/auth/callback?suite=${encodeURIComponent(
        destinationSure(parsed.data.suite),
      )}`,
      // On ne crée pas de compte à la volée : l'accès à l'administration est
      // accordé par l'ajout à `company_members`, pas par une simple connexion.
      shouldCreateUser: false,
    },
  });

  if (error) {
    console.error("[auth] lien magique :", error.message);
    // Réponse identique en cas d'email inconnu : on n'indique jamais si une
    // adresse existe dans le système.
  }

  return { ok: true, lienEnvoye: true };
}

export async function connexionParMotDePasse(entree: unknown): Promise<ResultatAuth> {
  const parsed = MotDePasseSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Message volontairement indifférencié : ne pas révéler quel élément est faux.
    return { ok: false, message: "Identifiants incorrects." };
  }

  redirect(destinationSure(parsed.data.suite));
}

/**
 * Connexion — ou création de compte — d'un CLIENT, par lien magique.
 *
 * Différence assumée avec `connexionParLienMagique` : ici `shouldCreateUser` est
 * vrai. L'accès à l'administration se mérite par une ligne dans
 * `company_members` ; l'espace client, lui, doit s'ouvrir en un clic à qui
 * possède l'adresse email — c'est tout l'intérêt du lien magique pour une
 * clientèle qui ne veut pas retenir de mot de passe (PLAN.md §2.4).
 *
 * Aucun mot de passe n'est proposé nulle part dans ce parcours.
 */
export async function connexionClient(entree: unknown): Promise<ResultatAuth> {
  const parsed = EmailSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const supabase = await createSupabaseServerClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // La destination reste dans l'espace client : un lien de connexion client ne
  // doit jamais servir de tremplin vers l'administration.
  const suite = parsed.data.suite?.startsWith("/compte") ? parsed.data.suite : "/compte";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${site}/auth/callback?suite=${encodeURIComponent(suite)}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error("[auth] lien magique client :", error.message);
    return {
      ok: false,
      message:
        "L'envoi du lien a échoué. Réessayez dans un instant, ou appelez-nous : nous retrouverons votre commande.",
    };
  }

  return { ok: true, lienEnvoye: true };
}

export async function deconnexion(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
