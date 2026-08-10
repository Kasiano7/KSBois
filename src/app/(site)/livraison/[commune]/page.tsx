import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getCommuneLivree, listerCommunesLivrees } from "@/server/contenu";
import { formatDistance, formatEuros } from "@/domain/units";
import { formatJoursLivraison } from "@/lib/jours";
import { jsonldFaq, jsonldFilAriane, metadataPage } from "@/lib/seo";
import { DonneesStructurees } from "@/components/site/donnees-structurees";
import { AppelAction, Faq, PageContenu, Prose } from "@/components/site/page-contenu";

/**
 * Page locale d'une commune — docs/06 §1.3.
 *
 * ⚠️ **La règle anti-spam est appliquée par le code, pas par la discipline.**
 * Une page qui ne porte pas au moins quatre informations qui lui sont propres
 * passe en `noindex` automatiquement. Deux cents pages clonées
 * « bois de chauffage à {commune} » sont traitées par Google comme du contenu
 * de faible valeur et peuvent pénaliser le site entier.
 *
 * La page existe malgré tout dans ce cas : un visiteur qui suit un lien doit
 * trouver une réponse, même si Google n'a pas à l'indexer.
 *
 * Toutes les informations affichées viennent de la BASE — distance mesurée,
 * jours de passage réels, tarif réel, délai réel, nombre de livraisons déjà
 * effectuées. Aucune n'est inventée pour remplir la page.
 */

export async function generateStaticParams() {
  // Pas de pré-génération : la résolution du tenant dépend du domaine de la
  // requête, elle n'est donc pas disponible au build (docs/01 §4.3).
  return [];
}

export async function generateMetadata(props: PageProps<"/livraison/[commune]">): Promise<Metadata> {
  const tenant = await requireTenant();
  const { commune: slug } = await props.params;
  const commune = await getCommuneLivree(tenant.id, slug);

  if (!commune) {
    return metadataPage({
      titre: "Commune introuvable",
      description: "Cette commune ne figure pas dans nos zones de livraison.",
      chemin: `/livraison/${slug}`,
      noindex: true,
    });
  }

  return metadataPage({
    titre: `Bois de chauffage à ${commune.ville}`,
    description:
      `Livraison de bois de chauffage sec à ${commune.ville} (${commune.codePostal}), ` +
      `à ${commune.distanceKm === null ? "?" : formatDistance(commune.distanceKm)} de notre dépôt. Jours de passage, tarif et délai réels.`,
    chemin: `/livraison/${commune.slug}`,
    noindex: !commune.indexable,
  });
}

