import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Retour du lien magique : échange le code contre une session.
 *
 * La destination est restreinte aux chemins internes — une redirection ouverte
 * permettrait d'envoyer l'utilisateur vers un site tiers depuis notre domaine.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const suiteBrute = url.searchParams.get("suite");

  const suite =
    suiteBrute && suiteBrute.startsWith("/") && !suiteBrute.startsWith("//") ? suiteBrute : "/admin";

  if (!code) {
    return NextResponse.redirect(new URL("/connexion?erreur=lien_invalide", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth] échange du code :", error.message);
    return NextResponse.redirect(new URL("/connexion?erreur=lien_expire", url.origin));
  }

  return NextResponse.redirect(new URL(suite, url.origin));
}
