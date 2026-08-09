"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErreurStatistiques({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="p-5 sm:p-8">
      <div className="border-erreur/40 bg-erreur/10 max-w-2xl rounded-[8px] border p-6">
        <AlertTriangle className="text-erreur" size={28} aria-hidden="true" />
        <h1 className="mt-4 text-[28px]">Les statistiques ne peuvent pas être chargées</h1>
        <p className="text-cendre-clair mt-3 text-[15px]">Les commandes ne sont pas touchées. Réessayez dans un instant ; si le problème persiste, vérifiez que la migration Statistiques a bien été appliquée.</p>
        <Button type="button" variant="default" className="mt-6" onClick={reset}><RefreshCw size={17} aria-hidden="true" />Réessayer</Button>
      </div>
    </main>
  );
}
