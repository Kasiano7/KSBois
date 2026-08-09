"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, Merge, Save, ShieldX, ShoppingCart, UserCheck } from "lucide-react";
import {
  anonymiserClient,
  definirBlocageClient,
  enregistrerNotesClient,
  fusionnerClients,
  modifierClient,
  preparerCommandeClient,
  type ResultatClientAdmin,
} from "@/server/actions/admin-clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ClientEditable {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  customerType: "particulier" | "professionnel";
  isCompany: boolean;
  companyName: string;
  siret: string;
  vatNumber: string;
  acceptsMarketing: boolean;
  notes: string;
  blocked: boolean;
  blockedReason: string;
  anonymized: boolean;
}

function Retour({ retour }: { retour: { ok: boolean; message: string } | null }) {
  if (!retour) return null;
  return (
    <p role="status" className={`mt-3 text-[15px] font-semibold ${retour.ok ? "text-succes" : "text-erreur"}`}>
      {retour.message}
    </p>
  );
}

export function PanneauFicheClient({
  client,
  doublons,
  owner,
}: {
  client: ClientEditable;
  doublons: { id: string; nom: string; email: string }[];
  owner: boolean;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [motif, setMotif] = useState(client.blockedReason);
  const [cibleFusion, setCibleFusion] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const executer = (promesse: () => Promise<ResultatClientAdmin>) => {
    setRetour(null);
    demarrer(async () => {
      const resultat = await promesse();
      setRetour({ ok: resultat.ok, message: resultat.message ?? (resultat.ok ? "Enregistré." : "Une erreur est survenue.") });
      if (resultat.redirection) {
        router.push(resultat.redirection);
      } else if (resultat.ok) {
        router.refresh();
      }
    });
  };

  const envoyerCoordonnees = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    executer(() =>
      modifierClient({
        clientId: client.id,
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email"),
        phone: form.get("phone"),
        customerType: form.get("customerType"),
        isCompany: form.get("isCompany") === "on",
        companyName: form.get("companyName"),
        siret: form.get("siret"),
        vatNumber: form.get("vatNumber"),
        acceptsMarketing: form.get("acceptsMarketing") === "on",
      }),
    );
  };

  if (client.anonymized) {
    return (
      <section className="border-ecorce-bord rounded-[8px] border p-5">
        <h2 className="text-[19px] font-semibold">Données personnelles</h2>
        <p className="text-cendre-clair mt-2 text-[15px] leading-relaxed">
          Cette fiche a été anonymisée. Les commandes comptables restent visibles, mais aucune donnée personnelle ne peut être restaurée ni modifiée.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="border-ecorce-bord rounded-[8px] border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[19px] font-semibold">Coordonnées</h2>
            <p className="text-cendre-clair mt-1 text-[14px]">Informations de contact et données professionnelles.</p>
          </div>
          <Button
            type="button"
            variant="cta"
            size="default"
            disabled={enCours || client.blocked}
            onClick={() => executer(() => preparerCommandeClient({ clientId: client.id }))}
          >
            {enCours ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
            Créer une commande
          </Button>
        </div>

        <form onSubmit={envoyerCoordonnees} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-cendre-clair text-[14px] font-semibold">Prénom</span><Input name="firstName" defaultValue={client.firstName} className="mt-1.5" /></label>
          <label><span className="text-cendre-clair text-[14px] font-semibold">Nom</span><Input name="lastName" defaultValue={client.lastName} className="mt-1.5" /></label>
          <label><span className="text-cendre-clair text-[14px] font-semibold">E-mail</span><Input name="email" type="email" required defaultValue={client.email} className="mt-1.5" /></label>
          <label><span className="text-cendre-clair text-[14px] font-semibold">Téléphone</span><Input name="phone" type="tel" defaultValue={client.phone} className="mt-1.5" /></label>
          <label>
            <span className="text-cendre-clair text-[14px] font-semibold">Type de client</span>
            <select name="customerType" defaultValue={client.customerType} className="border-input bg-card mt-1.5 h-12 w-full rounded-[4px] border px-3.5 text-[17px]">
              <option value="particulier">Particulier</option>
              <option value="professionnel">Professionnel</option>
            </select>
          </label>
          <label className="border-ecorce-bord mt-5 flex min-h-12 items-center gap-3 rounded-[4px] border px-3.5">
            <input name="isCompany" type="checkbox" defaultChecked={client.isCompany} className="accent-braise size-5" />
            <span className="text-[15px] font-semibold">Entreprise ou association</span>
          </label>
          <label><span className="text-cendre-clair text-[14px] font-semibold">Raison sociale</span><Input name="companyName" defaultValue={client.companyName} className="mt-1.5" /></label>
          <label><span className="text-cendre-clair text-[14px] font-semibold">SIRET</span><Input name="siret" defaultValue={client.siret} className="mt-1.5" /></label>
          <label><span className="text-cendre-clair text-[14px] font-semibold">Numéro de TVA</span><Input name="vatNumber" defaultValue={client.vatNumber} className="mt-1.5" /></label>
          <label className="border-ecorce-bord mt-5 flex min-h-12 items-center gap-3 rounded-[4px] border px-3.5">
            <input name="acceptsMarketing" type="checkbox" defaultChecked={client.acceptsMarketing} className="accent-braise size-5" />
            <span className="text-[15px] font-semibold">Accepte les communications commerciales</span>
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" variant="default" disabled={enCours}>
              {enCours ? <Loader2 className="animate-spin" /> : <Save />}
              Enregistrer les coordonnées
            </Button>
          </div>
        </form>
        <Retour retour={retour} />
      </section>

      <section className="border-ecorce-bord rounded-[8px] border p-5">
        <h2 className="text-[19px] font-semibold">Notes internes</h2>
        <p className="text-cendre-clair mt-1 text-[14px]">Jamais visibles par le client. Évitez les données inutiles ou sensibles.</p>
        <Textarea id="notes-client" defaultValue={client.notes} className="mt-4 min-h-32" />
        <Button
          type="button"
          variant="default"
          disabled={enCours}
          className="mt-3"
          onClick={() => {
            const notes = (document.getElementById("notes-client") as HTMLTextAreaElement | null)?.value ?? "";
            executer(() => enregistrerNotesClient({ clientId: client.id, notes }));
          }}
        >
          <Save /> Enregistrer les notes
        </Button>
      </section>

      <section className={`rounded-[8px] border p-5 ${client.blocked ? "border-erreur/40 bg-erreur/8" : "border-ecorce-bord"}`}>
        <h2 className="text-[19px] font-semibold">Accès aux commandes</h2>
        {client.blocked ? (
          <>
            <p className="text-erreur mt-2 text-[15px] font-semibold">Client bloqué : {client.blockedReason || "motif non renseigné"}</p>
            <Button type="button" variant="outline" className="mt-4" disabled={enCours} onClick={() => executer(() => definirBlocageClient({ clientId: client.id, blocked: false, reason: "" }))}>
              <UserCheck /> Débloquer le client
            </Button>
          </>
        ) : (
          <>
            <label className="mt-4 block max-w-xl">
              <span className="text-cendre-clair text-[14px] font-semibold">Motif obligatoire</span>
              <Input value={motif} onChange={(event) => setMotif(event.target.value)} placeholder="Ex. impayé à régulariser" className="mt-1.5" />
            </label>
            <Button type="button" variant="destructive" className="mt-3" disabled={enCours || motif.trim().length < 3} onClick={() => executer(() => definirBlocageClient({ clientId: client.id, blocked: true, reason: motif }))}>
              <Ban /> Bloquer le client
            </Button>
          </>
        )}
      </section>

      {owner && (
        <section className="border-erreur/30 rounded-[8px] border p-5">
          <h2 className="text-[19px] font-semibold">Actions exceptionnelles</h2>
          <p className="text-cendre-clair mt-1 text-[14px] leading-relaxed">Réservées au gérant et enregistrées dans le journal d’audit.</p>

          <div className="border-ecorce-bord mt-5 border-t pt-5">
            <h3 className="font-semibold">Fusionner un doublon</h3>
            <p className="text-cendre-clair mt-1 text-[14px]">Les commandes et adresses seront déplacées vers la fiche choisie, puis cette fiche disparaîtra.</p>
            <select value={cibleFusion} onChange={(event) => setCibleFusion(event.target.value)} className="border-input bg-card mt-3 h-12 w-full max-w-xl rounded-[4px] border px-3.5 text-[15px]">
              <option value="">Choisir la fiche à conserver…</option>
              {doublons.map((doublon) => <option key={doublon.id} value={doublon.id}>{doublon.nom} · {doublon.email}</option>)}
            </select>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              disabled={enCours || !cibleFusion}
              onClick={() => {
                if (window.confirm("Fusionner définitivement ces deux fiches ?")) {
                  executer(() => fusionnerClients({ sourceId: client.id, targetId: cibleFusion }));
                }
              }}
            >
              <Merge /> Fusionner vers cette fiche
            </Button>
          </div>

          <div className="border-erreur/25 mt-6 border-t pt-5">
            <h3 className="text-erreur font-semibold">Droit à l’effacement</h3>
            <p className="text-cendre-clair mt-1 max-w-[70ch] text-[14px] leading-relaxed">
              Supprime les coordonnées, adresses, accès au compte et données de livraison. Les montants et factures restent conservés pour les obligations comptables. Cette action est irréversible.
            </p>
            <label className="mt-3 block max-w-sm">
              <span className="text-cendre-clair text-[14px] font-semibold">Saisissez ANONYMISER</span>
              <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1.5" />
            </label>
            <Button type="button" variant="destructive" className="mt-3" disabled={enCours || confirmation !== "ANONYMISER"} onClick={() => executer(() => anonymiserClient({ clientId: client.id, confirmation }))}>
              <ShieldX /> Anonymiser définitivement
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
