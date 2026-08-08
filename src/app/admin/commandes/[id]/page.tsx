import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { formatDateCreneau } from "@/server/creneaux";
import { formatEuros, formatVolume } from "@/domain/units";
import { ORDER_STATUS_LABELS, nextStatuses, type OrderStatus } from "@/domain/orders/state-machine";
import { ActionsCommande } from "@/components/admin/actions-commande";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Commande",
  robots: { index: false, follow: false },
};

const formatDateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const MODES: Record<string, string> = {
  card: "Carte bancaire en ligne",
  cash: "Espèces à la livraison",
  check: "Chèque",
  transfer: "Virement bancaire",
  sumup: "Carte au terminal du camion",
};

export default async function PageCommande({ params }: PageProps<"/admin/commandes/[id]">) {
  const session = await requireRole(["owner", "staff"], "/admin/commandes");
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const { data: commande } = await supabase
    .from("orders")
    .select(
      `*, order_items ( product_name, variant_label, quantity, line_volume_m3,
        unit_price_cents, line_total_cents, vat_rate ),
       order_status_history ( from_status, to_status, note, actor, created_at ),
       payments ( method, amount_cents, status, received_at, reference )`,
    )
    .eq("id", id)
    .eq("company_id", session.companyId)
    .maybeSingle();

  if (!commande) notFound();

  const statut = commande.status as OrderStatus;
  // Snapshot JSON de l'adresse : on le type une fois ici plutôt que de semer
  // des `String(...)` dans le rendu.
  const adresse = (commande.shipping_address ?? {}) as {
    line1?: string;
    line2?: string;
    postalCode?: string;
    city?: string;
    accessNotes?: string;
    truckAccess?: string;
  };
  const historique = [...(commande.order_status_history ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <main className="p-5 sm:p-8">
      <Button asChild variant="ghost" size="default">
        <Link href="/admin/commandes">
          <ChevronLeft strokeWidth={1.75} />
          Toutes les commandes
        </Link>
      </Button>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-mono text-[28px] sm:text-[34px]">{commande.reference}</h1>
        <span className="bg-seve/20 text-seve rounded-[4px] px-3 py-1 text-[15px] font-semibold">
          {ORDER_STATUS_LABELS[statut]}
        </span>
      </div>
      <p className="text-cendre-clair mt-1 text-[15px]">
        Passée le {formatDateHeure.format(new Date(commande.created_at))}
        {commande.source === "web" ? " depuis le site" : ` (${commande.source})`}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {/* ---- Contenu ---- */}
          <section className="border-ecorce-bord rounded-[8px] border p-5">
            <h2 className="text-[19px] font-semibold">Contenu</h2>
            <ul className="divide-ecorce-bord mt-4 divide-y">
              {(commande.order_items ?? []).map((i, index) => (
                <li key={index} className="flex justify-between gap-3 py-3 first:pt-0">
                  <span>
                    <span className="font-semibold">{i.product_name}</span>
                    <span className="text-cendre-clair block text-[15px]">
                      {i.variant_label} · {formatVolume(Number(i.line_volume_m3))} ·{" "}
                      {formatEuros(i.unit_price_cents)}/m³app
                    </span>
                  </span>
                  <span className="tabulaire whitespace-nowrap">
                    {formatEuros(i.line_total_cents)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="border-ecorce-bord mt-4 space-y-1.5 border-t pt-4 text-[15px]">
              <div className="text-cendre-clair flex justify-between gap-3">
                <dt>Bois</dt>
                <dd className="tabulaire">{formatEuros(commande.subtotal_cents)}</dd>
              </div>
              {commande.delivery_base_cents > 0 && (
                <div className="text-cendre-clair flex justify-between gap-3">
                  <dt>Livraison — forfait</dt>
                  <dd className="tabulaire">{formatEuros(commande.delivery_base_cents)}</dd>
                </div>
              )}
              {commande.delivery_fuel_cents > 0 && (
                <div className="text-cendre-clair flex justify-between gap-3">
                  <dt>
                    Livraison — carburant
                    {commande.fuel_price_snapshot_cents
                      ? ` (gazole à ${(commande.fuel_price_snapshot_cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €/L)`
                      : ""}
                  </dt>
                  <dd className="tabulaire">{formatEuros(commande.delivery_fuel_cents)}</dd>
                </div>
              )}
              <div className="border-ecorce-bord flex justify-between gap-3 border-t pt-2.5 text-[19px] font-semibold">
                <dt>Total TTC</dt>
                <dd className="tabulaire">{formatEuros(commande.total_cents)}</dd>
              </div>
            </dl>
          </section>

          {/* ---- Client et livraison ---- */}
          <section className="border-ecorce-bord rounded-[8px] border p-5">
            <h2 className="text-[19px] font-semibold">Client et livraison</h2>
            <dl className="mt-4 space-y-3 text-[15px]">
              <div>
                <dt className="text-cendre-clair">Client</dt>
                <dd className="text-[17px]">
                  {commande.first_name} {commande.last_name}
                  <br />
                  <a href={`mailto:${commande.email}`} className="underline underline-offset-4">
                    {commande.email}
                  </a>
                  {commande.phone && (
                    <>
                      {" · "}
                      <a href={`tel:${commande.phone}`} className="underline underline-offset-4">
                        {commande.phone}
                      </a>
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-cendre-clair">Adresse</dt>
                <dd className="text-[17px]">
                  {adresse.line1 ?? "—"}
                  <br />
                  {adresse.postalCode} {adresse.city}
                  {commande.distance_km !== null && (
                    <span className="text-cendre-clair"> · {commande.distance_km} km</span>
                  )}
                </dd>
              </div>
              {adresse.accessNotes && (
                <div>
                  <dt className="text-cendre-clair">Contraintes d&apos;accès</dt>
                  <dd className="text-alerte text-[17px]">{adresse.accessNotes}</dd>
                </div>
              )}
              <div>
                <dt className="text-cendre-clair">Paiement</dt>
                <dd className="text-[17px]">
                  {MODES[commande.payment_method ?? ""] ?? "—"}
                  {commande.payment_status === "paid" ? (
                    <span className="text-succes"> · encaissé</span>
                  ) : (
                    <span className="text-alerte"> · en attente</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-cendre-clair">Livraison confirmée</dt>
                <dd className="text-[17px]">
                  {commande.confirmed_delivery_date ? (
                    <span className="first-letter:uppercase">
                      {formatDateCreneau(commande.confirmed_delivery_date)}
                      {commande.confirmed_slot_label ? ` · ${commande.confirmed_slot_label}` : ""}
                    </span>
                  ) : (
                    "Pas encore confirmée au client"
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* ---- Historique ---- */}
          <section className="border-ecorce-bord rounded-[8px] border p-5">
            <h2 className="text-[19px] font-semibold">Historique</h2>
            <ol className="mt-4 space-y-2.5 text-[15px]">
              {historique.map((h, index) => (
                <li key={index} className="text-cendre-clair">
                  <span className="text-aubier">
                    {h.from_status
                      ? `${ORDER_STATUS_LABELS[h.from_status as OrderStatus]} → ${ORDER_STATUS_LABELS[h.to_status as OrderStatus]}`
                      : ORDER_STATUS_LABELS[h.to_status as OrderStatus]}
                  </span>
                  {" · "}
                  {formatDateHeure.format(new Date(h.created_at))}
                  {h.note && ` · ${h.note}`}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <ActionsCommande
          orderId={commande.id}
          statut={statut}
          statutsPossibles={nextStatuses(statut)}
          totalCents={commande.total_cents}
          dejaPayeCents={commande.amount_paid_cents}
          modePaiement={commande.payment_method}
          dateConfirmee={commande.confirmed_delivery_date}
          creneauConfirme={commande.confirmed_slot_label}
        />
      </div>
    </main>
  );
}
