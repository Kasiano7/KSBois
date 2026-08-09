"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Loader2, Lock, CreditCard } from "lucide-react";
import { confirmerPaiementCarte } from "@/server/actions/commande";
import { formatEuros } from "@/domain/units";
import { Button } from "@/components/ui/button";

/**
 * Paiement par carte — docs/02-MOTEURS-METIER.md §6.2
 *
 * Stripe Elements : le formulaire est un iframe hébergé par Stripe, donc AUCUNE
 * donnée de carte ne touche notre serveur (conformité PCI-DSS SAQ-A).
 *
 * Après confirmation, on appelle une action serveur qui redemande l'état réel à
 * l'API Stripe. On ne se fie jamais au résultat renvoyé au navigateur.
 */

export interface DonneesPaiement {
  clientSecret: string;
  publishableKey: string;
  montantCents: number;
  reference: string;
  redirection: string;
}

export function FormulaireCarte({ donnees }: { donnees: DonneesPaiement }) {
  // `loadStripe` est appelé ici et non au module : la clé vient des props, donc
  // elle reste juste même si l'entreprise change (multi-tenant).
  const [promesse] = useState(() => loadStripe(donnees.publishableKey));

  return (
    <Elements
      stripe={promesse}
      options={{
        clientSecret: donnees.clientSecret,
        locale: "fr",
        appearance: {
          theme: "flat",
          variables: {
            colorPrimary: "#c4501b",
            colorText: "#14100d",
            colorBackground: "#ffffff",
            borderRadius: "4px",
            fontFamily: "Archivo, system-ui, sans-serif",
            fontSizeBase: "17px",
            spacingUnit: "4px",
          },
        },
      }}
    >
      <Champs donnees={donnees} />
    </Elements>
  );
}

function Champs({ donnees }: { donnees: DonneesPaiement }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const payer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setEnCours(true);
    setErreur(null);

    // `redirect: "if_required"` garde le client sur la page pour une carte
    // classique, et ne redirige que si la banque impose une authentification.
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${donnees.redirection}`,
      },
      redirect: "if_required",
    });

    if (error) {
      // Messages Stripe déjà localisés en français grâce à `locale: "fr"`.
      setErreur(error.message ?? "Le paiement n'a pas abouti.");
      setEnCours(false);
      return;
    }

    if (paymentIntent?.status !== "succeeded") {
      setErreur("Le paiement est en cours de traitement. Nous vous confirmons par email.");
      setEnCours(false);
      return;
    }

    // Le navigateur dit « payé » : on fait vérifier par le serveur auprès de
    // Stripe avant de considérer la commande acquittée.
    const resultat = await confirmerPaiementCarte({ reference: donnees.reference });

    if (!resultat.ok) {
      // Le paiement est passé chez Stripe : on n'inquiète pas le client, le
      // webhook rattrapera. On l'emmène sur sa confirmation.
      console.error("[paiement] vérification serveur :", resultat.message);
    }

    router.push(donnees.redirection);
  };

  return (
    <form onSubmit={payer}>
      <PaymentElement options={{ layout: "tabs" }} />

      {erreur && (
        <p role="alert" className="text-erreur mt-4 text-[17px]">
          {erreur}
        </p>
      )}

      <Button
        type="submit"
        variant="or"
        size="cta"
        disabled={enCours || !stripe}
        className="mt-6 w-full"
      >
        {enCours ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Paiement en cours…
          </>
        ) : (
          <>
            <CreditCard strokeWidth={1.75} />
            Payer {formatEuros(donnees.montantCents)}
          </>
        )}
      </Button>

      <p className="text-cendre mt-3 flex items-center justify-center gap-1.5 text-[13px]">
        <Lock size={14} strokeWidth={2} aria-hidden="true" />
        Paiement sécurisé par Stripe — vos coordonnées bancaires ne transitent pas par notre site.
      </p>
    </form>
  );
}
