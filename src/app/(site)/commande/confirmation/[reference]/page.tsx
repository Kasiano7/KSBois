import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Mail, Phone, Truck } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { formatEuros, formatVolume } from "@/domain/units";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/domain/orders/state-machine";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Commande confirmée",
  robots: { index: false, follow: false },
};

const SUITE: Record<string, string> = {
  card: "Votre paiement a été enregistré.",
  cash: "Vous réglerez en espèces à la livraison. Pensez à faire l'appoint si possible.",
  check: "Vous réglerez par chèque à la livraison, à l'ordre indiqué sur votre facture.",
  transfer: "Nous vous envoyons le RIB par email. Indiquez la référence de commande en libellé.",
  sumup: "Vous réglerez par carte à la livraison, sur le terminal du livreur.",
};

export default async function PageConfirmation({ params, searchParams }: PageProps<"/commande/confirmation/[reference]">) {
  const { reference } = await params;
  const { jeton } = await searchParams;

  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: commande } = await supabase
    .from("orders")
    .select(
      `id, reference, status, email, first_name, last_name, phone, total_cents,
       total_volume_m3, delivery_total_cents, payment_method, deposit_required_cents,
       shipping_address, created_at,
       order_items ( product_name, variant_label, quantity, line_volume_m3, line_total_cents )`,
    )
    .eq("company_id", tenant.id)
    .eq("reference", reference)
    .maybeSingle();

  if (!commande) notFound();

  // ⚠️ Une référence est devinable : l'accès exige le jeton opaque envoyé par
  // email (docs/01 §4.2). Sans jeton valide, on ne montre RIEN.
  const jetonFourni = typeof jeton === "string" ? jeton : null;
  let autorise = false;

  if (jetonFourni) {
    const { data: acces } = await supabase
      .from("order_access_tokens")
      .select("order_id, expires_at")
      .eq("token", jetonFourni)
      .maybeSingle();
    autorise = acces?.order_id === commande.id && new Date(acces.expires_at) > new Date();
  }

  if (!autorise) {
    return (
      <main className="mx-auto max-w-[680px] px-5 py-20">
        <h1 className="text-[32px]">Commande introuvable</h1>
        <p className="text-cendre mt-4 text-[17px] leading-relaxed">
          Ce lien n&apos;est plus valide. Retrouvez votre commande depuis l&apos;email de
          confirmation, ou appelez-nous au {tenant.phoneDisplay ?? tenant.phone}.
        </p>
        <Button asChild variant="outline" size="lg" className="mt-8">
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </main>
    );
  }

  const lignes = (commande.order_items ?? []) as {
    product_name: string;
    variant_label: string;
    quantity: number;
    line_volume_m3: number;
    line_total_cents: number;
  }[];

  const adresse = commande.shipping_address as { line1?: string; city?: string } | null;

  return (
    <main className="mx-auto max-w-[680px] px-5 py-12 sm:py-16">
      <div className="border-succes/30 bg-succes/8 rounded-[8px] border p-6">
        <p className="flex items-center gap-2.5 text-[22px] font-semibold">
          <CheckCircle2 size={28} strokeWidth={1.9} className="text-succes" aria-hidden="true" />
          Merci, votre commande est enregistrée
        </p>
        <p className="text-cendre mt-3 text-[17px] leading-relaxed">
          Référence <strong className="text-encre font-mono">{commande.reference}</strong> ·{" "}
          {ORDER_STATUS_LABELS[commande.status as OrderStatus]}
        </p>
      </div>

      <section className="border-aubier-bord bg-aubier-pur mt-8 rounded-[14px] border p-5">
        <h2 className="text-[19px] font-semibold">Votre commande</h2>
        <ul className="divide-aubier-bord mt-4 divide-y">
          {lignes.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 py-3 first:pt-0">
              <span>
                <span className="font-semibold">{l.product_name}</span>
                <span className="text-cendre block text-[15px]">
                  {l.variant_label} · {formatVolume(Number(l.line_volume_m3))}
                </span>
              </span>
              <span className="tabulaire whitespace-nowrap">
                {formatEuros(l.line_total_cents)}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-aubier-bord mt-4 flex items-end justify-between gap-3 border-t pt-4">
          <span className="font-semibold">Total TTC</span>
          <span className="tabulaire text-[22px] font-bold">
            {formatEuros(commande.total_cents)}
          </span>
        </div>
        {commande.deposit_required_cents > 0 && (
          <p className="text-braise-texte mt-2 text-right text-[15px] font-semibold">
            Acompte de {formatEuros(commande.deposit_required_cents)} · reste{" "}
            {formatEuros(commande.total_cents - commande.deposit_required_cents)} à la livraison
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[19px] font-semibold">Et maintenant ?</h2>
        <ul className="text-cendre mt-4 space-y-4 text-[17px] leading-relaxed">
          <li className="flex gap-3">
            <Mail size={21} strokeWidth={1.75} className="text-sapin mt-1 shrink-0" aria-hidden="true" />
            <span>
              Un récapitulatif part à l&apos;adresse{" "}
              <strong className="text-encre">{commande.email}</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <Truck size={21} strokeWidth={1.75} className="text-sapin mt-1 shrink-0" aria-hidden="true" />
            <span>
              Nous vous <strong className="text-encre">confirmons la date de livraison sous 24
              heures</strong>
              {adresse?.city ? ` à ${adresse.city}` : ""}. Le livreur vous appelle avant de passer.
            </span>
          </li>
          <li className="flex gap-3">
            <Phone size={21} strokeWidth={1.75} className="text-sapin mt-1 shrink-0" aria-hidden="true" />
            <span>
              {SUITE[commande.payment_method ?? ""] ?? "Nous revenons vers vous rapidement."}
            </span>
          </li>
        </ul>
      </section>

      {/* Création du compte proposée ICI : c'est le moment exact où le client
          est satisfait, et c'est là qu'un acheteur invité devient un client
          fidèle qui recommandera en deux clics l'hiver prochain (docs/02 §9.2). */}
      <section className="border-aubier-bord bg-aubier-pur mt-10 rounded-[14px] border p-5 sm:p-6">
        <h2 className="text-[21px] font-semibold">Gardez cette commande sous la main</h2>
        <p className="text-cendre mt-2 max-w-[62ch] text-[17px] leading-relaxed">
          Créez votre espace en un clic, sans mot de passe : vous y retrouverez cette commande et
          vous pourrez commander le même bois en deux clics l&apos;an prochain.
        </p>
        <Button asChild variant="or" size="lg" className="mt-5">
          <Link href="/compte/connexion">Créer mon espace</Link>
        </Button>
        <p className="text-cendre mt-3 text-[15px]">
          Utilisez la même adresse ({commande.email}) : cette commande y sera rattachée
          automatiquement.
        </p>
      </section>

      <div className="border-aubier-bord mt-10 border-t pt-8">
        <p className="text-cendre text-[17px]">
          Une question ? Appelez-nous au{" "}
          <a
            href={`tel:${tenant.phone ?? ""}`}
            className="text-braise-texte font-semibold underline underline-offset-4"
          >
            {tenant.phoneDisplay ?? tenant.phone ?? "—"}
          </a>
          .
        </p>
        <Button asChild variant="outline" size="lg" className="mt-6">
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </div>
    </main>
  );
}
