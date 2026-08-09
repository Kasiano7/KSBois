"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatEuros } from "@/domain/units";
import type { ClientListe } from "@/server/admin-clients";

type Filtre = "tous" | "fideles" | "pros" | "bloques";

const formatDate = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

function normaliser(valeur: string): string {
  return valeur.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function ListeClients({ clients }: { clients: ClientListe[] }) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const visibles = useMemo(() => {
    const termes = normaliser(recherche).split(/\s+/).filter(Boolean);
    return clients.filter((client) => {
      if (filtre === "fideles" && client.commandes < 2) return false;
      if (filtre === "pros" && !client.professionnel) return false;
      if (filtre === "bloques" && !client.bloque) return false;
      const texte = normaliser(
        [client.nom, client.email, client.telephone, client.commune, client.societe].filter(Boolean).join(" "),
      );
      return termes.every((terme) => texte.includes(terme));
    });
  }, [clients, filtre, recherche]);

  return (
    <>
      <div className="mt-7 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative block max-w-xl flex-1">
          <span className="sr-only">Rechercher un client</span>
          <Search className="text-cendre-clair pointer-events-none absolute top-3.5 left-3.5" size={20} aria-hidden="true" />
          <Input
            type="search"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder="Nom, email, téléphone ou commune…"
            className="pl-11"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les clients">
          {([
            ["tous", "Tous"],
            ["fideles", "Fidèles"],
            ["pros", "Professionnels"],
            ["bloques", "Bloqués"],
          ] as const).map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              onClick={() => setFiltre(cle)}
              aria-pressed={filtre === cle}
              className={`min-h-11 rounded-[4px] border px-4 text-[15px] font-semibold transition-colors ${
                filtre === cle ? "border-braise bg-braise/15" : "border-ecorce-bord hover:bg-ecorce-eleve"
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>
      </div>

      <p className="text-cendre-clair mt-3 text-[14px]" aria-live="polite">
        {visibles.length} client{visibles.length > 1 ? "s" : ""} affiché{visibles.length > 1 ? "s" : ""}
      </p>

      {visibles.length === 0 ? (
        <div className="border-ecorce-bord mt-6 rounded-[8px] border border-dashed p-8 text-center">
          <Users className="text-cendre-clair mx-auto" size={30} aria-hidden="true" />
          <p className="mt-3 font-semibold">Aucun client ne correspond</p>
          <p className="text-cendre-clair mt-1 text-[15px]">Essayez un nom plus court ou retirez le filtre.</p>
        </div>
      ) : (
        <div className="border-ecorce-bord mt-4 overflow-x-auto rounded-[8px] border">
          <table className="w-full min-w-[860px] border-collapse text-[15px]">
            <thead className="bg-ecorce-eleve">
              <tr className="border-ecorce-bord text-cendre-clair border-b text-left">
                <th scope="col" className="px-4 py-3 font-semibold">Client</th>
                <th scope="col" className="px-4 py-3 font-semibold">Commune</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Commandes</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
                <th scope="col" className="px-4 py-3 font-semibold">Dernière commande</th>
                <th scope="col" className="px-4 py-3 font-semibold">État</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((client) => (
                <tr key={client.id} className="border-ecorce-bord hover:bg-ecorce-eleve border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${client.id}`} className="block underline-offset-4 hover:underline">
                      <span className="font-semibold">{client.nom}</span>
                      <span className="text-cendre-clair mt-0.5 block text-[13px]">
                        {client.email}{client.telephone ? ` · ${client.telephone}` : ""}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">{client.commune ?? "—"}</td>
                  <td className="tabulaire px-4 py-3 text-right">{client.commandes}</td>
                  <td className="tabulaire px-4 py-3 text-right font-semibold">{formatEuros(client.totalCents)}</td>
                  <td className="px-4 py-3">
                    {client.derniereCommande ? formatDate.format(new Date(client.derniereCommande)) : "Jamais"}
                  </td>
                  <td className="px-4 py-3">
                    {client.anonymise ? (
                      <span className="bg-cendre/20 text-cendre-clair rounded-[3px] px-2 py-1 text-[13px] font-semibold">Anonymisé</span>
                    ) : client.bloque ? (
                      <span className="bg-erreur/15 text-erreur rounded-[3px] px-2 py-1 text-[13px] font-semibold">Bloqué</span>
                    ) : client.professionnel ? (
                      <span className="bg-info/15 text-info rounded-[3px] px-2 py-1 text-[13px] font-semibold">Professionnel</span>
                    ) : (
                      <span className="bg-succes/15 text-succes rounded-[3px] px-2 py-1 text-[13px] font-semibold">Actif</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
