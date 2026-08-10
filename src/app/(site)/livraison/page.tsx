import type { Metadata } from "next";
import Link from "next/link";
import { requireTenant } from "@/lib/tenant";
import { listerCommunesLivrees } from "@/server/contenu";
import { formatDistance, formatEuros } from "@/domain/units";
import { formatJoursLivraison } from "@/lib/jours";
import { jsonldFaq, jsonldFilAriane, jsonldServiceLivraison, metadataPage } from "@/lib/seo";
import { DonneesStructurees } from "@/components/site/donnees-structurees";
import { AppelAction, Faq, PageContenu, Prose } from "@/components/site/page-contenu";
import { BandeauLivraison } from "@/components/produit/bandeau-livraison";

/**
 * Page pivot de la livraison — docs/06 §1.2.
 *
 * Elle répond à la question n°1 du visiteur (« est-ce que vous livrez chez
 * moi ? »), porte le maillage interne vers les pages communes, et cible
 * « livraison bois de chauffage Ardèche ».
 *
 * Le tableau liste TOUTES les communes desservies, y compris celles qui n'ont
 * pas de page dédiée : c'est ce qui permet de ne créer qu'une vingtaine de
 * pages locales sans laisser de commune sans réponse (docs/06 §1.3).
 */

const FAQ = [
  {
    question: "Livrez-vous chez moi ?",
    reponse:
      "Saisissez votre code postal ci-dessus : la réponse est immédiate, avec les jours de passage et le tarif exact. Si votre commune n'apparaît pas, demandez un devis — nous livrons régulièrement hors zone au cas par cas.",
  },
  {
    question: "Combien coûte la livraison ?",
    reponse:
      "Elle dépend de la distance depuis le dépôt et du volume commandé. Le montant exact s'affiche dans le panier avant tout engagement, et il est recalculé par nos serveurs — jamais estimé à la louche.",
  },
  {
    question: "Comment se passe le déchargement ?",
    reponse:
      "Le bois est déposé en vrac à l'endroit accessible le plus proche que vous nous indiquez. Prévoyez un accès dégagé pour le camion et repérez l'emplacement à l'avance. Le rangement en tas est proposé en option.",
  },
  {
    question: "Puis-je être absent le jour de la livraison ?",
    reponse:
      "Oui, si l'accès est libre et l'emplacement clairement indiqué. Vous pouvez le préciser à la commande. Le livreur vous appelle avant de passer dans tous les cas.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  return metadataPage({
    titre: "Livraison de bois de chauffage",
    description:
      "Zones, jours de passage et tarifs de livraison de bois de chauffage en Ardèche nord. Vérifiez votre commune et obtenez le prix exact avant de commander.",
    chemin: "/livraison",
  });
}

export default async function PageLivraison() {
  const tenant = await requireTenant();
  const communes = await listerCommunesLivrees(tenant.id);

  const avecPage = communes.filter((commune) => commune.indexable);
  const distanceMax = communes.reduce(
    (max, commune) => Math.max(max, commune.distanceKm ?? 0),
    0,
  );

  return (
    <>
      <DonneesStructurees
        data={[
          jsonldFilAriane([
            { nom: "Accueil", chemin: "/" },
            { nom: "Livraison", chemin: "/livraison" },
          ]),
          jsonldServiceLivraison(
            tenant,
            communes.map((commune) => commune.ville),
            `Livraison de bois de chauffage à domicile dans un rayon de ${Math.round(distanceMax)} km autour de ${tenant.city ?? "notre dépôt"}.`,
          ),
          jsonldFaq(FAQ),
        ]}
      />

      <PageContenu
        large
        eyebrow="Livraison"
        titre="Où et quand nous livrons"
        chapeau={`Nous livrons ${communes.length} communes autour de ${tenant.city ?? "notre dépôt"}, dans un rayon d'environ ${Math.round(distanceMax)} km. Vérifiez la vôtre en une saisie.`}
        fil={[
          { nom: "Accueil", chemin: "/" },
          { nom: "Livraison", chemin: "/livraison" },
        ]}
      >
        {/* Même composant que l'accueil : une seule implémentation de
            l'estimation, donc jamais deux réponses différentes à la même
            question selon la page où l'on se trouve. */}
        <BandeauLivraison region={tenant.city ?? "Ardèche"} />

        <Prose>
          <h2>Comment se passe une livraison</h2>
          <p>
            Vous choisissez votre créneau à la commande. Nous vous confirmons ensuite une date
            ferme, et vous recevez un rappel la veille. Le livreur vous appelle avant de passer.
          </p>
          <p>
            Le bois est déposé en vrac à l&apos;endroit accessible le plus proche de votre choix.
            Si le chemin est étroit, en pente, ou si le déchargement doit se faire à un endroit
            précis, indiquez-le à la commande : c&apos;est prévu dans le formulaire, et c&apos;est
            ce qui évite la livraison ratée.
          </p>
        </Prose>

        <section className="mt-14">
          <h2 className="text-[26px]">Communes desservies</h2>
          <p className="text-cendre mt-2 max-w-[68ch] text-[17px]">
            Distances mesurées depuis notre dépôt. Les tarifs affichés sont les frais de base :
            le montant exact dépend du volume et s&apos;affiche dans le panier.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[16px]">
              <caption className="sr-only">
                Communes desservies, distance, jours de livraison et frais de base
              </caption>
              <thead>
                <tr className="border-encre border-b text-left">
                  <th scope="col" className="py-3 pr-4 font-semibold">Commune</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Code postal</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Distance</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">Jours de passage</th>
                  <th scope="col" className="py-3 font-semibold">À partir de</th>
                </tr>
              </thead>
              <tbody>
                {communes.map((commune) => (
                  <tr key={commune.slug} className="border-aubier-bord border-b">
                    <th scope="row" className="py-3 pr-4 text-left font-medium">
                      {commune.indexable ? (
                        <Link
                          href={`/livraison/${commune.slug}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {commune.ville}
                        </Link>
                      ) : (
                        commune.ville
                      )}
                    </th>
                    <td className="text-cendre py-3 pr-4 tabular-nums">{commune.codePostal}</td>
                    <td className="text-cendre py-3 pr-4 tabular-nums">
                      {commune.distanceKm === null ? "—" : formatDistance(commune.distanceKm)}
                    </td>
                    <td className="text-cendre py-3 pr-4">
                      {commune.joursLivraison.length > 0
                        ? formatJoursLivraison(commune.joursLivraison)
                        : "Sur rendez-vous"}
                    </td>
                    <td className="text-cendre py-3 tabular-nums">
                      {commune.fraisBaseCents === 0 && commune.fraisParM3Cents === 0
                        ? "Offerte"
                        : formatEuros(commune.fraisBaseCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {avecPage.length > 0 && (
            <p className="text-cendre mt-5 max-w-[68ch] text-[15px] leading-relaxed">
              Les communes en lien ont une page détaillée avec les tarifs, les délais et les jours
              de passage qui leur sont propres.
            </p>
          )}
        </section>

        <Faq questions={FAQ} />

        <AppelAction
          titre="Votre commune n'est pas dans la liste ?"
          texte="Nous livrons régulièrement hors zone, au cas par cas. Demandez un devis : nous vous répondons avec un prix ferme, livraison comprise."
          lien="/devis"
          libelleLien="Demander un devis"
        />
      </PageContenu>
    </>
  );
}
