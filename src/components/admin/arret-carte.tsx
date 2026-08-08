"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Phone,
  Navigation,
  Banknote,
  CreditCard,
  FileText,
  Landmark,
  Smartphone,
  AlertTriangle,
  Check,
  Loader2,
  DoorOpen,
} from "lucide-react";
import { changerStatutCommande } from "@/server/actions/admin-commandes";
import { formatEuros, formatVolume } from "@/domain/units";
import { ORDER_STATUS_LABELS } from "@/domain/orders/state-machine";
import type { ArretTournee } from "@/server/tournee";
import { Button } from "@/components/ui/button";

/**
 * Un arrêt de la tournée.
 *
 * Hiérarchie voulue : nom, adresse, produit, puis en ÉVIDENCE le mode de
 * paiement et les contraintes d'accès — les deux causes de livraison ratée
 * (docs/05 §3.2). Jamais d'icône seule : tout est écrit.
 */

const PAIEMENTS: Record<string, { libelle: string; Icone: typeof Banknote; alerte: boolean }> = {
  cash: { libelle: "ESPÈCES À ENCAISSER", Icone: Banknote, alerte: true },
  check: { libelle: "Chèque à récupérer", Icone: FileText, alerte: true },
  sumup: { libelle: "Carte au terminal", Icone: Smartphone, alerte: true },
  transfer: { libelle: "Virement", Icone: Landmark, alerte: false },
  card: { libelle: "Payé en ligne", Icone: CreditCard, alerte: false },
};

const ACCES: Record<string, string> = {
  spl: "Semi-remorque possible",
  camion: "Camion",
  fourgon: "FOURGON SEULEMENT — pas de camion",
  remorque_seule: "PETITE REMORQUE SEULEMENT",
};

const DECHARGEMENT: Record<string, string> = {
  vrac_sol: "en vrac au sol",
  benne: "déversé à la benne",
  range: "rangé",
};

