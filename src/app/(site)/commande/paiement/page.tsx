import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getCartId, getPanier } from "@/server/panier";
import { getPaymentSettings } from "@/server/reglages";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { formatDateCreneau } from "@/server/creneaux";
import { evaluatePaymentMethods, evaluateDeposit, type PaymentAvailabilityInput } from "@/domain/payments";
import { formatEuros, formatVolume } from "@/domain/units";
import { Etapes } from "@/components/commande/etapes";
import { ChoixPaiement } from "@/components/commande/choix-paiement";

export const metadata: Metadata = {
  title: "Paiement",
  robots: { index: false, follow: false },
};

export default async function PagePaiement() {
  const tenant = await requireTenant();
  const panier = await getPanier(tenant);

  if (panier.lignes.length === 0) redirect("/panier");
  if (panier.livraison.devis?.status !== "ok") redirect("/panier");

  const cartId = await getCartId();
  const supabase = createSupabaseAdminClient();

  const { data: brouillon } = await supabase
    .from("carts")
    .select(
      `first_name, last_name, email, phone, address_line1, address_line2,
       fulfillment_type, slot_id, delivery_slots ( date, label )`,
    )
    .eq("id", cartId!)
    .maybeSingle();

  // Coordonnées incomplètes : on renvoie à l'étape concernée plutôt que
  // d'afficher un écran de paiement qui échouera.
  if (!brouillon?.email || !brouillon.first_name) redirect("/commande/livraison");

  const reglages = await getPaymentSettings(tenant.id);

  const contexte: PaymentAvailabilityInput = {
    enabledMethods: reglages.enabledMethods,
    totalCents: panier.totaux.totalCents,
    volumeM3: panier.totaux.totalVolumeM3,
    distanceKm: panier.livraison.distanceKm ?? 0,
    fulfillmentType: brouillon.fulfillment_type === "pickup" ? "pickup" : "delivery",
    cashLimitCents: reglages.cashLimitCents,
    depositPercent: reglages.depositPercent,
    depositTriggerVolumeM3: reglages.depositTriggerVolumeM3,
    depositTriggerKm: reglages.depositTriggerKm,
    cardConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  };

  const options = evaluatePaymentMethods(contexte);
  const acompte = evaluateDeposit(contexte);
  const creneau = brouillon.delivery_slots as unknown as { date: string; label: string } | null;

  return (
    <main className="mx-auto max-w-[820px] px-5 py-12 sm:py-16">
      <Etapes courante="paiement" />

      <h1 className="mt-6 text-[32px] sm:text-[42px]">Votre commande</h1>

      {/* Récapitulatif complet : dernière occasion de vérifier avant de valider */}
      <div className="border-aubier-bord bg-aubier-pur mt-8 rounded-[14px] border p-5">
        <ul className="divide-aubier-bord divide-y">
          {panier.lignes.map((ligne) => (
            <li key={ligne.itemId} className="flex justify-between gap-3 py-3 first:pt-0">
              <span>
                <span className="font-semibold">{ligne.productName}</span>
                <span className="text-cendre block text-[15px]">
                  {ligne.variantLabel} · {formatVolume(ligne.lineVolumeM3)}
                </span>
              </span>
              <span className="tabulaire whitespace-nowrap">
                {formatEuros(ligne.lineTotalCents)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="border-aubier-bord mt-4 space-y-2 border-t pt-4 text-[15px]">
          {panier.options.map((option) => (
            <div key={option.code} className="flex justify-between gap-3">
              <dt className="text-cendre">{option.name}</dt>
              <dd className="tabulaire">{formatEuros(option.totalCents)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3">
            <dt className="text-cendre">Livraison à {panier.ville}</dt>
            <dd className="tabulaire">
              {panier.totaux.deliveryCents === 0 ? "Offerte" : formatEuros(panier.totaux.deliveryCents)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cendre">Adresse</dt>
            <dd className="text-right">
              {brouillon.address_line1}
              {brouillon.address_line2 ? `, ${brouillon.address_line2}` : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-cendre">Créneau souhaité</dt>
            <dd className="text-right">
              {creneau ? (
                <span className="first-letter:uppercase">
                  {formatDateCreneau(creneau.date)} · {creneau.label}
                </span>
              ) : (
                "À convenir par téléphone"
              )}
            </dd>
          </div>
        </dl>

        <div className="border-aubier-bord mt-4 flex items-end justify-between gap-3 border-t pt-4">
          <span className="font-semibold">Total TTC</span>
          <span className="text-braise-texte font-display tabulaire text-[32px] leading-none font-bold">
            {formatEuros(panier.totaux.totalCents)}
          </span>
        </div>
      </div>

      <ChoixPaiement
        options={options}
        totalCents={panier.totaux.totalCents}
        acompteCents={acompte.required ? acompte.amountCents : 0}
      />
    </main>
  );
}
