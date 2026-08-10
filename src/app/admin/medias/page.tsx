import type { Metadata } from "next";
import Link from "next/link";
import { Images } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listerMedias } from "@/server/medias";
import { imagekitConfigure } from "@/lib/imagekit";
import { LIBELLES_DOSSIER, type DossierMedia } from "@/lib/medias";
import { TeleverseurMedias } from "@/components/admin/televerseur-medias";
import { GrilleMedias } from "@/components/admin/grille-medias";

export const metadata: Metadata = {
  title: "Médias",
  robots: { index: false, follow: false },
};

const DOSSIERS = Object.keys(LIBELLES_DOSSIER) as DossierMedia[];

function premier(parametre: string | string[] | undefined): string | undefined {
  return Array.isArray(parametre) ? parametre[0] : parametre;
}

export default async function PageMedias(props: PageProps<"/admin/medias">) {
  const session = await requireRole(["owner", "staff"], "/admin/medias");
  const params = await props.searchParams;
  const dossier = premier(params.dossier);
  const recherche = premier(params.recherche);

  const medias = await listerMedias(session.companyId, {
    dossier: dossier && DOSSIERS.includes(dossier as DossierMedia) ? dossier : null,
    recherche: recherche ?? null,
  });

  const sansDescription = medias.filter((media) => !media.altText?.trim()).length;

  return (
    <main className="mx-auto w-full max-w-[1560px] p-5 sm:p-8">
      <p className="micro-label text-seve">Bibliothèque</p>
      <h1 className="mt-2 text-[32px] sm:text-[40px]">Médias</h1>
      <p className="text-cendre-clair mt-2 max-w-[74ch] text-[17px] leading-relaxed">
        Les photos du site. Elles sont redimensionnées automatiquement à l&apos;envoi : inutile
        de les préparer, envoyez-les telles qu&apos;elles sortent du téléphone.
      </p>

      {sansDescription > 0 && (
        <p className="border-alerte/40 bg-alerte/10 mt-5 max-w-[74ch] rounded-[10px] border px-4 py-3 text-[15px]">
          <strong>
            {sansDescription} image{sansDescription > 1 ? "s" : ""} sans description
          </strong>{" "}
          — elles ne peuvent pas être publiées tant qu&apos;elles n&apos;en ont pas une.
        </p>
      )}

      <section className="mt-8">
        <h2 className="sr-only">Ajouter des photos</h2>
        <TeleverseurMedias configure={imagekitConfigure()} />
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Images size={19} strokeWidth={1.75} className="text-seve" aria-hidden="true" />
          <h2 className="text-[22px]">
            {medias.length} image{medias.length > 1 ? "s" : ""}
          </h2>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Filtrer par dossier">
          <Lien href="/admin/medias" actif={!dossier}>
            Toutes
          </Lien>
          {DOSSIERS.map((valeur) => (
            <Lien
              key={valeur}
              href={`/admin/medias?dossier=${valeur}`}
              actif={dossier === valeur}
            >
              {LIBELLES_DOSSIER[valeur]}
            </Lien>
          ))}
        </div>

        <form method="get" className="mt-4 flex max-w-md flex-wrap gap-2">
          {dossier && <input type="hidden" name="dossier" value={dossier} />}
          <label className="sr-only" htmlFor="recherche-medias">
            Rechercher une image
          </label>
          <input
            id="recherche-medias"
            name="recherche"
            defaultValue={recherche ?? ""}
            placeholder="Nom de fichier ou description"
            className="border-ecorce-bord bg-ecorce h-11 min-w-0 flex-1 rounded-[6px] border px-3 text-[16px]"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground h-11 rounded-[6px] px-4 text-[15px] font-semibold"
          >
            Rechercher
          </button>
        </form>

        <GrilleMedias medias={medias} estGerant={session.role === "owner"} />
      </section>
    </main>
  );
}

function Lien({
  href,
  actif,
  children,
}: {
  href: string;
  actif: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={actif ? "true" : undefined}
      className={`flex min-h-10 items-center rounded-[9px] px-3.5 text-[14px] font-semibold transition-colors ${
        actif ? "bg-seve text-encre" : "border-ecorce-bord text-cendre-clair hover:bg-aubier/10 border"
      }`}
    >
      {children}
    </Link>
  );
}