export function ArretCarte({ arret, numero }: { arret: ArretTournee; numero: number }) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [itineraireOuvert, setItineraireOuvert] = useState(false);

  const paiement = arret.modePaiement ? PAIEMENTS[arret.modePaiement] : null;
  const dejaLivree = arret.status === "livree";
  const adresseComplete = `${arret.adresse}, ${arret.codePostal} ${arret.ville}, France`;
  const encodee = encodeURIComponent(adresseComplete);

  const marquerLivree = () => {
    setErreur(null);
    demarrer(async () => {
      const resultat = await changerStatutCommande({
        orderId: arret.orderId,
        nouveauStatut: "livree",
      });
      if (!resultat.ok) setErreur(resultat.message ?? "Erreur.");
    });
  };

  return (
    <li
      className={`border-ecorce-bord rounded-[8px] border p-5 ${
        dejaLivree ? "opacity-60" : "bg-ecorce-eleve"
      }`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span className="bg-ecorce text-seve flex size-10 shrink-0 items-center justify-center rounded-full text-[19px] font-bold">
          {numero}
        </span>

        <div className="min-w-[14rem] flex-1">
          <p className="text-[22px] font-semibold">{arret.nom}</p>
          <Link
            href={`/admin/commandes/${arret.orderId}`}
            className="text-cendre-clair font-mono text-[13px] underline-offset-4 hover:underline"
          >
            {arret.reference}
          </Link>
          {arret.creneau && (
            <p className="text-cendre-clair mt-1 text-[15px]">{arret.creneau}</p>
          )}

          <p className="mt-3 text-[17px]">{arret.adresse}</p>
          <p className="text-cendre-clair text-[17px]">
            {arret.codePostal} {arret.ville}
          </p>

          <ul className="mt-3 space-y-0.5 text-[17px]">
            {arret.produits.map((p, i) => (
              <li key={i}>
                <strong>{formatVolume(p.volumeM3)}</strong> · {p.nom} · {p.format}
              </li>
            ))}
          </ul>
          {arret.typeDechargement && (
            <p className="text-cendre-clair mt-1 text-[15px]">
              Déchargement {DECHARGEMENT[arret.typeDechargement] ?? arret.typeDechargement}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 print:hidden">
          {arret.telephone && (
            <Button asChild variant="outline" size="default">
              <a href={`tel:${arret.telephone}`}>
                <Phone strokeWidth={1.75} />
                {arret.telephone}
              </a>
            </Button>
          )}

          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="default"
              aria-expanded={itineraireOuvert}
              onClick={() => setItineraireOuvert((v) => !v)}
            >
              <Navigation strokeWidth={1.75} />
              Itinéraire
            </Button>
            {itineraireOuvert && (
              <div className="border-ecorce-bord bg-ecorce absolute right-0 z-10 mt-1 w-48 rounded-[6px] border p-1 shadow-lg">
                {[
                  { nom: "Google Maps", url: `https://www.google.com/maps/dir/?api=1&destination=${encodee}&travelmode=driving` },
                  { nom: "Waze", url: `https://waze.com/ul?q=${encodee}&navigate=yes` },
                  { nom: "Apple Plans", url: `https://maps.apple.com/?daddr=${encodee}&dirflg=d` },
                ].map((app) => (
                  <a
                    key={app.nom}
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-ecorce-eleve flex min-h-11 items-center rounded-[4px] px-3 text-[15px]"
                  >
                    {app.nom}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Signalements : les deux causes de livraison ratée ---- */}
      <div className="mt-4 space-y-2">
        {paiement && arret.resteAPayerCents > 0 && (
          <p
            className={`flex flex-wrap items-center gap-2 rounded-[4px] px-3 py-2 text-[17px] font-bold ${
              paiement.alerte ? "bg-braise/20 text-braise" : "text-cendre-clair"
            }`}
          >
            <paiement.Icone size={20} strokeWidth={2} aria-hidden="true" />
            {paiement.libelle} — {formatEuros(arret.resteAPayerCents)}
          </p>
        )}
        {arret.resteAPayerCents === 0 && (
          <p className="text-succes flex items-center gap-2 text-[17px] font-semibold">
            <Check size={20} strokeWidth={2} aria-hidden="true" />
            Déjà payé — rien à encaisser
          </p>
        )}

        {arret.accesCamion && arret.accesCamion !== "camion" && arret.accesCamion !== "spl" && (
          <p className="bg-alerte/15 text-alerte flex items-center gap-2 rounded-[4px] px-3 py-2 text-[17px] font-semibold">
            <AlertTriangle size={20} strokeWidth={2} aria-hidden="true" />
            {ACCES[arret.accesCamion] ?? arret.accesCamion}
          </p>
        )}

        {arret.contraintesAcces && (
          <p className="bg-alerte/15 flex items-start gap-2 rounded-[4px] px-3 py-2 text-[17px]">
            <AlertTriangle size={20} strokeWidth={2} className="text-alerte mt-0.5 shrink-0" aria-hidden="true" />
            {arret.contraintesAcces}
          </p>
        )}

        {arret.livraisonSansPresence && (
          <p className="text-cendre-clair flex items-center gap-2 text-[17px]">
            <DoorOpen size={20} strokeWidth={1.9} aria-hidden="true" />
            Livraison autorisée en l&apos;absence du client
          </p>
        )}

        {arret.notesClient && (
          <p className="text-cendre-clair text-[17px]">Note du client : {arret.notesClient}</p>
        )}
        {arret.notesInternes && (
          <p className="text-cendre-clair text-[17px]">Note interne : {arret.notesInternes}</p>
        )}
      </div>

      {erreur && (
        <p role="alert" className="text-erreur mt-3 text-[15px]">
          {erreur}
        </p>
      )}

      <div className="mt-4 print:hidden">
        {dejaLivree ? (
          <p className="text-succes flex items-center gap-2 text-[17px] font-semibold">
            <Check size={20} strokeWidth={2} aria-hidden="true" />
            {ORDER_STATUS_LABELS.livree}
          </p>
        ) : (
          <Button type="button" variant="default" size="lg" disabled={enCours} onClick={marquerLivree}>
            {enCours ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Enregistrement…
              </>
            ) : (
              <>
                <Check strokeWidth={1.9} />
                Marquer comme livrée
              </>
            )}
          </Button>
        )}
      </div>
    </li>
  );
}
