"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureCart } from "@/server/panier";
import { uuidLike } from "@/lib/validation";
import type { Json } from "@/lib/supabase/database.types";

export interface ResultatClientAdmin {
  ok: boolean;
  message?: string;
  redirection?: string;
}

const ClientSchema = z.object({
  clientId: uuidLike,
  firstName: z.string().trim().max(80),
  lastName: z.string().trim().max(80),
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(160),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((valeur) => valeur === "" || valeur.replace(/\D/g, "").length >= 9, "Téléphone incomplet."),
  customerType: z.enum(["particulier", "professionnel"]),
  isCompany: z.boolean().default(false),
  companyName: z.string().trim().max(160),
  siret: z.string().trim().max(20),
  vatNumber: z.string().trim().max(30),
  acceptsMarketing: z.boolean().default(false),
});

async function journaliser(
  companyId: string,
  userId: string,
  role: string,
  action: string,
  entityId: string,
  before: Json | null,
  after: Json | null,
) {
  await createSupabaseAdminClient().from("audit_log").insert({
    company_id: companyId,
    actor_id: userId,
    actor_role: role,
    action,
    entity_type: "customer",
    entity_id: entityId,
    before,
    after,
  });
}

export async function modifierClient(entree: unknown): Promise<ResultatClientAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = ClientSchema.safeParse(entree);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: client } = await supabase
    .from("customers")
    .select("id, email, user_id, anonymized_at")
    .eq("company_id", session.companyId)
    .eq("id", d.clientId)
    .maybeSingle();
  if (!client) return { ok: false, message: "Client introuvable." };
  if (client.anonymized_at) return { ok: false, message: "Une fiche anonymisée n'est plus modifiable." };
  if (client.user_id && client.email.toLowerCase() !== d.email) {
    return {
      ok: false,
      message: "Ce client possède un compte. Son e-mail d'identification ne peut pas être changé ici.",
    };
  }

  const apres = {
    first_name: d.firstName || null,
    last_name: d.lastName || null,
    email: d.email,
    phone: d.phone || null,
    customer_type: d.customerType,
    is_company: d.isCompany,
    company_name: d.isCompany ? d.companyName || null : null,
    siret: d.isCompany ? d.siret || null : null,
    vat_number: d.isCompany ? d.vatNumber || null : null,
    accepts_marketing: d.acceptsMarketing,
  };
  const { error } = await supabase
    .from("customers")
    .update(apres)
    .eq("company_id", session.companyId)
    .eq("id", d.clientId);
  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "Cette adresse email appartient déjà à une autre fiche." : "Enregistrement impossible.",
    };
  }
  await journaliser(session.companyId, session.userId, session.role, "customer.updated", d.clientId, null, apres);
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${d.clientId}`);
  return { ok: true, message: "Coordonnées enregistrées." };
}

const NotesSchema = z.object({ clientId: uuidLike, notes: z.string().trim().max(5000) });

export async function enregistrerNotesClient(entree: unknown): Promise<ResultatClientAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = NotesSchema.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Notes trop longues." };
  const { error } = await createSupabaseAdminClient()
    .from("customers")
    .update({ internal_notes: parsed.data.notes || null })
    .eq("company_id", session.companyId)
    .eq("id", parsed.data.clientId)
    .is("anonymized_at", null);
  if (error) return { ok: false, message: "Enregistrement impossible." };
  await journaliser(
    session.companyId,
    session.userId,
    session.role,
    "customer.notes_updated",
    parsed.data.clientId,
    null,
    { has_notes: parsed.data.notes.length > 0 },
  );
  revalidatePath(`/admin/clients/${parsed.data.clientId}`);
  return { ok: true, message: "Notes enregistrées." };
}

const BlocageSchema = z.object({
  clientId: uuidLike,
  blocked: z.boolean(),
  reason: z.string().trim().max(500),
});

export async function definirBlocageClient(entree: unknown): Promise<ResultatClientAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = BlocageSchema.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };
  if (parsed.data.blocked && parsed.data.reason.length < 3) {
    return { ok: false, message: "Indiquez pourquoi ce client est bloqué." };
  }
  const { error } = await createSupabaseAdminClient()
    .from("customers")
    .update({
      is_blocked: parsed.data.blocked,
      blocked_reason: parsed.data.blocked ? parsed.data.reason : null,
    })
    .eq("company_id", session.companyId)
    .eq("id", parsed.data.clientId)
    .is("anonymized_at", null);
  if (error) return { ok: false, message: "Mise à jour impossible." };
  await journaliser(
    session.companyId,
    session.userId,
    session.role,
    parsed.data.blocked ? "customer.blocked" : "customer.unblocked",
    parsed.data.clientId,
    null,
    { blocked: parsed.data.blocked, reason: parsed.data.blocked ? parsed.data.reason : null },
  );
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${parsed.data.clientId}`);
  return { ok: true, message: parsed.data.blocked ? "Client bloqué." : "Client débloqué." };
}

