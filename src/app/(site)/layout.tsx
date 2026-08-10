import { headers } from "next/headers";
import { getTenant } from "@/lib/tenant";
import { EN_TETE_CHEMIN } from "@/proxy";
import { listerCommunesLivrees } from "@/server/contenu";
import { jsonldEntreprise } from "@/lib/seo";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { EnteteSite } from "@/components/site/entete";
import { PiedSite } from "@/components/site/pied";
import { DonneesStructurees } from "@/components/site/donnees-structurees";

/**
 * Layout du registre public — docs/01-ARCHITECTURE.md §2
 *
 * Groupe de routes `(site)` : il n'ajoute aucun segment d'URL, il ne fait
 * qu'apposer l'en-tête commune à toutes les pages publiques. L'administration
 * et l'espace livreur, eux, gardent leur propre registre.
 *
 * ⚠️ Un layout ne reçoit pas le chemin demandé. Le proxy le dépose dans
 * l'en-tête `x-chemin` : c'est ce qui permet de poser la barre en surimpression
 * de la photo sur l'accueil, et en barre pleine ailleurs, sans dupliquer ce
 * fichier dans deux groupes de routes.
 */
export default async function LayoutSite({ children }: LayoutProps<"/">) {
  const tenant = await getTenant();
  const chemin = (await headers()).get(EN_TETE_CHEMIN) ?? "";

  // Sans tenant résolu, la page affiche elle-même le message de configuration :
  // une en-tête sans nom d'entreprise n'apporterait rien.
  if (!tenant) return <>{children}</>;

  // L'espace client porte sa propre barre de navigation : une en-tête collante
  // passerait par-dessus au premier défilement.
  const espaceAvecSaBarre = chemin.startsWith("/compte");

  const [communes, { data: entreprise }] = await Promise.all([
    listerCommunesLivrees(tenant.id),
    createSupabaseAdminClient()
      .from("companies")
      .select("address_line1, depot_lat, depot_lng")
      .eq("id", tenant.id)
      .maybeSingle(),
  ]);

  // La fiche établissement est posée une seule fois, dans le layout : elle vaut
  // pour toutes les pages publiques, et la répéter par page produirait des
  // doublons que Google signale (docs/06 §1.5).
  const fiche = jsonldEntreprise(tenant, {
    adresse: {
      rue: entreprise?.address_line1 ?? null,
      codePostal: tenant.postalCode,
      ville: tenant.city,
    },
    latitude: entreprise?.depot_lat ?? null,
    longitude: entreprise?.depot_lng ?? null,
    communesDesservies: communes.map((commune) => commune.ville),
  });

  // Le tunnel de commande n'a ni pied de page ni maillage : à cette étape, la
  // seule action utile est de finir la commande (docs/03 §6.3).
  const dansLeTunnel = chemin.startsWith("/commande") || chemin.startsWith("/panier");

  return (
    <>
      <DonneesStructurees data={fiche} />
      <EnteteSite
        tenant={tenant}
        variante={chemin === "/" ? "surimpression" : "pleine"}
        collante={!espaceAvecSaBarre}
      />
      {children}
      {!dansLeTunnel && (
        <PiedSite
          tenant={tenant}
          communes={communes.map((commune) => ({
            slug: commune.slug,
            ville: commune.ville,
            indexable: commune.indexable,
          }))}
        />
      )}
    </>
  );
}
