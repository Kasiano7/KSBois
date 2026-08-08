import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { EcranAVenir } from "@/components/admin/ecran-a-venir";

export const metadata: Metadata = { title: "Devis", robots: { index: false, follow: false } };

export default async function PageDevis() {
  await requireRole(["owner", "staff"], "/admin/devis");

  return (
    <EcranAVenir
      titre="Demandes de devis"
      description="Les demandes arrivent déjà en base avec leur origine (hors zone, gros volume, formulaire) et le panier du visiteur en pièce jointe. Cet écran permettra de les traiter, d'ajuster l'estimation pré-calculée, d'envoyer un devis PDF, puis de le convertir en commande en un clic — sans double saisie."
      contournement={{ libelle: "Voir les commandes", href: "/admin/commandes" }}
    />
  );
}
