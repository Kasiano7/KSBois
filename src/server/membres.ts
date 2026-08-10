import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { RoleMembre } from "@/lib/roles";

/**
 * Utilisateurs de l'entreprise — docs/05 §1.
 *
 * Trois rôles, et la distinction compte :
 *  • `owner`   — le gérant : argent, réglages, facturation, utilisateurs ;
 *  • `staff`   — le secrétariat : commandes, stock, devis, clients ;
 *  • `driver`  — le livreur : tournée du jour et bons de livraison.
 *
 * ⚠️ Une entreprise doit toujours conserver au moins un gérant. Sans ce
 * garde-fou, un gérant peut se rétrograder lui-même et rendre les réglages,
 * la facturation et la gestion des utilisateurs définitivement inaccessibles —
 * il faudrait alors repasser par la base.
 */

export interface Membre {
  userId: string;
  email: string;
  nomComplet: string | null;
  role: RoleMembre;
  depuis: string;
  /** Vrai pour la personne connectée : l'écran l'empêche de se retirer seule. */
  estMoi: boolean;
}

export interface Invitation {
  id: string;
  email: string;
  role: RoleMembre;
  creeeLe: string;
  expireLe: string;
  expiree: boolean;
}

export async function listerMembres(companyId: string, moi: string): Promise<Membre[]> {
  const supabase = createSupabaseAdminClient();

  const { data: liens, error } = await supabase
    .from("company_members")
    .select("user_id, role, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[membres] liste :", error.message);
    return [];
  }

  const identifiants = (liens ?? []).map((lien) => lien.user_id);
  const { data: profils } = identifiants.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", identifiants)
    : { data: [] };

  const profilPar = new Map((profils ?? []).map((profil) => [profil.id, profil]));

  return (liens ?? []).map((lien) => {
    const profil = profilPar.get(lien.user_id);
    return {
      userId: lien.user_id,
      email: profil?.email ?? "adresse inconnue",
      nomComplet: profil?.full_name ?? null,
      role: lien.role as RoleMembre,
      depuis: lien.created_at,
      estMoi: lien.user_id === moi,
    };
  });
}

export async function listerInvitations(companyId: string): Promise<Invitation[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("company_invitations")
    .select("id, email, role, created_at, expires_at")
    .eq("company_id", companyId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[membres] invitations :", error.message);
    return [];
  }

  const maintenant = Date.now();
  return (data ?? []).map((ligne) => ({
    id: ligne.id,
    email: ligne.email,
    role: ligne.role as RoleMembre,
    creeeLe: ligne.created_at,
    expireLe: ligne.expires_at,
    expiree: new Date(ligne.expires_at).getTime() < maintenant,
  }));
}

/** Nombre de gérants restants si l'on retirait ou rétrogradait `sauf`. */
export async function gerantsRestants(companyId: string, sauf?: string): Promise<number> {
  const { data } = await createSupabaseAdminClient()
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("role", "owner");

  return (data ?? []).filter((membre) => membre.user_id !== sauf).length;
}
