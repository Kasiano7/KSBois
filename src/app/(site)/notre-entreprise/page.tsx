import type { Metadata } from "next";
import { requireTenant } from "@/lib/tenant";
import { listerCommunesLivrees } from "@/server/contenu";
import { jsonldFilAriane, metadataPage } from "@/lib/seo";
import { DonneesStructurees } from "@/components/site/donnees-structurees";
import { AppelAction, PageContenu, Prose } from "@/components/site/page-contenu";

/**
 * Notre entreprise — docs/06 §1.2.
 *
 * Page de confiance : elle prouve qu'il y a un vrai bûcheron derrière le site.
 * Elle ne contient AUCUN chiffre inventé — ni « 20 ans d'expérience », ni
 * « 2 000 clients satisfaits ». Le seul chiffre affiché est le nombre de
 * communes desservies, qui se lit en base.
 *
 * ⚠️ Les textes de cette page sont des textes de départ, rédigés à partir de ce
 * que le projet sait de l'entreprise. Ils sont à relire et à personnaliser avec
 * le client avant l'ouverture des ventes (docs/07, « rédaction des contenus »).
 */

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await requireTenant();
  return metadataPage({
    titre: "Notre entreprise",
    // 140 à 158 caractères une fois assemblée (docs/06 §1.6).
    description: `${tenant.name} exploite, coupe et livre son bois de chauffage en Ardèche nord. Un interlocuteur unique, du bois dont on connaît la provenance.`,
    chemin: "/notre-entreprise",
  });
}

export default async function PageNotreEntreprise() {
  const tenant = await requireTenant();
  const communes = await listerCommunesLivrees(tenant.id);

  return (
    <>
      <DonneesStructurees
        data={jsonldFilAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Notre entreprise", chemin: "/notre-entreprise" },
        ])}
      />

      <PageContenu
        eyebrow="Notre entreprise"
        titre="Le bois vient d'ici, et nous le livrons nous-mêmes"
        chapeau={`${tenant.name} exploite, coupe, sèche et livre son bois de chauffage. Pas d'intermédiaire, pas de revente : la personne qui vous livre est celle qui a coupé le bois.`}
        fil={[
          { nom: "Accueil", chemin: "/" },
          { nom: "Notre entreprise", chemin: "/notre-entreprise" },
        ]}
      >
        <Prose>
          <h2>Une entreprise locale, pas une plateforme</h2>
          <p>
            Nous travaillons dans le nord de l&apos;Ardèche, autour de{" "}
            {tenant.city ?? "notre dépôt"}. Nous livrons aujourd&apos;hui{" "}
            {communes.length} communes du bassin d&apos;Annonay et de ses environs.
          </p>
          <p>
            Quand vous appelez, vous tombez sur la personne qui gère les commandes. Quand vous
            êtes livré, vous voyez le camion de l&apos;entreprise. C&apos;est le genre de détail
            qui ne se voit pas sur un site, et qui change tout quand quelque chose ne se passe pas
            comme prévu.
          </p>

          <h2>Ce à quoi nous nous engageons</h2>
          <ul>
            <li>
              <strong>Un taux d&apos;humidité mesuré, pas promis.</strong> Nous mesurons au
              testeur, nous donnons la date de mesure et le lot. C&apos;est vérifiable.
            </li>
            <li>
              <strong>Un volume annoncé en mètres cubes apparents.</strong> C&apos;est la seule
              unité légale depuis 1977, et la seule qui permette de comparer honnêtement deux
              devis.
            </li>
            <li>
              <strong>Une date de livraison ferme.</strong> Vous exprimez un souhait, nous
              confirmons une date, et nous vous rappelons la veille.
            </li>
            <li>
              <strong>Un prix affiché avant la commande.</strong> Livraison comprise, calculée sur
              votre commune réelle, sans supplément découvert à l&apos;arrivée.
            </li>
          </ul>

          <h2>Notre bois</h2>
          <p>
            Chêne, hêtre, charme et mélanges de bois durs, coupés en 25, 33, 40 ou 50 cm. Le bois
            dur monte plus haut en température et tient plus longtemps que le résineux : c&apos;est
            ce qu&apos;on veut pour se chauffer, pas seulement pour faire une flambée.
          </p>
          <p>
            Le séchage se fait à l&apos;air libre, sous abri ventilé, sur la durée qu&apos;il faut.
            Il n&apos;y a pas de raccourci : un bois vendu sec l&apos;est parce qu&apos;il a
            attendu, et nous le mesurons avant de le vendre.
          </p>
        </Prose>

        <AppelAction
          titre="Une question avant de commander ?"
          texte={`Appelez-nous${tenant.phoneDisplay ? ` au ${tenant.phoneDisplay}` : ""}, ou demandez un devis en ligne. Nous répondons nous-mêmes.`}
          lien="/contact"
          libelleLien="Nous contacter"
        />
      </PageContenu>
    </>
  );
}
