import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { EcranAVenir } from "@/components/admin/ecran-a-venir";

export const metadata: Metadata = { title: "Réglages", robots: { index: false, follow: false } };

export default async function PageReglages() {
  await requireRole(["owner"], "/admin/reglages");

  return (
    <EcranAVenir
      titre="Réglages"
      description="Entreprise et mentions légales, thème (six couleurs et le logo), moyens de paiement, facturation et TVA, minimums de commande, notifications, textes légaux, et les interrupteurs de fonctionnalités qui pilotent le modèle multi-entreprises. Tous ces réglages existent déjà en base et sont lus par l'application : seule l'interface d'édition manque."
    />
  );
}
