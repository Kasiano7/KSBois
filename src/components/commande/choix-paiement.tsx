"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Banknote, FileText, Landmark, Smartphone, Loader2 } from "lucide-react";
import { validerCommande } from "@/server/actions/commande";
import { FormulaireCarte, type DonneesPaiement } from "./formulaire-carte";
import { formatEuros } from "@/domain/units";
import type { PaymentMethod } from "@/domain/payments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Étape 4 — paiement.
 *
 * Les modes proposés sont CALCULÉS PAR LE SERVEUR : le client ne voit jamais un
 * mode qu'il ne peut pas utiliser, et la sélection est revalidée à la création
 * de la commande. Modifier le formulaire ne sert à rien.
 */

export interface OptionPaiement {
  method: PaymentMethod;
  available: boolean;
  reason: string | null;
  payableNowCents: number;
  dueOnDeliveryCents: number;
}

const LIBELLES: Record<PaymentMethod, { titre: string; aide: string; Icone: typeof CreditCard }> = {
  card: { titre: "Carte bancaire", aide: "Paiement sécurisé en ligne", Icone: CreditCard },
  cash: { titre: "Espèces à la livraison", aide: "Faites l'appoint si possible", Icone: Banknote },
  check: { titre: "Chèque", aide: "À remettre au livreur", Icone: FileText },
  transfer: { titre: "Virement bancaire", aide: "RIB envoyé par email", Icone: Landmark },
  sumup: { titre: "Carte à la livraison", aide: "Terminal dans le camion", Icone: Smartphone },
};

const RAISONS: Record<string, string> = {
  plafond_especes:
    "Le paiement en espèces est limité à 1 000 € par la réglementation française.",
  livraison_uniquement: "Disponible uniquement en livraison.",
  non_configure: "Momentanément indisponible.",
};

export function ChoixPaiement({
  options,
  totalCents,
  acompteCents,
}: {
  options: OptionPaiement[];
  totalCents: number;
  acompteCents: number;
}) {
  const disponibles = options.filter((o) => o.available);
  const indisponiblesExpliquees = options.filter(
    (o) => !o.available && o.reason !== null && o.reason !== "desactive" && RAISONS[o.reason],
  );

  const router = useRouter();
  const [methode, setMethode] = useState<PaymentMethod | null>(
    disponibles[0]?.method ?? null,
  );
  const [cgv, setCgv] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [paiementCarte, setPaiementCarte] = useState<DonneesPaiement | null>(null);

  const choisie = options.find((o) => o.method === methode);
  const montantBouton =
    choisie && choisie.payableNowCents > 0 ? choisie.payableNowCents : totalCents;

  const valider = () => {
    setErreur(null);
    demarrer(async () => {
      const resultat = await validerCommande({ paymentMethod: methode, cgvAccepted: cgv });

      if (!resultat.ok) {
        setErreur(resultat.message ?? "Une erreur est survenue.");
        return;
      }

      // Carte : on reste sur la page et on affiche le formulaire Stripe. La
      // commande existe déjà, le stock est réservé, il ne manque que
      // l'encaissement.
      if (resultat.paiement && resultat.redirection) {
        setPaiementCarte({
          clientSecret: resultat.paiement.clientSecret,
          publishableKey: resultat.paiement.publishableKey,
          montantCents: resultat.paiement.montantCents,
          reference: resultat.redirection.split("/").pop()?.split("?")[0] ?? "",
          redirection: resultat.redirection,
        });
        return;
      }

      if (resultat.redirection) router.push(resultat.redirection);
    });
  };

  // Une fois l'intention créée, l'écran devient celui du paiement : revenir en
  // arrière n'aurait pas de sens, la commande est déjà enregistrée.
  if (paiementCarte) {
    return (
      <div className="mt-8">
        <h2 className="text-[22px]">Réglez votre commande</h2>
        <p className="text-cendre mt-2 text-[17px]">
          Votre commande est enregistrée. Il ne reste que le paiement.
        </p>
        <div className="border-aubier-bord bg-aubier-pur mt-5 rounded-[14px] border p-5">
          <FormulaireCarte donnees={paiementCarte} />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <fieldset>
        <legend className="micro-label text-cendre mb-3">Comment souhaitez-vous régler ?</legend>

        <div className="grid gap-2.5">
          {disponibles.map((option) => {
            const { titre, aide, Icone } = LIBELLES[option.method];
            const actif = methode === option.method;
            return (
              <label
                key={option.method}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[6px] border p-4 transition-colors duration-150",
                  actif ? "border-sapin bg-sapin/8" : "border-aubier-bord hover:bg-encre/3",
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option.method}
                  checked={actif}
                  onChange={() => setMethode(option.method)}
                  className="accent-braise mt-1 size-5"
                />
                <Icone size={22} strokeWidth={1.75} className="text-sapin mt-0.5 shrink-0" />
                <span className="flex-1">
                  <span className="block font-semibold">{titre}</span>
                  <span className="text-cendre block text-[15px]">{aide}</span>
                  {option.payableNowCents > 0 && option.dueOnDeliveryCents > 0 && (
                    <span className="text-braise-texte mt-1.5 block text-[15px] font-semibold">
                      Acompte de {formatEuros(option.payableNowCents)} maintenant, reste{" "}
                      {formatEuros(option.dueOnDeliveryCents)} à la livraison
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* On explique pourquoi un mode manque, plutôt que de le masquer sans un mot */}
      {indisponiblesExpliquees.length > 0 && (
        <ul className="text-cendre mt-4 space-y-1 text-[15px]">
          {indisponiblesExpliquees.map((o) => (
            <li key={o.method}>
              {LIBELLES[o.method].titre} — {RAISONS[o.reason!]}
            </li>
          ))}
        </ul>
      )}

      {acompteCents > 0 && (
        <p className="border-info/25 bg-info/6 mt-6 rounded-[6px] border p-4 text-[15px] leading-relaxed">
          Compte tenu du volume ou de la distance, un acompte de{" "}
          <strong>{formatEuros(acompteCents)}</strong> est demandé à la commande. Le solde se règle
          à la livraison.
        </p>
      )}

      <label className="border-aubier-bord mt-8 flex cursor-pointer items-start gap-3 rounded-[6px] border p-4">
        <input
          type="checkbox"
          checked={cgv}
          onChange={(e) => setCgv(e.target.checked)}
          className="accent-braise mt-1 size-5"
          aria-describedby="cgv-aide"
        />
        <span id="cgv-aide" className="text-[15px] leading-relaxed">
          J&apos;ai lu et j&apos;accepte les{" "}
          <a href="/cgv" target="_blank" className="text-braise-texte font-semibold underline underline-offset-4">
            conditions générales de vente
          </a>
          , et je reconnais disposer d&apos;un droit de rétractation de 14 jours.
        </span>
      </label>

      {erreur && (
        <p role="alert" className="text-erreur mt-6 text-[17px]">
          {erreur}
        </p>
      )}

      <Button
        type="button"
        variant="or"
        size="cta"
        disabled={enCours || !methode || !cgv}
        onClick={valider}
        className="mt-6 w-full"
      >
        {enCours ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Validation…
          </>
        ) : methode === "card" ? (
          `Payer ${formatEuros(montantBouton)}`
        ) : (
          `Valider ma commande de ${formatEuros(totalCents)}`
        )}
      </Button>

      <p className="text-cendre mt-3 text-center text-[13px]">
        Aucune création de compte n&apos;est nécessaire.
      </p>
    </div>
  );
}
