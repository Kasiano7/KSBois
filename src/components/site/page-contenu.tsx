import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Coquille commune des pages de contenu — registre CLAIR (docs/03 §1).
 *
 * Les pages éditoriales ne sont ni le tunnel ni le récit sombre : fond papier,
 * corps à 17 px, longueur de ligne bornée à 68 caractères. C'est ce qui rend un
 * guide lisible sur téléphone par quelqu'un de 62 ans.
 *
 * Le fil d'Ariane est rendu en HTML **et** en JSON-LD par la page appelante :
 * les deux doivent dire la même chose, sinon Google le signale.
 */

export interface EtapeFil {
  nom: string;
  chemin: string;
}

export function PageContenu({
  eyebrow,
  titre,
  chapeau,
  fil,
  children,
  large = false,
}: {
  eyebrow?: string;
  titre: string;
  chapeau?: string;
  fil: EtapeFil[];
  children: React.ReactNode;
  /** Élargit la colonne pour les pages à tableaux ou à grilles. */
  large?: boolean;
}) {
  return (
    <main className="bg-aubier min-h-full">
      <div className={cn("mx-auto w-full px-5 py-10 sm:py-14", large ? "max-w-[1120px]" : "max-w-[820px]")}>
        <FilAriane etapes={fil} />

        {eyebrow && <p className="micro-label text-braise-texte mt-6">{eyebrow}</p>}
        <h1 className="mt-2 text-[32px] sm:text-[44px]">{titre}</h1>
        {chapeau && (
          <p className="text-cendre mt-4 max-w-[68ch] text-[19px] leading-relaxed">{chapeau}</p>
        )}

        <div className="mt-10">{children}</div>
      </div>
    </main>
  );
}

function FilAriane({ etapes }: { etapes: EtapeFil[] }) {
  if (etapes.length === 0) return null;

  return (
    <nav aria-label="Fil d'Ariane">
      <ol className="text-cendre flex flex-wrap items-center gap-1 text-[14px]">
        {etapes.map((etape, index) => {
          const dernier = index === etapes.length - 1;
          return (
            <li key={etape.chemin} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              )}
              {dernier ? (
                <span aria-current="page" className="text-encre font-medium">
                  {etape.nom}
                </span>
              ) : (
                <Link href={etape.chemin} className="underline-offset-4 hover:underline">
                  {etape.nom}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Corps de texte éditorial : longueur de ligne et rythme vertical maîtrisés. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="[&_h2]:text-[26px] [&_h2]:mt-10 [&_h3]:mt-8 [&_h3]:text-[20px] [&_li]:text-[17px] [&_p]:mt-4 [&_p]:max-w-[68ch] [&_p]:text-[17px] [&_p]:leading-[1.65] [&_ul]:mt-4 [&_ul]:max-w-[68ch] [&_ul]:space-y-2">
      {children}
    </div>
  );
}

/** Bloc de questions fréquentes, doublé en JSON-LD par la page appelante. */
export function Faq({ questions }: { questions: Array<{ question: string; reponse: string }> }) {
  if (questions.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="text-[26px]">Questions fréquentes</h2>
      <dl className="mt-6 space-y-5">
        {questions.map((entree) => (
          <div key={entree.question} className="border-aubier-bord border-t pt-5">
            <dt className="text-[19px] font-semibold">{entree.question}</dt>
            <dd className="text-cendre mt-2 max-w-[68ch] text-[17px] leading-relaxed">
              {entree.reponse}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Rappel de conversion en bas de page éditoriale. */
export function AppelAction({
  titre,
  texte,
  lien = "/#commander",
  libelleLien = "Commander mon bois",
}: {
  titre: string;
  texte: string;
  lien?: string;
  libelleLien?: string;
}) {
  return (
    <section className="border-aubier-bord bg-aubier-pur mt-14 rounded-[14px] border p-6 sm:p-8">
      <h2 className="text-[24px]">{titre}</h2>
      <p className="text-cendre mt-3 max-w-[62ch] text-[17px] leading-relaxed">{texte}</p>
      <Link
        href={lien}
        className="bg-seve text-encre mt-6 inline-flex min-h-14 items-center rounded-[4px] px-8 text-[17px] font-semibold"
      >
        {libelleLien}
      </Link>
    </section>
  );
}
