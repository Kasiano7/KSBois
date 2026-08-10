import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getDonneesLegales } from "@/server/legal";
import { jsonldFilAriane, metadataPage } from "@/lib/seo";
import { DonneesStructurees } from "@/components/site/donnees-structurees";
import { PageContenu, Prose } from "@/components/site/page-contenu";

/**
 * Politique de confidentialité — docs/06 §3.
 *
 * ⚠️ Elle décrit les traitements RÉELS du site, pas un modèle générique :
 * mesure d'audience anonyme sans cookie publicitaire, conservation à 25 mois
 * des sessions, effacement RGPD atomique déjà implémenté côté administration.
 * Annoncer des traitements qu'on ne fait pas — ou taire ceux qu'on fait — est
 * la faute la plus courante sur ce type de page.
 */

export async function generateMetadata(): Promise<Metadata> {
  return metadataPage({
    titre: "Confidentialité",
    description:
      "Quelles données nous collectons, pourquoi, combien de temps nous les gardons et comment exercer vos droits.",
    chemin: "/confidentialite",
    noindex: true,
  });
}

export default async function PageConfidentialite() {
  const tenant = await requireTenant();
  const legales = await getDonneesLegales(tenant.id);
  if (!legales) notFound();

  return (
    <>
      <DonneesStructurees
        data={jsonldFilAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Confidentialité", chemin: "/confidentialite" },
        ])}
      />

      <PageContenu
        titre="Confidentialité"
        chapeau="Ce que nous collectons, pourquoi, et comment vous en reprendre le contrôle."
        fil={[
          { nom: "Accueil", chemin: "/" },
          { nom: "Confidentialité", chemin: "/confidentialite" },
        ]}
      >
        <Prose>
          <h2>Responsable du traitement</h2>
          <p>
            {legales.raisonSociale}
            {legales.adresse ? `, ${legales.adresse}` : ""}
            {legales.ville ? `, ${legales.codePostal} ${legales.ville}` : ""}. Contact :{" "}
            <a href={`mailto:${legales.email}`} className="underline underline-offset-4">
              {legales.email}
            </a>
            .
          </p>

          <h2>Données collectées et finalités</h2>
          <ul>
            <li>
              <strong>Commande et livraison</strong> — nom, adresse email, téléphone, adresse de
              livraison et contraintes d&apos;accès. Base légale : exécution du contrat. Sans ces
              données, la commande ne peut pas être livrée.
            </li>
            <li>
              <strong>Facturation et comptabilité</strong> — identité, adresse, montants et
              moyens de paiement. Base légale : obligation légale de conservation des pièces
              comptables.
            </li>
            <li>
              <strong>Compte client</strong> — adresse email vérifiée et historique de commandes.
              Base légale : exécution du contrat et intérêt légitime à vous permettre de
              recommander en deux clics.
            </li>
            <li>
              <strong>Demande de devis</strong> — coordonnées et description du besoin. Base
              légale : mesures précontractuelles prises à votre demande.
            </li>
            <li>
              <strong>Mesure d&apos;audience</strong> — parcours anonyme sur le site, par sessions
              de trente minutes. Aucune donnée nominative, aucun profilage publicitaire, aucun
              partage avec un tiers. Base légale : intérêt légitime à comprendre où les visiteurs
              abandonnent.
            </li>
          </ul>

          <h2>Paiement</h2>
          <p>
            Les paiements par carte sont traités par Stripe. <strong>Nous ne voyons jamais votre
            numéro de carte</strong> : il est saisi directement dans un composant hébergé par
            Stripe et ne transite pas par nos serveurs. Nous conservons uniquement une référence
            de transaction et le montant.
          </p>

          <h2>Durées de conservation</h2>
          <ul>
            <li>Commandes et factures : dix ans, obligation comptable et fiscale.</li>
            <li>Compte client inactif : trois ans après la dernière commande.</li>
            <li>Demandes de devis non converties : trois ans.</li>
            <li>Sessions de mesure d&apos;audience : vingt-cinq mois, puis purge automatique.</li>
            <li>Journal des notifications envoyées : trois ans.</li>
          </ul>

          <h2>Cookies</h2>
          <p>
            Le site utilise uniquement des cookies nécessaires à son fonctionnement : maintien du
            panier, session de connexion, et identifiant de session de mesure d&apos;audience.
            Aucun cookie publicitaire, aucun traceur tiers, aucun réseau social embarqué. C&apos;est
            pourquoi vous ne voyez pas de bandeau de consentement : il n&apos;y a rien à
            consentir.
          </p>

          <h2>Destinataires</h2>
          <p>
            Vos données ne sont ni vendues ni louées. Elles sont accessibles au personnel de
            l&apos;entreprise selon son rôle, et transmises à nos sous-traitants techniques dans
            la stricte mesure nécessaire : hébergement (Vercel, Supabase), paiement (Stripe),
            envoi d&apos;emails (Resend), hébergement d&apos;images (ImageKit).
          </p>

          <h2>Vos droits</h2>
          <p>
            Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
            limitation, d&apos;opposition et de portabilité. Écrivez à{" "}
            <a href={`mailto:${legales.email}`} className="underline underline-offset-4">
              {legales.email}
            </a>{" "}
            : nous répondons sous un mois.
          </p>
          <p>
            L&apos;effacement est réellement mis en œuvre : vos coordonnées, adresses et accès au
            compte sont supprimés. Les montants et les factures sont conservés de façon
            anonymisée, parce que la loi comptable l&apos;impose — nous ne pouvons pas les
            détruire, mais ils ne vous désignent plus.
          </p>
          <p>
            Vous pouvez introduire une réclamation auprès de la CNIL, 3 place de Fontenoy, 75007
            Paris, ou sur{" "}
            <a
              href="https://www.cnil.fr"
              className="underline underline-offset-4"
              rel="noopener nofollow"
              target="_blank"
            >
              cnil.fr
            </a>
            .
          </p>
        </Prose>
        <p className="sr-only">{tenant.name}</p>
      </PageContenu>
    </>
  );
}
