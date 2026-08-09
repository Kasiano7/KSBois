import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { createSupabaseAdminClient, isSupabaseConfigured } from "./supabase/server";

/**
 * Résolution du tenant — docs/01-ARCHITECTURE.md §4.3
 *
 * Une seule entreprise est active aujourd'hui, mais AUCUNE requête ne s'exécute
 * sans `company_id` explicite. C'est ce qui rendra la bascule multi-entreprises
 * gratuite le jour venu (PLAN.md §5.3).
 */

export interface TenantTheme {
  tokens: Record<string, string>;
  fontDisplay: string;
  fontBody: string;
}

export interface TenantFeatures {
  pellets: boolean;
  kindling: boolean;
  pallets: boolean;
  nets: boolean;
  pickup: boolean;
  services: boolean;
  promotions: boolean;
  sms: boolean;
  quotes: boolean;
  fuelSurcharge: boolean;
  routeOptimization: boolean;
  blog: boolean;
  needsCalculator: boolean;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  email: string;
  phone: string | null;
  phoneDisplay: string | null;
  postalCode: string | null;
  city: string | null;
  vatMode: "assujetti" | "franchise_en_base";
  pricingBasis: "map_delivered" | "stere_1m_equivalent";
  theme: TenantTheme;
  features: TenantFeatures;
}

const DEFAULT_FEATURES: TenantFeatures = {
  pellets: false,
  kindling: true,
  pallets: false,
  nets: false,
  pickup: true,
  services: false,
  promotions: true,
  sms: false,
  quotes: true,
  fuelSurcharge: true,
  routeOptimization: false,
  blog: true,
  needsCalculator: true,
};

/**
 * Résout l'entreprise à partir du nom de domaine de la requête.
 *
 * `cache()` mémorise le résultat pour la durée du rendu : une seule requête
 * base par requête HTTP, quel que soit le nombre de composants qui l'appellent.
 */
export const getTenant = cache(async (): Promise<Tenant | null> => {
  // La résolution dépend du domaine de la requête. En particulier, elle ne
  // doit jamais s'exécuter pendant le prerender Vercel, où aucun domaine client
  // réel n'est disponible.
  await connection();
  if (!isSupabaseConfigured()) return null;
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const hostname = host.split(":")[0];

  const supabase = createSupabaseAdminClient();

  // On tente d'abord l'hôte complet (avec port, utile en local), puis sans.
  const { data: domains, error: domainError } = await supabase
    .from("company_domains")
    .select("company_id, hostname")
    .in("hostname", [host, hostname]);

  if (domainError) {
    console.error("[tenant] lecture company_domains :", domainError.message);
  }

  let companyId = domains?.find((d) => d.hostname === host)?.company_id;
  companyId ??= domains?.find((d) => d.hostname === hostname)?.company_id;

  // Repli mono-entreprise : si un seul tenant existe, on le sert quel que soit
  // le domaine. Évite de casser les environnements de préversion (*.vercel.app).
  if (!companyId) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id")
      .eq("is_active", true)
      .limit(2);
    if (companies?.length === 1) companyId = companies[0].id;
  }

  if (!companyId) {
    console.error(
      `[tenant] aucune entreprise pour l'hôte « ${host} ». ` +
        `Domaines connus : ${domains?.map((d) => d.hostname).join(", ") || "aucun"}.`,
    );
    return null;
  }

  const [
    { data: company, error: companyError },
    { data: theme },
    { data: features },
    { data: branding },
  ] =
    await Promise.all([
      supabase.from("companies").select("*").eq("id", companyId).single(),
      supabase.from("company_themes").select("*").eq("company_id", companyId).maybeSingle(),
      supabase.from("company_features").select("*").eq("company_id", companyId).maybeSingle(),
      supabase
        .from("company_settings")
        .select("key, value")
        .eq("company_id", companyId)
        .in("key", ["branding.tagline", "branding.logo_url"]),
    ]);

  if (companyError) console.error("[tenant] lecture companies :", companyError.message);
  if (!company) return null;

  const valeurMarque = (cle: string): string | null => {
    const brut = branding?.find((ligne) => ligne.key === cle)?.value;
    return typeof brut === "string" && brut.trim() ? brut.trim() : null;
  };

  return {
    id: company.id,
    slug: company.slug,
    name: company.name,
    tagline: valeurMarque("branding.tagline") ?? "Bois de chauffage",
    logoUrl: valeurMarque("branding.logo_url"),
    email: company.email,
    phone: company.phone,
    phoneDisplay: company.phone_display,
    postalCode: company.postal_code,
    city: company.city,
    vatMode: company.vat_mode as Tenant["vatMode"],
    pricingBasis: company.pricing_basis as Tenant["pricingBasis"],
    theme: {
      tokens: (theme?.tokens as Record<string, string> | null) ?? {},
      fontDisplay: theme?.font_display ?? "Fraunces",
      fontBody: theme?.font_body ?? "Archivo",
    },
    features: features
      ? {
          pellets: features.pellets,
          kindling: features.kindling,
          pallets: features.pallets,
          nets: features.nets,
          pickup: features.pickup,
          services: features.services,
          promotions: features.promotions,
          sms: features.sms,
          quotes: features.quotes,
          fuelSurcharge: features.fuel_surcharge,
          routeOptimization: features.route_optimization,
          blog: features.blog,
          needsCalculator: features.needs_calculator,
        }
      : DEFAULT_FEATURES,
  };
});

/** Variante stricte : lève une exception si le tenant est introuvable. */
export async function requireTenant(): Promise<Tenant> {
  const tenant = await getTenant();
  if (!tenant) {
    throw new Error(
      "Aucune entreprise résolue pour ce domaine. Vérifiez la table company_domains.",
    );
  }
  return tenant;
}

/**
 * Traduit les tokens de thème en déclarations CSS injectables.
 * Changer d'entreprise = changer ces quelques valeurs (docs/03 §2.3).
 */
export function themeToCss(theme: TenantTheme): string {
  const entries = Object.entries(theme.tokens);
  if (entries.length === 0) return "";
  const declarations = entries
    // On n'accepte que des noms de token et des couleurs bien formés : ces
    // valeurs viennent de la base et sont injectées dans une balise <style>.
    .filter(([key, value]) => /^[a-z0-9-]+$/i.test(key) && /^#[0-9a-f]{3,8}$/i.test(value))
    .map(([key, value]) => `--${key}:${value}`)
    .join(";");
  return declarations ? `:root{${declarations}}` : "";
}
