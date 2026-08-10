import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getDonneesLegales, lignesIdentification } from "@/server/legal";
import { jsonldFilAriane, metadataPage } from "@/lib/seo";
import { DonneesStructurees } from "@/components/site/donnees-structurees";
import { PageContenu, Prose } from "@/components/site/page-contenu";

export async function generateMetadata(): Promise<Metadata> {
  return metadataPage({
    titre: "Mentions légales",
    description: "Éditeur du site, hébergement, propriété intellectuelle et médiation.",
    chemin: "/mentions-legales",
    // Utile aux visiteurs, sans intérêt de référencement.
    noindex: true,
  });
}

export default async function PageMentionsLegales() {
  const tenant = await requireTenant();
  const legales = await getDonneesLegales(tenant.id);
  if (!legales) notFound();

  return (
    <>
      <DonneesStructurees
        data={jsonldFilAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Mentions légales", chemin: "/mentions-legales" },
        ])}
      />

      <PageContenu
        titre="Mentions légales"
        fil={[
          { nom: "Accueil", chemin: "/" },
          { nom: "Mentions légales", chemin: "/mentions-legales" },
        ]}
      >
        <Prose>
          <h2>Éditeur du site</h2>
          <ul>
            {lignesIdentification(legales).map((ligne) => (
              <li key={ligne}>{ligne}</li>
            ))}
          </ul>
          {!legales.assujettiTva && (
            <p>TVA non applicable, article 293 B du code général des impôts.</p>
          )}

          <h2>Directeur de la publication</h2>
          <p>Le représentant légal de {legales.raisonSociale}.</p>

          <h2>Hébergement</h2>
          <p>
            Le site est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789,
            États-Unis. Les données de l&apos;application sont hébergées dans l&apos;Union
            européenne.
          </p>

          <h2>Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble des contenus de ce site — textes, photographies, illustrations et
            éléments graphiques — est la propriété de {legales.raisonSociale}, sauf mention
            contraire. Toute reproduction ou représentation, totale ou partielle, sans
            autorisation écrite préalable est interdite.
          </p>

          <h2>Signalement d&apos;un contenu</h2>
          <p>
            Pour signaler un contenu illicite ou une erreur, écrivez à{" "}
            <a href={`mailto:${legales.email}`} className="underline underline-offset-4">
              {legales.email}
            </a>
            {legales.telephone ? ` ou appelez le ${legales.telephone}` : ""}.
          </p>

          <h2>Médiation de la consommation</h2>
          <p>
            Conformément à l&apos;article L612-1 du code de la consommation, tout consommateur a
            le droit de recourir gratuitement à un médiateur de la consommation en vue de la
            résolution amiable d&apos;un litige. Les coordonnées du médiateur retenu par
            l&apos;entreprise sont communiquées sur demande à l&apos;adresse ci-dessus.
          </p>
          <p>
            La plateforme européenne de règlement en ligne des litiges est accessible à
            l&apos;adresse{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              className="underline underline-offset-4"
              rel="noopener nofollow"
              target="_blank"
            >
              ec.europa.eu/consumers/odr
            </a>
            .
          </p>
        </Prose>
      </PageContenu>
    </>
  );
}
