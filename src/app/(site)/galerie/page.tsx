import type { Metadata } from "next";
import { requireTenant } from "@/lib/tenant";
import { listerMedias } from "@/server/medias";
import { imagekitConfigure } from "@/lib/imagekit";
import { jsonldFilAriane, metadataPage } from "@/lib/seo";
import { DonneesStructurees } from "@/components/site/donnees-structurees";
import { Media } from "@/components/media";
import { AppelAction, PageContenu } from "@/components/site/page-contenu";

/**
 * Galerie — docs/06 §1.2.
 *
 * Alimentée par la bibliothèque de médias, dossier « galerie ». Deux règles :
 *
 * 1. **Seules les images décrites sont publiées.** Une photo sans texte
 *    alternatif est inaccessible et invisible pour Google (docs/04 §3) : elle
 *    est filtrée ici, pas seulement signalée dans l'administration.
 * 2. **Aucun placeholder en production.** Tant que le shooting n'a pas eu lieu,
 *    la page annonce honnêtement qu'elle se remplira — elle n'affiche pas des
 *    images de banque d'images en les faisant passer pour l'entreprise
 *    (docs/07, risques).
 */

export async function generateMetadata(): Promise<Metadata> {
  return metadataPage({
    titre: "Galerie",
    description:
      "Photos de notre bois de chauffage, de l'exploitation au séchage et à la livraison. Des images réelles, prises chez nous.",
    chemin: "/galerie",
  });
}

export default async function PageGalerie() {
  const tenant = await requireTenant();
  const tous = imagekitConfigure()
    ? await listerMedias(tenant.id, { dossier: "galerie" })
    : [];

  // Sans description, une image ne part pas sur le site public.
  const publiables = tous.filter((media) => media.altText?.trim());

  return (
    <>
      <DonneesStructurees
        data={jsonldFilAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Galerie", chemin: "/galerie" },
        ])}
      />

      <PageContenu
        large
        eyebrow="Galerie"
        titre="Notre bois en images"
        chapeau="Des photos prises chez nous : les coupes, les tas en séchage, les livraisons. Rien d'acheté sur une banque d'images."
        fil={[
          { nom: "Accueil", chemin: "/" },
          { nom: "Galerie", chemin: "/galerie" },
        ]}
      >
        {publiables.length === 0 ? (
          <div className="border-aubier-bord bg-aubier-pur rounded-[14px] border border-dashed p-8 text-center">
            <p className="text-[19px] font-semibold">Les photos arrivent</p>
            <p className="text-cendre mx-auto mt-3 max-w-[54ch] text-[17px] leading-relaxed">
              Nous préférons attendre d&apos;avoir nos propres photos plutôt que d&apos;afficher
              des images génériques. En attendant, chaque produit porte sa mesure d&apos;humidité
              et son volume exact — c&apos;est ce qui compte pour choisir.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publiables.map((media, index) => (
              <li key={media.id}>
                <figure className="overflow-hidden rounded-[12px]">
                  <Media
                    media={media}
                    preset="galleryTile"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    // Une seule image en priorité par page : l'image LCP
                    // (docs/04 §5.3).
                    priority={index === 0}
                  />
                  <figcaption className="text-cendre mt-2 text-[15px]">
                    {media.altText}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        )}

        <AppelAction
          titre="Le bois que vous voyez, vous pouvez le commander"
          texte="Choisissez votre longueur et votre essence : le prix livré chez vous s'affiche immédiatement, sans créer de compte."
        />
      </PageContenu>
    </>
  );
}
