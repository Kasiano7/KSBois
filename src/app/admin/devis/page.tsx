import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listerDevis, compterDevis } from "@/server/admin-devis";
import { formatEuros } from "@/domain/units";
import { QUOTE_ORIGIN_LABELS, QUOTE_STATUS_LABELS, type QuoteStatus } from "@/domain/quotes";

export const metadata: Metadata = { title: "Devis", robots: { index: false, follow: false } };

const FILTRES = [
  { cle: "a_traiter", libelle: "À traiter" },
  { cle: "envoyes", libelle: "Envoyés" },
  { cle: "acceptes", libelle: "Acceptés" },
  { cle: "refuses", libelle: "Refusés" },
  { cle: "toutes", libelle: "Toutes" },
];

/** Pastille de statut : couleur ET libellé, jamais la couleur seule. */
function Statut({ statut }: { statut: QuoteStatus }) {
  const ton =
    statut === "accepte"
      ? "bg-succes/20 text-succes"
      : statut === "refuse"
        ? "bg-cendre/20 text-cendre-clair"
        : statut === "envoye"
          ? "bg-seve/20 text-seve"
          : "bg-braise/20 text-braise";

  return (
    <span
      className={`rounded-[3px] px-2 py-0.5 text-[13px] font-semibold whitespace-nowrap ${ton}`}
    >
      {QUOTE_STATUS_LABELS[statut]}
    </span>
  );
}

const formatDate = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

export default async function PageDevis({ searchParams }: PageProps<"/admin/devis">) {
  const session = await requireRole(["owner", "staff"], "/admin/devis");
  const params = await searchParams;
  const filtre = typeof params.filtre === "string" ? params.filtre : "a_traiter";

  const [devis, compteurs] = await Promise.all([
    listerDevis(session.companyId, filtre),
    compterDevis(session.companyId),
  ]);

  return (
    <main className="p-5 sm:p-8">
      <h1 className="text-[28px] sm:text-[36px]">Demandes de devis</h1>
      <p className="text-cendre-clair mt-2 max-w-[68ch] text-[17px] leading-relaxed">
        Gros volumes, professionnels, communes hors zone : ces demandes attendent une réponse
        humaine. Chaque jour d&apos;attente est un client qui appelle un concurrent.
      </p>

      <nav aria-label="Filtres" className="mt-6 flex flex-wrap gap-2">
        {FILTRES.map((f) => (
          <Link
            key={f.cle}
            href={`/admin/devis?filtre=${f.cle}`}
            aria-current={filtre === f.cle ? "page" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-[4px] border px-4 text-[15px] font-medium transition-colors ${
              filtre === f.cle
                ? "border-braise bg-braise/15 text-aubier"
                : "border-ecorce-bord hover:bg-ecorce-eleve"
            }`}
          >
            {f.libelle}
            {compteurs[f.cle] > 0 && (
              <span className="bg-ecorce text-cendre-clair tabulaire rounded-[3px] px-1.5 text-[13px]">
                {compteurs[f.cle]}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {devis.length === 0 ? (
        <p className="text-cendre-clair mt-10 text-[17px]">
          Aucune demande dans cette vue. Le formulaire public alimente cette liste, et le tunnel de
          commande y bascule automatiquement les clients hors zone.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[15px]">
            <thead>
              <tr className="border-ecorce-bord text-cendre-clair border-b text-left">
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Référence
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Reçue le
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Client
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Commune
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Demande
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Origine
                </th>
                <th scope="col" className="py-3 pr-4 text-right font-semibold">
                  Proposé
                </th>
                <th scope="col" className="py-3 font-semibold">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody>
              {devis.map((d) => {
                // Une demande qui attend depuis deux jours est signalée en clair :
                // c'est l'information qui déclenche l'action.
                const enRetard =
                  (d.statut === "nouveau" || d.statut === "en_cours") && d.joursAttente >= 2;

                return (
                  <tr key={d.id} className="border-ecorce-bord hover:bg-ecorce-eleve border-b">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/devis/${d.id}`}
                        className="font-mono text-[14px] underline-offset-4 hover:underline"
                      >
                        {d.reference}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      {formatDate.format(new Date(d.createdAt))}
                      {enRetard && (
                        <span className="text-alerte ml-1.5 text-[13px] font-semibold">
                          depuis {d.joursAttente} j
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">{d.nom}</td>
                    <td className="py-3 pr-4">
                      {d.ville ?? "—"}
                      {d.codePostal && (
                        <span className="text-cendre-clair ml-1 text-[13px]">{d.codePostal}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">{d.demande}</td>
                    <td className="text-cendre-clair py-3 pr-4 text-[13px]">
                      {QUOTE_ORIGIN_LABELS[d.origine]}
                    </td>
                    <td className="tabulaire py-3 pr-4 text-right font-semibold">
                      {d.totalEstimeCents === null ? "—" : formatEuros(d.totalEstimeCents)}
                    </td>
                    <td className="py-3">
                      <Statut statut={d.statut} />
                      {d.converti && (
                        <span className="text-cendre-clair mt-1 block text-[13px]">commandé</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
