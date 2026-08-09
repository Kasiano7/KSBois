import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeEuro,
  CalendarClock,
  ChartNoAxesCombined,
  CircleGauge,
  FileText,
  PackageOpen,
  RefreshCw,
  Route,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { formatEuros, formatVolume } from "@/domain/units";
import {
  getRapportStatistiques,
  resoudrePeriodeStatistiques,
  type LignePrixM3,
  type LigneStock,
} from "@/server/statistiques";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Statistiques",
  robots: { index: false, follow: false },
};

function premier(parametre: string | string[] | undefined): string | undefined {
  return Array.isArray(parametre) ? parametre[0] : parametre;
}
function formatPourcentage(valeur: number | null, chiffres = 0): string {
  return valeur === null ? "—" : `${valeur.toLocaleString("fr-FR", { maximumFractionDigits: chiffres })} %`;
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

function formatDureeHeures(heures: number | null): string {
  if (heures === null) return "—";
  if (heures < 24) return `${Math.round(heures)} h`;
  return `${(heures / 24).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`;
}

function Evolution({ valeur }: { valeur: number | null }) {
  if (valeur === null) return <span className="text-cendre-clair text-[13px]">Pas de comparaison</span>;
  const positive = valeur >= 0;
  return (
    <span className={`mt-2 flex items-center gap-1.5 text-[13px] font-semibold ${positive ? "text-succes" : "text-alerte"}`}>
      {positive ? <TrendingUp size={16} aria-hidden="true" /> : <TrendingDown size={16} aria-hidden="true" />}
      {positive ? "+" : ""}{valeur.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % sur la période précédente
    </span>
  );
}

function Kpi({
  libelle,
  valeur,
  precision,
  evolution,
}: {
  libelle: string;
  valeur: string;
  precision?: string;
  evolution?: number | null;
}) {
  return (
    <div className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
      <p className="text-cendre-clair text-[14px]">{libelle}</p>
      <p className="font-display tabulaire mt-2 text-[32px] leading-none font-bold">{valeur}</p>
      {precision && <p className="text-cendre-clair mt-2 text-[13px]">{precision}</p>}
      {evolution !== undefined && <Evolution valeur={evolution} />}
    </div>
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
      <Icone className="text-seve mt-0.5 shrink-0" size={23} strokeWidth={1.75} aria-hidden="true" />
      <div>
        <h2 id={id} className="text-[24px]">{titre}</h2>
        <p className="text-cendre-clair mt-1 max-w-[78ch] text-[15px] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function Barre({ valeur, maximum, libelle }: { valeur: number; maximum: number; libelle: string }) {
  const largeur = maximum > 0 ? Math.max(2, Math.min(100, (valeur / maximum) * 100)) : 0;
  return (
    <div className="bg-ecorce mt-3 h-2.5 overflow-hidden rounded-[3px]" role="img" aria-label={`${libelle} : ${valeur}`}>
      <div className="bg-seve h-full rounded-[3px]" style={{ width: `${largeur}%` }} />
    </div>
  );
}

function EtatVide({ texte }: { texte: string }) {
  return (
    <div className="border-ecorce-bord mt-5 rounded-[8px] border border-dashed p-6">
      <p className="text-cendre-clair text-[15px]">{texte}</p>
    </div>
  );
}

function TableauPrix({ titre, lignes }: { titre: string; lignes: LignePrixM3[] }) {
  return (
    <div className="border-ecorce-bord rounded-[8px] border p-5">
      <h3 className="text-[18px]">{titre}</h3>
      {lignes.length === 0 ? (
        <p className="text-cendre-clair mt-3 text-[14px]">Aucune vente sur la période.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {lignes.slice(0, 8).map((ligne) => (
            <li key={ligne.cle} className="border-ecorce-bord border-b pb-3 last:border-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold">{titre === "Par mois" ? formatMois(ligne.libelle) : ligne.libelle}</span>
                <span className="tabulaire text-seve text-[17px] font-bold">{formatEuros(ligne.prixMoyenCents)}/m³</span>
              </div>
              <p className="text-cendre-clair mt-1 text-[13px]">
                {formatVolume(ligne.volumeM3)} · {formatEuros(ligne.caBoisCents)} de bois
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const LIBELLE_PRIORITE: Record<LigneStock["priorite"], string> = {
  urgent: "À produire maintenant",
  a_produire: "À produire bientôt",
  a_surveiller: "À surveiller",
  stable: "Stock stable",
};

const CLASSE_PRIORITE: Record<LigneStock["priorite"], string> = {
  urgent: "border-erreur/50 bg-erreur/10 text-[#FFB4B4]",
  a_produire: "border-alerte/50 bg-alerte/10 text-[#FFD39A]",
  a_surveiller: "border-seve/40 bg-seve/10 text-seve",
  stable: "border-succes/40 bg-succes/10 text-[#9FDCB5]",
};

export default async function PageStatistiques(props: PageProps<"/admin/statistiques">) {
  const session = await requireRole(["owner", "staff"], "/admin/statistiques");
  const params = await props.searchParams;
  const periode = resoudrePeriodeStatistiques({
    periode: premier(params.periode),
    debut: premier(params.debut),
    fin: premier(params.fin),
  });
  const rapport = await getRapportStatistiques(session.companyId, periode);
  const maxOrigine = Math.max(1, ...rapport.origines.map((origine) => origine.commandes));
  const maxTunnel = Math.max(1, rapport.tunnel[0]?.total ?? 0);

  return (
    <main className="mx-auto w-full max-w-[1500px] p-5 sm:p-8">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="micro-label text-seve">Pilotage de l&apos;activité</p>
          <h1 className="mt-2 text-[34px] sm:text-[44px]">Statistiques</h1>
          <p className="text-cendre-clair mt-2 max-w-[72ch] text-[16px]">
            Ce qui se vend, ce qui bloque les clients et ce qu&apos;il faut préparer ensuite.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Choisir une période">
          {[
            ["30j", "30 jours"],
            ["90j", "90 jours"],
            ["saison", "Saison de chauffe"],
            ["12m", "12 mois"],
          ].map(([cle, libelle]) => (
            <Button key={cle} asChild variant={periode.cle === cle ? "secondary" : "outline"} size="sm">
              <Link href={`/admin/statistiques?periode=${cle}`}>{libelle}</Link>
            </Button>
          ))}
        </div>
      </header>

      <form method="get" className="border-ecorce-bord bg-ecorce-eleve mt-6 grid gap-3 rounded-[8px] border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="periode" value="personnalisee" />
        <label className="text-[14px] font-semibold">
          Du
          <input name="debut" type="date" defaultValue={periode.cle === "personnalisee" ? periode.debut.toISOString().slice(0, 10) : ""} className="border-ecorce-bord bg-ecorce mt-2 block h-11 w-full rounded-[4px] border px-3 text-[16px]" />
        </label>
        <label className="text-[14px] font-semibold">
          Au
          <input name="fin" type="date" defaultValue={periode.cle === "personnalisee" ? new Date(periode.fin.getTime() - 86_400_000).toISOString().slice(0, 10) : ""} className="border-ecorce-bord bg-ecorce mt-2 block h-11 w-full rounded-[4px] border px-3 text-[16px]" />
        </label>
        <Button type="submit" variant="default">Afficher cette période</Button>
      </form>

      <p className="text-cendre-clair mt-3 text-[14px]">Période affichée : <strong className="text-aubier">{rapport.periode.libelle}</strong></p>

      <section aria-labelledby="synthese" className="mt-8">
        <h2 id="synthese" className="sr-only">Synthèse</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi libelle="CA commandé TTC" valeur={formatEuros(rapport.synthese.caCents)} precision="Commandes non annulées" evolution={rapport.synthese.evolutionCaPct} />
          <Kpi libelle="Commandes" valeur={String(rapport.synthese.commandes)} evolution={rapport.synthese.evolutionCommandesPct} />
          <Kpi libelle="Volume vendu" valeur={formatVolume(rapport.synthese.volumeM3)} />
          <Kpi libelle="Panier moyen" valeur={rapport.synthese.panierMoyenCents === null ? "—" : formatEuros(rapport.synthese.panierMoyenCents)} />
          <Kpi libelle="Prix réellement vendu" valeur={rapport.synthese.prixMoyenM3Cents === null ? "—" : `${formatEuros(rapport.synthese.prixMoyenM3Cents)}/m³`} precision="Bois après remise, hors livraison et options" />
        </div>
      </section>

      <section aria-labelledby="origines" className="mt-12">
        <TitreSection id="origines" titre="Origine des commandes et du CA" description="La part du site web montre combien de ventes sont réellement automatisées. Téléphone et saisie admin restent séparés." Icone={ShoppingCart} />
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-3 sm:grid-cols-3">
            {rapport.origines.map((origine) => (
              <div key={origine.cle} className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
                <p className="font-semibold">{origine.libelle}</p>
                <p className="tabulaire mt-3 text-[28px] font-bold">{origine.commandes}</p>
                <p className="text-cendre-clair text-[14px]">commandes · {formatPourcentage(origine.partCommandesPct)}</p>
                <p className="tabulaire mt-3 text-[19px] font-semibold">{formatEuros(origine.caCents)}</p>
                <p className="text-cendre-clair text-[13px]">{formatPourcentage(origine.partCaPct)} du CA · {formatVolume(origine.volumeM3)}</p>
                <Barre valeur={origine.commandes} maximum={maxOrigine} libelle={`${origine.libelle}, commandes`} />
              </div>
            ))}
          </div>
          <div className="border-succes/40 bg-succes/10 rounded-[8px] border p-5">
            <p className="text-[#9FDCB5] text-[14px] font-semibold">Automatisation par le site</p>
            <p className="font-display tabulaire mt-3 text-[42px] leading-none font-bold">{formatPourcentage(rapport.tauxAutomatisationCommandesPct)}</p>
            <p className="text-cendre-clair mt-2 text-[14px]">des commandes</p>
            <p className="tabulaire mt-5 text-[24px] font-bold">{formatPourcentage(rapport.tauxAutomatisationCaPct)}</p>
            <p className="text-cendre-clair text-[14px]">du CA commandé</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="tunnel" className="mt-12">
        <TitreSection id="tunnel" titre="Tunnel de conversion" description="Chaque nombre correspond à une session anonyme. La perte est affectée à la dernière étape atteinte, sans suivre une personne au-delà de 30 minutes." Icone={Route} />
        {!rapport.couvertureAnalyticsDepuis ? (
          <EtatVide texte="La mesure du parcours commencera dès que la migration Statistiques sera appliquée. Les commandes historiques restent visibles dans les autres blocs." />
        ) : (
          <>
            <div className="border-info/40 bg-info/10 mt-5 rounded-[8px] border p-4 text-[14px]">
              Mesure disponible depuis le <strong>{formatDateCourte(rapport.couvertureAnalyticsDepuis)}</strong>. Les périodes antérieures ne sont pas reconstituées.
            </div>
            <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              {rapport.tunnel.map((etape, index) => (
                <li key={etape.cle} className="border-ecorce-bord bg-ecorce-eleve relative rounded-[8px] border p-4">
                  <p className="text-cendre-clair text-[12px] font-semibold uppercase tracking-[0.1em]">Étape {index + 1}</p>
                  <p className="mt-2 text-[15px] font-semibold">{etape.libelle}</p>
                  <p className="tabulaire mt-3 text-[30px] font-bold">{etape.total}</p>
                  <Barre valeur={etape.total} maximum={maxTunnel} libelle={etape.libelle} />
                  {etape.abandonAvantSuivante !== null && (
                    <p className="text-cendre-clair mt-3 text-[12px] leading-relaxed">
                      {etape.abandonAvantSuivante} abandon{etape.abandonAvantSuivante > 1 ? "s" : ""} avant la suite · {formatPourcentage(etape.conversionSuivantePct)} continuent
                    </p>
                  )}
                  {index < rapport.tunnel.length - 1 && <ArrowRight className="text-cendre-clair absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 bg-ecorce xl:block" size={19} aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section aria-labelledby="pertes" className="mt-12">
        <TitreSection id="pertes" titre="Demande perdue" description="Les montants ci-dessous sont des estimations issues du panier au moment du blocage. Ils ne sont jamais ajoutés au CA réel." Icone={AlertTriangle} />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Kpi libelle="Blocages détectés" valeur={String(rapport.pertesTotal.occurrences)} />
          <Kpi libelle="CA potentiel" valeur={formatEuros(rapport.pertesTotal.caPotentielCents)} precision="Estimation, pas une vente" />
          <Kpi libelle="Volume potentiel" valeur={formatVolume(rapport.pertesTotal.volumePotentielM3)} />
        </div>
        {rapport.pertes.length === 0 ? <EtatVide texte="Aucun blocage mesuré sur cette période." /> : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {rapport.pertes.map((perte) => (
              <div key={perte.motif} className="border-ecorce-bord rounded-[8px] border p-4">
                <p className="font-semibold">{perte.libelle}</p>
                <p className="tabulaire mt-3 text-[26px] font-bold">{perte.occurrences}</p>
                <p className="text-cendre-clair text-[13px]">occurrences</p>
                <p className="tabulaire text-seve mt-3 font-semibold">{formatEuros(perte.caPotentielCents)}</p>
                <p className="text-cendre-clair text-[12px]">{formatVolume(perte.volumePotentielM3)} potentiels</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="prix" className="mt-12">
        <TitreSection id="prix" titre="Prix moyen réellement vendu au m³" description="Le prix du bois tient compte de la remise réellement accordée. Livraison et options sont exclues pour comparer les formats honnêtement." Icone={BadgeEuro} />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TableauPrix titre="Par essence" lignes={rapport.prixParEssence} />
          <TableauPrix titre="Par longueur" lignes={rapport.prixParLongueur} />
          <TableauPrix titre="Par zone" lignes={rapport.prixParZone} />
          <TableauPrix titre="Par mois" lignes={rapport.prixParMois} />
        </div>
      </section>

      <section aria-labelledby="stock" className="mt-12">
        <TitreSection id="stock" titre="Rotation et autonomie du stock" description="La vitesse utilise les ventes récentes. Les seuils d'urgence et la durée observée sont stockés dans les réglages de l'entreprise." Icone={PackageOpen} />
        {rapport.stock.length === 0 ? <EtatVide texte="Aucun format actif à analyser." /> : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {rapport.stock.map((ligne) => (
              <article key={ligne.id} className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[17px]">{ligne.libelle}</h3>
                    <p className="font-mono text-cendre-clair mt-1 text-[12px]">{ligne.sku}</p>
                  </div>
                  <span className={`rounded-[4px] border px-2.5 py-1 text-[12px] font-semibold ${CLASSE_PRIORITE[ligne.priorite]}`}>{LIBELLE_PRIORITE[ligne.priorite]}</span>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div><dt className="text-cendre-clair text-[12px]">Disponible</dt><dd className="tabulaire mt-1 font-semibold">{formatVolume(ligne.disponibleM3)}</dd></div>
                  <div><dt className="text-cendre-clair text-[12px]">Réservé</dt><dd className="tabulaire mt-1 font-semibold">{formatVolume(ligne.reserveM3)}</dd></div>
                  <div><dt className="text-cendre-clair text-[12px]">Vente / semaine</dt><dd className="tabulaire mt-1 font-semibold">{formatVolume(ligne.vitesseM3ParSemaine)}</dd></div>
                  <div><dt className="text-cendre-clair text-[12px]">Autonomie</dt><dd className="tabulaire mt-1 font-semibold">{ligne.joursRestants === null ? "Pas assez de ventes" : `${ligne.joursRestants} j`}</dd></div>
                </dl>
                {ligne.rupturePrevueLe && <p className="text-cendre-clair mt-4 text-[13px]">Rupture prévue vers le <strong className="text-aubier">{formatDateCourte(ligne.rupturePrevueLe)}</strong> si le rythme continue.</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="mt-12 grid gap-10 xl:grid-cols-2">
        <section aria-labelledby="devis">
          <TitreSection id="devis" titre="Performance des devis" description="Demandes reçues, réponses envoyées et décisions du client sur la période." Icone={FileText} />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi libelle="Reçus" valeur={String(rapport.devis.recus)} />
            <Kpi libelle="Envoyés" valeur={String(rapport.devis.envoyes)} />
            <Kpi libelle="Acceptés" valeur={String(rapport.devis.acceptes)} />
            <Kpi libelle="Refusés" valeur={String(rapport.devis.refuses)} />
          </div>
          <div className="border-ecorce-bord mt-4 grid gap-5 rounded-[8px] border p-5 sm:grid-cols-4">
            <div><p className="text-cendre-clair text-[13px]">Conversion</p><p className="tabulaire mt-1 text-[22px] font-bold">{formatPourcentage(rapport.devis.conversionPct)}</p></div>
            <div><p className="text-cendre-clair text-[13px]">Montant gagné</p><p className="tabulaire text-succes mt-1 text-[22px] font-bold">{formatEuros(rapport.devis.montantGagneCents)}</p></div>
            <div><p className="text-cendre-clair text-[13px]">Montant perdu</p><p className="tabulaire text-alerte mt-1 text-[22px] font-bold">{formatEuros(rapport.devis.montantPerduCents)}</p></div>
            <div><p className="text-cendre-clair text-[13px]">Réponse moyenne</p><p className="tabulaire mt-1 text-[22px] font-bold">{formatDureeHeures(rapport.devis.delaiReponseHeures)}</p></div>
          </div>
        </section>

        <section aria-labelledby="reactivation">
          <TitreSection id="reactivation" titre="Clients à réactiver" description="La date probable vient de l'intervalle médian entre leurs commandes. Une seule commande ne suffit pas pour faire une prédiction." Icone={UsersRound} />
          {rapport.clientsAReactiver.length === 0 ? <EtatVide texte="Aucun client n'arrive dans sa fenêtre probable de recommande." /> : (
            <ul className="mt-5 space-y-3">
              {rapport.clientsAReactiver.slice(0, 8).map((client) => (
                <li key={client.email} className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold">{client.nom}</p><a className="text-seve mt-1 block text-[13px] underline-offset-4 hover:underline" href={`mailto:${client.email}`}>{client.email}</a></div>
                    {client.telephone && <Button asChild variant="outline" size="sm"><a href={`tel:${client.telephone}`}>Appeler</a></Button>}
                  </div>
                  <p className="text-cendre-clair mt-3 text-[13px]">Prochaine commande estimée : <strong className="text-aubier">{formatDateCourte(client.prochaineCommandePrevueLe)}</strong> · rythme habituel {client.intervalleJours} j · {client.commandes} commandes</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="zones" className="mt-12">
        <TitreSection id="zones" titre="Rentabilité et délai des livraisons" description="Les frais facturés sont comparés au carburant réellement retenu sur la commande et au coût kilométrique du véhicule. La main-d'œuvre n'est pas encore incluse." Icone={CircleGauge} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi libelle="Délai commande → livraison" valeur={rapport.delaiLivraisonGlobalJours === null ? "—" : `${rapport.delaiLivraisonGlobalJours.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`} precision="Moyenne globale des commandes livrées" />
          {rapport.zones.slice(0, 7).map((zone) => (
            <div key={zone.zone} className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
              <h3 className="text-[17px]">{zone.zone}</h3>
              <p className="text-cendre-clair mt-1 text-[13px]">{zone.livraisons} livraison{zone.livraisons > 1 ? "s" : ""}</p>
              <dl className="mt-4 space-y-2 text-[14px]">
                <div className="flex justify-between gap-3"><dt className="text-cendre-clair">Facturé</dt><dd className="tabulaire">{formatEuros(zone.fraisFacturesCents)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-cendre-clair">Coût estimé</dt><dd className="tabulaire">{formatEuros(zone.coutEstimeCents)}</dd></div>
                <div className="border-ecorce-bord flex justify-between gap-3 border-t pt-2"><dt className="font-semibold">Marge livraison</dt><dd className={`tabulaire font-bold ${zone.margeCents >= 0 ? "text-succes" : "text-alerte"}`}>{formatEuros(zone.margeCents)} · {formatPourcentage(zone.rentabilitePct)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-cendre-clair">Délai moyen</dt><dd className="tabulaire">{zone.delaiMoyenJours === null ? "—" : `${zone.delaiMoyenJours.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`}</dd></div>
              </dl>
              {zone.coutIncomplet > 0 && <p className="text-alerte mt-3 text-[12px]">Coût incomplet pour {zone.coutIncomplet} livraison{zone.coutIncomplet > 1 ? "s" : ""}.</p>}
            </div>
          ))}
        </div>
        {rapport.zones.length === 0 && <EtatVide texte="Aucune commande livrée sur cette période." />}
      </section>

      <section aria-labelledby="secondaire" className="mt-12">
        <TitreSection id="secondaire" titre="Indicateurs secondaires" description="Annulations, remboursements, promotions, devis PDF et acquisition SEO." Icone={ChartNoAxesCombined} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi libelle="Annulations" valeur={String(rapport.secondaire.annulations)} precision={`${formatEuros(rapport.secondaire.montantAnnuleCents)} annulés`} />
          <Kpi libelle="Remboursements" valeur={String(rapport.secondaire.remboursements)} precision={`${formatEuros(rapport.secondaire.montantRembourseCents)} remboursés`} />
          <Kpi libelle="Devis PDF → commandes" valeur={`${rapport.secondaire.commandesApresDevisPdf}/${rapport.secondaire.devisPdfTelecharges}`} precision={`${formatPourcentage(rapport.secondaire.conversionDevisPdfPct)} · ${formatEuros(rapport.secondaire.caApresDevisPdfCents)} de CA`} />
          <Kpi libelle="SEO → commandes" valeur={String(rapport.secondaire.commandesSeo)} precision={`${formatEuros(rapport.secondaire.caSeoCents)} de CA attribué`} />
        </div>
        <div className="border-ecorce-bord mt-4 rounded-[8px] border p-5">
          <h3 className="text-[18px]">Promotions</h3>
          {rapport.secondaire.promotions.length === 0 ? <p className="text-cendre-clair mt-3 text-[14px]">Aucun code promotionnel utilisé.</p> : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rapport.secondaire.promotions.map((promo) => (
                <li key={promo.code} className="bg-ecorce rounded-[6px] p-4">
                  <p className="font-mono text-seve text-[14px] font-semibold">{promo.code}</p>
                  <p className="tabulaire mt-2 text-[19px] font-bold">{formatEuros(promo.caCents)}</p>
                  <p className="text-cendre-clair text-[12px]">{promo.commandes} commandes · {formatEuros(promo.remiseCents)} de remise</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="border-ecorce-bord mt-12 flex flex-col gap-3 rounded-[8px] border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CalendarClock className="text-seve mt-0.5 shrink-0" size={21} aria-hidden="true" />
          <div><p className="font-semibold">Définitions transparentes</p><p className="text-cendre-clair mt-1 text-[13px]">CA = commandes non annulées. Coût livraison = carburant + coût kilométrique, hors main-d&apos;œuvre. Demande perdue = estimation du panier.</p></div>
        </div>
        <Button asChild variant="outline"><Link href="/admin/statistiques"><RefreshCw size={17} aria-hidden="true" />Actualiser les chiffres</Link></Button>
      </div>
    </main>
  );
}
