import { getSession } from "@/lib/auth";
import { listerClientsAdmin } from "@/server/admin-clients";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function cellule(valeur: string | number | null): string {
  let texte = valeur === null ? "" : String(valeur);
  // Excel interprète =, +, - et @ comme des formules : un nom client ne doit
  // jamais pouvoir transformer un export en commande exécutable.
  if (/^[=+\-@]/.test(texte)) texte = `'${texte}`;
  return `"${texte.replaceAll('"', '""')}"`;
}

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Connexion requise.", { status: 401 });
  if (session.role !== "owner" && session.role !== "staff") {
    return new Response("Accès refusé.", { status: 403 });
  }

  const clients = await listerClientsAdmin(session.companyId);
  const lignes = [
    ["Nom", "Email", "Téléphone", "Commune", "Type", "Commandes", "Total dépensé (€)", "Dernière commande", "État"],
    ...clients.map((client) => [
      client.nom,
      client.email,
      client.telephone,
      client.commune,
      client.professionnel ? "Professionnel" : "Particulier",
      client.commandes,
      (client.totalCents / 100).toFixed(2).replace(".", ","),
      client.derniereCommande?.slice(0, 10) ?? "",
      client.anonymise ? "Anonymisé" : client.bloque ? "Bloqué" : "Actif",
    ]),
  ];
  const csv = "\uFEFF" + lignes.map((ligne) => ligne.map(cellule).join(";")).join("\r\n");

  await createSupabaseAdminClient().from("audit_log").insert({
    company_id: session.companyId,
    actor_id: session.userId,
    actor_role: session.role,
    action: "customers.exported",
    entity_type: "customers",
    before: null,
    after: { count: clients.length },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
