"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Impression de la feuille de tournée.
 *
 * On utilise l'impression du navigateur plutôt qu'un PDF serveur : la page est
 * déjà stylée pour l'impression (classes `print:`), le résultat est identique,
 * et surtout le livreur peut imprimer depuis son téléphone sans réseau une fois
 * la page chargée. Un PDF dédié reste possible plus tard si la mise en page
 * papier doit s'écarter de l'écran.
 */
export function BoutonImprimer({ libelle = "Imprimer la feuille" }: { libelle?: string }) {
  return (
    <Button type="button" variant="outline" size="lg" onClick={() => window.print()}>
      <Printer strokeWidth={1.75} />
      {libelle}
    </Button>
  );
}
