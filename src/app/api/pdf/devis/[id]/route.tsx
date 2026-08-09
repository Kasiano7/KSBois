import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { getDemandeDevis, calculerProposition } from "@/server/admin-devis";
import { DevisCommercialPdf } from "@/pdf/devis-commercial";

/**
 * GET /api/pdf/devis/[id] — devis commercial d'une demande (docs/02 §7.2).
 *
 * Réservé à l'administration : contrairement au devis du panier, ce document
 * porte l'identité d'un client. `requireRole` est en première ligne, comme sur
 * tout écran d'administration (PLAN.md §5).
 *
 * Le montant est recalculé ici aussi : le PDF téléchargé ne peut pas différer de
 * celui envoyé par email ni de ce qu'affiche l'écran.
 *
 * Runtime Node.js : @react-pdf/renderer n'est pas compatible edge.
 */
export const runtime = "nodejs";

const horodatage = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export async function GET(_request: Request, { params }: RouteContext<"/api/pdf/devis/[id]">) {
  const session = await requireRole(["owner", "staff"]);
  const tenant = await requireTenant();
  const { id } = await params;

  const demande = await getDemandeDevis(session.companyId, id);
  if (!demande) return new Response("Devis introuvable.", { status: 404 });

  const proposition = await calculerProposition(tenant, demande);
  if (proposition.lignes.length === 0) {
    return new Response("Ce devis ne contient aucune ligne à imprimer.", { status: 400 });
  }

  const buffer = await renderToBuffer(
    DevisCommercialPdf({
      tenant,
      demande,
      proposition,
      editeLe: horodatage.format(new Date()),
      message: null,
    }),
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="devis-${demande.reference}.pdf"`,
      // Un devis est un instantané : jamais de cache.
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
