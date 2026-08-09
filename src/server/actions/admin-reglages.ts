"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

const texte = (maximum: number) => z.string().trim().max(maximum);
const nombre = (minimum: number, maximum: number) =>
  z.coerce.number().finite().min(minimum).max(maximum);

const eurosEnCentimes = z
  .string()
  .trim()
  .transform((valeur) => Math.round(Number.parseFloat(valeur.replace(",", ".")) * 100))
  .refine((valeur) => Number.isFinite(valeur), "Montant invalide.");

const urlLogo = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (valeur) =>
      valeur === "" ||
      (valeur.startsWith("/") && !valeur.startsWith("//") && !valeur.includes("\\")) ||
      (() => {
        try {
          return new URL(valeur).protocol === "https:";
        } catch {
          return false;
        }
      })(),
    "Le logo doit utiliser une adresse https:// ou un chemin du site commençant par /.",
  );

function valeur(formData: FormData, cle: string): string {
  return String(formData.get(cle) ?? "");
}

function coche(formData: FormData, cle: string): boolean {
  return formData.get(cle) === "on";
}

async function journaliser(
  companyId: string,
  userId: string,
  role: string,
  action: string,
  before: Json | null,
  after: Json,
) {
  await createSupabaseAdminClient().from("audit_log").insert({
    company_id: companyId,
    actor_id: userId,
    actor_role: role,
    action,
    entity_type: "company_settings",
    entity_id: companyId,
    before,
    after,
  });
}

