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
