import Link from "next/link";
import { LogOut, TreePine } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { deconnexion } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { NavigationAdmin } from "@/components/admin/navigation-admin";

/**
 * Layout de l'administration — registre vert sapin (docs/03 §9 quater).
 *
 * ⚠️ La classe `registre-admin` porte toute la refonte du 10 août 2026 : elle
 * redéfinit `--ecorce`, `--ecorce-eleve` et `--ecorce-bord` sur la famille
 * verte de la maquette client. Les dix écrans existants la suivent sans avoir
 * été touchés, puisqu'ils n'utilisent que ces tokens. La retirer suffit à
 * revenir au brun.
 *
 * Contrainte dominante : l'exploitant n'est pas à l'aise avec l'informatique.
 * Donc des LIBELLÉS écrits partout, jamais d'icône seule, et des zones de clic
 * généreuses (docs/05 §1).
 */
export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  const session = await requireRole(["owner", "staff"], "/admin");
  const tenant = await requireTenant();

  return (
    <div className="registre-admin dark bg-ecorce text-aubier flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="border-ecorce-bord bg-ecorce-eleve flex flex-col border-b lg:h-dvh lg:w-[264px] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:sticky lg:top-0">
        <Link
          href="/"
          aria-label={`Retour à l'accueil de ${tenant.name}`}
          className="border-ecorce-bord hover:bg-aubier/5 focus-visible:ring-seve flex items-center gap-3 border-b px-5 py-4 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none"
        >
          <span
            className="bg-seve/15 text-seve flex size-10 shrink-0 items-center justify-center rounded-[10px]"
            aria-hidden="true"
          >
            <TreePine size={21} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="font-display truncate text-[18px] leading-tight">{tenant.name}</p>
            <p className="text-cendre-clair text-[12px]">Administration</p>
          </div>
        </Link>

        <NavigationAdmin />

        <div className="border-ecorce-bord mt-auto border-t p-3">
          <div className="px-2 pb-2">
            <p className="truncate text-[14px] font-medium">
              {session.fullName ?? session.email}
            </p>
            <p className="text-cendre-clair text-[12px]">
              {session.role === "owner" ? "Gérant" : "Secrétariat"}
            </p>
          </div>
          <form action={deconnexion}>
            <Button type="submit" variant="ghost" size="default" className="w-full justify-start">
              <LogOut size={19} strokeWidth={1.75} />
              Se déconnecter
            </Button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
