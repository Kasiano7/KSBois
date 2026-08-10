import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Home, MapPin, ReceiptText, ShoppingBag, UserRound } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getClientAdmin } from "@/server/admin-clients";
import { formatEuros, formatVolume } from "@/domain/units";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/domain/orders/state-machine";
import { PanneauFicheClient } from "@/components/admin/panneau-fiche-client";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Fiche client", robots: { index: false, follow: false } };

const formatDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});
const formatDateCourte = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Paris",
});

const ACCES: Record<string, string> = {
  spl: "Semi-remorque",
  camion: "Camion",
  fourgon: "Fourgon seulement",
  remorque_seule: "Petite remorque",
};
const DECHARGEMENT: Record<string, string> = {
  vrac_sol: "En vrac au sol",
  benne: "Déversé à la benne",
  range: "Rangé",
};
const SOURCES: Record<string, string> = { web: "Site web", phone: "Téléphone", admin: "Administration" };

function Kpi({ libelle, valeur, precision, Icone }: { libelle: string; valeur: string; precision?: string; Icone: typeof UserRound }) {
  return (
    <div className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-cendre-clair text-[13px]">{libelle}</p>
        <Icone className="text-seve" size={19} aria-hidden="true" />
      </div>
      <p className="font-display tabulaire mt-2 text-[25px] leading-none font-bold">{valeur}</p>
      {precision && <p className="text-cendre-clair mt-2 text-[12px]">{precision}</p>}
    </div>
  );
}

