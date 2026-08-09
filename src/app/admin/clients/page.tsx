import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Building2, Download, Repeat2, UsersRound } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listerClientsAdmin } from "@/server/admin-clients";
import { formatEuros } from "@/domain/units";
import { ListeClients } from "@/components/admin/liste-clients";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Clients", robots: { index: false, follow: false } };

function Kpi({ libelle, valeur, Icone }: { libelle: string; valeur: string; Icone: typeof UsersRound }) {
  return (
    <div className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-cendre-clair text-[14px]">{libelle}</p>
        <Icone className="text-seve" size={20} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <p className="font-display tabulaire mt-2 text-[28px] leading-none font-bold">{valeur}</p>
    </div>
  );
}

export default async function PageClients() {
  const session = await requireRole(["owner", "staff"], "/admin/clients");
  const clients = await listerClientsAdmin(session.companyId);
  const actifs = clients.filter((client) => !client.bloque && !client.anonymise);
  const fideles = clients.filter((client) => client.commandes >= 2 && !client.anonymise);
  const professionnels = clients.filter((client) => client.professionnel && !client.anonymise);
  const bloques = clients.filter((client) => client.bloque && !client.anonymise);
  const total = clients.reduce((somme, client) => somme + client.totalCents, 0);

  return (
    <main className="p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[36px]">Clients</h1>
          <p className="text-cendre-clair mt-2 max-w-[68ch] text-[17px] leading-relaxed">
            Retrouvez immédiatement un client, son historique, ses adresses et les informations utiles pendant un appel.
          </p>
        </div>
        <Button asChild variant="outline" size="default">
          <Link href="/admin/clients/export">
            <Download strokeWidth={1.75} />
            Exporter en CSV
          </Link>
        </Button>
      </div>

      <section aria-label="Résumé clients" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi libelle="Clients actifs" valeur={actifs.length.toLocaleString("fr-FR")} Icone={UsersRound} />
        <Kpi libelle="Clients fidèles" valeur={fideles.length.toLocaleString("fr-FR")} Icone={Repeat2} />
        <Kpi libelle="Professionnels" valeur={professionnels.length.toLocaleString("fr-FR")} Icone={Building2} />
        <Kpi libelle="Clients bloqués" valeur={bloques.length.toLocaleString("fr-FR")} Icone={Ban} />
        <Kpi libelle="CA historique" valeur={formatEuros(total)} Icone={UsersRound} />
      </section>

      <ListeClients clients={clients} />
    </main>
  );
}
