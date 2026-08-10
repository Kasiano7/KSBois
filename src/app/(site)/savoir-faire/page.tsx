import type { Metadata } from "next";
import { requireTenant } from "@/lib/tenant";
import { jsonldFaq, jsonldFilAriane, metadataPage } from "@/lib/seo";
import { DonneesStructurees } from "@/components/site/donnees-structurees";
import { AppelAction, Faq, PageContenu, Prose } from "@/components/site/page-contenu";

/**
 * Savoir-faire — exploitation, séchage, essences (docs/06 §1.2).
 *
 * Page de preuve technique. Elle sert deux publics : le client qui veut
 * comprendre ce qu'il achète, et Google, qui cherche du contenu de fond sur
 * « bois de chauffage sec » et « quelle essence choisir ».
 */

const FAQ = [
  {
    question: "Combien de temps faut-il pour sécher du bois de chauffage ?",
    reponse:
      "Entre 18 et 24 mois à l'air libre pour du bois dur fendu, sous abri ventilé. Un bois fendu sèche bien plus vite qu'un rondin entier : la fente ouvre le cœur à l'air.",
  },
  {
    question: "Quelle essence chauffe le mieux ?",
    reponse:
      "Le chêne, le hêtre et le charme sont les meilleures essences de chauffage : denses, elles dégagent plus d'énergie à volume égal et tiennent la braise. Le charme et le hêtre s'allument plus facilement, le chêne tient plus longtemps.",
  },
  {
    question: "Peut-on brûler du résineux ?",
    reponse:
      "Pour lancer un feu, oui. Comme bois de chauffage principal, non : le résineux brûle vite, chauffe moins à volume égal et encrasse davantage le conduit à cause de sa résine.",
  },
  {
    question: "Le bois séché en séchoir est-il meilleur ?",
    reponse:
      "Il est sec plus vite, pas mieux. Un bois séché à l'air pendant deux ans et un bois passé au séchoir donnent le même résultat dans le poêle si le taux d'humidité final est identique. Ce qui compte, c'est la mesure.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  return metadataPage({
    titre: "Notre savoir-faire",
    description:
      "De la coupe au séchage : comment nous produisons du bois de chauffage sec. Essences, fendage, durée de séchage et mesure de l'humidité.",
    chemin: "/savoir-faire",
  });
}

export default async function PageSavoirFaire() {
  const tenant = await requireTenant();

  return (
    <>
      <DonneesStructurees
        data={[
          jsonldFilAriane([
            { nom: "Accueil", chemin: "/" },
            { nom: "Savoir-faire", chemin: "/savoir-faire" },
          ]),
          jsonldFaq(FAQ),
        ]}
      />

      <PageContenu
        eyebrow="Savoir-faire"
        titre="De l'arbre au poêle"
        chapeau="Un bon bois de chauffage, c'est une essence adaptée, une coupe propre et surtout du temps de séchage. Voici comment nous travaillons, étape par étape."
        fil={[
          { nom: "Accueil", chemin: "/" },
          { nom: "Savoir-faire", chemin: "/savoir-faire" },
        ]}
      >
        <ol className="space-y-8">
          <Etape
            numero={1}
            titre="La coupe"
            texte="Nous exploitons des parcelles de feuillus du secteur, en coupe d'éclaircie ou de taillis. Le bois est abattu en période de repos végétatif, entre l'automne et la fin de l'hiver : la sève est descendue, le bois contient moins d'eau au départ."
          />
          <Etape
            numero={2}
            titre="Le fendage"
            texte="Le bois est fendu avant séchage, jamais après. Une bûche fendue expose son cœur à l'air et sèche deux à trois fois plus vite qu'un rondin de même diamètre. C'est l'étape qui décide de la durée de séchage."
          />
          <Etape
            numero={3}
            titre="Le séchage"
            texte="Empilé sous abri ventilé, à l'air libre, pendant 18 à 24 mois pour du bois dur. Il n'y a pas de raccourci : un bois vendu sec l'est parce qu'il a attendu. Le tas est orienté face au vent dominant, surélevé du sol, couvert par le dessus uniquement."
          />
          <Etape
            numero={4}
            titre="La mesure"
            texte="Avant la vente, nous mesurons l'humidité au testeur, au cœur d'une bûche fendue — pas en surface. La valeur, la date et le lot sont affichés sur le produit. C'est une preuve, pas une promesse."
          />
          <Etape
            numero={5}
            titre="La coupe à longueur"
            texte="Le bois est recoupé à la longueur commandée : 25, 33, 40 ou 50 cm. Plus la coupe est courte, plus il y a de sciage et de manutention — c'est pourquoi le prix au mètre cube apparent varie avec la longueur."
          />
          <Etape
            numero={6}
            titre="La livraison"
            texte="Nous livrons nous-mêmes, avec nos camions. Le bois est déposé en vrac à l'endroit accessible le plus proche que vous indiquez, et le rangement en tas est proposé en option."
          />
        </ol>

        <Prose>
          <h2>Les essences que nous vendons</h2>
          <p>
            Nous travaillons uniquement des feuillus durs. Ils sont plus denses que le résineux :
            à volume égal, ils contiennent plus de matière, donc plus d&apos;énergie, et ils
            tiennent la braise au lieu de s&apos;éteindre en une heure.
          </p>
          <ul>
            <li>
              <strong>Chêne</strong> — la référence pour tenir la nuit. Dense, braise longue,
              demande un séchage complet pour donner le meilleur.
            </li>
            <li>
              <strong>Hêtre</strong> — le meilleur compromis : s&apos;allume bien, chauffe fort,
              flamme claire. C&apos;est l&apos;essence la plus demandée.
            </li>
            <li>
              <strong>Charme</strong> — le plus dense des trois. Excellent pour la braise, un peu
              plus difficile à allumer.
            </li>
            <li>
              <strong>Mélange de bois durs</strong> — chêne, hêtre, charme et frêne selon les
              coupes. Le meilleur rapport qualité-prix pour un usage quotidien.
            </li>
          </ul>
        </Prose>

        <Faq questions={FAQ} />

        <AppelAction
          titre="Voir nos bois et leurs prix"
          texte={`Choisissez la longueur adaptée à votre poêle et l'essence qui vous convient. Le prix livré chez vous s'affiche immédiatement.`}
        />
        <p className="sr-only">{tenant.name}</p>
      </PageContenu>
    </>
  );
}

function Etape({ numero, titre, texte }: { numero: number; titre: string; texte: string }) {
  return (
    <li className="flex gap-5">
      <span
        className="bg-sapin flex size-11 shrink-0 items-center justify-center rounded-full text-[19px] font-bold text-white"
        aria-hidden="true"
      >
        {numero}
      </span>
      <div>
        <h2 className="text-[22px]">{titre}</h2>
        <p className="text-cendre mt-2 max-w-[64ch] text-[17px] leading-relaxed">{texte}</p>
      </div>
    </li>
  );
}
