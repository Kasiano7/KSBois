import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { GUIDES, getGuide } from "@/content/guides";
import { requireTenant } from "@/lib/tenant";
import { jsonldArticle, jsonldFaq, jsonldFilAriane, metadataPage } from "@/lib/seo";
import { DonneesStructurees } from "@/components/site/donnees-structurees";
import { AppelAction, Faq, PageContenu } from "@/components/site/page-contenu";

/** Les guides vivent dans le code : la génération statique est donc possible. */
export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata(props: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const guide = getGuide(slug);

  if (!guide) {
    return metadataPage({
      titre: "Guide introuvable",
      description: "Ce guide n'existe pas ou a été retiré.",
      chemin: `/guides/${slug}`,
      noindex: true,
    });
  }

  return metadataPage({
    titre: guide.titreSeo,
    description: guide.description,
    chemin: `/guides/${guide.slug}`,
  });
}

export default async function PageGuide(props: PageProps<"/guides/[slug]">) {
  const { slug } = await props.params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const tenant = await requireTenant();
  const fil = [
    { nom: "Accueil", chemin: "/" },
    { nom: "Guides", chemin: "/guides" },
    { nom: guide.titre, chemin: `/guides/${guide.slug}` },
  ];

  return (
    <>
      <DonneesStructurees
        data={[
          jsonldFilAriane(fil),
          jsonldArticle({
            titre: guide.titre,
            description: guide.description,
            chemin: `/guides/${guide.slug}`,
            auteur: tenant.name,
            publieLe: guide.publieLe,
          }),
          jsonldFaq(guide.faq),
        ]}
      />

      <PageContenu eyebrow="Guide" titre={guide.titre} chapeau={guide.chapeau} fil={fil}>
        <p className="text-cendre -mt-4 flex items-center gap-2 text-[15px]">
          <Clock size={16} strokeWidth={1.9} aria-hidden="true" />
          {guide.minutesLecture} min de lecture
        </p>

        <div className="mt-10 space-y-10">
          {guide.sections.map((section) => (
            <section key={section.titre}>
              <h2 className="text-[26px]">{section.titre}</h2>
              {section.paragraphes.map((paragraphe) => (
                <p
                  key={paragraphe.slice(0, 40)}
                  className="text-encre mt-4 max-w-[68ch] text-[17px] leading-[1.65]"
                >
                  {paragraphe}
                </p>
              ))}
              {section.liste && (
                <ul className="mt-5 max-w-[68ch] space-y-2">
                  {section.liste.map((element) => (
                    <li key={element} className="flex gap-3 text-[17px] leading-relaxed">
                      <span className="bg-seve mt-2.5 size-2 shrink-0 rounded-full" aria-hidden="true" />
                      {element}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <Faq questions={guide.faq} />

        <AppelAction
          titre="Prêt à commander ?"
          texte="Choisissez votre longueur et votre essence : le prix livré chez vous s'affiche immédiatement, sans créer de compte."
        />
      </PageContenu>
    </>
  );
}
