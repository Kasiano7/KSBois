"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  FileText,
  Images,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navigation de l'administration.
 *
 * Composant CLIENT — et uniquement pour ça : marquer l'écran courant. C'est la
 * seule information que le serveur ne peut pas donner à un layout (docs/03
 * §9 ter : un layout ne reçoit pas le chemin demandé).
 *
 * Les entrées sont GROUPÉES et toutes portent un libellé écrit. Dix liens à
 * plat obligent à relire la liste entière à chaque fois ; l'exploitant cherche
 * « une commande » ou « une tournée », pas la sixième ligne (docs/05 §1).
 */

const GROUPES = [
  {
    titre: "Pilotage",
    entrees: [
      { href: "/admin", libelle: "Tableau de bord", Icone: LayoutDashboard },
      { href: "/admin/statistiques", libelle: "Statistiques", Icone: ChartNoAxesCombined },
    ],
  },
  {
    titre: "Ventes",
    entrees: [
      { href: "/admin/commandes", libelle: "Commandes", Icone: ClipboardList },
      { href: "/admin/devis", libelle: "Devis", Icone: FileText },
      { href: "/admin/clients", libelle: "Clients", Icone: Users },
    ],
  },
  {
    titre: "Livraison",
    entrees: [
      { href: "/admin/tournee", libelle: "Tournée du jour", Icone: Truck },
      { href: "/admin/livraison/creneaux", libelle: "Créneaux", Icone: CalendarDays },
      { href: "/admin/livraison/zones", libelle: "Zones", Icone: MapPin },
    ],
  },
  {
    titre: "Entreprise",
    entrees: [
      { href: "/admin/stock", libelle: "Stock et tarifs", Icone: Package },
      { href: "/admin/medias", libelle: "Médias", Icone: Images },
      { href: "/admin/reglages", libelle: "Réglages", Icone: Settings },
    ],
  },
];

const TOUTES = GROUPES.flatMap((groupe) => groupe.entrees);

/**
 * L'écran courant est celui dont le chemin est le PLUS LONG à correspondre :
 * sans ça, « /admin » resterait allumé sur toutes les pages, et
 * « /admin/livraison/zones » n'allumerait rien de précis.
 */
function useHrefActif(): string | null {
  const chemin = usePathname();
  if (!chemin) return null;
  return (
    TOUTES.map((entree) => entree.href)
      .filter((href) => chemin === href || chemin.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}

export function NavigationAdmin() {
  const actif = useHrefActif();

  return (
    <nav aria-label="Administration">
      {/* Mobile : une seule rangée qui défile, sans titres de groupe — on ne
          scinde pas un menu en quatre paquets sur 375 px de large. */}
      <ul className="flex gap-2 overflow-x-auto px-4 py-3 lg:hidden [scrollbar-width:none]">
        {TOUTES.map(({ href, libelle, Icone }) => (
          <li key={href} className="shrink-0">
            <Lien href={href} libelle={libelle} Icone={Icone} actif={href === actif} />
          </li>
        ))}
      </ul>

      <div className="hidden px-3 py-4 lg:block">
        {GROUPES.map((groupe) => (
          <div key={groupe.titre} className="mb-5 last:mb-0">
            <p className="micro-label text-cendre-clair px-3 pb-2">{groupe.titre}</p>
            <ul className="space-y-1">
              {groupe.entrees.map(({ href, libelle, Icone }) => (
                <li key={href}>
                  <Lien href={href} libelle={libelle} Icone={Icone} actif={href === actif} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

function Lien({
  href,
  libelle,
  Icone,
  actif,
}: {
  href: string;
  libelle: string;
  Icone: typeof LayoutDashboard;
  actif: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-[10px] px-3 py-2 text-[15px] font-medium whitespace-nowrap transition-colors lg:w-full",
        actif ? "bg-seve text-encre font-semibold" : "text-aubier hover:bg-aubier/10",
      )}
    >
      <Icone size={19} strokeWidth={actif ? 2 : 1.75} className="shrink-0" aria-hidden="true" />
      {libelle}
    </Link>
  );
}
