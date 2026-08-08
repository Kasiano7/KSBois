import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getChiffresDuJour, getPointsDAttention, getResumeMois } from "@/server/admin";
import { formatEuros, formatVolume } from "@/domain/units";
import { Button } from "@/components/ui/button";

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

  const evolution =
    mois.caMoisPrecedentCents > 0
      ? Math.round(((mois.caCents - mois.caMoisPrecedentCents) / mois.caMoisPrecedentCents) * 100)
      : null;

  return (
    <main className="p-5 sm:p-8">
      {/* ---- Bloc 1 : AUJOURD'HUI, le plus grand, en haut ---- */}
      <section className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-6 sm:p-8">
        <p className="micro-label text-seve first-letter:uppercase">{dateLisible}</p>

        <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
          <Chiffre valeur={String(jour.livraisons)} libelle={jour.livraisons > 1 ? "livraisons prévues" : "livraison prévue"} />
          {/* Le libellé porte déjà l'unité : on n'affiche que le nombre. */}
          <Chiffre valeur={jour.volumeM3.toLocaleString("fr-FR")} libelle="m³ apparents à charger" />
          <Chiffre
            valeur={formatEuros(jour.aEncaisserCents)}
            libelle="à encaisser"
            precision={jour.enEspecesCents > 0 ? `dont ${formatEuros(jour.enEspecesCents)} en espèces` : undefined}
          />
          <Chiffre valeur={String(jour.nouvellesCommandes)} libelle="nouvelles commandes depuis hier" />
        </div>

        <Button asChild variant="cta" size="cta" className="mt-7">
          <Link href="/admin/tournee">
            Ouvrir la tournée du jour
            <ArrowRight strokeWidth={1.75} />
          </Link>
        </Button>
      </section>

      {/* ---- Bloc 2 : ce qui demande une action ---- */}
      <section className="mt-8">
        <h2 className="text-[22px]">À traiter</h2>

        {points.length === 0 ? (
          <p className="text-cendre-clair mt-3 text-[17px]">
            Rien à traiter dans l&apos;immédiat.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {points.map((point) => (
              <li key={point.cle}>
                <Link
                  href={point.href}
                  className="border-ecorce-bord hover:bg-ecorce-eleve flex min-h-14 items-center gap-3 rounded-[6px] border px-4 py-3 transition-colors"
                >
                  <AlertTriangle
                    size={20}
                    strokeWidth={1.9}
                    className="text-alerte shrink-0"
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-[17px]">{point.libelle}</span>
                  <ArrowRight size={18} strokeWidth={1.75} className="text-cendre-clair shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Bloc 3 : activité du mois ---- */}
      <section className="mt-10">
        <h2 className="text-[22px]">Ce mois-ci</h2>
        <div className="border-ecorce-bord mt-4 grid gap-6 rounded-[8px] border p-6 sm:grid-cols-3">
          <div>
            <p className="text-cendre-clair text-[15px]">Chiffre d&apos;affaires</p>
            <p className="tabulaire mt-1 text-[28px] font-bold">{formatEuros(mois.caCents)}</p>
            {evolution !== null && (
              <p
                className={`mt-1 flex items-center gap-1.5 text-[15px] ${
                  evolution >= 0 ? "text-succes" : "text-alerte"
                }`}
              >
                {evolution >= 0 ? (
                  <TrendingUp size={17} strokeWidth={1.9} aria-hidden="true" />
                ) : (
                  <TrendingDown size={17} strokeWidth={1.9} aria-hidden="true" />
                )}
                {evolution >= 0 ? "+" : ""}
                {evolution} % vs mois dernier
              </p>
            )}
          </div>
          <div>
            <p className="text-cendre-clair text-[15px]">Commandes</p>
            <p className="tabulaire mt-1 text-[28px] font-bold">{mois.commandes}</p>
          </div>
          <div>
            <p className="text-cendre-clair text-[15px]">Volume vendu</p>
            <p className="tabulaire mt-1 text-[28px] font-bold">{formatVolume(mois.volumeM3)}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
