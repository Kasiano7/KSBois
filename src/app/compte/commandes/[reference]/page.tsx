import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { getCommandeClient, phraseLivraison } from "@/server/compte";
import { formatEuros, formatVolume } from "@/domain/units";
import { formatDateFr } from "@/lib/jours";
import { ORDER_STATUS_LABELS } from "@/domain/orders/state-machine";
import { BoutonRecommander } from "@/components/compte/bouton-recommander";

export const metadata: Metadata = {
  title: "Ma commande",
  robots: { index: false, follow: false },
};

const MODES: Record<string, string> = {
  card: "Carte bancaire, payée en ligne",
  cash: "Espèces, à la livraison",
  check: "Chèque, à la livraison",
  transfer: "Virement bancaire",
  sumup: "Carte bancaire, au camion",
};

export default async function PageCommandeClient({
  params,
}: PageProps<"/compte/commandes/[reference]">) {
  const session = await requireClient("/compte");
  const tenant = await requireTenant();
  const { reference } = await params;

  // Filtrage sur le client de la SESSION : une référence devinée ne donne accès
  // à rien (docs/01 §4.2).
  const commande = await getCommandeClient(tenant.id, session.customerId, reference);
  if (!commande) notFound();

  return (
    <main className="mx-auto w-full max-w-[820px] px-5 py-10 sm:py-14">
      <Link
        href="/compte"
        className="text-cendre inline-flex min-h-11 items-center gap-2 text-[17px] underline-offset-4 hover:underline"
      >
        <ArrowLeft size={18} strokeWidth={1.9} aria-hidden="true" />
        Mes commandes
      </Link>

      <h1 className="mt-3 text-[32px] sm:text-[42px]">
        Commande <span className="font-mono text-[24px] sm:text-[30px]">{commande.reference}</span>
      </h1>
      <p className="text-cendre mt-2 text-[17px]">
        Passée le{" "}
        {formatDateFr(commande.creeLe.slice(0, 10), { jourSemaine: false, annee: true })} ·{" "}
        {ORDER_STATUS_LABELS[commande.statut]}
      </p>

      <section className="border-aubier-bord bg-aubier-pur mt-7 rounded-[8px] border p-5 sm:p-6">
        <h2 className="text-[21px] font-semibold">Votre livraison</h2>
        <p className="mt-2 text-[19px] leading-relaxed">{phraseLivraison(commande)}</p>
        {(commande.adresse || commande.ville) && (
          <p className="text-cendre mt-2 text-[17px]">
            {[commande.adresse, commande.ville].filter(Boolean).join(", ")}
          </p>
        )}
      </section>

      <section className="mt-7">
        <h2 className="text-[21px] font-semibold">Ce que vous avez commandé</h2>
        <ul className="mt-4 space-y-3">
          {commande.lignes.map((l) => (
            <li
              key={`${l.produit}-${l.format}`}
              className="border-aubier-bord flex flex-wrap items-baseline justify-between gap-3 border-b pb-3 text-[17px]"
            >
              <span>
                <strong className="text-[19px]">{formatVolume(l.volumeM3)}</strong>
                <span className="text-cendre block text-[15px]">
                  {l.produit} · {l.format}
                </span>
              </span>
              <span className="tabulaire font-semibold">{formatEuros(l.totalCents)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-[19px] font-semibold">Total payé</span>
          <span className="text-braise-texte font-display tabulaire text-[28px] font-bold">
            {formatEuros(commande.totalCents)}
          </span>
        </div>

        <p className="text-cendre mt-2 text-[15px]">
          {MODES[commande.modePaiement ?? ""] ?? "Mode de règlement à confirmer"}
          {commande.resteAPayerCents > 0 && commande.statut !== "annulee" && (
            <>
              {" · "}
              <strong className="text-encre">
                Reste à régler : {formatEuros(commande.resteAPayerCents)}
              </strong>
            </>
          )}
        </p>
      </section>

      {commande.statut !== "annulee" && (
        <section className="border-aubier-bord mt-10 rounded-[8px] border border-dashed p-5 sm:p-6">
          <h2 className="text-[21px] font-semibold">Il vous en faut à nouveau ?</h2>
          <p className="text-cendre mt-2 max-w-[62ch] text-[17px] leading-relaxed">
            Nous remettons exactement le même bois dans votre panier, à la même adresse. Vous
            n&apos;aurez qu&apos;à choisir votre date de livraison.
          </p>
          <div className="mt-5">
            <BoutonRecommander reference={commande.reference} />
          </div>
        </section>
      )}

      <p className="text-cendre mt-10 text-[15px]">
        Une question sur cette commande ? Appelez-nous au{" "}
        <a
          href={`tel:${(tenant.phone ?? "").replace(/\s/g, "")}`}
          className="font-semibold underline underline-offset-4"
        >
          {tenant.phoneDisplay ?? tenant.phone}
        </a>{" "}
        en indiquant la référence {commande.reference}.
      </p>
    </main>
  );
}
