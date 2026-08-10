import Link from "next/link";
import { TreePine } from "lucide-react";
import type { Tenant } from "@/lib/tenant";

/**
 * Pied de page du registre public — docs/03 §6.1.
 *
 * Registre sombre, comme le récit et le héros. Il porte trois choses : les
 * coordonnées (qui alimentent le référencement local et rassurent), le maillage
 * vers les communes desservies, et les liens légaux — sans lesquels on ne peut
 * pas vendre en ligne.
 *
 * Les communes affichées viennent de la base : la liste suit les zones réelles,
 * elle ne se périme pas.
 */
export function PiedSite({
  tenant,
  communes,
}: {
  tenant: Tenant;
  communes: Array<{ slug: string; ville: string; indexable: boolean }>;
}) {
  const annee = new Date().getFullYear();

  return (
    <footer className="bg-ecorce text-aubier mt-auto">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="flex items-center gap-2.5">
              <TreePine size={22} strokeWidth={1.75} className="text-seve" aria-hidden="true" />
              <span className="font-display text-[20px]">{tenant.name}</span>
            </p>
            <p className="text-cendre-clair mt-3 text-[15px] leading-relaxed">{tenant.tagline}</p>
            <address className="text-cendre-clair mt-4 text-[15px] leading-relaxed not-italic">
              {[tenant.postalCode, tenant.city].filter(Boolean).join(" ")}
              {tenant.phoneDisplay || tenant.phone ? (
                <>
                  <br />
                  <a
                    href={`tel:${(tenant.phone ?? "").replace(/\s/g, "")}`}
                    className="text-aubier font-semibold underline-offset-4 hover:underline"
                  >
                    {tenant.phoneDisplay ?? tenant.phone}
                  </a>
                </>
              ) : null}
              <br />
              <a href={`mailto:${tenant.email}`} className="underline-offset-4 hover:underline">
                {tenant.email}
              </a>
            </address>
          </div>

          <Colonne titre="Commander">
            <LienPied href="/#commander">Nos bois et nos prix</LienPied>
            <LienPied href="/livraison">Zones et tarifs de livraison</LienPied>
            <LienPied href="/devis">Devis sur mesure</LienPied>
            <LienPied href="/compte">Mon espace client</LienPied>
          </Colonne>

          <Colonne titre="En savoir plus">
            <LienPied href="/notre-entreprise">Notre entreprise</LienPied>
            <LienPied href="/savoir-faire">Notre savoir-faire</LienPied>
            <LienPied href="/guides">Guides du bois de chauffage</LienPied>
            <LienPied href="/galerie">Galerie</LienPied>
            <LienPied href="/contact">Nous contacter</LienPied>
          </Colonne>

          <Colonne titre="Nous livrons à">
            {communes.slice(0, 8).map((commune) => (
              <LienPied
                key={commune.slug}
                href={commune.indexable ? `/livraison/${commune.slug}` : "/livraison"}
              >
                {commune.ville}
              </LienPied>
            ))}
            {communes.length > 8 && (
              <LienPied href="/livraison">
                et {communes.length - 8} autres communes
              </LienPied>
            )}
          </Colonne>
        </div>

        <div className="border-ecorce-bord mt-12 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-cendre-clair text-[14px]">
            © {annee} {tenant.name}
          </p>
          <nav aria-label="Informations légales">
            <ul className="text-cendre-clair flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
              <li>
                <Link href="/cgv" className="underline-offset-4 hover:underline">
                  Conditions générales de vente
                </Link>
              </li>
              <li>
                <Link href="/mentions-legales" className="underline-offset-4 hover:underline">
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="underline-offset-4 hover:underline">
                  Confidentialité
                </Link>
              </li>
              <li>
                <Link href="/retractation" className="underline-offset-4 hover:underline">
                  Rétractation
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <p className="text-cendre-clair mt-6 max-w-[80ch] text-[13px] leading-relaxed">
          Les quantités sont exprimées en mètres cubes apparents. Le stère n&apos;est plus une
          unité légale de mesure depuis 1977 ; la mention « stère » est donnée à titre indicatif.
        </p>
      </div>
    </footer>
  );
}

function Colonne({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="micro-label text-seve">{titre}</p>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function LienPied({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-cendre-clair hover:text-aubier flex min-h-9 items-center text-[15px] underline-offset-4 transition-colors hover:underline"
      >
        {children}
      </Link>
    </li>
  );
}
