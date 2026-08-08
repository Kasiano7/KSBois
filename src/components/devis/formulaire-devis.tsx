"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { envoyerDemandeDevis } from "@/server/actions/devis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Formulaire de demande de devis.
 *
 * UX : un champ par ligne sur mobile, libellés visibles (jamais de placeholder
 * seul), erreurs affichées SOUS le champ concerné et non regroupées en haut de
 * page (docs/03 §9).
 */

interface Champ {
  nom: string;
  libelle: string;
  type?: string;
  requis?: boolean;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal";
  autoComplete?: string;
  aide?: string;
  largeur?: "plein" | "moitie";
}

const CHAMPS: Champ[] = [
  { nom: "firstName", libelle: "Prénom", requis: true, autoComplete: "given-name", largeur: "moitie" },
  { nom: "lastName", libelle: "Nom", requis: true, autoComplete: "family-name", largeur: "moitie" },
  { nom: "companyName", libelle: "Entreprise", aide: "Si vous commandez pour un professionnel" },
  { nom: "email", libelle: "Email", type: "email", requis: true, inputMode: "email", autoComplete: "email", largeur: "moitie" },
  { nom: "phone", libelle: "Téléphone", type: "tel", requis: true, inputMode: "tel", autoComplete: "tel", largeur: "moitie" },
  { nom: "addressLine1", libelle: "Adresse de livraison", autoComplete: "address-line1" },
  { nom: "postalCode", libelle: "Code postal", requis: true, inputMode: "numeric", autoComplete: "postal-code", largeur: "moitie" },
  { nom: "city", libelle: "Commune", requis: true, autoComplete: "address-level2", largeur: "moitie" },
  { nom: "quantityM3", libelle: "Quantité souhaitée", inputMode: "decimal", aide: "En m³ apparents (stères)", largeur: "moitie" },
  { nom: "cutLengthCm", libelle: "Longueur de coupe", inputMode: "numeric", aide: "En centimètres : 25, 33, 40, 50 ou 100", largeur: "moitie" },
  { nom: "species", libelle: "Essence souhaitée", aide: "Chêne, hêtre, charme, mélange…" },
];

const SECHAGES = [
  { valeur: "sec", libelle: "Bois sec, prêt à brûler" },
  { valeur: "mi_sec", libelle: "Mi-sec" },
  { valeur: "vert", libelle: "Fraîchement coupé" },
  { valeur: "peu_importe", libelle: "Peu importe" },
];

export function FormulaireDevis() {
  const [enCours, demarrer] = useTransition();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [messageGlobal, setMessageGlobal] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  if (reference) {
    return (
      <div className="border-succes/30 bg-succes/8 rounded-[8px] border p-6">
        <p className="flex items-center gap-2.5 text-[19px] font-semibold">
          <CheckCircle2 size={24} strokeWidth={1.9} className="text-succes" aria-hidden="true" />
          Votre demande est enregistrée
        </p>
        <p className="text-cendre mt-3 text-[17px] leading-relaxed">
          Référence <strong className="text-encre font-mono">{reference}</strong>. Nous revenons
          vers vous sous 48 heures ouvrées, par téléphone ou par email.
        </p>
      </div>
    );
  }

  /**
   * ⚠️ `onSubmit` + `preventDefault`, et NON `action={}` : React réinitialise le
   * formulaire après une soumission via `action`, ce qui effaçait les onze
   * champs déjà saisis dès la première erreur de validation.
   */
  const envoyer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErreurs({});
    setMessageGlobal(null);

    const brut = Object.fromEntries(new FormData(event.currentTarget).entries());
    // Les champs numériques vides ne doivent pas être envoyés comme "".
    for (const cle of ["quantityM3", "cutLengthCm"]) {
      if (brut[cle] === "") delete brut[cle];
    }

    demarrer(async () => {
      const resultat = await envoyerDemandeDevis(brut);
      if (resultat.ok) {
        setReference(resultat.reference ?? "—");
        return;
      }
      setErreurs(resultat.erreurs ?? {});
      setMessageGlobal(resultat.message ?? "Une erreur est survenue.");
    });
  };

  return (
    <form onSubmit={envoyer} noValidate>
      {/* Piège anti-robot : invisible et hors du flux de tabulation. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="siteWeb">Site web</label>
        <input id="siteWeb" name="siteWeb" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {CHAMPS.map((champ) => (
          <div
            key={champ.nom}
            className={champ.largeur === "moitie" ? "sm:col-span-1" : "sm:col-span-2"}
          >
            <Label htmlFor={champ.nom} className="text-cendre">
              {champ.libelle}
              {!champ.requis && <span className="font-normal">(facultatif)</span>}
            </Label>
            <Input
              id={champ.nom}
              name={champ.nom}
              type={champ.type ?? "text"}
              inputMode={champ.inputMode}
              autoComplete={champ.autoComplete}
              required={champ.requis}
              aria-invalid={Boolean(erreurs[champ.nom])}
              aria-describedby={
                erreurs[champ.nom]
                  ? `${champ.nom}-erreur`
                  : champ.aide
                    ? `${champ.nom}-aide`
                    : undefined
              }
              className="mt-2"
            />
            {erreurs[champ.nom] ? (
              <p id={`${champ.nom}-erreur`} role="alert" className="text-erreur mt-1.5 text-[15px]">
                {erreurs[champ.nom]}
              </p>
            ) : (
              champ.aide && (
                <p id={`${champ.nom}-aide`} className="text-cendre mt-1.5 text-[15px]">
                  {champ.aide}
                </p>
              )
            )}
          </div>
        ))}

        <fieldset className="sm:col-span-2">
          <legend className="micro-label text-cendre mb-3">Séchage souhaité</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2.5">
            {SECHAGES.map((s) => (
              <label key={s.valeur} className="flex cursor-pointer items-center gap-2.5 text-[17px]">
                <input
                  type="radio"
                  name="humidityPreference"
                  value={s.valeur}
                  defaultChecked={s.valeur === "sec"}
                  className="accent-braise size-5"
                />
                {s.libelle}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="sm:col-span-2">
          <Label htmlFor="message" className="text-cendre">
            Votre message <span className="font-normal">(facultatif)</span>
          </Label>
          <Textarea
            id="message"
            name="message"
            className="mt-2"
            placeholder="Accès au terrain, contraintes de livraison, délai souhaité…"
          />
        </div>
      </div>

      {messageGlobal && (
        <p role="alert" className="text-erreur mt-5 text-[17px]">
          {messageGlobal}
        </p>
      )}

      <Button type="submit" variant="cta" size="cta" disabled={enCours} className="mt-7 w-full sm:w-auto">
        {enCours ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Envoi…
          </>
        ) : (
          "Envoyer ma demande"
        )}
      </Button>

      <p className="text-cendre mt-4 text-[15px]">
        Vos coordonnées servent uniquement à traiter votre demande. Elles ne sont ni revendues ni
        utilisées à des fins publicitaires.
      </p>
    </form>
  );
}
