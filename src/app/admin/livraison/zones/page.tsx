import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { EcranAVenir } from "@/components/admin/ecran-a-venir";

export const metadata: Metadata = { title: "Zones de livraison", robots: { index: false, follow: false } };

export default async function PageZones() {
  await requireRole(["owner"], "/admin/livraison/zones");

  return (
    <EcranAVenir
      titre="Zones de livraison"
      description="Deux vues : les zones (forfait, tarif au m³, seuil de gratuité, minimum de commande) et le tableau des communes à affecter en masse. Un bouton « Tester une adresse » montrera exactement ce que verrait un client. Les zones et les communes du secteur sont déjà en base et le calcul fonctionne ; il n'est pas encore modifiable sans SQL."
    />
  );
}