export default async function PageCommune(props: PageProps<"/livraison/[commune]">) {
  const tenant = await requireTenant();
  const { commune: slug } = await props.params;
  const commune = await getCommuneLivree(tenant.id, slug);
  if (!commune) notFound();

  const communes = await listerCommunesLivrees(tenant.id);
  const voisines = commune.voisines
    .map((voisine) => communes.find((autre) => autre.slug === voisine.slug))
    .filter((autre): autre is NonNullable<typeof autre> => Boolean(autre));

  const jours =
    commune.joursLivraison.length > 0
      ? formatJoursLivraison(commune.joursLivraison)
      : "sur rendez-vous";

  const faq = [
    {
      question: `Livrez-vous à ${commune.ville} ?`,
      reponse:
        `Oui. ${commune.ville} (${commune.codePostal}) est à ${commune.distanceKm === null ? "quelques km" : formatDistance(commune.distanceKm)} de notre dépôt, ` +
        `dans notre ${commune.zone.toLowerCase()}. Nous y passons ${jours}.`,
    },
    {
      question: `Combien coûte la livraison à ${commune.ville} ?`,
      reponse:
        commune.fraisBaseCents === 0 && commune.fraisParM3Cents === 0
          ? `La livraison est offerte à ${commune.ville}. Le total affiché dans le panier est donc le prix du bois, sans supplément.`
          : `Les frais démarrent à ${formatEuros(commune.fraisBaseCents)}` +
            (commune.fraisParM3Cents > 0
              ? `, plus ${formatEuros(commune.fraisParM3Cents)} par mètre cube apparent`
              : "") +
            (commune.gratuitAuDelaCents
              ? `. La livraison est offerte au-delà de ${formatEuros(commune.gratuitAuDelaCents)} de commande.`
              : ". Le montant exact s'affiche dans le panier avant tout engagement."),
    },
    {
      question: `Quel est le délai de livraison à ${commune.ville} ?`,
      reponse: commune.delaiJours
        ? `Comptez environ ${commune.delaiJours} jour${commune.delaiJours > 1 ? "s" : ""} entre la commande et la livraison, selon les créneaux disponibles.`
        : "Le délai dépend des créneaux disponibles ; ils s'affichent à la commande.",
    },
  ];

  return (
    <>
      <DonneesStructurees
        data={[
          jsonldFilAriane([
            { nom: "Accueil", chemin: "/" },
            { nom: "Livraison", chemin: "/livraison" },
            { nom: commune.ville, chemin: `/livraison/${commune.slug}` },
          ]),
          jsonldFaq(faq),
        ]}
      />

      <PageContenu
        eyebrow={`${commune.codePostal} · ${commune.zone}`}
        titre={`Bois de chauffage livré à ${commune.ville}`}
        chapeau={
          commune.distanceKm !== null
            ? `Vous êtes à ${formatDistance(commune.distanceKm)} de notre dépôt. Nous livrons ${jours}.`
            : `Nous livrons ${commune.ville} ${jours}.`
        }
        fil={[
          { nom: "Accueil", chemin: "/" },
          { nom: "Livraison", chemin: "/livraison" },
          { nom: commune.ville, chemin: `/livraison/${commune.slug}` },
        ]}
      >
        {/* Les quatre informations propres à la commune, en tête : c'est ce que
            le visiteur cherche, et c'est ce qui justifie l'existence de la page. */}
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fiche libelle="Distance depuis le dépôt">
            {commune.distanceKm === null ? "Non mesurée" : formatDistance(commune.distanceKm)}
          </Fiche>
          <Fiche libelle="Jours de passage">
            <span className="first-letter:uppercase">{jours}</span>
          </Fiche>
          <Fiche libelle="Frais de livraison">
            {/* « à partir de 0,00 € » se lit comme une erreur d'affichage.
                Une livraison offerte se dit, elle ne se chiffre pas. */}
            {commune.fraisBaseCents === 0 && commune.fraisParM3Cents === 0
              ? "offerte"
              : `à partir de ${formatEuros(commune.fraisBaseCents)}`}
            {commune.gratuitAuDelaCents ? (
              <span className="text-cendre block text-[15px] font-normal">
                offerte au-delà de {formatEuros(commune.gratuitAuDelaCents)}
              </span>
            ) : null}
          </Fiche>
          <Fiche libelle="Délai habituel">
            {commune.delaiJours
              ? `${commune.delaiJours} jour${commune.delaiJours > 1 ? "s" : ""}`
              : "selon créneaux"}
          </Fiche>
        </dl>

        {commune.minimumCommandeCents ? (
          <p className="text-cendre mt-5 text-[16px]">
            Commande minimum sur cette zone : {formatEuros(commune.minimumCommandeCents)}.
          </p>
        ) : null}

        {/* Preuve locale, uniquement si elle est réelle. */}
        {commune.commandesLivrees > 0 && (
          <p className="border-sapin/25 bg-sapin/5 mt-6 rounded-[12px] border p-4 text-[17px]">
            Nous avons déjà livré <strong>{commune.commandesLivrees}</strong> commande
            {commune.commandesLivrees > 1 ? "s" : ""} à {commune.ville}.
          </p>
        )}

        <Prose>
          <h2>Ce que nous livrons à {commune.ville}</h2>
          <p>
            Du bois de chauffage sec, coupé en 25, 33, 40 ou 50 cm, en chêne, hêtre, charme ou
            mélange de bois durs. Le taux d&apos;humidité est mesuré au testeur et affiché sur
            chaque produit : c&apos;est une mesure datée, pas une promesse.
          </p>
          <p>
            Le bois est déposé en vrac à l&apos;endroit accessible le plus proche que vous nous
            indiquez. Si l&apos;accès est étroit ou en pente à {commune.ville}, précisez-le à la
            commande — c&apos;est prévu dans le formulaire.
          </p>
        </Prose>

        {voisines.length > 0 && (
          <section className="mt-14">
            <h2 className="text-[26px]">Nous livrons aussi à proximité</h2>
            <ul className="mt-5 flex flex-wrap gap-3">
              {voisines.map((voisine) => (
                <li key={voisine.slug}>
                  <Link
                    href={
                      voisine.indexable ? `/livraison/${voisine.slug}` : "/livraison"
                    }
                    className="border-aubier-bord bg-aubier-pur hover:bg-aubier flex min-h-12 items-center rounded-[8px] border px-4 text-[16px] font-medium transition-colors"
                  >
                    {voisine.ville}
                    {voisine.distanceKm !== null && (
                      <span className="text-cendre ml-2 text-[14px]">
                        {formatDistance(voisine.distanceKm)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Faq questions={faq} />

        <AppelAction
          titre={`Commander du bois pour ${commune.ville}`}
          texte="Choisissez votre longueur et votre essence, indiquez votre code postal, et le prix livré s'affiche immédiatement. Aucun compte n'est nécessaire."
        />
      </PageContenu>
    </>
  );
}

function Fiche({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="border-aubier-bord bg-aubier-pur rounded-[12px] border p-4">
      <dt className="text-cendre text-[14px]">{libelle}</dt>
      <dd className="mt-1 text-[19px] font-semibold">{children}</dd>
    </div>
  );
}
