"use client";

import { useState, useTransition } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { definirDestination } from "@/server/actions/panier";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Vérification de la zone de livraison — placée DÈS LE PANIER.
 *
 * Un client qui découvre au moment de payer qu'on ne le livre pas est un client
 * perdu (docs/02 §2.1). Le champ est donc la première chose visible du panier.
 */

interface ChampDestinationProps {
  codePostalInitial: string | null;
  villeInitiale: string | null;
}

export function ChampDestination({ codePostalInitial, villeInitiale }: ChampDestinationProps) {
  const [codePostal, setCodePostal] = useState(codePostalInitial ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [choix, setChoix] = useState<{ postalCode: string; city: string }[] | null>(null);
  const [enCours, demarrer] = useTransition();

  const envoyer = (ville?: string) => {
    setErreur(null);
    demarrer(async () => {
      const resultat = await definirDestination({ postalCode: codePostal, city: ville ?? null });
      if (!resultat.ok) {
        setErreur(resultat.message ?? "Une erreur est survenue.");
        return;
      }
      // Plusieurs communes partagent ce code postal : on demande laquelle plutôt
      // que de deviner et de facturer la mauvaise distance.
      setChoix(resultat.statut === "ambiguous" ? (resultat.choix ?? null) : null);
    });
  };

  return (
    <div className="border-aubier-bord bg-aubier-pur rounded-[8px] border p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          envoyer();
        }}
      >
        <Label htmlFor="code-postal" className="text-cendre">
          <MapPin size={18} strokeWidth={1.75} aria-hidden="true" />
          Où devons-nous livrer ?
        </Label>

        <div className="mt-3 flex flex-wrap items-start gap-3">
          <div>
            <Input
              id="code-postal"
              name="postalCode"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="07690"
              maxLength={5}
              value={codePostal}
              onChange={(e) => setCodePostal(e.target.value.replace(/\D/g, ""))}
              aria-invalid={erreur !== null}
              aria-describedby={erreur ? "code-postal-erreur" : undefined}
              className="tabulaire w-32 text-center"
            />
          </div>
          <Button type="submit" size="lg" disabled={enCours || codePostal.length < 5}>
            {enCours ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Calcul…
              </>
            ) : (
              "Calculer la livraison"
            )}
          </Button>
        </div>

        {villeInitiale && !choix && (
          <p className="text-cendre mt-2.5 text-[15px]">
            Commune retenue : <strong className="text-encre">{villeInitiale}</strong>
          </p>
        )}

        {erreur && (
          <p id="code-postal-erreur" role="alert" className="text-erreur mt-2.5 text-[15px]">
            {erreur}
          </p>
        )}
      </form>

      {choix && (
        <div className="border-aubier-bord mt-4 border-t pt-4">
          <p className="text-[15px] font-semibold">
            Plusieurs communes portent ce code postal. Laquelle est la vôtre ?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {choix.map((c) => (
              <Button
                key={c.city}
                type="button"
                variant="outline"
                size="default"
                disabled={enCours}
                onClick={() => envoyer(c.city)}
              >
                {c.city}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
