import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ChartNoAxesCombined } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getChiffresDuJour, getPointsDAttention, getResumeMois } from "@/server/admin";
import { formatEuros, formatVolume } from "@/domain/units";
import { evolutionPourcent } from "@/domain/statistics";
import { Button } from "@/components/ui/button";
import { Carte, PuceEvolution } from "@/components/admin/carte";

export const metadata: Metadata = {
  title: "Tableau de bord",
  robots: { index: false, follow: false },
};

const formatDateLongue = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function Chiffre({
  valeur,
  libelle,
  precision,
}: {
  valeur: string;
  libelle: string;
  precision?: string;
}) {
  return (
    <div>
      <p className="font-display tabulaire text-[40px] leading-none font-bold sm:text-[52px]">
        {valeur}
      </p>
      <p className="text-cendre-clair mt-2 text-[15px]">{libelle}</p>
      {precision && <p className="text-seve mt-0.5 text-[13px] font-semibold">{precision}</p>}
    </div>
  );
}

export default async function TableauDeBord() {
  const session = await requireRole(["owner", "staff"], "/admin");

  const [jour, points, mois] = await Promise.all([
    getChiffresDuJour(session.companyId),
    getPointsDAttention(session.companyId),
    getResumeMois(session.companyId),
  ]);

  const [y, m, d] = jour.date.split("-").map(Number);
  const dateLisible = formatDateLongue.format(new Date(Date.UTC(y, m - 1, d)));
  const evolution = evolutionPourcent(mois.caCents, mois.caMoisPrecedentCents);

  return (
    <main className="mx-auto w-full max-w-[1560px] p-5 sm:p-8">
      {/* ---- Bloc 1 : AUJOURD'HUI, le plus grand, en haut ---- */}
      <Carte className="p-6 sm:p-8">
        <p className="micro-label text-seve first-letter:uppercase">{dateLisible}</p>

        <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
          <Chiffre
            valeur={String(jour.livraisons)}
            libelle={jour.livraisons > 1 ? "livraisons prévues" : "livraison prévue"}
          />
          {/* Le libellé porte déjà l'unité : on n'affiche que le nombre. */}
          <Chiffre valeur={jour.volumeM3.toLocaleString("fr-FR")} libelle="m³ apparents à charger" />
          <Chiffre
            valeur={formatEuros(jour.aEncaisserCents)}
            libelle="à encaisser"
            precision={
              jour.enEspecesCents > 0
                ? `dont ${formatEuros(jour.enEspecesCents)} en espèces`
                : undefined
            }
          />
          <Chiffre
            valeur={String(jour.nouvellesCommandes)}
            libelle="nouvelles commandes depuis hier"
          />
        </div>

        <Button asChild variant="cta" size="cta" className="mt-7">
          <Link href="/admin/tournee">
            Ouvrir la tournée du jour
            <ArrowRight strokeWidth={1.75} />
          </Link>
        </Button>
      </Carte>

      {/* ---- Bloc 2 : ce qui demande une action ---- */}
      <section className="mt-8">
        <h2 className="text-[22px]">À traiter</h2>

        {points.length === 0 ? (
          <p className="text-cendre-clair mt-3 text-[17px]">Rien à traiter dans l&apos;immédiat.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {points.map((point) => (
              <li key={point.cle}>
                <Link
                  href={point.href}
                  className="border-ecorce-bord hover:bg-ecorce-eleve flex min-h-14 items-center gap-3 rounded-[12px] border px-4 py-3 transition-colors"
                >
                  <AlertTriangle
                    size={20}
                    strokeWidth={1.9}
                    className="text-alerte shrink-0"
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-[17px]">{point.libelle}</span>
                  <ArrowRight
                    size={18}
                    strokeWidth={1.75}
                    className="text-cendre-clair shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Bloc 3 : activité du mois ---- */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px]">Ce mois-ci</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/statistiques">
              <ChartNoAxesCombined size={17} strokeWidth={1.9} aria-hidden="true" />
              Voir toutes les statistiques
            </Link>
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Carte>
            <p className="text-cendre-clair text-[14px]">Chiffre d&apos;affaires</p>
            <p className="font-display tabulaire mt-2 text-[28px] leading-none font-bold">
              {formatEuros(mois.caCents)}
            </p>
            <div className="mt-3">
              <PuceEvolution valeur={evolution} suffixe="vs mois dernier" />
            </div>
          </Carte>
          <Carte>
            <p className="text-cendre-clair text-[14px]">Commandes</p>
            <p className="font-display tabulaire mt-2 text-[28px] leading-none font-bold">
              {mois.commandes}
            </p>
          </Carte>
          <Carte>
            <p className="text-cendre-clair text-[14px]">Volume vendu</p>
            <p className="font-display tabulaire mt-2 text-[28px] leading-none font-bold">
              {formatVolume(mois.volumeM3)}
            </p>
          </Carte>
        </div>
      </section>
    </main>
  );
}
