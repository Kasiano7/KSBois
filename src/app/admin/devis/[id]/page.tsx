import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, Mail } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import {
  getDemandeDevis,
  calculerProposition,
  listerVariantesVendables,
} from "@/server/admin-devis";
import { aujourdHui } from "@/server/creneaux";
import { formatEuros, formatVolume } from "@/domain/units";
import { formatDateFr } from "@/lib/jours";
import {
  QUOTE_ORIGIN_LABELS,
  QUOTE_STATUS_LABELS,
  joursDAttente,
  isQuoteExpired,
} from "@/domain/quotes";
import { PropositionDevis } from "@/components/admin/proposition-devis";
import { SuiviDevis } from "@/components/admin/suivi-devis";

export const metadata: Metadata = { title: "Devis", robots: { index: false, follow: false } };

const HUMIDITE: Record<string, string> = {
  sec: "bois sec",
  mi_sec: "mi-sec",
  vert: "fraîchement coupé",
  peu_importe: "peu importe",
};

const horodatage = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function PageDevisDetail({ params }: PageProps<"/admin/devis/[id]">) {
  const session = await requireRole(["owner", "staff"], "/admin/devis");
  const tenant = await requireTenant();
  const { id } = await params;

  const demande = await getDemandeDevis(session.companyId, id);
  if (!demande) notFound();

  const [proposition, variantes] = await Promise.all([
    calculerProposition(tenant, demande),
    listerVariantesVendables(session.companyId),
  ]);

  const attente = joursDAttente(demande.createdAt, aujourdHui());
  const perime = isQuoteExpired(demande.validJusquA, aujourdHui());
  const nomClient = [demande.prenom, demande.nom].filter(Boolean).join(" ") || demande.email;

  return (
    <main className="p-5 sm:p-8">
      <Link
        href="/admin/devis"
        className="text-cendre-clair inline-flex min-h-11 items-center gap-2 text-[15px] underline-offset-4 hover:underline"
      >
        <ArrowLeft size={18} strokeWidth={1.9} aria-hidden="true" />
        Toutes les demandes
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[28px] sm:text-[36px]">
          <span className="font-mono text-[22px] sm:text-[26px]">{demande.reference}</span>{" "}
          {nomClient}
        </h1>
        <p className="text-cendre-clair text-[15px]">
          {QUOTE_STATUS_LABELS[demande.statut]} · reçue le{" "}
          {horodatage.format(new Date(demande.createdAt))}
        </p>
      </div>

      {/* Signalements qui doivent sauter aux yeux avant tout le reste. */}
      <div className="mt-4 space-y-2">
        {(demande.statut === "nouveau" || demande.statut === "en_cours") && attente >= 2 && (
          <p className="border-alerte/30 bg-alerte/8 rounded-[6px] border p-3 text-[15px]">
            Cette demande attend une réponse depuis {attente} jours.
          </p>
        )}
        {perime && (
          <p className="border-alerte/30 bg-alerte/8 rounded-[6px] border p-3 text-[15px]">
            La validité annoncée est dépassée depuis le{" "}
            {formatDateFr(demande.validJusquA!, { jourSemaine: false })}. Repoussez la date avant de
            renvoyer ce devis.
          </p>
        )}
        {demande.commandeId && (
          <p className="border-succes/30 bg-succes/8 rounded-[6px] border p-3 text-[15px]">
            Devis accepté et converti en commande{" "}
            <Link
              href={`/admin/commandes/${demande.commandeId}`}
              className="font-semibold underline underline-offset-4"
            >
              {demande.commandeReference}
            </Link>
            .
          </p>
        )}
      </div>

      {/* Ordre voulu sur téléphone : la demande, puis le chiffrage, puis le
          suivi. Sur grand écran, le chiffrage occupe la colonne de droite sur
          toute la hauteur. */}
      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* ------------------------------------------------------------------ */}
        {/* La demande, telle que le client l'a écrite — jamais modifiée ici.   */}
        {/* ------------------------------------------------------------------ */}
        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
          <section className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
            <h2 className="text-[22px]">Sa demande</h2>
            <p className="text-cendre-clair mt-1.5 text-[15px]">
              {QUOTE_ORIGIN_LABELS[demande.origine]}
            </p>

            <dl className="mt-4 space-y-3 text-[17px]">
              <div>
                <dt className="text-cendre-clair text-[13px]">Contact</dt>
                <dd className="mt-0.5">
                  {demande.societe && <span className="font-semibold">{demande.societe} · </span>}
                  {nomClient}
                </dd>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {demande.telephone && (
                    <a
                      href={`tel:${demande.telephone.replace(/\s/g, "")}`}
                      className="border-ecorce-bord hover:bg-ecorce flex min-h-11 items-center gap-2 rounded-[4px] border px-3.5 text-[15px] font-semibold"
                    >
                      <Phone size={17} strokeWidth={1.9} aria-hidden="true" />
                      {demande.telephone}
                    </a>
                  )}
                  <a
                    href={`mailto:${demande.email}?subject=${encodeURIComponent(`Votre demande de devis ${demande.reference}`)}`}
                    className="border-ecorce-bord hover:bg-ecorce flex min-h-11 items-center gap-2 rounded-[4px] border px-3.5 text-[15px] font-semibold"
                  >
                    <Mail size={17} strokeWidth={1.9} aria-hidden="true" />
                    {demande.email}
                  </a>
                </dd>
              </div>

              <div>
                <dt className="text-cendre-clair text-[13px]">Adresse</dt>
                <dd className="mt-0.5">
                  {demande.adresse && (
                    <>
                      {demande.adresse}
                      <br />
                    </>
                  )}
                  {[demande.codePostal, demande.ville].filter(Boolean).join(" ") || "non précisée"}
                </dd>
              </div>

              <div>
                <dt className="text-cendre-clair text-[13px]">Ce qu&apos;il veut</dt>
                <dd className="mt-0.5">
                  {[
                    demande.quantiteM3 !== null ? formatVolume(demande.quantiteM3) : null,
                    demande.essence,
                    demande.longueurCm !== null ? `bûches de ${demande.longueurCm} cm` : null,
                    demande.preferenceHumidite ? HUMIDITE[demande.preferenceHumidite] : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "à préciser au téléphone"}
                </dd>
              </div>

              {demande.message && (
                <div>
                  <dt className="text-cendre-clair text-[13px]">Son message</dt>
                  <dd className="border-ecorce-bord mt-1 rounded-[6px] border p-3 text-[15px] leading-relaxed whitespace-pre-line">
                    {demande.message}
                  </dd>
                </div>
              )}

              {demande.respondedAt && (
                <div>
                  <dt className="text-cendre-clair text-[13px]">Devis envoyé</dt>
                  <dd className="mt-0.5 text-[15px]">
                    {horodatage.format(new Date(demande.respondedAt))}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Le panier que le visiteur avait rempli avant de basculer en devis :
              c'est l'intention d'achat la plus fiable dont on dispose. */}
          {demande.panierJoint && demande.panierJoint.lignes.length > 0 && (
            <section className="border-ecorce-bord bg-ecorce-eleve rounded-[8px] border p-5">
              <h2 className="text-[19px] font-semibold">Son panier au moment de la demande</h2>
              <ul className="mt-3 space-y-2 text-[15px]">
                {demande.panierJoint.lignes.map((l, i) => (
                  <li key={`${l.produit}-${i}`} className="flex justify-between gap-3">
                    <span>
                      {l.produit} — {l.format}
                      <span className="text-cendre-clair"> × {l.quantite}</span>
                    </span>
                    <span className="tabulaire">{formatEuros(l.totalCents)}</span>
                  </li>
                ))}
              </ul>
              {demande.panierJoint.sousTotalCents !== null && (
                <p className="border-ecorce-bord mt-3 flex justify-between border-t pt-2 text-[15px] font-semibold">
                  <span>Sous-total constaté</span>
                  <span className="tabulaire">
                    {formatEuros(demande.panierJoint.sousTotalCents)}
                  </span>
                </p>
              )}
            </section>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* La proposition, chiffrée par le serveur.                            */}
        {/* ------------------------------------------------------------------ */}
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <PropositionDevis demande={demande} proposition={proposition} variantes={variantes} />
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <SuiviDevis
            devisId={demande.id}
            statut={demande.statut}
            notes={demande.notesInternes}
            converti={demande.commandeId !== null}
          />
        </div>
      </div>
    </main>
  );
}
