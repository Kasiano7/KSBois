import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { EcranAVenir } from "@/components/admin/ecran-a-venir";

export const metadata: Metadata = { title: "Clients", robots: { index: false, follow: false } };

export default async function PageClients() {
  await requireRole(["owner", "staff"], "/admin/clients");

  return (
    <EcranAVenir
      titre="Clients"
      description="Recherche instantanée par nom, téléphone ou commune, historique des commandes, adresses avec contraintes d'accès, notes internes, et bouton « Créer une commande pour ce client » qui pré-remplit tout — indispensable pour prendre une commande au téléphone. Les coordonnées sont déjà enregistrées avec chaque commande."
      contournement={{ libelle: "Voir les commandes", href: "/admin/commandes" }}
    />
  );
}