async function upsertReglages(companyId: string, reglages: Record<string, Json>) {
  const supabase = createSupabaseAdminClient();
  const lignes = Object.entries(reglages).map(([key, value]) => ({
    company_id: companyId,
    key,
    value,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("company_settings").upsert(lignes);
  if (error) throw new Error(`Enregistrement des réglages impossible : ${error.message}`);
}

function rafraichirSite() {
  revalidatePath("/admin/reglages");
  revalidatePath("/", "layout");
}

export async function enregistrerEntreprise(formData: FormData): Promise<void> {
  const session = await assertRole(["owner"]);
  const schema = z.object({
    legalName: texte(160),
    siret: texte(20),
    rcs: texte(80),
    vatNumber: texte(30),
    apeCode: texte(20),
    email: z.string().trim().email().max(160),
    phone: texte(30),
    phoneDisplay: texte(40),
    addressLine1: texte(200),
    postalCode: texte(10),
    city: texte(120),
    depotLat: z.union([z.literal(""), nombre(-90, 90)]),
    depotLng: z.union([z.literal(""), nombre(-180, 180)]),
  });
  const data = schema.parse({
    legalName: valeur(formData, "legalName"),
    siret: valeur(formData, "siret"),
    rcs: valeur(formData, "rcs"),
    vatNumber: valeur(formData, "vatNumber"),
    apeCode: valeur(formData, "apeCode"),
    email: valeur(formData, "email"),
    phone: valeur(formData, "phone"),
    phoneDisplay: valeur(formData, "phoneDisplay"),
    addressLine1: valeur(formData, "addressLine1"),
    postalCode: valeur(formData, "postalCode"),
    city: valeur(formData, "city"),
    depotLat: valeur(formData, "depotLat"),
    depotLng: valeur(formData, "depotLng"),
  });

  const supabase = createSupabaseAdminClient();
  const { data: avant } = await supabase
    .from("companies")
    .select("legal_name, siret, rcs, vat_number, ape_code, email, phone, phone_display, address_line1, postal_code, city, depot_lat, depot_lng")
    .eq("id", session.companyId)
    .single();

  const apres = {
    legal_name: data.legalName || null,
    siret: data.siret || null,
    rcs: data.rcs || null,
    vat_number: data.vatNumber || null,
    ape_code: data.apeCode || null,
    email: data.email,
    phone: data.phone || null,
    phone_display: data.phoneDisplay || null,
    address_line1: data.addressLine1 || null,
    postal_code: data.postalCode || null,
    city: data.city || null,
    depot_lat: data.depotLat === "" ? null : data.depotLat,
    depot_lng: data.depotLng === "" ? null : data.depotLng,
  };
  const { error } = await supabase.from("companies").update(apres).eq("id", session.companyId);
  if (error) throw new Error(`Enregistrement de l'entreprise impossible : ${error.message}`);
  await journaliser(session.companyId, session.userId, session.role, "settings.company_updated", avant as Json, apres);
  rafraichirSite();
  redirect("/admin/reglages?enregistre=entreprise#entreprise");
}

export async function enregistrerApparence(formData: FormData): Promise<void> {
  const session = await assertRole(["owner"]);
  const schema = z.object({
    name: texte(120).min(2),
    tagline: texte(120),
    logoUrl: urlLogo,
    ecorce: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    aubier: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    sapin: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    braise: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    braiseTexte: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    seve: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  });
  const data = schema.parse({
    name: valeur(formData, "name"),
    tagline: valeur(formData, "tagline"),
    logoUrl: valeur(formData, "logoUrl"),
    ecorce: valeur(formData, "ecorce"),
    aubier: valeur(formData, "aubier"),
    sapin: valeur(formData, "sapin"),
    braise: valeur(formData, "braise"),
    braiseTexte: valeur(formData, "braiseTexte"),
    seve: valeur(formData, "seve"),
  });

  const supabase = createSupabaseAdminClient();
  const tokens = {
    ecorce: data.ecorce,
    aubier: data.aubier,
    sapin: data.sapin,
    braise: data.braise,
    "braise-texte": data.braiseTexte,
    seve: data.seve,
  };
  const [{ error: erreurEntreprise }, { error: erreurTheme }] = await Promise.all([
    supabase.from("companies").update({ name: data.name }).eq("id", session.companyId),
    supabase.from("company_themes").upsert({
      company_id: session.companyId,
      tokens,
      updated_at: new Date().toISOString(),
    }),
  ]);
  if (erreurEntreprise || erreurTheme) {
    throw new Error(`Enregistrement de l'apparence impossible : ${erreurEntreprise?.message ?? erreurTheme?.message}`);
  }
  await upsertReglages(session.companyId, {
    "branding.tagline": data.tagline,
    "branding.logo_url": data.logoUrl,
  });
  await journaliser(session.companyId, session.userId, session.role, "settings.branding_updated", null, {
    name: data.name,
    tagline: data.tagline,
    logo_url: data.logoUrl,
    tokens,
  });
  rafraichirSite();
  redirect("/admin/reglages?enregistre=apparence#apparence");
}

export async function enregistrerCommandes(formData: FormData): Promise<void> {
  const session = await assertRole(["owner"]);
  const schema = z.object({
    leadTimeDays: nombre(0, 90),
    bookingHorizonDays: nombre(1, 365),
    minAmountCents: eurosEnCentimes.pipe(z.number().min(0).max(1_000_000)),
    minVolumeM3: nombre(0, 100),
    stackingPriceCents: eurosEnCentimes.pipe(z.number().min(0).max(100_000)),
  });
  const data = schema.parse({
    leadTimeDays: valeur(formData, "leadTimeDays"),
    bookingHorizonDays: valeur(formData, "bookingHorizonDays"),
    minAmountCents: valeur(formData, "minAmountEuros"),
    minVolumeM3: valeur(formData, "minVolumeM3"),
    stackingPriceCents: valeur(formData, "stackingPriceEuros"),
  });

  await upsertReglages(session.companyId, {
    "order.lead_time_days": data.leadTimeDays,
    "order.booking_horizon_days": data.bookingHorizonDays,
    "order.min_amount_cents": data.minAmountCents,
    "order.min_volume_m3": data.minVolumeM3,
  });
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("product_options").upsert(
    {
      company_id: session.companyId,
      code: "rangement",
      name: "Rangement du bois",
      description: "Bois transporté et rangé à l'emplacement indiqué par le client.",
      price_cents: data.stackingPriceCents,
      price_type: "per_m3",
      vat_rate: 20,
      applies_to: "order",
      is_active: coche(formData, "stackingEnabled"),
    },
    { onConflict: "company_id,code" },
  );
  if (error) throw new Error(`Enregistrement du rangement impossible : ${error.message}`);
  await journaliser(session.companyId, session.userId, session.role, "settings.orders_updated", null, {
    ...data,
    stackingEnabled: coche(formData, "stackingEnabled"),
  });
  rafraichirSite();
  redirect("/admin/reglages?enregistre=commandes#commandes");
}

export async function enregistrerPaiementFacturation(formData: FormData): Promise<void> {
  const session = await assertRole(["owner"]);
  const schema = z.object({
    cashLimitCents: eurosEnCentimes.pipe(z.number().min(0).max(10_000_000)),
    depositPercent: nombre(0, 100),
    depositTriggerVolumeM3: nombre(0, 500),
    depositTriggerKm: nombre(0, 1000),
    invoicePrefix: texte(20),
    invoiceFooter: texte(1000),
    quoteDisclaimer: texte(1500),
    vatMode: z.enum(["assujetti", "franchise_en_base"]),
  });
  const data = schema.parse({
    cashLimitCents: valeur(formData, "cashLimitEuros"),
    depositPercent: valeur(formData, "depositPercent"),
    depositTriggerVolumeM3: valeur(formData, "depositTriggerVolumeM3"),
    depositTriggerKm: valeur(formData, "depositTriggerKm"),
    invoicePrefix: valeur(formData, "invoicePrefix"),
    invoiceFooter: valeur(formData, "invoiceFooter"),
    quoteDisclaimer: valeur(formData, "quoteDisclaimer"),
    vatMode: valeur(formData, "vatMode"),
  });
  const enabledMethods = ["card", "cash", "check", "transfer", "sumup"].filter((methode) =>
    coche(formData, `payment_${methode}`),
  );
  if (enabledMethods.length === 0) throw new Error("Activez au moins un moyen de paiement.");

  await upsertReglages(session.companyId, {
    "payment.enabled_methods": enabledMethods,
    "payment.cash_limit_cents": data.cashLimitCents,
    "payment.deposit_percent": data.depositPercent,
    "payment.deposit_trigger_volume_m3": data.depositTriggerVolumeM3,
    "payment.deposit_trigger_km": data.depositTriggerKm,
    "invoice.prefix": data.invoicePrefix,
    "invoice.footer": data.invoiceFooter,
    "quote.disclaimer": data.quoteDisclaimer,
  });
  const { error } = await createSupabaseAdminClient()
    .from("companies")
    .update({ vat_mode: data.vatMode })
    .eq("id", session.companyId);
  if (error) throw new Error(`Enregistrement de la TVA impossible : ${error.message}`);
  await journaliser(session.companyId, session.userId, session.role, "settings.payment_updated", null, {
    ...data,
    enabledMethods,
  });
  rafraichirSite();
  redirect("/admin/reglages?enregistre=paiement#paiement");
}

export async function enregistrerNotificationsLegal(formData: FormData): Promise<void> {
  const session = await assertRole(["owner"]);
  const schema = z.object({
    senderName: texte(120),
    copyEmail: z.union([z.literal(""), z.string().trim().email().max(160)]),
    digestTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),
    cgvVersion: texte(40),
    cgvUrl: urlLogo,
    privacyUrl: urlLogo,
  });
  const data = schema.parse({
    senderName: valeur(formData, "senderName"),
    copyEmail: valeur(formData, "copyEmail"),
    digestTime: valeur(formData, "digestTime"),
    cgvVersion: valeur(formData, "cgvVersion"),
    cgvUrl: valeur(formData, "cgvUrl"),
    privacyUrl: valeur(formData, "privacyUrl"),
  });
  await upsertReglages(session.companyId, {
    "notifications.sender_name": data.senderName,
    "notifications.copy_email": data.copyEmail,
    "notifications.digest_time": data.digestTime,
    "notifications.order_created": coche(formData, "notifyOrderCreated"),
    "notifications.payment_failed": coche(formData, "notifyPaymentFailed"),
    "notifications.low_stock": coche(formData, "notifyLowStock"),
    "legal.cgv_version": data.cgvVersion,
    "legal.cgv_url": data.cgvUrl,
    "legal.privacy_url": data.privacyUrl,
  });
  await journaliser(session.companyId, session.userId, session.role, "settings.notifications_legal_updated", null, data);
  rafraichirSite();
  redirect("/admin/reglages?enregistre=notifications#notifications");
}

const FEATURE_KEYS = [
  "pellets",
  "kindling",
  "pallets",
  "nets",
  "pickup",
  "services",
  "promotions",
  "sms",
  "quotes",
  "fuel_surcharge",
  "route_optimization",
  "blog",
  "needs_calculator",
] as const;

export async function enregistrerFonctionnalites(formData: FormData): Promise<void> {
  const session = await assertRole(["owner"]);
  const features = Object.fromEntries(
    FEATURE_KEYS.map((cle) => [cle, coche(formData, `feature_${cle}`)]),
  );
  const { error } = await createSupabaseAdminClient()
    .from("company_features")
    .upsert({ company_id: session.companyId, ...features });
  if (error) throw new Error(`Enregistrement des fonctionnalités impossible : ${error.message}`);
  await journaliser(session.companyId, session.userId, session.role, "settings.features_updated", null, features);
  rafraichirSite();
  redirect("/admin/reglages?enregistre=fonctionnalites#fonctionnalites");
}
