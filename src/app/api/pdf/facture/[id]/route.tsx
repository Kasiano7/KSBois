import { renderToBuffer } from "@react-pdf/renderer";
import { getClientSession, getSession } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getFacture } from "@/server/factures";
import { FacturePdf } from "@/pdf/document-facture";

/**
 * GET /api/pdf/facture/[id] — facture ou avoir en PDF.
 *
 * Deux publics, un seul document : l'exploitant depuis l'administration, et le
 * client depuis son espace. Le contrôle d'accès est donc explicite en tête de
 * route — membre de l'entreprise, OU client connecté propriétaire de la
 * commande facturée. Un invité non connecté n'y accède pas : une facture porte
 * une adresse et un nom, elle ne circule pas sur un simple identifiant.
 *
 * Le document est rendu depuis l'instantané stocké : il ne relit ni la
 * commande, ni les prix du jour.
 *
 * Runtime Node.js : @react-pdf/renderer n'est pas compatible edge.
 */
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: RouteContext<"/api/pdf/facture/[id]">) {
  const tenant = await requireTenant();
  const { id } = await params;

  const session = await getSession();
  const estMembre =
    session !== null &&
    session.companyId === tenant.id &&
    ["owner", "staff", "driver"].includes(session.role);

  const facture = await getFacture(tenant.id, id);
  if (!facture) return new Response("Facture introuvable.", { status: 404 });

  if (!estMembre) {
    const autorise = await clientProprietaire(tenant.id, facture.orderId);
    if (!autorise) return new Response("Accès refusé.", { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: reglages }, { data: origine }] = await Promise.all([
    supabase
      .from("company_settings")
      .select("key, value")
      .eq("company_id", tenant.id)
      .in("key", ["invoice.footer"]),
    facture.factureOrigineId
      ? supabase
          .from("invoices")
          .select("number")
          .eq("company_id", tenant.id)
          .eq("id", facture.factureOrigineId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const pied = reglages?.find((ligne) => ligne.key === "invoice.footer")?.value;

  const buffer = await renderToBuffer(
    FacturePdf({
      facture: facture.document,
      numero: facture.numero,
      emiseLe: facture.emiseLe,
      numeroFactureOrigine: origine?.number ?? null,
      piedPersonnalise: typeof pied === "string" && pied.trim() ? pied.trim() : null,
    }),
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${facture.estAvoir ? "avoir" : "facture"}-${facture.numero}.pdf"`,
      // Une facture est un document nominatif : jamais de cache partagé.
      "Cache-Control": "private, no-store, must-revalidate",
    },
  });
}

/** Le client connecté est-il bien le propriétaire de la commande facturée ? */
async function clientProprietaire(companyId: string, orderId: string): Promise<boolean> {
  const client = await getClientSession();
  if (!client) return false;

  const { data } = await createSupabaseAdminClient()
    .from("orders")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", orderId)
    .eq("customer_id", client.customerId)
    .maybeSingle();

  return data !== null;
}
