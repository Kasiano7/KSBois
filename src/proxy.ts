import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ⚠️ Next.js 16 : ce fichier s'appelle `proxy.ts` et non plus `middleware.ts`,
 * et la fonction exportée s'appelle `proxy`. Le runtime est Node.js, non
 * configurable (docs/01-ARCHITECTURE.md §1.0).
 *
 * Rôle : rafraîchir la session Supabase à chaque requête et protéger les
 * espaces authentifiés. La résolution du tenant, elle, se fait dans
 * `src/lib/tenant.ts` : elle nécessite des accès base que le proxy ne doit pas
 * porter, et le résultat est mémoïsé par rendu.
 */

const ESPACES_PROTEGES = ["/admin", "/livreur", "/compte"];

/** Pages d'un espace protégé qui doivent rester ouvertes : sinon, boucle. */
const EXCEPTIONS = ["/compte/connexion"];

/**
 * Où renvoyer un visiteur non connecté. Un client n'a rien à faire sur l'écran
 * de connexion de l'entreprise, et réciproquement.
 */
function pageDeConnexion(chemin: string): string {
  return chemin.startsWith("/compte") ? "/compte/connexion" : "/connexion";
}

/**
 * Chemin demandé, exposé aux layouts serveur.
 *
 * Next ne donne pas le pathname à un layout : sans cet en-tête, le layout du
 * site ne pourrait pas savoir s'il rend l'accueil (en-tête en surimpression de
 * la photo) ou une page intérieure (barre pleine). C'est le seul moyen propre
 * d'éviter de dupliquer le layout dans deux groupes de routes.
 */
export const EN_TETE_CHEMIN = "x-chemin";

export async function proxy(request: NextRequest) {
  request.headers.set(EN_TETE_CHEMIN, request.nextUrl.pathname);
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sans Supabase configuré, on laisse passer : le site public reste consultable
  // et la page d'accueil affiche un message explicite.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() valide le jeton auprès du serveur d'authentification.
  // Ne jamais se fier à getSession() pour une décision d'autorisation :
  // son contenu vient du cookie et n'est pas vérifié.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chemin = request.nextUrl.pathname;
  const estProtege =
    ESPACES_PROTEGES.some((p) => chemin === p || chemin.startsWith(`${p}/`)) &&
    !EXCEPTIONS.some((p) => chemin === p || chemin.startsWith(`${p}/`));

  if (estProtege && !user) {
    const connexion = request.nextUrl.clone();
    connexion.pathname = pageDeConnexion(chemin);
    connexion.searchParams.set("suite", chemin);
    return NextResponse.redirect(connexion);
  }

  return response;
}

export const config = {
  // On évite les fichiers statiques et les images : inutile d'y rafraîchir une session.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
