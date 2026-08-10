import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { getDonneesBonLivraison } from "@/server/factures";
import { BonLivraisonPdf } from "@/pdf/document-bon-livraison";

/**
 * GET /api/pdf/bon-livraison/[id] — bon de livraison d'une commande.
 *
 * `[id]` est l'identifiant de la COMMANDE : le bon n'a pas d'existence propre
 * en base, il est reconstruit à chaque impression (docs/02 §6). Réimprimer
 * redonne donc exactement le même document, ce qui est le cas d'usage réel —
 * l'exemplaire papier reste souvent dans le camion.
 *
 * Réservé à l'entreprise, `driver` compris : c'est le livreur qui l'imprime.
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

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/pdf/bon-livraison/[id]">,
) {
  const session = await requireRole(["owner", "staff", "driver"]);
  const tenant = await requireTenant();
  const { id } = await params;

  const donnees = await getDonneesBonLivraison(session.companyId, id);
  if (!donnees) return new Response("Commande introuvable.", { status: 404 });
  if (donnees.lignes.length === 0) {
    return new Response("Cette commande ne contient aucune ligne à livrer.", { status: 400 });
  }

  const buffer = await renderToBuffer(
    BonLivraisonPdf({
      tenant,
      reference: donnees.reference,
      editeLe: horodatage.format(new Date()),
      client: donnees.client,
      livraison: donnees.livraison,
      lignes: donnees.lignes,
      volumeTotalM3: donnees.volumeTotalM3,
      paiement: donnees.paiement,
    }),
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bon-livraison-${donnees.reference}.pdf"`,
      "Cache-Control": "private, no-store, must-revalidate",
    },
  });
}
