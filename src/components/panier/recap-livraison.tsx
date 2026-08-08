import Link from "next/link";
import { Truck, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { formatEuros, formatVolume } from "@/domain/units";
import type { LivraisonResume } from "@/server/panier";
import { Button } from "@/components/ui/button";

/**
 * Détail des frais de livraison.
 *
 * Principe : on n'affiche JAMAIS un blocage sec. Chaque situation indique ce
 * qu'il manque et propose une action (docs/02 §2.5).
 */

import { formatJoursLivraison } from "@/lib/jours";

function Encadre({
  ton,
  titre,
  children,
}: {
  ton: "info" | "alerte" | "succes";
  titre: string;
  children?: React.ReactNode;
}) {
  const Icone = ton === "alerte" ? AlertTriangle : ton === "succes" ? CheckCircle2 : Info;
  const couleur =
    ton === "alerte"
      ? "border-alerte/30 bg-alerte/8"
      : ton === "succes"
        ? "border-succes/30 bg-succes/8"
        : "border-info/25 bg-info/6";

  return (
    <div className={`rounded-[6px] border p-4 ${couleur}`}>
      <p className="flex items-center gap-2 font-semibold">
        <Icone size={19} strokeWidth={1.9} aria-hidden="true" />
        {titre}
      </p>
      {children && <div className="mt-2 text-[15px] leading-relaxed">{children}</div>}
    </div>
  );
}

function BoutonDevis({ libelle = "Demander un devis" }: { libelle?: string }) {
  return (
    <Button asChild variant="outline" size="lg" className="mt-3">
      <Link href="/devis">{libelle}</Link>
    </Button>
  );
}

export function RecapLivraison({ livraison }: { livraison: LivraisonResume }) {
  const { resolution, devis, eligibilite, joursLivraison, vehicule } = livraison;

  if (!resolution) {
    return (
      <Encadre ton="info" titre="Frais de livraison à calculer">
        Indiquez votre code postal ci-dessus pour connaître les frais de livraison et les jours de
        passage dans votre commune.
      </Encadre>
    );
  }

  if (resolution.status === "unknown") {
    return (
      <Encadre ton="alerte" titre={`Nous ne connaissons pas le code postal ${resolution.postalCode}`}>
        <p>
          Il est peut-être hors de notre secteur habituel, mais nous étudions toutes les demandes —
          notamment pour les volumes importants.
        </p>
        <BoutonDevis />
      </Encadre>
    );
  }

  if (resolution.status === "ambiguous") {
    return (
      <Encadre ton="info" titre="Précisez votre commune">
        Plusieurs communes portent ce code postal. Sélectionnez la vôtre ci-dessus pour que nous
        calculions la bonne distance.
      </Encadre>
    );
  }

  if (resolution.status === "not_served") {
    return (
      <Encadre ton="alerte" titre={`Nous ne livrons pas encore ${resolution.commune.city}`}>
        <p>
          {resolution.commune.distanceKm
            ? `Votre commune est à environ ${resolution.commune.distanceKm} km de notre dépôt, au-delà de notre secteur de livraison régulier. `
            : ""}
          Faites-nous une demande : selon la quantité, un déplacement peut rester intéressant.
        </p>
        <BoutonDevis />
      </Encadre>
    );
  }

  const { commune, zone } = resolution;

  // Minimums de commande non atteints : on chiffre ce qui manque.
  if (eligibilite && eligibilite.status !== "ok") {
    return (
      <Encadre ton="alerte" titre={`Commande minimum pour ${commune.city}`}>
        {eligibilite.status === "below_min_amount" ? (
          <p>
            Il vous manque <strong>{formatEuros(eligibilite.missingCents)}</strong> pour atteindre le
            minimum de {formatEuros(zone.minOrderAmountCents)} applicable à votre commune.
          </p>
        ) : (
          <p>
            Il vous manque <strong>{formatVolume(eligibilite.missingM3)}</strong> pour atteindre le
            minimum de {formatVolume(zone.minOrderVolumeM3)} applicable à votre commune.
          </p>
        )}
        <Button asChild variant="outline" size="lg" className="mt-3">
          <Link href="/#commander">Compléter ma commande</Link>
        </Button>
      </Encadre>
    );
  }

  if (!vehicule) {
    return (
      <Encadre ton="alerte" titre="Volume trop important pour une seule livraison">
        <p>
          Votre commande dépasse la capacité de nos véhicules. Nous pouvons la fractionner en
          plusieurs passages ou vous proposer un tarif adapté.
        </p>
        <BoutonDevis libelle="Demander un devis pour ce volume" />
      </Encadre>
    );
  }

  if (devis?.status === "requires_quote") {
    return (
      <Encadre ton="alerte" titre="Livraison à chiffrer">
        <p>
          Compte tenu de la distance et du volume, les frais dépasseraient{" "}
          {formatEuros(devis.estimatedCents)}. Nous préférons vous faire une proposition précise
          plutôt que d&apos;afficher un montant dissuasif.
        </p>
        <BoutonDevis />
      </Encadre>
    );
  }

  if (devis?.status !== "ok") return null;

  const brut = devis.baseCents + devis.volumeCents + devis.fuelCents;
  const jours = formatJoursLivraison(joursLivraison ?? []);

  return (
    <div className="border-aubier-bord bg-aubier-pur rounded-[8px] border p-5">
      <p className="flex flex-wrap items-center gap-x-2 font-semibold">
        <Truck size={20} strokeWidth={1.75} className="text-sapin" aria-hidden="true" />
        Livraison à {commune.city}
        {commune.distanceKm !== null && (
          <span className="text-cendre font-normal">· {commune.distanceKm} km</span>
        )}
      </p>
      <p className="text-cendre mt-1 text-[15px]">{zone.name}</p>

      <dl className="text-cendre mt-4 space-y-1.5 text-[15px]">
        {/* Une ligne à 0,00 € est du bruit : on ne l'affiche pas. */}
        {devis.baseCents > 0 && (
          <div className="flex justify-between gap-3">
            <dt>Forfait de déplacement</dt>
            <dd className="tabulaire">{formatEuros(devis.baseCents)}</dd>
          </div>
        )}
        {devis.volumeCents > 0 && (
          <div className="flex justify-between gap-3">
            <dt>Part liée au volume</dt>
            <dd className="tabulaire">{formatEuros(devis.volumeCents)}</dd>
          </div>
        )}
        {devis.fuelCents > 0 && (
          <div className="flex justify-between gap-3">
            <dt>
              Carburant
              <span className="text-cendre/80">
                {" "}
                — {vehicule.name}, aller-retour
              </span>
            </dt>
            <dd className="tabulaire">{formatEuros(devis.fuelCents)}</dd>
          </div>
        )}
      </dl>

      <div className="border-aubier-bord mt-4 flex items-baseline justify-between gap-3 border-t pt-3">
        <span className="font-semibold">Frais de livraison</span>
        {devis.isFree ? (
          <span className="text-right">
            <span className="text-succes text-[17px] font-semibold">Offerte</span>
            <span className="text-cendre tabulaire ml-2 text-[15px] line-through">
              {formatEuros(brut)}
            </span>
          </span>
        ) : (
          <span className="tabulaire text-[17px] font-semibold">
            {formatEuros(devis.totalCents)}
          </span>
        )}
      </div>

      {devis.isFree && devis.freeReason === "seuil" && zone.freeAboveCents !== null && (
        <p className="text-succes mt-2 text-[15px]">
          Livraison offerte à partir de {formatEuros(zone.freeAboveCents)} de bois.
        </p>
      )}

      {jours && (
        <p className="text-cendre mt-3 text-[15px]">
          Nous livrons {commune.city} {jours}.
        </p>
      )}
    </div>
  );
}
