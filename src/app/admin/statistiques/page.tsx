import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeEuro,
  CalendarClock,
  ChartNoAxesCombined,
  CircleGauge,
  FileText,
  PackageOpen,
  Route,
  ShoppingCart,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { formatEuros, formatEurosCompact, formatVolume } from "@/domain/units";
import {
  getRapportStatistiques,
  resoudrePeriodeStatistiques,
  type LignePrixM3,
  type LigneStock,
} from "@/server/statistiques";
import { Button } from "@/components/ui/button";
import { Carte, EnteteCarte, PuceEvolution } from "@/components/admin/carte";
import { Courbe, type PointCourbe } from "@/components/admin/graphiques/courbe";
import { Sparkline } from "@/components/admin/graphiques/sparkline";
import { Anneau } from "@/components/admin/graphiques/anneau";
import { BarresClassees, type LigneBarre } from "@/components/admin/graphiques/barres";
import { Jauge } from "@/components/admin/graphiques/jauge";

export const metadata: Metadata = {
  title: "Statistiques",
  robots: { index: false, follow: false },
};

/* ==========================================================================
   Formatage
   ========================================================================== */

function premier(parametre: string | string[] | undefined): string | undefined {
  return Array.isArray(parametre) ? parametre[0] : parametre;
}

function formatPourcentage(valeur: number | null, chiffres = 0): string {
  return valeur === null
    ? "—"
    : `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: chiffres })} %`;
}

function formatDateCourte(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(typeof date === "string" ? new Date(date) : date);
}

function formatMois(cle: string): string {
  const [annee, mois] = cle.split("-").map(Number);
  if (!annee || !mois) return cle;
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(annee, mois - 1, 1)))
    .replace(/^./, (lettre) => lettre.toUpperCase());
}

function formatMoisCourt(cle: string): string {
  const [annee, mois] = cle.split("-").map(Number);
  if (!annee || !mois) return cle;
  return new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(annee, mois - 1, 1)))
    .replace(".", "");
}

function formatDureeHeures(heures: number | null): string {
  if (heures === null) return "—";
  if (heures < 24) return `${Math.round(heures)} h`;
  return `${(heures / 24).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`;
}

function formatVolumeCompact(m3: number): string {
  return `${m3.toLocaleString("fr-FR", { maximumFractionDigits: m3 < 10 ? 1 : 0 })} m³`;
}

/* ==========================================================================
   Briques d'affichage
   ========================================================================== */

/** Tuile d'en-tête : le chiffre en grand, la tendance dessous, la courbe au fond. */
function Tuile({
  libelle,
  valeur,
  precision,
  evolution,
  serie,
  couleur,
  sensInverse,
}: {
  libelle: string;
  valeur: string;
  precision?: string;
  evolution?: number | null;
  serie?: number[];
  couleur?: string;
  sensInverse?: boolean;
}) {
  return (
    <Carte className="flex flex-col justify-between gap-4 p-5">
      <div>
        <p className="text-cendre-clair text-[13px]">{libelle}</p>
        <p className="font-display tabulaire mt-2 text-[30px] leading-none font-bold">{valeur}</p>
        {precision && <p className="text-cendre-clair mt-2 text-[12px]">{precision}</p>}
        {evolution !== undefined && (
          <div className="mt-3">
            <PuceEvolution valeur={evolution} sensInverse={sensInverse} />
          </div>
        )}
      </div>
      {serie && serie.length > 1 && (
        <Sparkline valeurs={serie} couleur={couleur} hauteur={40} />
      )}
    </Carte>
  );
}

/** Indicateur nu, sans courbe : utilisé dans les blocs de détail. */
function Kpi({
  libelle,
  valeur,
  precision,
  ton,
}: {
  libelle: string;
  valeur: string;
  precision?: string;
  ton?: "positif" | "negatif";
}) {
  return (
    <Carte ton="creuse" className="p-4">
      <p className="text-cendre-clair text-[13px]">{libelle}</p>
      <p
        className={`tabulaire mt-2 text-[23px] leading-none font-bold ${
          ton === "positif"
            ? "text-graphique-positif"
            : ton === "negatif"
              ? "text-graphique-negatif"
              : ""
        }`}
      >
        {valeur}
      </p>
      {precision && <p className="text-cendre-clair mt-2 text-[12px]">{precision}</p>}
    </Carte>
  );
}

