import type { MetadataRoute } from "next";
import { getTenant } from "@/lib/tenant";
import { listerCommunesLivrees } from "@/server/contenu";
import { GUIDES } from "@/content/guides";
import { urlAbsolue } from "@/lib/seo";

/**
 * Plan du site — docs/06 §1.6.
 *
 * ⚠️ **Seules les pages indexables y figurent.** Une page commune trop pauvre
 * est en `noindex` (docs/06 §1.3) : l'annoncer dans le sitemap tout en
 * demandant à Google de ne pas l'indexer est un signal contradictoire, remonté
 * comme une erreur dans la Search Console.
 *
 * Les pages légales, le tunnel et l'espace client n'y sont pas non plus : ils
 * n'ont aucun intérêt de référencement et sont déjà exclus par `robots`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const maintenant = new Date();

  const statiques: MetadataRoute.Sitemap = [
    { url: urlAbsolue("/"), lastModified: maintenant, changeFrequency: "weekly", priority: 1 },
    { url: urlAbsolue("/livraison"), lastModified: maintenant, changeFrequency: "monthly", priority: 0.9 },
    { url: urlAbsolue("/devis"), lastModified: maintenant, changeFrequency: "monthly", priority: 0.8 },
    { url: urlAbsolue("/savoir-faire"), lastModified: maintenant, changeFrequency: "yearly", priority: 0.6 },
    { url: urlAbsolue("/notre-entreprise"), lastModified: maintenant, changeFrequency: "yearly", priority: 0.6 },
    { url: urlAbsolue("/guides"), lastModified: maintenant, changeFrequency: "monthly", priority: 0.6 },
    { url: urlAbsolue("/galerie"), lastModified: maintenant, changeFrequency: "monthly", priority: 0.4 },
    { url: urlAbsolue("/contact"), lastModified: maintenant, changeFrequency: "yearly", priority: 0.4 },
    { url: urlAbsolue("/cgv"), lastModified: maintenant, changeFrequency: "yearly", priority: 0.2 },
  ];

  const guides: MetadataRoute.Sitemap = GUIDES.map((guide) => ({
    url: urlAbsolue(`/guides/${guide.slug}`),
    lastModified: new Date(guide.publieLe),
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  // Le tenant se résout par le domaine de la requête : s'il est introuvable —
  // prerender, domaine inconnu — on sert le socle statique plutôt qu'une erreur.
  const tenant = await getTenant();
  if (!tenant) return [...statiques, ...guides];

  const communes = await listerCommunesLivrees(tenant.id);
  const locales: MetadataRoute.Sitemap = communes
    .filter((commune) => commune.indexable)
    .map((commune) => ({
      url: urlAbsolue(`/livraison/${commune.slug}`),
      lastModified: maintenant,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));

  return [...statiques, ...guides, ...locales];
}
