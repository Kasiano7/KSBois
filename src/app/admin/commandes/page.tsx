import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listerCommandes } from "@/server/admin";
import { formatEuros, formatVolume } from "@/domain/units";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/domain/orders/state-machine";

export const metadata: Metadata = {
  title: "Commandes",
  robots: { index: false, follow: false },
};

const FILTRES = [
  { cle: "a_traiter", libelle: "À traiter" },
  { cle: "a_confirmer", libelle: "Date à confirmer" },
  { cle: "planifiee", libelle: "Planifiées" },
  { cle: "livree", libelle: "Livrées" },
  { cle: "toutes", libelle: "Toutes" },
];

const MODES: Record<string, string> = {
  card: "Carte en ligne",
  cash: "Espèces",
  check: "Chèque",
  transfer: "Virement",
  sumup: "Carte au camion",
};

/** Couleur de pastille + libellé : jamais la couleur seule (docs/03 §9). */
function Statut({ statut }: { statut: OrderStatus }) {
  const ton =
    statut === "livree"
      ? "bg-succes/20 text-succes"
      : statut === "annulee"
        ? "bg-cendre/20 text-cendre-clair"
        : statut === "en_attente_paiement"
          ? "bg-alerte/20 text-alerte"
          : "bg-seve/20 text-seve";

  return (
    <span className={`rounded-[3px] px-2 py-0.5 text-[13px] font-semibold whitespace-nowrap ${ton}`}>
      {ORDER_STATUS_LABELS[statut]}
    </span>
  );
}

const formatDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export default async function PageCommandes({ searchParams }: PageProps<"/admin/commandes">) {
  const session = await requireRole(["owner", "staff"], "/admin/commandes");
  const params = await searchParams;
  const filtre = typeof params.filtre === "string" ? params.filtre : "a_traiter";

  const commandes = await listerCommandes(session.companyId, filtre);

  return (
    <main className="p-5 sm:p-8">
      <h1 className="text-[28px] sm:text-[36px]">Commandes</h1>

      <nav aria-label="Filtres" className="mt-6 flex flex-wrap gap-2">
        {FILTRES.map((f) => (
          <Link
            key={f.cle}
            href={`/admin/commandes?filtre=${f.cle}`}
            aria-current={filtre === f.cle ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-[4px] border px-4 text-[15px] font-medium transition-colors ${
              filtre === f.cle
                ? "border-braise bg-braise/15 text-aubier"
                : "border-ecorce-bord hover:bg-ecorce-eleve"
            }`}
          >
            {f.libelle}
          </Link>
        ))}
      </nav>

      {commandes.length === 0 ? (
        <p className="text-cendre-clair mt-10 text-[17px]">Aucune commande dans cette vue.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[15px]">
            <thead>
              <tr className="border-ecorce-bord text-cendre-clair border-b text-left">
                <th scope="col" className="py-3 pr-4 font-semibold">Référence</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Client</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Commune</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Volume</th>
                <th scope="col" className="py-3 pr-4 text-right font-semibold">Montant</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Paiement</th>
                <th scope="col" className="py-3 pr-4 font-semibold">Livraison</th>
                <th scope="col" className="py-3 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {commandes.map((c) => (
                <tr key={c.id} className="border-ecorce-bord hover:bg-ecorce-eleve border-b">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/commandes/${c.id}`}
                      className="font-mono text-[14px] underline-offset-4 hover:underline"
                    >
                      {c.reference}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{c.nom}</td>
                  <td className="py-3 pr-4">{c.ville ?? "—"}</td>
                  <td className="tabulaire py-3 pr-4">{formatVolume(c.volumeM3)}</td>
                  <td className="tabulaire py-3 pr-4 text-right font-semibold">
                    {formatEuros(c.totalCents)}
                  </td>
                  <td className="py-3 pr-4">
                    {MODES[c.paymentMethod ?? ""] ?? "—"}
                    {c.paymentStatus === "paid" && (
                      <span className="text-succes ml-1.5 text-[13px]">payé</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {c.confirmedDeliveryDate ? (
                      formatDate.format(new Date(`${c.confirmedDeliveryDate}T12:00:00Z`))
                    ) : (
                      <span className="text-alerte">à confirmer</span>
                    )}
                  </td>
                  <td className="py-3">
                    <Statut statut={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
