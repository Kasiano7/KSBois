import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getPanier } from "@/server/panier";
import { listerCreneauxDisponibles, grouperParDate, formatDateCreneau } from "@/server/creneaux";
import { joursDeLivraison } from "@/server/zones";
import { isLastPlaces } from "@/domain/slots";
import { Etapes } from "@/components/commande/etapes";
import { ChoixCreneau } from "@/components/commande/choix-creneau";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Choisir un créneau",
  robots: { index: false, follow: false },
};

export default async function PageCreneau() {
  const tenant = await requireTenant();
  const panier = await getPanier(tenant);

  if (panier.lignes.length === 0) redirect("/panier");
  if (panier.livraison.resolution?.status !== "ok") redirect("/panier");

  const { commune, zone } = panier.livraison.resolution;

  const creneaux = await listerCreneauxDisponibles({
    companyId: tenant.id,
    volumeM3: panier.totaux.totalVolumeM3,
    zoneId: zone.id,
    joursAutorises: joursDeLivraison(commune, zone),
    leadTimeDaysZone: zone.leadTimeDays,
  });

  const groupes = grouperParDate(creneaux).map((g) => ({
    date: g.date,
    dateLisible: formatDateCreneau(g.date),
    creneaux: g.creneaux.map((c) => ({
      id: c.slot.id,
      dateLisible: formatDateCreneau(c.slot.date),
      label: c.slot.label,
      dernieresPlaces: isLastPlaces(c),
    })),
  }));

  return (
    <main className="mx-auto max-w-[820px] px-5 py-12 sm:py-16">
      <Etapes courante="creneau" />

      <h1 className="mt-6 text-[32px] sm:text-[42px]">Quand souhaitez-vous être livré ?</h1>

      <p className="text-cendre prose-bois mt-4 text-[17px] leading-relaxed">
        Choisissez le créneau qui vous arrange. <strong className="text-encre">Nous vous
        confirmons la date par email sous 24 heures</strong> — le bois, la météo et les chemins
        réservent parfois des surprises, nous préférons vous annoncer une date que nous tiendrons.
      </p>

      {groupes.length === 0 ? (
        <div className="border-alerte/30 bg-alerte/8 mt-8 rounded-[6px] border p-5">
          <p className="font-semibold">Aucun créneau disponible pour votre commande</p>
          <p className="mt-2 text-[15px] leading-relaxed">
            Votre volume ({panier.totaux.totalVolumeM3.toLocaleString("fr-FR")} m³ apparents) ne
            rentre dans aucun créneau ouvert pour {commune.city} sur la période de réservation.
            Contactez-nous, nous organiserons une livraison sur mesure.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="default" size="lg">
              <Link href="/devis">Demander un devis</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/panier">Réduire ma commande</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ChoixCreneau groupes={groupes} />
      )}
    </main>
  );
}
