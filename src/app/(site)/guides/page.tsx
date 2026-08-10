import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { GUIDES } from "@/content/guides";
import { jsonldFilAriane, metadataPage } from "@/lib/seo";
import { DonneesStructurees } from "@/components/site/donnees-structurees";
import { AppelAction, PageContenu } from "@/components/site/page-contenu";

export async function generateMetadata(): Promise<Metadata> {
  return metadataPage({
    titre: "Guides du bois de chauffage",
    description:
      "Quelle quantité commander, comment reconnaître du bois sec, comment le stocker et quelle longueur de bûche choisir. Nos réponses aux questions les plus fréquentes.",
    chemin: "/guides",
  });
}

export default function PageGuides() {
  return (
    <>
      <DonneesStructurees
        data={jsonldFilAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Guides", chemin: "/guides" },
        ])}
      />

      <PageContenu
        eyebrow="Guides"
        titre="Bien choisir et bien utiliser son bois"
        chapeau="Les questions qu'on nous pose au téléphone, avec des réponses honnêtes — y compris quand la réponse est « ça dépend »."
        fil={[
          { nom: "Accueil", chemin: "/" },
          { nom: "Guides", chemin: "/guides" },
        ]}
      >
        <ul className="space-y-4">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Link
                href={`/guides/${guide.slug}`}
                className="border-aubier-bord bg-aubier-pur hover:border-sapin/40 block rounded-[14px] border p-5 transition-colors sm:p-6"
              >
                <h2 className="text-[22px]">{guide.titre}</h2>
                <p className="text-cendre mt-2 max-w-[64ch] text-[17px] leading-relaxed">
                  {guide.description}
                </p>
                <p className="text-cendre mt-4 flex items-center gap-2 text-[15px] font-semibold">
                  <Clock size={16} strokeWidth={1.9} aria-hidden="true" />
                  {guide.minutesLecture} min de lecture
                  <ArrowRight size={16} strokeWidth={1.9} aria-hidden="true" className="ml-1" />
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <AppelAction
          titre="Vous savez ce qu'il vous faut ?"
          texte="Choisissez votre longueur et votre essence : le prix livré chez vous s'affiche immédiatement."
        />
      </PageContenu>
    </>
  );
}
