"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { enregistrerCoordonnees } from "@/server/actions/commande";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Étape 2 — coordonnées, adresse et contraintes d'accès.
 *
 * ⚠️ Aucun champ mot de passe : la commande invité est le parcours par défaut
 * (PLAN.md §2.4). La création de compte est proposée APRÈS le paiement.
 *
 * Les contraintes d'accès sont la partie la plus importante de cet écran :
 * c'est ce qui évite le camion qui fait demi-tour dans un chemin de montagne.
 */

interface Valeurs {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  accessNotes: string | null;
  truckAccess: string;
  unloadType: string | null;
  allowUnattendedDelivery: boolean;
  deliveryNotes: string | null;
}

const ACCES = [
  { valeur: "spl", libelle: "Semi-remorque", aide: "Route large, accès dégagé" },
  { valeur: "camion", libelle: "Camion", aide: "Le cas le plus courant" },
  { valeur: "fourgon", libelle: "Fourgon seulement", aide: "Chemin étroit, virage serré" },
  { valeur: "remorque_seule", libelle: "Petite remorque", aide: "Accès très difficile" },
];

const DECHARGEMENT = [
  { valeur: "vrac_sol", libelle: "En vrac au sol" },
  { valeur: "benne", libelle: "Déversé à la benne" },
  { valeur: "range", libelle: "Rangé (sur devis)" },
];

