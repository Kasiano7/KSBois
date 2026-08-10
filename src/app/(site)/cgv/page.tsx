import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getDonneesLegales, lignesIdentification } from "@/server/legal";
import { formatEuros } from "@/domain/units";
import { jsonldFilAriane, metadataPage } from "@/lib/seo";
import { DonneesStructurees } from "@/components/site/donnees-structurees";
import { PageContenu, Prose } from "@/components/site/page-contenu";

/**
 * Conditions générales de vente.
 *
 * ⚠️ Ces conditions décrivent **ce que le site fait réellement** : les moyens
 * de paiement listés sont ceux activés en réglages, le plafond espèces est
 * celui appliqué par le serveur, l'unité de vente est celle des documents. Des
 * CGV copiées d'un modèle générique promettraient des choses que le code ne
 * fait pas — c'est exactement ce qui se retourne contre le vendeur en litige.
 *
 * ⚠️ **À faire relire par un juriste avant l'ouverture des ventes** (docs/07).
 */

export async function generateMetadata(): Promise<Metadata> {
  return metadataPage({
    titre: "Conditions générales de vente",
    description:
      "Commande, prix, livraison, paiement, rétractation et garanties applicables aux ventes de bois de chauffage.",
    chemin: "/cgv",
  });
}

export default async function PageCgv() {
  const tenant = await requireTenant();
  const legales = await getDonneesLegales(tenant.id);
  if (!legales) notFound();

  return (
    <>
      <DonneesStructurees
        data={jsonldFilAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Conditions générales de vente", chemin: "/cgv" },
        ])}
      />

      <PageContenu
        titre="Conditions générales de vente"
        chapeau={`Version ${legales.versionCgv}. Elles s'appliquent à toute commande passée sur ce site.`}
        fil={[
          { nom: "Accueil", chemin: "/" },
          { nom: "Conditions générales de vente", chemin: "/cgv" },
        ]}
      >
        <Prose>
          <h2>1. Vendeur</h2>
          <ul>
            {lignesIdentification(legales).map((ligne) => (
              <li key={ligne}>{ligne}</li>
            ))}
          </ul>

          <h2>2. Objet</h2>
          <p>
            Les présentes conditions régissent la vente de bois de chauffage et des prestations
            associées (livraison, rangement) par {legales.raisonSociale} à ses clients,
            particuliers ou professionnels. Toute commande implique leur acceptation sans
            réserve, matérialisée par une case à cocher avant paiement.
          </p>

          <h2>3. Unité de vente</h2>
          <p>
            Le bois est vendu au <strong>mètre cube apparent</strong>, seule unité légale de
            mesure depuis 1977. Le stère n&apos;est plus une unité légale : lorsqu&apos;il est
            mentionné sur le site, c&apos;est à titre indicatif et à titre de conversion.
          </p>
          <p>
            Un mètre cube apparent correspond au volume occupé par le bois empilé, vides compris.
            Ce volume dépend de la longueur de coupe : à matière égale, du bois court occupe moins
            de volume apparent que du bois d&apos;un mètre. Les équivalences affichées sur le site
            tiennent compte de ce coefficient.
          </p>

          <h2>4. Commande</h2>
          <p>
            La commande est validée après acceptation des présentes conditions et confirmation du
            mode de paiement. Un email de confirmation récapitule les produits, les quantités, le
            prix et le créneau de livraison souhaité.
          </p>
          <p>
            La date de livraison exprimée à la commande est un <strong>souhait</strong>.
            L&apos;entreprise confirme ensuite une date ferme par email. Le délai habituel entre
            la commande et la livraison est d&apos;environ {legales.delaiCommandeJours} jour
            {legales.delaiCommandeJours > 1 ? "s" : ""}, selon les créneaux disponibles.
          </p>

          <h2>5. Prix</h2>
          <p>
            Les prix sont indiqués en euros toutes taxes comprises
            {legales.assujettiTva ? "" : " (TVA non applicable, article 293 B du CGI)"}, hors
            frais de livraison. Les frais de livraison sont calculés en fonction de la commune de
            livraison et du volume commandé, et affichés avant tout engagement.
          </p>
          <p>
            Les prix peuvent évoluer à tout moment ; le prix applicable est celui affiché au
            moment de la validation de la commande. Un devis édité depuis le panier est une
            estimation sans engagement ; un devis nominatif adressé par l&apos;entreprise engage
            celle-ci pendant sa durée de validité.
          </p>

          <h2>6. Paiement</h2>
          <p>Les moyens de paiement acceptés sont : {legales.moyensPaiement.join(", ")}.</p>
          <p>
            Conformément à l&apos;article L112-6 du code monétaire et financier, le paiement en
            espèces est limité à {formatEuros(legales.plafondEspecesCents)} par transaction pour
            un particulier résidant fiscalement en France. Au-delà, un autre moyen de paiement est
            requis.
          </p>
          <p>
            Un acompte de {legales.acomptePourcent} % peut être demandé pour les commandes de
            volume important ou éloignées du dépôt. Il est indiqué avant paiement.
          </p>

          <h2>7. Livraison</h2>
          <p>
            La livraison s&apos;effectue dans les communes desservies, listées sur la{" "}
            <Link href="/livraison" className="underline underline-offset-4">
              page Livraison
            </Link>
            . Le bois est déposé en vrac à l&apos;endroit accessible le plus proche indiqué par le
            client.
          </p>
          <p>
            Le client s&apos;engage à garantir un accès praticable au véhicule de livraison et à
            signaler toute contrainte d&apos;accès à la commande. Si la livraison ne peut être
            effectuée du fait d&apos;un accès non praticable ou non signalé, les frais de
            déplacement restent dus.
          </p>
          <p>
            La présence du client n&apos;est pas obligatoire si l&apos;accès est libre et
            l&apos;emplacement de déchargement clairement indiqué. Le livreur appelle avant de
            passer.
          </p>

          <h2>8. Réception et réclamation</h2>
          <p>
            Le client vérifie la quantité et l&apos;état du bois à la livraison. Toute réserve
            doit être portée sur le bon de livraison ou signalée dans les 48 heures à
            l&apos;adresse{" "}
            <a href={`mailto:${legales.email}`} className="underline underline-offset-4">
              {legales.email}
            </a>
            .
          </p>

          <h2>9. Droit de rétractation</h2>
          <p>
            Le consommateur dispose d&apos;un délai de quatorze jours pour exercer son droit de
            rétractation, dans les conditions détaillées sur la page{" "}
            <Link href="/retractation" className="underline underline-offset-4">
              Droit de rétractation
            </Link>
            .
          </p>

          <h2>10. Garanties</h2>
          <p>
            Le vendeur est tenu de la garantie légale de conformité (articles L217-3 et suivants
            du code de la consommation) et de la garantie contre les vices cachés (articles 1641
            et suivants du code civil).
          </p>
          <p>
            Le taux d&apos;humidité annoncé correspond à une mesure effectuée au testeur sur un
            échantillon du lot, à la date indiquée. Le bois étant un matériau vivant, ce taux peut
            évoluer après livraison en fonction des conditions de stockage du client.
          </p>

          <h2>11. Données personnelles</h2>
          <p>
            Le traitement des données est décrit sur la page{" "}
            <Link href="/confidentialite" className="underline underline-offset-4">
              Confidentialité
            </Link>
            .
          </p>

          <h2>12. Droit applicable et litiges</h2>
          <p>
            Les présentes conditions sont soumises au droit français. En cas de litige, une
            solution amiable sera recherchée en priorité ; à défaut, le consommateur peut recourir
            gratuitement à un médiateur de la consommation (voir les{" "}
            <Link href="/mentions-legales" className="underline underline-offset-4">
              mentions légales
            </Link>
            ).
          </p>
        </Prose>
      </PageContenu>
    </>
  );
}
