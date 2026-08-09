import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseAdminClient } from "./supabase/server";
import { getTenant } from "./tenant";

/**
 * Contrôle d'accès serveur — docs/06-SEO-SECURITE-DEPLOIEMENT.md §2.2
 *
 * Règle : toute Server Action et toute page d'administration commence par un
 * appel explicite à `requireRole()`. Aucun contrôle implicite, jamais.
 * La RLS reste la seconde barrière, pas la première.
 */

export type Role = "owner" | "staff" | "driver";

export interface Session {
  userId: string;
  email: string;
  fullName: string | null;
  companyId: string;
  role: Role;
}

/**
 * Session courante, ou null.
 *
 * ⚠️ On utilise `getUser()` et jamais `getSession()` : le contenu de
 * `getSession()` provient du cookie et n'est pas vérifié auprès du serveur
 * d'authentification. Une décision d'autorisation ne se prend jamais dessus.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const tenant = await getTenant();
  if (!tenant) return null;

  // Lecture par le client d'administration : la RLS sur company_members
  // dépendrait de la session, ce qui rendrait le contrôle circulaire.
  const admin = createSupabaseAdminClient();
  const [{ data: membre }, { data: profil }] = await Promise.all([
    admin
      .from("company_members")
      .select("role")
      .eq("company_id", tenant.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  if (!membre) return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profil?.full_name ?? null,
    companyId: tenant.id,
    role: membre.role as Role,
  };
});

/**
 * Exige l'un des rôles fournis. Redirige vers la connexion si absent,
 * vers l'accueil de l'admin si le rôle est insuffisant.
 */
export async function requireRole(roles: Role[], cheminActuel?: string): Promise<Session> {
  const session = await getSession();

  if (!session) {
    const suite = cheminActuel ? `?suite=${encodeURIComponent(cheminActuel)}` : "";
    redirect(`/connexion${suite}`);
  }

  if (!roles.includes(session.role)) {
    redirect("/admin?acces=refuse");
  }

  return session;
}

/** Variante pour les Server Actions : lève une erreur au lieu de rediriger. */
export async function assertRole(roles: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("Non authentifié.");
  if (!roles.includes(session.role)) throw new Error("Droits insuffisants.");
  return session;
}

/** Le rôle `driver` n'accède qu'à sa tournée, jamais au reste de l'admin. */
export function peutVoirAdmin(role: Role): boolean {
  return role === "owner" || role === "staff";
}

// -----------------------------------------------------------------------------
// Espace client — docs/03 §6.4
//
// Un CLIENT n'est pas un membre de l'entreprise : il n'a aucun rôle, il a une
// fiche dans `customers`. Les deux sessions sont donc distinctes, et un client
// authentifié n'obtient jamais le moindre accès à l'administration.
// -----------------------------------------------------------------------------

export interface ClientSession {
  userId: string;
  email: string;
  customerId: string;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
}

/**
 * Session du client connecté, ou `null`.
 *
 * À la toute première visite, la fiche client est créée et les commandes
 * passées EN INVITÉ avec la même adresse lui sont rattachées. Le rattachement
 * s'appuie sur l'email vérifié par Supabase Auth — jamais sur une valeur
 * fournie par le navigateur, sans quoi n'importe qui réclamerait les commandes
 * d'un tiers en saisissant son adresse.
 */
export const getClientSession = cache(async (): Promise<ClientSession | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const tenant = await getTenant();
  if (!tenant) return null;

  const admin = createSupabaseAdminClient();

  const fiche = async () =>
    admin
      .from("customers")
      .select("id, first_name, last_name, phone")
      .eq("company_id", tenant.id)
      .eq("user_id", user.id)
      .maybeSingle();

  let { data: client } = await fiche();

  // Première visite : on crée la fiche et on récupère l'historique invité.
  if (!client) {
    const { error } = await admin.rpc("rattacher_client_au_compte", {
      p_company_id: tenant.id,
      p_user_id: user.id,
      p_email: user.email,
    });
    if (error) {
      console.error("[auth] rattachement du compte client :", error.message);
      return null;
    }
    ({ data: client } = await fiche());
  }

  if (!client) return null;

  return {
    userId: user.id,
    email: user.email,
    customerId: client.id,
    prenom: client.first_name,
    nom: client.last_name,
    telephone: client.phone,
  };
});

/** Exige un client connecté. Redirige vers la connexion client sinon. */
export async function requireClient(cheminActuel?: string): Promise<ClientSession> {
  const session = await getClientSession();
  if (!session) {
    const suite = cheminActuel ? `?suite=${encodeURIComponent(cheminActuel)}` : "";
    redirect(`/compte/connexion${suite}`);
  }
  return session;
}
