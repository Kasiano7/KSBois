import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  Truck,
  Package,
  Users,
  MapPin,
  CalendarDays,
  ChartNoAxesCombined,
  Settings,
  LogOut,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { deconnexion } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * Layout de l'administration — registre sombre, dense (docs/03 §1).
 *
 * Contrainte dominante : l'exploitant n'est pas à l'aise avec l'informatique.
 * Donc des LIBELLÉS écrits partout, jamais d'icône seule, et des zones de clic
 * généreuses (docs/05 §1).
 */

const NAVIGATION = [
  { href: "/admin", libelle: "Tableau de bord", Icone: LayoutDashboard },
  { href: "/admin/commandes", libelle: "Commandes", Icone: ClipboardList },
  { href: "/admin/tournee", libelle: "Tournée du jour", Icone: Truck },
  { href: "/admin/stock", libelle: "Stock", Icone: Package },
  { href: "/admin/clients", libelle: "Clients", Icone: Users },
  { href: "/admin/devis", libelle: "Devis", Icone: ClipboardList },
  { href: "/admin/livraison/zones", libelle: "Zones", Icone: MapPin },
  { href: "/admin/livraison/creneaux", libelle: "Créneaux", Icone: CalendarDays },
  { href: "/admin/statistiques", libelle: "Statistiques", Icone: ChartNoAxesCombined },
  { href: "/admin/reglages", libelle: "Réglages", Icone: Settings },
];

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  const session = await requireRole(["owner", "staff"], "/admin");
  const tenant = await requireTenant();

  return (
    <div className="dark bg-ecorce text-aubier flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="border-ecorce-bord bg-ecorce-eleve border-b lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="border-ecorce-bord border-b p-5">
          <p className="font-display text-[19px] leading-tight">{tenant.name}</p>
          <p className="text-cendre-clair mt-1 text-[13px]">
            {session.fullName ?? session.email} ·{" "}
            {session.role === "owner" ? "Gérant" : "Secrétariat"}
          </p>
        </div>

        <nav aria-label="Administration" className="p-3">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {NAVIGATION.map(({ href, libelle, Icone }) => (
              <li key={href} className="lg:w-full">
                <Link
                  href={href}
                  className="text-aubier hover:bg-ecorce flex min-h-11 items-center gap-2.5 rounded-[4px] px-3 py-2 text-[15px] font-medium transition-colors"
                >
                  <Icone size={19} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
                  {libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-ecorce-bord mt-auto border-t p-3">
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
