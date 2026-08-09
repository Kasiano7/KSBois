"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { connexionClient } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Connexion client par lien magique — une seule chose à faire à l'écran.
 *
 * ⚠️ `onSubmit` + `preventDefault`, jamais `action={}` : React réinitialise le
 * formulaire après une soumission via `action`, et le client perdait son email
 * dès la première erreur de saisie (piège déjà rencontré sur le tunnel).
 */
export function ConnexionClient({ suite }: { suite?: string }) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoyeA, setEnvoyeA] = useState<string | null>(null);

  if (envoyeA) {
    return (
      <div>
        <p className="flex items-center gap-2.5 text-[19px] font-semibold">
          <CheckCircle2 size={24} strokeWidth={1.9} className="text-succes" aria-hidden="true" />
          Regardez votre boîte mail
        </p>
        <p className="text-cendre mt-3 text-[17px] leading-relaxed">
          Nous venons d&apos;envoyer un lien de connexion à <strong>{envoyeA}</strong>. Cliquez
          dessus depuis ce téléphone ou cet ordinateur : vous serez connecté directement. Le lien
          est valable une heure.
        </p>
        <p className="text-cendre mt-3 text-[15px]">
          Rien reçu au bout de deux minutes ? Regardez dans vos courriers indésirables.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="mt-5"
          onClick={() => setEnvoyeA(null)}
        >
          Utiliser une autre adresse
        </Button>
      </div>
    );
  }

  const envoyer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErreur(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");

    demarrer(async () => {
      const r = await connexionClient({ email, suite });
      if (r.ok && r.lienEnvoye) setEnvoyeA(email);
      else setErreur(r.message ?? "L'envoi a échoué.");
    });
  };

  return (
    <form onSubmit={envoyer} noValidate>
      <Label htmlFor="email-client">Votre adresse email</Label>
      <Input
        id="email-client"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        autoFocus
        placeholder="jean.dupont@exemple.fr"
        className="mt-2"
      />

      {erreur && (
        <p role="alert" className="text-erreur mt-3 text-[15px]">
          {erreur}
        </p>
      )}

      <Button type="submit" variant="cta" size="cta" className="mt-5 w-full" disabled={enCours}>
        {enCours ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Mail strokeWidth={1.9} />
        )}
        Recevoir mon lien de connexion
      </Button>
    </form>
  );
}
