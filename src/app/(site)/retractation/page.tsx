import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getDonneesLegales } from "@/server/legal";
import { jsonldFilAriane, metadataPage } from "@/lib/seo";
import { DonneesStructurees } from "@/components/site/donnees-structurees";
import { PageContenu, Prose } from "@/components/site/page-contenu";

/**
 * Droit de rétractation.
 *
 * ⚠️ Le point délicat est le bois **coupé à une longueur choisie par le
 * client** : il relève potentiellement de l'exception « bien confectionné selon
 * les spécifications du consommateur » (art. L221-28 3°). La page ne tranche
 * pas à la place du juriste — elle décrit le droit commun, applique le délai de
 * quatorze jours, et signale la question. Écrire l'inverse par prudence
 * commerciale serait une clause abusive.
 */

export async function generateMetadata(): Promise<Metadata> {
  return metadataPage({
    titre: "Droit de rétractation",
    description:
      "Délai de quatorze jours, modalités d'exercice, frais de retour et formulaire type de rétractation.",
    chemin: "/retractation",
    noindex: true,
  });
}

export default async function PageRetractation() {
  const tenant = await requireTenant();
  const legales = await getDonneesLegales(tenant.id);
  if (!legales) notFound();

  const adressePostale = [
    legales.raisonSociale,
    legales.adresse,
    [legales.codePostal, legales.ville].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <DonneesStructurees
        data={jsonldFilAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Droit de rétractation", chemin: "/retractation" },
        ])}
      />

      <PageContenu
        titre="Droit de rétractation"
        chapeau="Vous disposez de quatorze jours pour changer d'avis, sans avoir à vous justifier."
        fil={[
          { nom: "Accueil", chemin: "/" },
          { nom: "Droit de rétractation", chemin: "/retractation" },
        ]}
      >
        <Prose>
          <h2>Délai</h2>
          <p>
            Vous disposez d&apos;un délai de quatorze jours à compter de la réception du bois pour
            exercer votre droit de rétractation, sans avoir à motiver votre décision ni à payer de
            pénalité.
          </p>

          <h2>Comment l&apos;exercer</h2>
          <p>
            Informez-nous de votre décision par une déclaration dénuée d&apos;ambiguïté : email à{" "}
            <a href={`mailto:${legales.email}`} className="underline underline-offset-4">
              {legales.email}
            </a>
            {legales.telephone ? `, appel au ${legales.telephone}` : ""}, ou courrier à
            l&apos;adresse ci-dessous. Vous pouvez utiliser le formulaire type reproduit plus bas,
            sans obligation.
          </p>
          <p>
            Pour que le délai soit respecté, il suffit que votre communication soit envoyée avant
            son expiration.
          </p>

          <h2>Effets</h2>
          <p>
            Nous vous remboursons tous les paiements reçus, y compris les frais de livraison
            standard, au plus tard quatorze jours après avoir récupéré le bois ou reçu la preuve
            de son expédition. Le remboursement s&apos;effectue par le même moyen de paiement que
            celui utilisé pour la commande, sauf accord contraire.
          </p>
          <p>
            <strong>Frais de retour.</strong> Le bois de chauffage est un produit pondéreux : les
            frais directs de renvoi restent à votre charge, ou nous pouvons organiser la reprise à
            un tarif communiqué à l&apos;avance. Votre responsabilité est engagée pour la
            dépréciation du bois résultant de manipulations autres que celles nécessaires pour en
            constater la nature et les caractéristiques — un bois laissé sous la pluie, par
            exemple.
          </p>

          <h2>Cas des coupes sur mesure</h2>
          <p>
            L&apos;article L221-28 3° du code de la consommation exclut du droit de rétractation
            les biens confectionnés selon les spécifications du consommateur. Une coupe à une
            longueur non standard, réalisée spécialement pour vous, peut relever de cette
            exception. Nous vous le signalons explicitement avant la commande lorsque c&apos;est
            le cas. Les longueurs standard proposées au catalogue ne sont pas concernées :
            le droit de rétractation s&apos;y applique pleinement.
          </p>

          <h2>Formulaire type de rétractation</h2>
          <div className="border-aubier-bord bg-aubier-pur mt-4 max-w-[68ch] rounded-[12px] border p-5 text-[16px] leading-relaxed">
            <p className="text-cendre text-[14px]">
              À compléter et à renvoyer uniquement si vous souhaitez vous rétracter.
            </p>
            <p className="mt-4">À l&apos;attention de {adressePostale} — {legales.email} :</p>
            <p className="mt-3">
              Je vous notifie par la présente ma rétractation du contrat portant sur la vente du
              bien ci-dessous :
            </p>
            <p className="mt-3">Commandé le … / reçu le …</p>
            <p className="mt-3">Numéro de commande : …</p>
            <p className="mt-3">Nom du consommateur : …</p>
            <p className="mt-3">Adresse du consommateur : …</p>
            <p className="mt-3">
              Signature (uniquement en cas de notification sur papier) : …
            </p>
            <p className="mt-3">Date : …</p>
          </div>
        </Prose>
        <p className="sr-only">{tenant.name}</p>
      </PageContenu>
    </>
  );
}
