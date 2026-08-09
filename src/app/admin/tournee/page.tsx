import type { Metadata } from "next";
import Link from "next/link";
import { Navigation, ChevronLeft, ChevronRight } from "lucide-react";
import { BoutonImprimer } from "@/components/admin/bouton-imprimer";
import { requireRole } from "@/lib/auth";
import { getTournee, lienTourneeComplete } from "@/server/tournee";
import { aujourdHui } from "@/server/creneaux";
import { addDays } from "@/domain/slots";
import { formatDateFr } from "@/lib/jours";
import { formatEuros, formatVolume } from "@/domain/units";
import { ArretCarte } from "@/components/admin/arret-carte";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Tournée du jour",
  robots: { index: false, follow: false },
};

function dateLisible(iso: string): string {
  return formatDateFr(iso, { annee: true });
}

export default async function PageTournee({ searchParams }: PageProps<"/admin/tournee">) {
  const session = await requireRole(["owner", "staff", "driver"], "/admin/tournee");
  const params = await searchParams;

  const date =
    typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : aujourdHui();

  const tournee = await getTournee(session.companyId, date);
  const lienComplet = lienTourneeComplete(tournee.arrets);

  return (
    <main className="p-5 sm:p-8">
      {/* En-tête : navigation par date + totaux de la journée */}
      <div className="flex flex-wrap items-start justify-between gap-4 print:block">
        <div>
          <h1 className="text-[28px] first-letter:uppercase sm:text-[36px]">
            {dateLisible(date)}
          </h1>
          <p className="text-cendre-clair mt-2 text-[17px]">
            {tournee.arrets.length === 0
              ? "Aucune livraison prévue"
              : `${tournee.arrets.length} livraison${tournee.arrets.length > 1 ? "s" : ""} · ${formatVolume(tournee.volumeTotalM3)} à charger`}
            {tournee.vehicules.length > 0 && ` · ${tournee.vehicules.join(", ")}`}
          </p>
          {tournee.aEncaisserCents > 0 && (
            <p className="text-seve mt-1 text-[17px] font-semibold">
              {formatEuros(tournee.aEncaisserCents)} à encaisser
              {tournee.especesCents > 0 && ` dont ${formatEuros(tournee.especesCents)} en espèces`}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <Button asChild variant="outline" size="default">
            <Link href={`/admin/tournee?date=${addDays(date, -1)}`}>
              <ChevronLeft strokeWidth={1.75} />
              Veille
            </Link>
          </Button>
          <Button asChild variant="outline" size="default">
            <Link href={`/admin/tournee?date=${addDays(date, 1)}`}>
              Lendemain
              <ChevronRight strokeWidth={1.75} />
            </Link>
          </Button>
        </div>
      </div>

      {tournee.arrets.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          {lienComplet && (
            <Button asChild variant="cta" size="lg">
              <a href={lienComplet} target="_blank" rel="noopener noreferrer">
                <Navigation strokeWidth={1.75} />
                Ouvrir toute la tournée dans Maps
              </a>
            </Button>
          )}
          {/* L'impression reste le filet de sécurité : pas de réseau en montagne. */}
          <BoutonImprimer />
        </div>
      )}

      {tournee.arrets.length === 0 ? (
        <p className="text-cendre-clair mt-10 text-[17px]">
          Rien à livrer ce jour-là. Les commandes apparaissent ici dès que vous avez confirmé leur
          date de livraison depuis la fiche commande.
        </p>
      ) : (
        <ol className="mt-8 space-y-4">
          {tournee.arrets.map((arret, index) => (
            <ArretCarte key={arret.orderId} arret={arret} numero={index + 1} />
          ))}
        </ol>
      )}
    </main>
  );
}
