"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, KeyRound, CheckCircle2 } from "lucide-react";
import { connexionParLienMagique, connexionParMotDePasse } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Deux voies de connexion.
 *
 * Le lien magique est la voie principale : rien à retenir, et l'exploitant n'a
 * pas à gérer un mot de passe. Le mot de passe reste proposé parce que, depuis
 * le camion, l'aller-retour vers la boîte mail est pénible.
 */
export function FormulaireConnexion({ suite }: { suite?: string }) {
  const [mode, setMode] = useState<"lien" | "motDePasse">("motDePasse");
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [lienEnvoye, setLienEnvoye] = useState(false);

  if (lienEnvoye) {
    return (
      <div>
        <p className="flex items-center gap-2.5 text-[19px] font-semibold">
          <CheckCircle2 size={24} strokeWidth={1.9} className="text-succes" aria-hidden="true" />
          Vérifiez votre boîte mail
        </p>
        <p className="text-cendre mt-3 text-[17px] leading-relaxed">
          Si cette adresse a accès à l&apos;espace de l&apos;entreprise, un lien de connexion vient
          d&apos;être envoyé. Il est valable une heure.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="mt-5"
          onClick={() => setLienEnvoye(false)}
        >
          Utiliser une autre adresse
        </Button>
      </div>
    );
  }

  /**
   * ⚠️ On utilise `onSubmit` + `preventDefault`, et NON `action={}`.
   *
   * React réinitialise le formulaire après une soumission via `action` : en cas
   * d'erreur, l'utilisateur perdait son email et devait tout retaper. Sur un
   * formulaire long, c'est rédhibitoire.
   */
  const envoyer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErreur(null);
    const formData = new FormData(event.currentTarget);
    const donnees = { ...Object.fromEntries(formData.entries()), suite };

    demarrer(async () => {
      const resultat =
        mode === "lien"
          ? await connexionParLienMagique(donnees)
          : await connexionParMotDePasse(donnees);

      // En mot de passe, le succès redirige : on n'arrive ici qu'en erreur.
      if (resultat?.lienEnvoye) setLienEnvoye(true);
      else if (resultat && !resultat.ok) setErreur(resultat.message ?? "Connexion impossible.");
    });
  };

  return (
    <form onSubmit={envoyer} noValidate>
      <div>
        <Label htmlFor="email" className="text-cendre">
          Adresse email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          autoFocus
          className="mt-2"
        />
      </div>

      {mode === "motDePasse" && (
        <div className="mt-5">
          <Label htmlFor="password" className="text-cendre">
            Mot de passe
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-2"
          />
        </div>
      )}

      {erreur && (
        <p role="alert" className="text-erreur mt-4 text-[15px]">
          {erreur}
        </p>
      )}

      <Button type="submit" variant="cta" size="cta" disabled={enCours} className="mt-6 w-full">
        {enCours ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Connexion…
          </>
        ) : mode === "lien" ? (
          <>
            <Mail strokeWidth={1.75} />
            Recevoir un lien de connexion
          </>
        ) : (
          <>
            <KeyRound strokeWidth={1.75} />
            Se connecter
          </>
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="default"
        className="mt-3 w-full"
        onClick={() => {
          setMode(mode === "lien" ? "motDePasse" : "lien");
          setErreur(null);
        }}
      >
        {mode === "lien" ? "Utiliser un mot de passe" : "Recevoir un lien par email"}
      </Button>
    </form>
  );
}