const FusionSchema = z.object({ sourceId: uuidLike, targetId: uuidLike });

export async function fusionnerClients(entree: unknown): Promise<ResultatClientAdmin> {
  const session = await assertRole(["owner"]);
  const parsed = FusionSchema.safeParse(entree);
  if (!parsed.success || parsed.data.sourceId === parsed.data.targetId) {
    return { ok: false, message: "Choisissez une autre fiche client." };
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("merge_customers", {
    p_company_id: session.companyId,
    p_source_id: parsed.data.sourceId,
    p_target_id: parsed.data.targetId,
  });
  if (error) return { ok: false, message: error.message };
  await journaliser(
    session.companyId,
    session.userId,
    session.role,
    "customer.merged",
    parsed.data.sourceId,
    { source_id: parsed.data.sourceId },
    { target_id: parsed.data.targetId },
  );
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${parsed.data.targetId}`);
  return {
    ok: true,
    message: "Les deux fiches ont été fusionnées.",
    redirection: `/admin/clients/${parsed.data.targetId}`,
  };
}

const AnonymisationSchema = z.object({
  clientId: uuidLike,
  confirmation: z.literal("ANONYMISER"),
});

export async function anonymiserClient(entree: unknown): Promise<ResultatClientAdmin> {
  const session = await assertRole(["owner"]);
  const parsed = AnonymisationSchema.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Saisissez exactement ANONYMISER." };
  const supabase = createSupabaseAdminClient();
  const { data: avant } = await supabase
    .from("customers")
    .select("id, user_id")
    .eq("company_id", session.companyId)
    .eq("id", parsed.data.clientId)
    .maybeSingle();
  if (!avant) return { ok: false, message: "Client introuvable." };
  const { error } = await supabase.rpc("anonymize_customer", {
    p_company_id: session.companyId,
    p_customer_id: parsed.data.clientId,
  });
  if (error) return { ok: false, message: error.message };
  // Aucune donnée personnelle n'est recopiée dans l'audit : le droit à l'effacement
  // serait sinon contredit par notre propre journal technique.
  await journaliser(
    session.companyId,
    session.userId,
    session.role,
    "customer.anonymized",
    parsed.data.clientId,
    { had_account: avant.user_id !== null },
    { anonymized: true },
  );
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${parsed.data.clientId}`);
  return { ok: true, message: "Les données personnelles ont été anonymisées." };
}

export async function preparerCommandeClient(entree: unknown): Promise<ResultatClientAdmin> {
  const session = await assertRole(["owner", "staff"]);
  const parsed = z.object({ clientId: uuidLike }).safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Client invalide." };
  const supabase = createSupabaseAdminClient();
  const [{ data: client }, { data: adresse }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, email, phone, first_name, last_name, is_blocked, blocked_reason, anonymized_at")
      .eq("company_id", session.companyId)
      .eq("id", parsed.data.clientId)
      .maybeSingle(),
    supabase
      .from("addresses")
      .select("*")
      .eq("company_id", session.companyId)
      .eq("customer_id", parsed.data.clientId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!client) return { ok: false, message: "Client introuvable." };
  if (client.anonymized_at) return { ok: false, message: "Cette fiche est anonymisée." };
  if (client.is_blocked) {
    return { ok: false, message: `Client bloqué${client.blocked_reason ? ` : ${client.blocked_reason}` : "."}` };
  }

  const cartId = await ensureCart(session.companyId);
  await supabase.from("cart_items").delete().eq("cart_id", cartId);
  const { error } = await supabase
    .from("carts")
    .update({
      customer_id: client.id,
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email,
      phone: client.phone,
      fulfillment_type: "delivery",
      address_line1: adresse?.line1 ?? null,
      address_line2: adresse?.line2 ?? null,
      postal_code: adresse?.postal_code ?? null,
      city: adresse?.city ?? null,
      truck_access: adresse?.truck_access ?? "camion",
      unload_type: adresse?.unload_type ?? null,
      allow_unattended_delivery: adresse?.allow_unattended_delivery ?? false,
      access_notes: adresse?.access_notes ?? null,
      delivery_notes: null,
      slot_id: null,
      step: "cart",
    })
    .eq("id", cartId)
    .eq("company_id", session.companyId);
  if (error) return { ok: false, message: "La commande n'a pas pu être préparée." };

  (await cookies()).set("commande_admin", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  revalidatePath("/");
  return {
    ok: true,
    message: "Le client est prérempli. Choisissez maintenant son bois.",
    redirection: "/#commander",
  };
}
