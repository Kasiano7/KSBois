import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { FormulaireConnexion } from "@/components/connexion/formulaire-connexion";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default async function PageConnexion({ searchParams }: PageProps<"/connexion">) {
  const tenant = await requireTenant();
  const { suite } = await searchParams;

  // Déjà connecté : inutile de proposer un formulaire.
  const session = await getSession();
  if (session) redirect(typeof suite === "string" && suite.startsWith("/") ? suite : "/admin");

  return (
    <main className="registre-sombre flex min-h-full flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-[440px]">
        <p className="micro-label text-seve">{tenant.name}</p>
        <h1 className="mt-3 text-[32px] leading-tight">Connexion</h1>
        <p className="text-cendre-clair mt-3 text-[17px]">
          Espace réservé à l&apos;entreprise.
        </p>

        <div className="bg-aubier-pur text-encre mt-8 rounded-[8px] p-6">
          <FormulaireConnexion suite={typeof suite === "string" ? suite : undefined} />
        </div>

        {process.env.NODE_ENV !== "production" && (
          <div className="border-ecorce-bord text-cendre-clair mt-6 rounded-[6px] border border-dashed p-4 text-[15px]">
            <p className="font-semibold">Comptes de démonstration</p>
            <p className="mt-1.5">
              patron@demo.local · secretariat@demo.local
              <br />
              Mot de passe : demo1234
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
