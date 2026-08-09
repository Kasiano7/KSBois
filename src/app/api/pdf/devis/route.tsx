import { renderToBuffer } from "@react-pdf/renderer";
import { requireTenant } from "@/lib/tenant";
import { getPanier } from "@/server/panier";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { DevisPdf } from "@/pdf/devis";
import { getCartId } from "@/server/panier";
import { enregistrerEvenementAnalytics } from "@/server/analytics";

/**
 * POST /api/pdf/devis — devis imprimable depuis le panier (docs/02 §7.1).
 *
 * Aucun compte, aucun email, aucune validation : le fichier part immédiatement.
 * Le recalcul est intégralement serveur, à partir du panier en base : le
 * navigateur n'envoie AUCUN montant.
 *
 * Runtime Node.js : @react-pdf/renderer n'est pas compatible edge.
 */
export const runtime = "nodejs";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export async function POST() {
  const tenant = await requireTenant();
  const panier = await getPanier(tenant);

  if (panier.lignes.length === 0) {
    return new Response("Panier vide.", { status: 400 });
  }

  const maintenant = new Date();
  const reference = `EST-${maintenant.getTime().toString(36).toUpperCase().slice(-6)}`;

  // Mention d'indicativité éditable depuis l'administration, sans redéploiement.
  let mention: string | undefined;
  try {
    const { data } = await createSupabaseAdminClient()
      .from("company_settings")
      .select("value")
      .eq("company_id", tenant.id)
      .eq("key", "quote.disclaimer")
      .maybeSingle();
    if (typeof data?.value === "string" && data.value.trim().length > 0) {
      mention = data.value;
    }
  } catch {
    // Repli sur la mention par défaut du composant : jamais de devis sans mention.
  }

  const buffer = await renderToBuffer(
    <DevisPdf
      tenant={tenant}
      panier={panier}
      editeLe={dateFormatter.format(maintenant)}
      mention={mention}
      reference={reference}
    />,
  );

  const nomFichier = `devis-bois-${reference}.pdf`;

  await enregistrerEvenementAnalytics(tenant.id, {
    type: "quote_pdf",
    cartId: await getCartId(),
    caPotentielCents: panier.totaux.totalCents,
    volumePotentielM3: panier.totaux.totalVolumeM3,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
      // Un devis est un instantané : il ne doit jamais être servi depuis un cache.
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
