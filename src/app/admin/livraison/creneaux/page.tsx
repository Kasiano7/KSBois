import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { EcranAVenir } from "@/components/admin/ecran-a-venir";

export const metadata: Metadata = { title: "Créneaux", robots: { index: false, follow: false } };

export default async function PageCreneaux() {
  await requireRole(["owner", "staff"], "/admin/livraison/creneaux");

  return (
    <EcranAVenir
      titre="Créneaux de livraison"
      description="Gestion des modèles récurrents (jour, horaires, nombre maximum de livraisons ET volume maximum) et calendrier des huit prochaines semaines avec le taux de remplissage de chaque créneau. Les créneaux sont déjà générés automatiquement et la double contrainte de capacité est appliquée à la réservation."
      contournement={{ libelle: "Voir la tournée du jour", href: "/admin/tournee" }}
    />
  );
}
