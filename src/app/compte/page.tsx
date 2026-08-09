import type { Metadata } from "next";
import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { listerCommandesClient, resumerClient, phraseLivraison } from "@/server/compte";
import { formatEuros, formatVolume } from "@/domain/units";
import { formatDateFr } from "@/lib/jours";
import { ORDER_STATUS_LABELS } from "@/domain/orders/state-machine";
import { BoutonRecommander } from "@/components/compte/bouton-recommander";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Mes commandes",
  robots: { index: false, follow: false },
};

/**
 * Accueil de l'espace client — docs/03-DESIGN-SYSTEM.md §6.4
 *
 * Règle de composition : **une seule chose au-dessus de la ligne de flottaison**,
 * la dernière commande et son bouton « Recommander la même chose ». Tout le
 * reste vient après. Cette clientèle rachète le même bois chaque année ; lui
 * faire retraverser le catalogue serait lui faire perdre son temps.
 */
export default async function PageCompte() {
  const session = await requireClient("/compte");
  const tenant = await requireTenant();

  const commandes = await listerCommandesClient(tenant.id, session.customerId);
  const resume = resumerClient(commandes);
  const derniere = commandes.find((c) => c.statut !== "annulee") ?? null;

  return (
    <main className="mx-auto w-full max-w-[1240px] px-5 py-10 sm:py-14">
      <h1 className="text-[32px] sm:text-[42px]">
        Bonjour{session.prenom ? ` ${session.prenom}` : ""}
      </h1>

      {derniere ? (
        <>
          {/* ---- LA chose à faire : recommander ---- */}
          <section className="border-aubier-bord bg-aubier-pur mt-6 rounded-[8px] border p-5 sm:p-7">
            <p className="micro-label text-cendre">Votre dernière commande</p>

            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <div>
                {derniere.lignes.map((l) => (
                  <p key={`${l.produit}-${l.format}`} className="text-[21px] sm:text-[24px]">
                    <strong>{formatVolume(l.volumeM3)}</strong> · {l.produit} · {l.format}
                  </p>
                ))}
              </div>
              <p className="text-braise-texte font-display text-[28px] font-bold sm:text-[32px]">
                {formatEuros(derniere.totalCents)}
              </p>
            </div>

            <p className="text-cendre mt-3 text-[17px]">
              Commandée le{" "}
              {formatDateFr(derniere.creeLe.slice(0, 10), { jourSemaine: false, annee: true })} ·{" "}
              {phraseLivraison(derniere)}
            </p>

            <div className="mt-6">
              <BoutonRecommander reference={derniere.reference} />
              <p className="text-cendre mt-3 text-[15px]">
                Nous remettons le même bois dans votre panier, à votre adresse habituelle. Il ne
                vous restera qu&apos;à choisir la date de livraison.
              </p>
            </div>

            <Link
              href={`/compte/commandes/${derniere.reference}`}
              className="text-encre mt-5 inline-flex min-h-11 items-center gap-1.5 text-[17px] font-semibold underline underline-offset-4"
            >
              Voir le détail de cette commande
              <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
            </Link>
          </section>

          {/* ---- Historique ---- */}
          {commandes.length > 1 && (
            <section className="mt-12">
              <h2 className="text-[26px] sm:text-[32px]">Toutes mes commandes</h2>
              <ul className="mt-5 space-y-3">
                {commandes.slice(1).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/compte/commandes/${c.reference}`}
                      className="border-aubier-bord bg-aubier-pur hover:border-cendre flex flex-wrap items-center justify-between gap-3 rounded-[8px] border p-4 transition-colors"
                    >
                      <span>
                        <span className="text-[19px] font-semibold">
                          {formatVolume(c.volumeM3)}
                        </span>
                        <span className="text-cendre block text-[15px]">
                          {formatDateFr(c.creeLe.slice(0, 10), { jourSemaine: false, annee: true })}{" "}
                          · {ORDER_STATUS_LABELS[c.statut]}
                          {c.ville ? ` · ${c.ville}` : ""}
                        </span>
                      </span>
                      <span className="tabulaire text-[19px] font-semibold">
                        {formatEuros(c.totalCents)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="text-cendre mt-5 text-[15px]">
                {resume.nbCommandes} commande{resume.nbCommandes > 1 ? "s" : ""} ·{" "}
                {formatVolume(resume.volumeTotalM3)} au total
                {resume.clientDepuis ? ` · client depuis ${resume.clientDepuis}` : ""}
              </p>
            </section>
          )}
        </>
      ) : (
        /* ---- État vide : on ne laisse jamais un écran nu ---- */
        <section className="border-aubier-bord mt-8 rounded-[8px] border border-dashed p-6 sm:p-8">
          <p className="flex items-center gap-2.5 text-[21px] font-semibold">
            <Package size={24} strokeWidth={1.9} className="text-cendre" aria-hidden="true" />
            Aucune commande pour l&apos;instant
          </p>
          <p className="text-cendre mt-3 max-w-[62ch] text-[17px] leading-relaxed">
            Dès votre première commande, vous la retrouverez ici — et vous pourrez la refaire à
            l&apos;identique en deux clics l&apos;hiver suivant.
          </p>
          <p className="text-cendre mt-3 max-w-[62ch] text-[15px] leading-relaxed">
            Vous avez déjà commandé chez nous ? Vérifiez que vous utilisez bien la même adresse
            email que lors de votre commande : c&apos;est elle qui rattache votre historique.
          </p>
          <Button asChild variant="cta" size="cta" className="mt-6">
            <Link href="/#commander">Commander mon bois</Link>
          </Button>
        </section>
      )}

      <p className="text-cendre mt-12 text-[15px]">
        Une question sur une commande ? Appelez-nous au{" "}
        <a
          href={`tel:${(tenant.phone ?? "").replace(/\s/g, "")}`}
          className="font-semibold underline underline-offset-4"
        >
          {tenant.phoneDisplay ?? tenant.phone}
        </a>
        .
      </p>
    </main>
  );
}