function TitreSection({
  id,
  titre,
  description,
  Icone,
}: {
  id: string;
  titre: string;
  description: string;
  Icone: typeof ChartNoAxesCombined;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icone className="text-seve mt-1 shrink-0" size={21} strokeWidth={1.75} aria-hidden="true" />
      <div>
        <h2 id={id} className="text-[22px]">
          {titre}
        </h2>
        <p className="text-cendre-clair mt-1 max-w-[80ch] text-[14px] leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

function EtatVide({ texte }: { texte: string }) {
  return (
    <Carte ton="creuse" className="border-dashed">
      <p className="text-cendre-clair text-[15px]">{texte}</p>
    </Carte>
  );
}

/** Prix moyen au m³, en barres classées : le classement se lit avant le chiffre. */
function ClassementPrix({
  titre,
  lignes,
  parMois = false,
  couleur,
}: {
  titre: string;
  lignes: LignePrixM3[];
  parMois?: boolean;
  couleur?: string;
}) {
  const barres: LigneBarre[] = lignes.map((ligne) => ({
    cle: ligne.cle,
    libelle: parMois ? formatMois(ligne.libelle) : ligne.libelle,
    valeur: ligne.volumeM3,
    valeurAffichee: `${formatEuros(ligne.prixMoyenCents)}/m³`,
    precision: `${formatVolume(ligne.volumeM3)} · ${formatEuros(ligne.caBoisCents)} de bois`,
  }));

  return (
    <Carte>
      <h3 className="text-[16px]">{titre}</h3>
      <p className="text-cendre-clair mt-1 text-[12px]">Barre = volume vendu</p>
      <BarresClassees lignes={barres} couleur={couleur} texteVide="Aucune vente sur la période." />
    </Carte>
  );
}

const LIBELLE_PRIORITE: Record<LigneStock["priorite"], string> = {
  urgent: "À produire maintenant",
  a_produire: "À produire bientôt",
  a_surveiller: "À surveiller",
  stable: "Stock stable",
};

const CLASSE_PRIORITE: Record<LigneStock["priorite"], string> = {
  urgent: "border-erreur/50 bg-erreur/15 text-[#FFB4B4]",
  a_produire: "border-alerte/50 bg-alerte/15 text-[#FFD39A]",
  a_surveiller: "border-seve/40 bg-seve/10 text-seve",
  stable: "border-graphique-positif/40 bg-graphique-positif/10 text-graphique-positif",
};

const PERIODES: Array<[string, string]> = [
  ["30j", "30 jours"],
  ["90j", "90 jours"],
  ["saison", "Saison de chauffe"],
  ["12m", "12 mois"],
];

/** Verdict écrit à côté de chaque jauge : un pourcentage nu ne se juge pas. */
function verdictConversion(taux: number | null): string {
  if (taux === null) return "Pas encore mesurable";
  if (taux >= 3) return "Très bon";
  if (taux >= 1.5) return "Correct";
  if (taux > 0) return "À améliorer";
  return "Aucune commande";
}

function verdictAutomatisation(taux: number | null): string {
  if (taux === null) return "Aucune vente";
  if (taux >= 70) return "Le site porte les ventes";
  if (taux >= 40) return "Site et téléphone à parts";
  return "Le téléphone domine";
}

/* ==========================================================================
   Page
   ========================================================================== */

export default async function PageStatistiques(props: PageProps<"/admin/statistiques">) {
  const session = await requireRole(["owner", "staff"], "/admin/statistiques");
  const params = await props.searchParams;
  const periode = resoudrePeriodeStatistiques({
    periode: premier(params.periode),
    debut: premier(params.debut),
    fin: premier(params.fin),
  });
  const rapport = await getRapportStatistiques(session.companyId, periode);
  const { serie, synthese } = rapport;

  const pointsCa: PointCourbe[] = serie.points.map((point) => ({
    cle: point.cle,
    libelle: point.libelle,
    libelleCourt: point.libelleCourt,
    valeur: point.caCents,
  }));
  const pointsCommandes: PointCourbe[] = serie.points.map((point) => ({
    cle: point.cle,
    libelle: point.libelle,
    libelleCourt: point.libelleCourt,
    valeur: point.commandes,
  }));
  const pointsVolume: PointCourbe[] = serie.points.map((point) => ({
    cle: point.cle,
    libelle: point.libelle,
    libelleCourt: point.libelleCourt,
    valeur: point.volumeM3,
  }));
  const pointsPrixMois: PointCourbe[] = rapport.prixParMois.map((ligne) => ({
    cle: ligne.cle,
    libelle: formatMois(ligne.libelle),
    libelleCourt: formatMoisCourt(ligne.libelle),
    valeur: ligne.prixMoyenCents,
  }));

  const couleursOrigine: Record<string, string> = {
    web: "var(--graphique-2)",
    phone: "var(--graphique-4)",
    admin: "var(--graphique-5)",
  };

  const maxTunnel = Math.max(1, rapport.tunnel[0]?.total ?? 0);
  const conversionGlobale =
    maxTunnel > 0 && rapport.tunnel.length > 0
      ? ((rapport.tunnel.at(-1)?.total ?? 0) / maxTunnel) * 100
      : null;

  return (
    <main className="mx-auto w-full max-w-[1560px] p-5 sm:p-8">
      {/* ---- En-tête et choix de la période ---- */}
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="micro-label text-seve">Pilotage de l&apos;activité</p>
          <h1 className="mt-2 text-[32px] sm:text-[40px]">Statistiques</h1>
          <p className="text-cendre-clair mt-2 max-w-[72ch] text-[16px]">
            Ce qui se vend, ce qui bloque les clients et ce qu&apos;il faut préparer ensuite.
            Période affichée : <strong className="text-aubier">{rapport.periode.libelle}</strong>,{" "}
            {serie.libelleGranularite}.
          </p>
        </div>

        <div
          className="border-ecorce-bord bg-ecorce-eleve flex flex-wrap gap-1 rounded-[12px] border p-1"
          aria-label="Choisir une période"
        >
          {PERIODES.map(([cle, libelle]) => {
            const actif = periode.cle === cle;
            return (
              <Link
                key={cle}
                href={`/admin/statistiques?periode=${cle}`}
                aria-current={actif ? "true" : undefined}
                className={`flex min-h-10 items-center rounded-[9px] px-3.5 text-[14px] font-semibold transition-colors ${
                  actif ? "bg-seve text-encre" : "text-cendre-clair hover:bg-aubier/10"
                }`}
              >
                {libelle}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Période sur mesure : repliée, parce qu'elle sert une fois sur vingt. */}
      <details className="group mt-4" open={periode.cle === "personnalisee"}>
        <summary className="text-cendre-clair hover:text-aubier inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-[14px] font-semibold">
          <SlidersHorizontal size={16} strokeWidth={1.9} aria-hidden="true" />
          Choisir des dates précises
        </summary>
        <form
          method="get"
          className="border-ecorce-bord bg-ecorce-eleve mt-3 grid gap-3 rounded-[12px] border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <input type="hidden" name="periode" value="personnalisee" />
          <label className="text-[14px] font-semibold">
            Du
            <input
              name="debut"
              type="date"
              defaultValue={
                periode.cle === "personnalisee" ? periode.debut.toISOString().slice(0, 10) : ""
              }
              className="border-ecorce-bord bg-ecorce mt-2 block h-11 w-full rounded-[6px] border px-3 text-[16px]"
            />
          </label>
          <label className="text-[14px] font-semibold">
            Au
            <input
              name="fin"
              type="date"
              defaultValue={
                periode.cle === "personnalisee"
                  ? new Date(periode.fin.getTime() - 86_400_000).toISOString().slice(0, 10)
                  : ""
              }
              className="border-ecorce-bord bg-ecorce mt-2 block h-11 w-full rounded-[6px] border px-3 text-[16px]"
            />
          </label>
          <Button type="submit">Afficher cette période</Button>
        </form>
      </details>

      {/* ---- Synthèse : quatre tuiles, chacune avec sa courbe ---- */}
      <section aria-labelledby="synthese" className="mt-7">
        <h2 id="synthese" className="sr-only">
          Synthèse de la période
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tuile
            libelle="Chiffre d'affaires TTC"
            valeur={formatEuros(synthese.caCents)}
            precision="Commandes non annulées"
            evolution={synthese.evolutionCaPct}
            serie={serie.points.map((point) => point.caCents)}
            couleur="var(--graphique-1)"
          />
          <Tuile
            libelle="Commandes"
            valeur={String(synthese.commandes)}
            precision={
              synthese.panierMoyenCents === null
                ? undefined
                : `Panier moyen ${formatEuros(synthese.panierMoyenCents)}`
            }
            evolution={synthese.evolutionCommandesPct}
            serie={serie.points.map((point) => point.commandes)}
            couleur="var(--graphique-2)"
          />
          <Tuile
            libelle="Volume vendu"
            valeur={formatVolume(synthese.volumeM3)}
            precision="Toutes essences et longueurs"
            serie={serie.points.map((point) => point.volumeM3)}
            couleur="var(--graphique-4)"
          />
          <Tuile
            libelle="Prix réellement vendu"
            valeur={
              synthese.prixMoyenM3Cents === null
                ? "—"
                : `${formatEuros(synthese.prixMoyenM3Cents)}/m³`
            }
            precision="Bois après remise, hors livraison et options"
          />
        </div>
      </section>

      {/* ---- La grande courbe + la répartition par origine ---- */}
      <section aria-labelledby="evolution" className="mt-6 grid gap-4 xl:grid-cols-[1.9fr_1fr]">
        <Carte className="p-5 sm:p-6">
          <EnteteCarte
            titre="Chiffre d'affaires dans le temps"
            description={`Une valeur ${serie.libelleGranularite}. La courbe en pointillé est la période précédente de même durée, recalée au même rang de jour.`}
          />
          <h2 id="evolution" className="sr-only">
            Évolution du chiffre d&apos;affaires
          </h2>
          <div className="mt-6">
            <Courbe
              points={pointsCa}
              comparaison={serie.caPrecedentCents}
              formatValeur={formatEurosCompact}
              legende={`Chiffre d'affaires ${serie.libelleGranularite}`}
              legendeComparaison="Période précédente"
              titreAccessible={`Chiffre d'affaires ${serie.libelleGranularite} sur ${rapport.periode.libelle}`}
              hauteur={250}
            />
          </div>
        </Carte>

        <Carte className="p-5 sm:p-6">
          <EnteteCarte
            titre="Origine des commandes"
            description="La part du site mesure ce qui se vend sans vous."
            Icone={ShoppingCart}
          />
          <div className="mt-5">
            <Anneau
              parts={rapport.origines.map((origine) => ({
                cle: origine.cle,
                libelle: origine.libelle,
                valeur: origine.commandes,
                precision: `${origine.commandes} cde · ${formatEuros(origine.caCents)}`,
                couleur: couleursOrigine[origine.cle] ?? "var(--graphique-5)",
              }))}
              total={synthese.commandes}
              centreValeur={String(synthese.commandes)}
              centreLibelle="commandes"
              titreAccessible="Répartition des commandes par origine"
            />
          </div>
          <div className="border-ecorce-bord mt-5 flex items-center gap-4 border-t pt-5">
            <Jauge
              pourcentage={rapport.tauxAutomatisationCommandesPct}
              verdict={verdictAutomatisation(rapport.tauxAutomatisationCommandesPct)}
              taille={104}
            />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">Automatisation par le site</p>
              <p className="text-cendre-clair mt-1 text-[13px]">
                {formatPourcentage(rapport.tauxAutomatisationCaPct)} du chiffre d&apos;affaires
                arrive sans intervention.
              </p>
            </div>
          </div>
        </Carte>
      </section>

      {/* ---- Commandes et volume, côte à côte ---- */}
      <section aria-labelledby="rythme" className="mt-4 grid gap-4 lg:grid-cols-2">
        <h2 id="rythme" className="sr-only">
          Rythme des commandes et des volumes
        </h2>
        <Carte className="p-5 sm:p-6">
          <EnteteCarte titre="Nombre de commandes" />
          <div className="mt-5">
            <Courbe
              points={pointsCommandes}
              formatValeur={(valeur) => valeur.toLocaleString("fr-FR")}
              legende={`Commandes ${serie.libelleGranularite}`}
              titreAccessible={`Nombre de commandes ${serie.libelleGranularite}`}
              couleur="var(--graphique-2)"
              hauteur={170}
            />
          </div>
        </Carte>
        <Carte className="p-5 sm:p-6">
          <EnteteCarte titre="Volume livré" />
          <div className="mt-5">
            <Courbe
              points={pointsVolume}
              formatValeur={formatVolumeCompact}
              legende={`Volume ${serie.libelleGranularite}`}
              titreAccessible={`Volume vendu ${serie.libelleGranularite}, en mètres cubes apparents`}
              couleur="var(--graphique-4)"
              hauteur={170}
            />
          </div>
        </Carte>
      </section>

      {/* ---- Tunnel de conversion ---- */}
      <section aria-labelledby="tunnel" className="mt-10">
        <TitreSection
          id="tunnel"
          titre="Tunnel de conversion"
          description="Chaque nombre correspond à une session anonyme. La perte est affectée à la dernière étape atteinte, sans suivre une personne au-delà de 30 minutes."
          Icone={Route}
        />
        {!rapport.couvertureAnalyticsDepuis ? (
          <div className="mt-5">
            <EtatVide texte="La mesure du parcours commencera dès que la migration Statistiques sera appliquée. Les commandes historiques restent visibles dans les autres blocs." />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
            <Carte className="p-5 sm:p-6">
              <p className="text-cendre-clair text-[13px]">
                Mesure disponible depuis le{" "}
                <strong className="text-aubier">
                  {formatDateCourte(rapport.couvertureAnalyticsDepuis)}
                </strong>
                . Les périodes antérieures ne sont pas reconstituées.
              </p>
              <ol className="mt-5 space-y-4">
                {rapport.tunnel.map((etape, index) => (
                  <li key={etape.cle}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-medium">
                        <span className="text-cendre-clair tabulaire mr-2 text-[13px]">
                          {index + 1}.
                        </span>
                        {etape.libelle}
                      </span>
                      <span className="tabulaire shrink-0 text-[16px] font-bold">
                        {etape.total.toLocaleString("fr-FR")}
                      </span>
                    </div>
                    <div className="bg-ecorce mt-2 h-2.5 overflow-hidden rounded-full">
                      <div
                        className="bg-graphique-1 h-full rounded-full"
                        style={{
                          width: `${Math.max(1.5, Math.min(100, (etape.total / maxTunnel) * 100))}%`,
                        }}
                      />
                    </div>
                    {etape.abandonAvantSuivante !== null && (
                      <p className="text-cendre-clair mt-1.5 text-[12px]">
                        {formatPourcentage(etape.conversionSuivantePct)} continuent ·{" "}
                        {etape.abandonAvantSuivante.toLocaleString("fr-FR")} abandon
                        {etape.abandonAvantSuivante > 1 ? "s" : ""} à cette étape
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </Carte>

            <Carte className="flex flex-col items-center justify-center gap-4 p-5 text-center">
              <Jauge
                pourcentage={conversionGlobale}
                verdict={verdictConversion(conversionGlobale)}
                couleur="var(--graphique-1)"
              />
              <div>
                <p className="text-[15px] font-semibold">Visiteur → commande</p>
                <p className="text-cendre-clair mt-1 text-[13px]">
                  Part des visiteurs qui vont jusqu&apos;à la commande.
                </p>
              </div>
            </Carte>
          </div>
        )}
      </section>

      {/* ---- Demande perdue ---- */}
      <section aria-labelledby="pertes" className="mt-10">
        <TitreSection
          id="pertes"
          titre="Demande perdue"
          description="Les montants ci-dessous sont des estimations issues du panier au moment du blocage. Ils ne sont jamais ajoutés au chiffre d'affaires réel."
          Icone={AlertTriangle}
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <Kpi libelle="Blocages détectés" valeur={String(rapport.pertesTotal.occurrences)} />
            <Kpi
              libelle="Chiffre d'affaires potentiel"
              valeur={formatEuros(rapport.pertesTotal.caPotentielCents)}
              precision="Estimation, pas une vente"
              ton={rapport.pertesTotal.caPotentielCents > 0 ? "negatif" : undefined}
            />
            <Kpi
              libelle="Volume potentiel"
              valeur={formatVolume(rapport.pertesTotal.volumePotentielM3)}
            />
          </div>
          <Carte>
            <h3 className="text-[16px]">Pourquoi les clients bloquent</h3>
            <p className="text-cendre-clair mt-1 text-[12px]">
              Barre = chiffre d&apos;affaires potentiel perdu
            </p>
            <BarresClassees
              couleur="var(--graphique-3)"
              texteVide="Aucun blocage mesuré sur cette période."
              lignes={rapport.pertes.map((perte) => ({
                cle: perte.motif,
                libelle: perte.libelle,
                valeur: perte.caPotentielCents,
                valeurAffichee: formatEuros(perte.caPotentielCents),
                precision: `${perte.occurrences} occurrence${perte.occurrences > 1 ? "s" : ""} · ${formatVolume(perte.volumePotentielM3)} potentiels`,
              }))}
            />
          </Carte>
        </div>
      </section>

      {/* ---- Prix réellement vendu ---- */}
      <section aria-labelledby="prix" className="mt-10">
        <TitreSection
          id="prix"
          titre="Prix moyen réellement vendu au m³"
          description="Le prix du bois tient compte de la remise réellement accordée. Livraison et options sont exclues pour comparer les formats honnêtement."
          Icone={BadgeEuro}
        />
        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1.3fr]">
          <ClassementPrix titre="Par essence" lignes={rapport.prixParEssence} />
          <ClassementPrix
            titre="Par longueur"
            lignes={rapport.prixParLongueur}
            couleur="var(--graphique-2)"
          />
          <ClassementPrix
            titre="Par zone"
            lignes={rapport.prixParZone}
            couleur="var(--graphique-4)"
          />
          <Carte>
            <h3 className="text-[16px]">Mois après mois</h3>
            <p className="text-cendre-clair mt-1 text-[12px]">
              Une dérive lente du prix moyen ne se voit pas dans un total.
            </p>
            <div className="mt-5">
              {pointsPrixMois.length > 1 ? (
                <Courbe
                  points={pointsPrixMois}
                  formatValeur={formatEurosCompact}
                  legende="Prix moyen du m³"
                  titreAccessible="Prix moyen du mètre cube apparent, mois après mois"
                  couleur="var(--graphique-1)"
                  hauteur={150}
                />
              ) : (
                <p className="text-cendre-clair text-[14px]">
                  Il faut au moins deux mois de ventes pour tracer une tendance.
                </p>
              )}
            </div>
          </Carte>
        </div>
      </section>

      {/* ---- Stock ---- */}
      <section aria-labelledby="stock" className="mt-10">
        <TitreSection
          id="stock"
          titre="Rotation et autonomie du stock"
          description="La vitesse utilise les ventes récentes. Les seuils d'urgence et la durée observée sont stockés dans les réglages de l'entreprise."
          Icone={PackageOpen}
        />
        {rapport.stock.length === 0 ? (
          <div className="mt-5">
            <EtatVide texte="Aucun format actif à analyser." />
          </div>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {rapport.stock.map((ligne) => (
              <Carte key={ligne.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[16px]">{ligne.libelle}</h3>
                    <p className="text-cendre-clair mt-1 font-mono text-[12px]">{ligne.sku}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${CLASSE_PRIORITE[ligne.priorite]}`}
                  >
                    {LIBELLE_PRIORITE[ligne.priorite]}
                  </span>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <dt className="text-cendre-clair text-[12px]">Disponible</dt>
                    <dd className="tabulaire mt-1 font-semibold">
                      {formatVolume(ligne.disponibleM3)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-cendre-clair text-[12px]">Réservé</dt>
                    <dd className="tabulaire mt-1 font-semibold">
                      {formatVolume(ligne.reserveM3)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-cendre-clair text-[12px]">Vente / semaine</dt>
                    <dd className="tabulaire mt-1 font-semibold">
                      {formatVolume(ligne.vitesseM3ParSemaine)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-cendre-clair text-[12px]">Autonomie</dt>
                    <dd className="tabulaire mt-1 font-semibold">
                      {ligne.joursRestants === null ? "Pas assez de ventes" : `${ligne.joursRestants} j`}
                    </dd>
                  </div>
                </dl>
                {ligne.rupturePrevueLe && (
                  <p className="text-cendre-clair mt-4 text-[13px]">
                    Rupture prévue vers le{" "}
                    <strong className="text-aubier">{formatDateCourte(ligne.rupturePrevueLe)}</strong>{" "}
                    si le rythme continue.
                  </p>
                )}
              </Carte>
            ))}
          </div>
        )}
      </section>

      {/* ---- Devis et clients à réactiver ---- */}
      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <section aria-labelledby="devis">
          <TitreSection
            id="devis"
            titre="Performance des devis"
            description="Demandes reçues, réponses envoyées et décisions du client sur la période."
            Icone={FileText}
          />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi libelle="Reçus" valeur={String(rapport.devis.recus)} />
            <Kpi libelle="Envoyés" valeur={String(rapport.devis.envoyes)} />
            <Kpi libelle="Acceptés" valeur={String(rapport.devis.acceptes)} ton="positif" />
            <Kpi libelle="Refusés" valeur={String(rapport.devis.refuses)} ton="negatif" />
          </div>
          <Carte className="mt-3 flex flex-wrap items-center gap-6">
            <Jauge
              pourcentage={rapport.devis.conversionPct}
              verdict={
                rapport.devis.conversionPct === null ? "Aucune décision" : "Devis acceptés"
              }
              taille={112}
            />
            <dl className="min-w-[180px] flex-1 space-y-3 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-cendre-clair">Montant gagné</dt>
                <dd className="tabulaire text-graphique-positif font-bold">
                  {formatEuros(rapport.devis.montantGagneCents)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-cendre-clair">Montant perdu</dt>
                <dd className="tabulaire text-graphique-negatif font-bold">
                  {formatEuros(rapport.devis.montantPerduCents)}
                </dd>
              </div>
              <div className="border-ecorce-bord flex justify-between gap-3 border-t pt-3">
                <dt className="text-cendre-clair">Délai de réponse moyen</dt>
                <dd className="tabulaire font-bold">
                  {formatDureeHeures(rapport.devis.delaiReponseHeures)}
                </dd>
              </div>
            </dl>
          </Carte>
        </section>

        <section aria-labelledby="reactivation">
          <TitreSection
            id="reactivation"
            titre="Clients à réactiver"
            description="La date probable vient de l'intervalle médian entre leurs commandes. Une seule commande ne suffit pas pour faire une prédiction."
            Icone={UsersRound}
          />
          {rapport.clientsAReactiver.length === 0 ? (
            <div className="mt-5">
              <EtatVide texte="Aucun client n'arrive dans sa fenêtre probable de recommande." />
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {rapport.clientsAReactiver.slice(0, 8).map((client) => (
                <li key={client.email}>
                  <Carte className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{client.nom}</p>
                        <a
                          className="text-seve mt-0.5 block truncate text-[13px] underline-offset-4 hover:underline"
                          href={`mailto:${client.email}`}
                        >
                          {client.email}
                        </a>
                      </div>
                      {client.telephone && (
                        <Button asChild variant="outline" size="sm">
                          <a href={`tel:${client.telephone}`}>Appeler</a>
                        </Button>
                      )}
                    </div>
                    <p className="text-cendre-clair mt-3 text-[13px]">
                      Prochaine commande estimée :{" "}
                      <strong className="text-aubier">
                        {formatDateCourte(client.prochaineCommandePrevueLe)}
                      </strong>{" "}
                      · rythme habituel {client.intervalleJours} j · {client.commandes} commandes
                    </p>
                  </Carte>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---- Zones de livraison ---- */}
      <section aria-labelledby="zones" className="mt-10">
        <TitreSection
          id="zones"
          titre="Rentabilité et délai des livraisons"
          description="Les frais facturés sont comparés au carburant réellement retenu sur la commande et au coût kilométrique du véhicule. La main-d'œuvre n'est pas encore incluse."
          Icone={CircleGauge}
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Carte ton="accent">
            <p className="text-cendre-clair text-[13px]">Délai commande → livraison</p>
            <p className="font-display tabulaire mt-2 text-[28px] leading-none font-bold">
              {rapport.delaiLivraisonGlobalJours === null
                ? "—"
                : `${rapport.delaiLivraisonGlobalJours.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`}
            </p>
            <p className="text-cendre-clair mt-2 text-[12px]">
              Moyenne globale des commandes livrées
            </p>
          </Carte>
          {rapport.zones.slice(0, 7).map((zone) => (
            <Carte key={zone.zone}>
              <h3 className="text-[16px]">{zone.zone}</h3>
              <p className="text-cendre-clair mt-1 text-[12px]">
                {zone.livraisons} livraison{zone.livraisons > 1 ? "s" : ""}
              </p>
              <dl className="mt-4 space-y-2 text-[14px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-cendre-clair">Facturé</dt>
                  <dd className="tabulaire">{formatEuros(zone.fraisFacturesCents)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-cendre-clair">Coût estimé</dt>
                  <dd className="tabulaire">{formatEuros(zone.coutEstimeCents)}</dd>
                </div>
                <div className="border-ecorce-bord flex justify-between gap-3 border-t pt-2">
                  <dt className="font-semibold">Marge</dt>
                  <dd
                    className={`tabulaire font-bold ${zone.margeCents >= 0 ? "text-graphique-positif" : "text-graphique-negatif"}`}
                  >
                    {formatEuros(zone.margeCents)} · {formatPourcentage(zone.rentabilitePct)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-cendre-clair">Délai moyen</dt>
                  <dd className="tabulaire">
                    {zone.delaiMoyenJours === null
                      ? "—"
                      : `${zone.delaiMoyenJours.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`}
                  </dd>
                </div>
              </dl>
              {zone.coutIncomplet > 0 && (
                <p className="text-graphique-negatif mt-3 text-[12px]">
                  Coût incomplet pour {zone.coutIncomplet} livraison
                  {zone.coutIncomplet > 1 ? "s" : ""}.
                </p>
              )}
            </Carte>
          ))}
        </div>
        {rapport.zones.length === 0 && (
          <div className="mt-4">
            <EtatVide texte="Aucune commande livrée sur cette période." />
          </div>
        )}
      </section>

      {/* ---- Indicateurs secondaires ---- */}
      <section aria-labelledby="secondaire" className="mt-10">
        <TitreSection
          id="secondaire"
          titre="Indicateurs secondaires"
          description="Annulations, remboursements, promotions, devis PDF et acquisition SEO."
          Icone={ChartNoAxesCombined}
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            libelle="Annulations"
            valeur={String(rapport.secondaire.annulations)}
            precision={`${formatEuros(rapport.secondaire.montantAnnuleCents)} annulés`}
          />
          <Kpi
            libelle="Remboursements"
            valeur={String(rapport.secondaire.remboursements)}
            precision={`${formatEuros(rapport.secondaire.montantRembourseCents)} remboursés`}
          />
          <Kpi
            libelle="Devis PDF → commandes"
            valeur={`${rapport.secondaire.commandesApresDevisPdf}/${rapport.secondaire.devisPdfTelecharges}`}
            precision={`${formatPourcentage(rapport.secondaire.conversionDevisPdfPct)} · ${formatEuros(rapport.secondaire.caApresDevisPdfCents)} de CA`}
          />
          <Kpi
            libelle="SEO → commandes"
            valeur={String(rapport.secondaire.commandesSeo)}
            precision={`${formatEuros(rapport.secondaire.caSeoCents)} de CA attribué`}
          />
        </div>
        <Carte className="mt-3">
          <h3 className="text-[16px]">Promotions</h3>
          <BarresClassees
            couleur="var(--graphique-2)"
            texteVide="Aucun code promotionnel utilisé."
            lignes={rapport.secondaire.promotions.map((promo) => ({
              cle: promo.code,
              libelle: promo.code,
              valeur: promo.caCents,
              valeurAffichee: formatEuros(promo.caCents),
              precision: `${promo.commandes} commande${promo.commandes > 1 ? "s" : ""} · ${formatEuros(promo.remiseCents)} de remise`,
            }))}
          />
        </Carte>
      </section>

      <Carte ton="creuse" className="mt-10 flex items-start gap-3">
        <CalendarClock className="text-seve mt-0.5 shrink-0" size={20} aria-hidden="true" />
        <div>
          <p className="font-semibold">Définitions transparentes</p>
          <p className="text-cendre-clair mt-1 text-[13px] leading-relaxed">
            Chiffre d&apos;affaires = commandes non annulées, TTC. Coût de livraison = carburant +
            coût kilométrique, hors main-d&apos;œuvre. Demande perdue = estimation du panier au
            moment du blocage. Les courbes agrègent {serie.libelleGranularite}, trous inclus.
          </p>
        </div>
      </Carte>
    </main>
  );
}
