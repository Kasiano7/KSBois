import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { jsonldFilAriane, metadataPage } from "@/lib/seo";
import { DonneesStructurees } from "@/components/site/donnees-structurees";
import { PageContenu, Prose } from "@/components/site/page-contenu";

/**
 * Contact — docs/06 §1.2.
 *
 * Pas de formulaire de contact générique : il en existe déjà un, la demande de
 * devis, qui pose les bonnes questions et arrive dans l'administration avec le
 * panier du visiteur. Un second formulaire créerait une file de messages que
 * personne ne relève.
 *
 * Le téléphone est mis en avant : c'est le canal réel de cette clientèle.
 */

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await requireTenant();
  return metadataPage({
    titre: "Nous contacter",
    description: `Téléphone, email et adresse de ${tenant.name}. Pour un devis, utilisez le formulaire en ligne : la réponse est plus rapide et chiffrée.`,
    chemin: "/contact",
  });
}

export default async function PageContact() {
  const tenant = await requireTenant();

  const { data: entreprise } = await createSupabaseAdminClient()
    .from("companies")
    .select("address_line1, postal_code, city, legal_name")
    .eq("id", tenant.id)
    .maybeSingle();

  return (
    <>
      <DonneesStructurees
        data={jsonldFilAriane([
          { nom: "Accueil", chemin: "/" },
          { nom: "Contact", chemin: "/contact" },
        ])}
      />

      <PageContenu
        eyebrow="Contact"
        titre="Nous joindre"
        chapeau="Le plus simple reste le téléphone : vous tombez sur la personne qui gère les commandes."
        fil={[
          { nom: "Accueil", chemin: "/" },
          { nom: "Contact", chemin: "/contact" },
        ]}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(tenant.phoneDisplay || tenant.phone) && (
            <a
              href={`tel:${(tenant.phone ?? "").replace(/\s/g, "")}`}
              className="border-aubier-bord bg-aubier-pur hover:border-sapin/40 flex items-start gap-4 rounded-[14px] border p-5 transition-colors"
            >
              <Phone size={22} strokeWidth={1.75} className="text-sapin mt-1 shrink-0" aria-hidden="true" />
              <span>
                <span className="text-cendre block text-[14px]">Téléphone</span>
                <span className="block text-[21px] font-semibold">
                  {tenant.phoneDisplay ?? tenant.phone}
                </span>
              </span>
            </a>
          )}

          <a
            href={`mailto:${tenant.email}`}
            className="border-aubier-bord bg-aubier-pur hover:border-sapin/40 flex items-start gap-4 rounded-[14px] border p-5 transition-colors"
          >
            <Mail size={22} strokeWidth={1.75} className="text-sapin mt-1 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="text-cendre block text-[14px]">Email</span>
              <span className="block truncate text-[19px] font-semibold">{tenant.email}</span>
            </span>
          </a>
        </div>

        {(entreprise?.address_line1 || entreprise?.city) && (
          <div className="border-aubier-bord bg-aubier-pur mt-4 flex items-start gap-4 rounded-[14px] border p-5">
            <MapPin size={22} strokeWidth={1.75} className="text-sapin mt-1 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-cendre text-[14px]">Adresse</p>
              <address className="mt-0.5 text-[19px] font-semibold not-italic">
                {entreprise.address_line1 && (
                  <>
                    {entreprise.address_line1}
                    <br />
                  </>
                )}
                {[entreprise.postal_code, entreprise.city].filter(Boolean).join(" ")}
              </address>
            </div>
          </div>
        )}

        <Prose>
          <h2>Pour un devis, passez par le formulaire</h2>
          <p>
            Un devis en ligne est chiffré, livraison comprise, et vous recevez le PDF par email.
            Le formulaire pose les bonnes questions — essence, longueur, quantité, accès — ce qui
            évite trois allers-retours.
          </p>
        </Prose>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/devis"
            className="bg-seve text-encre inline-flex min-h-14 items-center rounded-[4px] px-8 text-[17px] font-semibold"
          >
            Demander un devis
          </Link>
          <Link
            href="/livraison"
            className="border-aubier-bord inline-flex min-h-14 items-center rounded-[4px] border px-8 text-[17px] font-semibold"
          >
            Voir les zones livrées
          </Link>
        </div>
      </PageContenu>
    </>
  );
}