export function FormulaireCoordonnees({
  valeurs,
  ville,
  codePostal,
}: {
  valeurs: Valeurs;
  ville: string | null;
  codePostal: string | null;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [messageGlobal, setMessageGlobal] = useState<string | null>(null);

  /**
   * ⚠️ `onSubmit` + `preventDefault`, et NON `action={}` : React réinitialise le
   * formulaire après une soumission via `action`. Sur cet écran, une erreur de
   * validation effaçait l'adresse et toutes les contraintes d'accès déjà
   * renseignées — le champ le plus long à remplir du tunnel.
   */
  const envoyer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErreurs({});
    setMessageGlobal(null);
    const formData = new FormData(event.currentTarget);
    const brut = Object.fromEntries(formData.entries());

    demarrer(async () => {
      const resultat = await enregistrerCoordonnees({
        ...brut,
        allowUnattendedDelivery: formData.get("allowUnattendedDelivery") === "on",
        fulfillmentType: "delivery",
      });
      if (resultat.ok) {
        router.push("/commande/creneau");
        return;
      }
      setErreurs(resultat.erreurs ?? {});
      setMessageGlobal(resultat.message ?? "Une erreur est survenue.");
    });
  };

  const champ = (
    nom: keyof Valeurs,
    libelle: string,
    options: {
      type?: string;
      requis?: boolean;
      inputMode?: "text" | "tel" | "email" | "numeric";
      autoComplete?: string;
      aide?: string;
    } = {},
  ) => (
    <div>
      <Label htmlFor={nom} className="text-cendre">
        {libelle}
        {!options.requis && <span className="font-normal">(facultatif)</span>}
      </Label>
      <Input
        id={nom}
        name={nom}
        type={options.type ?? "text"}
        inputMode={options.inputMode}
        autoComplete={options.autoComplete}
        required={options.requis}
        defaultValue={(valeurs[nom] as string | null) ?? ""}
        aria-invalid={Boolean(erreurs[nom])}
        aria-describedby={erreurs[nom] ? `${nom}-erreur` : options.aide ? `${nom}-aide` : undefined}
        className="mt-2"
      />
      {erreurs[nom] ? (
        <p id={`${nom}-erreur`} role="alert" className="text-erreur mt-1.5 text-[15px]">
          {erreurs[nom]}
        </p>
      ) : (
        options.aide && (
          <p id={`${nom}-aide`} className="text-cendre mt-1.5 text-[15px]">
            {options.aide}
          </p>
        )
      )}
    </div>
  );

  return (
    <form onSubmit={envoyer} noValidate className="mt-8">
      <section>
        <h2 className="text-[24px]">Vos coordonnées</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {champ("firstName", "Prénom", { requis: true, autoComplete: "given-name" })}
          {champ("lastName", "Nom", { requis: true, autoComplete: "family-name" })}
          {champ("email", "Email", {
            requis: true,
            type: "email",
            inputMode: "email",
            autoComplete: "email",
            aide: "Pour recevoir la confirmation et la facture",
          })}
          {champ("phone", "Téléphone", {
            requis: true,
            type: "tel",
            inputMode: "tel",
            autoComplete: "tel",
            aide: "Le livreur vous appelle avant de passer",
          })}
        </div>
      </section>

      <section className="border-aubier-bord mt-10 border-t pt-8">
        <h2 className="text-[24px]">Adresse de livraison</h2>
        <p className="text-cendre mt-2 text-[15px]">
          Commune enregistrée à l&apos;étape précédente :{" "}
          <strong className="text-encre">
            {ville ?? "—"} {codePostal ? `(${codePostal})` : ""}
          </strong>
        </p>

        <div className="mt-5 grid gap-5">
          {champ("addressLine1", "Adresse", {
            requis: true,
            autoComplete: "address-line1",
            aide: "Numéro, rue, lieu-dit",
          })}
          {champ("addressLine2", "Complément", { autoComplete: "address-line2" })}
        </div>
      </section>

      <section className="border-aubier-bord mt-10 border-t pt-8">
        <h2 className="text-[24px]">Accès à votre domicile</h2>
        <p className="text-cendre prose-bois mt-2 text-[17px]">
          Ces informations évitent la quasi-totalité des livraisons ratées. Prenez trente secondes,
          elles nous font gagner un aller-retour.
        </p>

        <fieldset className="mt-6">
          <legend className="micro-label text-cendre mb-3">
            Quel véhicule peut accéder chez vous ?
          </legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {ACCES.map((a) => (
              <label
                key={a.valeur}
                className="border-aubier-bord hover:bg-encre/3 flex cursor-pointer items-start gap-3 rounded-[6px] border p-3.5"
              >
                <input
                  type="radio"
                  name="truckAccess"
                  value={a.valeur}
                  defaultChecked={valeurs.truckAccess === a.valeur}
                  className="accent-braise mt-1 size-5"
                />
                <span>
                  <span className="block font-semibold">{a.libelle}</span>
                  <span className="text-cendre block text-[15px]">{a.aide}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="micro-label text-cendre mb-3">Déchargement souhaité</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2.5">
            {DECHARGEMENT.map((d) => (
              <label key={d.valeur} className="flex cursor-pointer items-center gap-2.5 text-[17px]">
                <input
                  type="radio"
                  name="unloadType"
                  value={d.valeur}
                  defaultChecked={(valeurs.unloadType ?? "vrac_sol") === d.valeur}
                  className="accent-braise size-5"
                />
                {d.libelle}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="border-aubier-bord mt-6 flex cursor-pointer items-start gap-3 rounded-[6px] border p-4">
          <input
            type="checkbox"
            name="allowUnattendedDelivery"
            defaultChecked={valeurs.allowUnattendedDelivery}
            className="accent-braise mt-1 size-5"
          />
          <span>
            <span className="block font-semibold">
              J&apos;autorise la livraison en mon absence
            </span>
            <span className="text-cendre block text-[15px]">
              Précisez ci-dessous où déposer le bois. Sans cette autorisation, votre présence est
              nécessaire.
            </span>
          </span>
        </label>

        <div className="mt-6 grid gap-5">
          <div>
            <Label htmlFor="accessNotes" className="text-cendre">
              Précisions sur l&apos;accès <span className="font-normal">(facultatif)</span>
            </Label>
            <Textarea
              id="accessNotes"
              name="accessNotes"
              defaultValue={valeurs.accessNotes ?? ""}
              className="mt-2"
              placeholder="Chemin étroit sur 200 m, portail à gauche, forte pente, décharger devant le garage…"
            />
          </div>
          <div>
            <Label htmlFor="deliveryNotes" className="text-cendre">
              Autre information <span className="font-normal">(facultatif)</span>
            </Label>
            <Textarea
              id="deliveryNotes"
              name="deliveryNotes"
              defaultValue={valeurs.deliveryNotes ?? ""}
              className="mt-2"
            />
          </div>
        </div>
      </section>

      {messageGlobal && (
        <p role="alert" className="text-erreur mt-6 text-[17px]">
          {messageGlobal}
        </p>
      )}

      <Button type="submit" variant="or" size="cta" disabled={enCours} className="mt-8 w-full sm:w-auto">
        {enCours ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            Enregistrement…
          </>
        ) : (
          "Choisir un créneau"
        )}
      </Button>
    </form>
  );
}
