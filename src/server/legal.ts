import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getRawSettings } from "./reglages";

/**
 * Identité légale de l'entreprise, pour les pages CGV, mentions et cie.
 *
 * ⚠️ Tout vient de la BASE et rien n'est écrit en dur : ces pages doivent
 * rester justes quand l'entreprise change de raison sociale, de SIRET ou de
 * régime de TVA — et quand une seconde entreprise arrive sur la plateforme.
 *
 * ⚠️ Les textes de ces pages sont des textes de départ, écrits pour être
 * exacts au regard de ce que le site fait réellement. **Ils doivent être relus
 * par un juriste avant l'ouverture des ventes** (docs/07, hors développement).
 */

export interface DonneesLegales {
  nom: string;
  raisonSociale: string;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  siret: string | null;
  rcs: string | null;
  apeCode: string | null;
  numeroTva: string | null;
  email: string;
  telephone: string | null;
  assujettiTva: boolean;
  versionCgv: string;
  /** Modes de paiement réellement proposés : les CGV ne promettent pas plus. */
  moyensPaiement: string[];
  plafondEspecesCents: number;
  acomptePourcent: number;
  delaiCommandeJours: number;
}

const LIBELLES_PAIEMENT: Record<string, string> = {
  card: "carte bancaire en ligne",
  cash: "espèces à la livraison",
  check: "chèque à la livraison",
  transfer: "virement bancaire",
  sumup: "carte bancaire au terminal du livreur",
};

function nombre(valeur: unknown, repli: number): number {
  return typeof valeur === "number" && Number.isFinite(valeur) ? valeur : repli;
}

export async function getDonneesLegales(companyId: string): Promise<DonneesLegales | null> {
  const [{ data: entreprise }, reglages] = await Promise.all([
    createSupabaseAdminClient().from("companies").select("*").eq("id", companyId).maybeSingle(),
    getRawSettings(companyId),
  ]);

  if (!entreprise) return null;

  const methodes = Array.isArray(reglages["payment.enabled_methods"])
    ? (reglages["payment.enabled_methods"] as string[])
    : ["cash", "check", "transfer", "card"];

  return {
    nom: entreprise.name,
    raisonSociale: entreprise.legal_name ?? entreprise.name,
    adresse: entreprise.address_line1,
    codePostal: entreprise.postal_code,
    ville: entreprise.city,
    siret: entreprise.siret,
    rcs: entreprise.rcs,
    apeCode: entreprise.ape_code,
    numeroTva: entreprise.vat_number,
    email: entreprise.email,
    telephone: entreprise.phone_display ?? entreprise.phone,
    assujettiTva: entreprise.vat_mode === "assujetti",
    versionCgv:
      typeof reglages["legal.cgv_version"] === "string"
        ? (reglages["legal.cgv_version"] as string)
        : "1",
    moyensPaiement: methodes
      .map((methode) => LIBELLES_PAIEMENT[methode])
      .filter((libelle): libelle is string => Boolean(libelle)),
    plafondEspecesCents: nombre(reglages["payment.cash_limit_cents"], 100_000),
    acomptePourcent: nombre(reglages["payment.deposit_percent"], 30),
    delaiCommandeJours: nombre(reglages["order.lead_time_days"], 3),
  };
}

/** Bloc d'identification, identique sur les quatre pages légales. */
export function lignesIdentification(legales: DonneesLegales): string[] {
  return [
    legales.raisonSociale,
    [legales.adresse, [legales.codePostal, legales.ville].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
    legales.siret ? `SIRET ${legales.siret}` : null,
    legales.rcs ? `RCS ${legales.rcs}` : null,
    legales.apeCode ? `Code APE ${legales.apeCode}` : null,
    legales.assujettiTva && legales.numeroTva ? `TVA intracommunautaire ${legales.numeroTva}` : null,
    legales.telephone ? `Téléphone : ${legales.telephone}` : null,
    `Email : ${legales.email}`,
  ].filter((ligne): ligne is string => Boolean(ligne));
}
