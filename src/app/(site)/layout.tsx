import { headers } from "next/headers";
import { getTenant } from "@/lib/tenant";
import { EN_TETE_CHEMIN } from "@/proxy";
import { EnteteSite } from "@/components/site/entete";

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

  return (
    <>
      <EnteteSite
        tenant={tenant}
        variante={chemin === "/" ? "surimpression" : "pleine"}
        collante={!espaceAvecSaBarre}
      />
      {children}
    </>
  );
}
