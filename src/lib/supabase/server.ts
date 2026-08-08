import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Clients Supabase côté serveur.
 *
 * ⚠️ Next.js 16 : `cookies()` est asynchrone, ces fonctions sont donc `async`.
 * ⚠️ `server-only` garantit qu'une importation depuis un composant client
 *    échoue à la compilation, et non silencieusement à l'exécution.
 */

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Client lié à la session de l'utilisateur. Toutes les requêtes passent par la
 * RLS avec son rôle réel. **C'est le client par défaut.**
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch (erreur) {
            // Depuis un Server Component, l'écriture de cookie est interdite et
            // cette exception est NORMALE : proxy.ts se charge du
            // rafraîchissement. Mais si elle survient dans une Server Action,
            // c'est un vrai bug — la session ne sera jamais persistée. On la
            // journalise donc au lieu de l'avaler en silence.
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                "[supabase] écriture de cookie refusée :",
                erreur instanceof Error ? erreur.message : erreur,
              );
            }
          }
        },
      },
    },
  );
}

/**
 * Client à privilèges complets — CONTOURNE LA RLS.
 *
 * Réservé à : webhooks, crons, panier serveur, résolution des commandes invité,
 * lecture des réglages sensibles. Chaque appel DOIT filtrer explicitement par
 * `company_id` : la base ne le fera plus pour vous.
 *
 * Ne jamais l'utiliser pour servir une requête utilisateur sans contrôle de
 * rôle préalable.
 */
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante — le client d'administration est indisponible.",
    );
  }

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
