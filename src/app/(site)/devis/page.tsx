import type { Metadata } from "next";
import { requireTenant } from "@/lib/tenant";
import { FormulaireDevis } from "@/components/devis/formulaire-devis";

export const metadata: Metadata = {
  title: "Demander un devis",
  description:
    "Gros volume, livraison hors secteur, besoin professionnel : demandez un devis personnalisé pour votre bois de chauffage.",
};

export default async function PageDevis() {
  const tenant = await requireTenant();

  return (
    <>
      <header className="registre-sombre">
        <div className="mx-auto max-w-[1240px] px-5 py-16 sm:py-20">
          <p className="micro-label text-seve">Demande personnalisée</p>
          <h1 className="mt-4 text-[36px] leading-[1.05] sm:text-[52px]">Demander un devis</h1>
          <p className="text-cendre-clair prose-bois mt-5 text-[19px] leading-relaxed">
            Gros volume, livraison au-delà de notre secteur habituel, besoin professionnel ou
            demande particulière : dites-nous ce qu&apos;il vous faut, nous étudions chaque
            situation.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[820px] px-5 py-12 sm:py-16">
        <FormulaireDevis />

        <div className="border-aubier-bord mt-12 border-t pt-8">
          <p className="text-cendre text-[17px]">
            Vous préférez le téléphone ? Appelez-nous au{" "}
            <a
              href={`tel:${tenant.phone ?? ""}`}
              className="text-braise-texte font-semibold underline underline-offset-4"
            >
              {tenant.phoneDisplay ?? tenant.phone ?? "—"}
            </a>
            .
          </p>
        </div>
      </main>
    </>
  );
}
