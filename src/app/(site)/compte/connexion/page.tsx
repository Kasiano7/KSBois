import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";
import { getClientSession } from "@/lib/auth";
import { ConnexionClient } from "@/components/compte/connexion-client";

export const metadata: Metadata = {
  title: "Mon espace",
  robots: { index: false, follow: false },
};

/**
 * Connexion du client — docs/03-DESIGN-SYSTEM.md §6.4
 *
 * Registre transactionnel : fond clair, gros texte, une seule chose à faire.
 * Aucun mot de passe n'est proposé, ni ici ni ailleurs dans ce parcours : notre
 * audience ne veut pas en retenir un de plus, et le lien magique supprime au
 * passage toute une classe de vulnérabilités (docs/01 §1).
 */
export default async function PageConnexionClient({
  searchParams,
}: PageProps<"/compte/connexion">) {
  const tenant = await requireTenant();
  const { suite } = await searchParams;

  const session = await getClientSession();
  if (session) {
    redirect(typeof suite === "string" && suite.startsWith("/compte") ? suite : "/compte");
  }

  return (
    <main className="mx-auto max-w-[560px] px-5 py-12 sm:py-20">
      <h1 className="text-[32px] sm:text-[42px]">Mon espace</h1>
      <p className="text-cendre mt-4 text-[19px] leading-relaxed">
        Retrouvez vos commandes et recommandez le même bois en deux clics. Indiquez votre adresse
        email : nous vous envoyons un lien de connexion, sans mot de passe à retenir.
      </p>

      <div className="border-aubier-bord bg-aubier-pur mt-8 rounded-[8px] border p-6">
        <ConnexionClient suite={typeof suite === "string" ? suite : undefined} />
      </div>

      <p className="text-cendre mt-8 text-[15px] leading-relaxed">
        Vous avez commandé sans créer de compte ? Utilisez la même adresse email : vos commandes
        précédentes vous seront rattachées automatiquement.
      </p>

      <p className="text-cendre mt-4 text-[15px]">
        Une difficulté ? Appelez-nous au{" "}
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
