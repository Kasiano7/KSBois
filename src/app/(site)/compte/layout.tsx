import Link from "next/link";
import { User, Package, MapPin, LogOut } from "lucide-react";
import { getClientSession } from "@/lib/auth";
import { deconnexion } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * Espace client — registre transactionnel (docs/03 §1) : fond clair, contraste
 * maximal, gros texte. Rien de la densité de l'administration.
 *
 * ⚠️ Ce layout n'exige PAS de session : il enveloppe aussi `/compte/connexion`,
 * qui doit rester accessible déconnecté. Chaque page appelle `requireClient()`
 * pour elle-même — le contrôle d'accès reste explicite, écran par écran.
 */

const NAVIGATION = [
  { href: "/compte", libelle: "Mes commandes", Icone: Package },
  { href: "/compte/adresses", libelle: "Mes adresses", Icone: MapPin },
];

export default async function LayoutCompte({ children }: LayoutProps<"/compte">) {
  const session = await getClientSession();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {session && (
        <div className="border-aubier-bord border-b">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-5 py-3">
            <p className="text-cendre flex items-center gap-2 text-[15px]">
              <User size={18} strokeWidth={1.9} aria-hidden="true" />
              {[session.prenom, session.nom].filter(Boolean).join(" ") || session.email}
            </p>

            <nav aria-label="Mon espace" className="flex flex-wrap items-center gap-1">
              {NAVIGATION.map(({ href, libelle, Icone }) => (
                <Link
                  key={href}
                  href={href}
                  className="hover:bg-aubier flex min-h-11 items-center gap-2 rounded-[4px] px-3 text-[15px] font-medium"
                >
                  <Icone size={18} strokeWidth={1.9} aria-hidden="true" />
                  {libelle}
                </Link>
              ))}

              <form action={deconnexion}>
                <Button type="submit" variant="ghost" size="default">
                  <LogOut size={18} strokeWidth={1.9} />
                  Se déconnecter
                </Button>
              </form>
            </nav>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
