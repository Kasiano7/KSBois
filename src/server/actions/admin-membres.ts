"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { uuidLike } from "@/lib/validation";
import { ROLES_ADMIN } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { gerantsRestants } from "@/server/membres";
import { envoyerSansBloquer } from "@/server/notifications";
import { InvitationEquipe } from "@/emails/invitation-equipe";
import type { ResultatAdmin } from "./admin-commandes";

/**
 * Gestion des utilisateurs de l'entreprise — réservée au GÉRANT.
 *
 * Donner accès à l'administration, c'est donner accès au chiffre d'affaires, aux
 * clients et aux tarifs. Aucune de ces actions n'est ouverte au secrétariat.
 *
 * ⚠️ Deux garde-fous non négociables, tous deux testés :
 *  1. l'entreprise conserve toujours au moins un gérant ;
 *  2. personne ne peut se retirer soi-même — la seule façon de partir est
 *     qu'un autre gérant vous retire, ce qui laisse une trace et un responsable.
 */

const InvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(200),
  role: z.enum(ROLES_ADMIN),
});

export async function inviterMembre(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner"]);
  const parsed = InvitationSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Requête invalide." };
  }

  const { email, role } = parsed.data;
  const supabase = createSupabaseAdminClient();
  const tenant = await requireTenant();

  // Déjà membre ? On le dit clairement plutôt que de créer une invitation
  // fantôme qui ne sera jamais consommée.
  const { data: profil } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profil) {
    const { data: dejaMembre } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", session.companyId)
      .eq("user_id", profil.id)
      .maybeSingle();

    if (dejaMembre) {
      return { ok: false, message: `${email} fait déjà partie de l'équipe.` };
    }
  }

  const { error } = await supabase.from("company_invitations").insert({
    company_id: session.companyId,
    email,
    role,
    invited_by: session.userId,
  });

  if (error) {
    // 23505 : l'index partiel `company_invitations_une_vivante` a arbitré.
    if (error.code === "23505") {
      return { ok: false, message: `${email} a déjà une invitation en attente.` };
    }
    console.error("[membres] invitation :", error.message);
    return { ok: false, message: "L'invitation n'a pas pu être créée." };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await envoyerSansBloquer({
    companyId: session.companyId,
    destinataire: email,
    sujet: `Vous êtes invité à rejoindre l'administration de ${tenant.name}`,
    modele: "invitation_equipe",
    contenu: InvitationEquipe({
      entreprise: tenant.name,
      invitePar: session.fullName ?? session.email,
      role,
      lienConnexion: `${site}/connexion`,
    }),
  });

  revalidatePath("/admin/reglages");
  return { ok: true, message: `Invitation envoyée à ${email}.` };
}

export async function revoquerInvitation(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner"]);
  const parsed = z.object({ invitationId: uuidLike }).safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const { error } = await createSupabaseAdminClient()
    .from("company_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("company_id", session.companyId)
    .eq("id", parsed.data.invitationId)
    .is("accepted_at", null);

  if (error) {
    console.error("[membres] révocation :", error.message);
    return { ok: false, message: "L'invitation n'a pas pu être annulée." };
  }

  revalidatePath("/admin/reglages");
  return { ok: true, message: "Invitation annulée." };
}

export async function changerRoleMembre(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner"]);
  const parsed = z.object({ userId: uuidLike, role: z.enum(ROLES_ADMIN) }).safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const { userId, role } = parsed.data;

  if (userId === session.userId && role !== "owner") {
    return {
      ok: false,
      message:
        "Vous ne pouvez pas vous retirer vos propres droits de gérant. " +
        "Demandez à un autre gérant de le faire.",
    };
  }

  if (role !== "owner" && (await gerantsRestants(session.companyId, userId)) === 0) {
    return {
      ok: false,
      message:
        "L'entreprise doit garder au moins un gérant. Nommez d'abord quelqu'un d'autre gérant.",
    };
  }

  const { error } = await createSupabaseAdminClient()
    .from("company_members")
    .update({ role })
    .eq("company_id", session.companyId)
    .eq("user_id", userId);

  if (error) {
    console.error("[membres] changement de rôle :", error.message);
    return { ok: false, message: "Le rôle n'a pas pu être modifié." };
  }

  revalidatePath("/admin/reglages");
  return { ok: true, message: "Rôle modifié." };
}

export async function retirerMembre(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner"]);
  const parsed = z.object({ userId: uuidLike }).safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const { userId } = parsed.data;

  if (userId === session.userId) {
    return {
      ok: false,
      message: "Vous ne pouvez pas vous retirer vous-même de l'équipe.",
    };
  }

  if ((await gerantsRestants(session.companyId, userId)) === 0) {
    return {
      ok: false,
      message: "L'entreprise doit garder au moins un gérant.",
    };
  }

  const { error } = await createSupabaseAdminClient()
    .from("company_members")
    .delete()
    .eq("company_id", session.companyId)
    .eq("user_id", userId);

  if (error) {
    console.error("[membres] retrait :", error.message);
    return { ok: false, message: "L'accès n'a pas pu être retiré." };
  }

  revalidatePath("/admin/reglages");
  return { ok: true, message: "Accès retiré." };
}
