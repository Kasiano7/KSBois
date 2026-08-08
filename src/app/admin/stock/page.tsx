import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { EcranAVenir } from "@/components/admin/ecran-a-venir";

export const metadata: Metadata = { title: "Stock", robots: { index: false, follow: false } };

export default async function PageStock() {
  await requireRole(["owner", "staff"], "/admin/stock");

  return (
    <EcranAVenir
      titre="Stock"
      description="Cet écran permettra de saisir la production du jour en deux gestes depuis un téléphone (« Combien avez-vous produit ? » → +5), de corriger un inventaire avec motif, et de suivre les seuils d'alerte. Les stocks sont déjà tenus automatiquement : ils se réservent à la commande et se décrémentent à la livraison, chaque mouvement étant tracé."
      contournement={{ libelle: "Voir les commandes", href: "/admin/commandes" }}
    />
  );
}