export default async function PageClient({ params }: PageProps<"/admin/clients/[id]">) {
  const session = await requireRole(["owner", "staff"], "/admin/clients");
  const { id } = await params;
  const detail = await getClientAdmin(session.companyId, id);
  if (!detail) notFound();
  const { client, indicateurs } = detail;
  const nom = [client.first_name, client.last_name].filter(Boolean).join(" ") || client.company_name || client.email;

  return (
    <main className="p-5 sm:p-8">
      <Button asChild variant="ghost" size="default">
        <Link href="/admin/clients"><ArrowLeft /> Tous les clients</Link>
      </Button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] sm:text-[36px]">{nom}</h1>
            {client.anonymized_at ? (
              <span className="bg-cendre/20 text-cendre-clair rounded-[3px] px-2.5 py-1 text-[13px] font-semibold">Anonymisé</span>
            ) : client.is_blocked ? (
              <span className="bg-erreur/15 text-erreur rounded-[3px] px-2.5 py-1 text-[13px] font-semibold">Bloqué</span>
            ) : client.customer_type === "professionnel" ? (
              <span className="bg-info/15 text-info rounded-[3px] px-2.5 py-1 text-[13px] font-semibold">Professionnel</span>
            ) : null}
          </div>
          {client.company_name && <p className="text-cendre-clair mt-1 text-[16px]">{client.company_name}</p>}
          <p className="text-cendre-clair mt-2 text-[15px]">
            {client.email}{client.phone ? ` · ${client.phone}` : ""}
            {client.user_id ? " · espace client actif" : " · achat invité"}
          </p>
        </div>
      </div>

      <section aria-label="Indicateurs du client" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi libelle="Client depuis" valeur={formatDateCourte.format(new Date(indicateurs.clientDepuis))} Icone={UserRound} />
        <Kpi libelle="Commandes" valeur={indicateurs.nbCommandes.toLocaleString("fr-FR")} Icone={ShoppingBag} />
        <Kpi libelle="Total commandé" valeur={formatEuros(indicateurs.totalCents)} Icone={ShoppingBag} />
        <Kpi libelle="Panier moyen" valeur={formatEuros(indicateurs.panierMoyenCents)} Icone={ShoppingBag} />
        <Kpi libelle="Volume total" valeur={formatVolume(indicateurs.volumeM3)} Icone={Home} />
        <Kpi
          libelle="Rythme estimé"
          valeur={indicateurs.frequenceJours ? `${indicateurs.frequenceJours} j` : "—"}
          precision={indicateurs.prochaineCommande ? `Prochaine vers le ${formatDateCourte.format(new Date(indicateurs.prochaineCommande))}` : "Deux commandes nécessaires"}
          Icone={CalendarClock}
        />
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.65fr)]">
        <div className="space-y-8">
          <section className="border-ecorce-bord rounded-[8px] border p-5">
            <div className="flex items-center gap-2.5">
              <MapPin className="text-seve" size={21} aria-hidden="true" />
              <h2 className="text-[20px] font-semibold">Adresses et accès</h2>
            </div>
            {detail.adresses.length === 0 ? (
              <p className="text-cendre-clair mt-4 text-[15px]">Aucune adresse enregistrée. La dernière adresse reste visible dans chaque commande.</p>
            ) : (
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {detail.adresses.map((adresse) => (
                  <li key={adresse.id} className="border-ecorce-bord bg-ecorce-eleve rounded-[6px] border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{adresse.label || "Adresse de livraison"}</p>
                      {adresse.is_default && <span className="bg-seve/15 text-seve rounded-[3px] px-2 py-0.5 text-[12px] font-semibold">Par défaut</span>}
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed">{adresse.line1}{adresse.line2 ? <><br />{adresse.line2}</> : null}<br />{adresse.postal_code} {adresse.city}</p>
                    <dl className="text-cendre-clair mt-3 space-y-1 text-[13px]">
                      <div><dt className="inline font-semibold">Accès : </dt><dd className="inline">{ACCES[adresse.truck_access] ?? adresse.truck_access}</dd></div>
                      {adresse.unload_type && <div><dt className="inline font-semibold">Déchargement : </dt><dd className="inline">{DECHARGEMENT[adresse.unload_type] ?? adresse.unload_type}</dd></div>}
                      {(adresse.has_slope || adresse.has_gate) && <div><dt className="inline font-semibold">Contraintes : </dt><dd className="inline">{[adresse.has_slope && "pente", adresse.has_gate && "portail"].filter(Boolean).join(", ")}</dd></div>}
                      {adresse.allow_unattended_delivery && <div>Livraison en l’absence du client autorisée</div>}
                    </dl>
                    {adresse.access_notes && <p className="border-alerte/25 bg-alerte/8 text-alerte mt-3 rounded-[4px] border p-2.5 text-[13px]">{adresse.access_notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-ecorce-bord rounded-[8px] border p-5">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="text-seve" size={21} aria-hidden="true" />
              <h2 className="text-[20px] font-semibold">Historique des commandes</h2>
            </div>
            {detail.commandes.length === 0 ? (
              <p className="text-cendre-clair mt-4 text-[15px]">Aucune commande rattachée à cette fiche.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[700px] text-[14px]">
                  <thead><tr className="border-ecorce-bord text-cendre-clair border-b text-left"><th className="py-2 pr-3">Référence</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Ville</th><th className="py-2 pr-3">Origine</th><th className="py-2 pr-3 text-right">Volume</th><th className="py-2 pr-3 text-right">Total</th><th className="py-2">Statut</th></tr></thead>
                  <tbody>{detail.commandes.map((commande) => (
                    <tr key={commande.id} className="border-ecorce-bord border-b last:border-0">
                      <td className="py-3 pr-3"><Link href={`/admin/commandes/${commande.id}`} className="font-mono underline-offset-4 hover:underline">{commande.reference}</Link></td>
                      <td className="py-3 pr-3">{formatDateCourte.format(new Date(commande.creeLe))}</td>
                      <td className="py-3 pr-3">{commande.ville ?? "—"}</td>
                      <td className="py-3 pr-3">{SOURCES[commande.source] ?? commande.source}</td>
                      <td className="tabulaire py-3 pr-3 text-right">{formatVolume(commande.volumeM3)}</td>
                      <td className="tabulaire py-3 pr-3 text-right font-semibold">{formatEuros(commande.totalCents)}</td>
                      <td className="py-3"><span className="bg-seve/15 text-seve rounded-[3px] px-2 py-1 text-[12px] font-semibold">{ORDER_STATUS_LABELS[commande.statut as OrderStatus] ?? commande.statut}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>

          <section className="border-ecorce-bord rounded-[8px] border p-5">
            <div className="flex items-center gap-2.5">
              <ReceiptText className="text-seve" size={21} aria-hidden="true" />
              <h2 className="text-[20px] font-semibold">Factures et avoirs</h2>
            </div>
            {detail.factures.length === 0 ? (
              <p className="text-cendre-clair mt-4 text-[15px]">Aucune facture émise pour ce client.</p>
            ) : (
              <ul className="divide-ecorce-bord mt-4 divide-y">
                {detail.factures.map((facture) => (
                  <li key={facture.id}>
                    <a
                      href={`/api/pdf/facture/${facture.id}`}
                      target="_blank"
                      rel="noopener"
                      className="hover:bg-ecorce-eleve -mx-2 flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-[8px] px-2 py-3 transition-colors"
                    >
                      <span><strong className="font-mono text-[14px]">{facture.numero}</strong><span className="text-cendre-clair ml-2 text-[13px]">{facture.avoir ? "Avoir" : "Facture"} · {formatDate.format(new Date(`${facture.emiseLe}T12:00:00Z`))} · PDF</span></span>
                      <span className="tabulaire font-semibold">{facture.totalCents === null ? "Montant archivé" : formatEuros(facture.totalCents)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <PanneauFicheClient
          owner={session.role === "owner"}
          client={{
            id: client.id,
            firstName: client.first_name ?? "",
            lastName: client.last_name ?? "",
            email: client.email,
            phone: client.phone ?? "",
            customerType: client.customer_type as "particulier" | "professionnel",
            isCompany: client.is_company,
            companyName: client.company_name ?? "",
            siret: client.siret ?? "",
            vatNumber: client.vat_number ?? "",
            acceptsMarketing: client.accepts_marketing,
            notes: client.internal_notes ?? "",
            blocked: client.is_blocked,
            blockedReason: client.blocked_reason ?? "",
            anonymized: client.anonymized_at !== null,
          }}
          doublons={detail.doublonsPossibles}
        />
      </div>
    </main>
  );
}
