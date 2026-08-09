import Link from "next/link";
import { TreePine, User, ShoppingCart } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getCartId } from "@/server/panier";
import { cn } from "@/lib/utils";
import type { Tenant } from "@/lib/tenant";

/**
 * En-tête du site public — présente sur TOUTES les pages du registre public.
 *
 * Deux variantes, une seule implémentation :
 *  • `surimpression` — accueil : posée sur la photo du héros, sans fond, la
 *    photo continue derrière ;
 *  • `pleine` — pages intérieures : barre pleine écorce, collante en haut.
 *
 * La marque ramène toujours à l'accueil : c'est le repère de sortie de secours
 * d'une audience qui ne connaît pas le bouton « précédent » de son navigateur.
 *
 * ⚠️ La navigation ne liste que des destinations qui EXISTENT. Le principe du
 * « chantier visible » vaut aussi ici : mieux vaut trois liens qui marchent que
 * six dont la moitié tombe en 404 (docs/05 §1).
 */

async function nombreArticlesPanier(): Promise<number> {
  const cartId = await getCartId();
  if (!cartId) return 0;

  const { count } = await createSupabaseAdminClient()
    .from("cart_items")
    .select("id", { count: "exact", head: true })
    .eq("cart_id", cartId);

  return count ?? 0;
}

const LIENS = [
  { href: "/#commander", libelle: "Bois de chauffage" },
  { href: "/#livraison", libelle: "Livraison" },
  { href: "/devis", libelle: "Devis sur mesure" },
];

export async function EnteteSite({
  tenant,
  variante = "pleine",
}: {
  tenant: Tenant;
  variante?: "surimpression" | "pleine";
}) {
  const articles = await nombreArticlesPanier();
  const surimpression = variante === "surimpression";

  return (
    <header
      className={cn(
        "z-30",
        surimpression
          ? "absolute inset-x-0 top-0"
          : "bg-ecorce border-ecorce-bord sticky top-0 border-b",
      )}
    >
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:py-5">
        {/* ── Marque : retour à l'accueil depuis n'importe quelle page ── */}
        <Link href="/" className="group flex items-center gap-3">
          {tenant.logoUrl ? (
            // Le logo est administrable et peut venir du CDN choisi par l'entreprise.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt=""
              className="h-11 w-auto max-w-28 shrink-0 object-contain"
            />
          ) : (
            <TreePine size={30} strokeWidth={1.5} className="text-seve shrink-0" aria-hidden="true" />
          )}
          <span>
            <span className="font-display text-aubier block text-[24px] leading-none group-hover:underline group-hover:underline-offset-4">
              {tenant.name}
            </span>
            <span className="micro-label text-cendre-clair mt-1 block text-[10px]">
              {tenant.tagline}
              {tenant.city ? ` · ${tenant.city}` : ""}
            </span>
          </span>
        </Link>

        {/* ── Navigation ── */}
        <nav aria-label="Principale" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {LIENS.map((lien) => (
              <li key={lien.href}>
                <Link
                  href={lien.href}
                  className="text-aubier/90 hover:text-aubier hover:bg-aubier/10 flex min-h-11 items-center rounded-[4px] px-3.5 text-[15px] font-medium transition-colors"
                >
                  {lien.libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Actions ── */}
        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/compte"
            aria-label="Mon espace client"
            className="text-aubier/90 hover:text-aubier hover:bg-aubier/10 flex size-11 items-center justify-center rounded-[4px] transition-colors"
          >
            <User size={22} strokeWidth={1.6} aria-hidden="true" />
          </Link>

          <Link
            href="/panier"
            aria-label={
              articles === 0
                ? "Mon panier, vide"
                : `Mon panier, ${articles} article${articles > 1 ? "s" : ""}`
            }
            className="text-aubier/90 hover:text-aubier hover:bg-aubier/10 relative flex size-11 items-center justify-center rounded-[4px] transition-colors"
          >
            <ShoppingCart size={22} strokeWidth={1.6} aria-hidden="true" />
            {articles > 0 && (
              <span
                aria-hidden="true"
                className="bg-braise tabulaire absolute top-1 right-0.5 flex size-[19px] items-center justify-center rounded-full text-[11px] font-bold text-white"
              >
                {articles}
              </span>
            )}
          </Link>

          <Link
            href="/#commander"
            className="border-aubier/35 text-aubier hover:bg-aubier hover:text-encre ml-1.5 hidden h-11 items-center rounded-[4px] border px-5 text-[15px] font-semibold transition-colors sm:inline-flex"
          >
            Commander mon bois
          </Link>
        </div>
      </div>
    </header>
  );
}
