import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getCartId, getPanier } from "@/server/panier";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { formatEuros, formatVolume } from "@/domain/units";
import { Etapes } from "@/components/commande/etapes";
import { FormulaireCoordonnees } from "@/components/commande/formulaire-coordonnees";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Vos coordonnées",
  robots: { index: false, follow: false },
};

export default async function PageCoordonnees() {
  const tenant = await requireTenant();
  const panier = await getPanier(tenant);

  if (panier.lignes.length === 0) {
    return (
      <main className="mx-auto max-w-[820px] px-5 py-20">
        <h1 className="text-[32px]">Votre panier est vide</h1>
        <Button asChild variant="cta" size="cta" className="mt-8">
          <Link href="/#commander">Voir le bois de chauffage</Link>
        </Button>
      </main>
    );
  }

  // Sans livraison chiffrée, on ne peut pas continuer : retour au panier.
  if (panier.livraison.devis?.status !== "ok") redirect("/panier");

  const cartId = await getCartId();
  const { data: brouillon } = await createSupabaseAdminClient()
    .from("carts")
    .select(
      `first_name, last_name, email, phone, address_line1, address_line2,
       access_notes, truck_access, unload_type, allow_unattended_delivery, delivery_notes`,
    )
    .eq("id", cartId!)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-[820px] px-5 py-12 sm:py-16">
      <Etapes courante="coordonnees" />

      <h1 className="mt-6 text-[32px] sm:text-[42px]">Où livrons-nous ?</h1>

      <div className="border-aubier-bord bg-aubier-pur mt-6 flex flex-wrap items-baseline justify-between gap-3 rounded-[8px] border p-4">
        <span className="text-cendre text-[15px]">
          {formatVolume(panier.totaux.totalVolumeM3)} · livraison à {panier.ville}
        </span>
        <span className="tabulaire text-[19px] font-semibold">
          {formatEuros(panier.totaux.totalCents)}
        </span>
      </div>

      <FormulaireCoordonnees
        valeurs={{
          firstName: brouillon?.first_name ?? null,
          lastName: brouillon?.last_name ?? null,
          email: brouillon?.email ?? null,
          phone: brouillon?.phone ?? null,
          addressLine1: brouillon?.address_line1 ?? null,
          addressLine2: brouillon?.address_line2 ?? null,
          accessNotes: brouillon?.access_notes ?? null,
          truckAccess: brouillon?.truck_access ?? "camion",
          unloadType: brouillon?.unload_type ?? null,
          allowUnattendedDelivery: brouillon?.allow_unattended_delivery ?? false,
          deliveryNotes: brouillon?.delivery_notes ?? null,
        }}
        ville={panier.ville}
        codePostal={panier.codePostal}
      />
    </main>
  );
}
