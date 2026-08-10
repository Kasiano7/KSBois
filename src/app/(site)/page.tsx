import type { Metadata } from "next";
import Image from "next/image";
import { Truck, Droplets, MapPin, Leaf, ShieldCheck, Star, Users } from "lucide-react";
import { ChoixBois } from "@/components/produit/choix-bois";
import { BandeauLivraison } from "@/components/produit/bandeau-livraison";
import { getTenant } from "@/lib/tenant";
import { listProducts } from "@/server/catalogue";
import { getContexteLivraison } from "@/server/livraison-contexte";
import { metadataPage } from "@/lib/seo";
import herosBucheron from "@/assets/heros-bucheron.png";

/**
 * L'accueil est la page la plus visitée et la plus liée : sans canonique
 * explicite, une variante avec paramètres de campagne (`?utm_source=…`) peut
 * être indexée à sa place et diluer son autorité.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  return metadataPage({
    titre: `Bois de chauffage sec livré${tenant?.city ? ` autour de ${tenant.city}` : " en Ardèche"}`,
    description:
      "Bois de chauffage sec, coupé et livré en Ardèche nord. Chêne, hêtre et charme en 25, 33, 40 et 50 cm. Humidité mesurée, prix livré affiché avant commande.",
    chemin: "/",
  });
}

export default async function Accueil() {
  const tenant = await getTenant();

  if (!tenant) {
    return (
      <main className="mx-auto max-w-[68ch] px-5 py-24">
        <h1 className="text-[32px]">Configuration incomplète</h1>
        <p className="text-cendre mt-4 text-[19px]">
          Aucune entreprise n&apos;est associée à ce domaine. Renseignez la table{" "}
          <code className="font-mono text-[15px]">company_domains</code>, ou démarrez Supabase en
          local avec <code className="font-mono text-[15px]">npx supabase start</code>.
        </p>
      </main>
    );
  }

  const [produits, contexteLivraison] = await Promise.all([
    listProducts(tenant.id),
    // Non nul seulement si le visiteur a déjà estimé sa livraison : le panneau
    // de sélection affiche alors un total livraison comprise.
    getContexteLivraison(tenant),
  ]);

  const secteur = tenant.city ? `${tenant.city} et alentours` : "Ardèche et alentours";

  /** Trois preuves sous le titre, séparées par des filets — docs/03 §6.1. */
  const preuves = [
    { icone: MapPin, titre: "Livraison locale", texte: secteur },
    { icone: Leaf, titre: "Essences sélectionnées", texte: "Bois trié avec soin" },
    { icone: ShieldCheck, titre: "Qualité garantie", texte: "Humidité mesurée à chaque lot" },
  ];

  /** Bandeau de réassurance, sous le configurateur. */
  const reassurance = [
    { icone: Star, titre: "Bois sec mesuré", texte: "Humidité publiée, pas promise" },
    { icone: Truck, titre: "Livraison locale", texte: secteur },
    { icone: Droplets, titre: "Séchage maîtrisé", texte: "Sous abri, 18 à 24 mois" },
    { icone: Users, titre: "Entreprise familiale", texte: "Nous coupons, nous livrons" },
  ];

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════
          HÉROS — registre sombre. « On vend la confiance dans le noir. »

          La photo occupe tout le cadre ; un voile dégradé la recouvre pour que
          le titre reste lisible quel que soit le recadrage (docs/03 §10 :
          jamais de texte sur photo sans voile de lisibilité contrôlé).
          ═══════════════════════════════════════════════════════════════ */}
      <section className="registre-sombre relative isolate overflow-hidden bg-[#100d0a] sm:min-h-[680px]">
        {/* ⚠️ PAS de `object-cover` sur grand écran, et c'est tout l'enjeu.

            `cover` dimensionne l'image sur le PLUS CONTRAIGNANT des deux axes.
            Sur une photo panoramique (16:9) posée dans un bandeau large et
            court, c'est la largeur qui pilote tant que la fenêtre est très
            large — puis la HAUTEUR reprend la main dès qu'elle se resserre, et
            l'image bondit : à 2048 px le facteur d'échelle valait 1,22, à
            1265 px il passait à 0,88 sur la largeur mais 0,88 sur la hauteur…
            soit un bûcheron 40 % plus gros d'une résolution à l'autre.

            On pilote donc la LARGEUR seule, entre deux bornes rapprochées, et
            on laisse la hauteur suivre le ratio naturel. Conséquence assumée :
            sur un écran très large, la photo ne touche pas le bord gauche —
            on y voit du fond sombre, ce qui vaut mieux qu'un zoom. Le voile
            étant quasi opaque de ce côté, la jonction ne se voit pas.

            Sur téléphone, `cover` reste le bon choix : le bandeau est alors
            plus haut que large et il n'y a pas de composition à préserver. */}
        <Image
          src={herosBucheron}
          alt=""
          priority
          sizes="(max-width: 640px) 100vw, 1700px"
          placeholder="blur"
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-center select-none sm:inset-auto sm:top-0 sm:right-0 sm:h-auto sm:w-[clamp(1500px,100vw,1620px)] sm:max-w-none"
        />

        {/* Voile de lisibilité, en deux régimes.

            Sur téléphone, le texte occupe TOUTE la largeur : il lui faut un
            voile uniforme, sinon le sous-titre passe sur le visage du bûcheron
            et devient illisible. Sur grand écran, le texte tient à gauche : on
            assombrit ce côté et on laisse la photo respirer à droite. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 sm:hidden"
          style={{ background: "rgba(16,13,10,0.74)" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 hidden sm:block"
          style={{
            // Opaque au bord gauche : sur écran très large, c'est là que la
            // photo s'arrête, et le voile masque la jonction.
            background:
              "linear-gradient(100deg, rgba(16,13,10,1) 0%, rgba(16,13,10,0.92) 26%, rgba(16,13,10,0.60) 52%, rgba(16,13,10,0.30) 78%, rgba(16,13,10,0.22) 100%)",
          }}
        />

        <div className="mx-auto max-w-[1240px] px-5 pt-32 pb-40 sm:pt-40 sm:pb-48 lg:pt-44">
          <h1 className="max-w-[15ch] text-[40px] leading-[0.98] sm:text-[62px] lg:text-[72px]">
            Du bois sec, coupé et livré près de chez vous.
          </h1>

          <p className="text-cendre-clair mt-7 max-w-[54ch] text-[19px] leading-relaxed sm:text-[21px]">
            Sec, local et prêt à brûler.
            <br />
            Livré chez vous avec le soin d&apos;un vrai bûcheron.
          </p>

          <ul className="mt-10 flex flex-wrap items-stretch gap-y-5">
            {preuves.map(({ icone: Icone, titre, texte }, index) => (
              <li
                key={titre}
                /* Le filet séparateur et son décalage n'existent qu'à partir de
                   `sm` : empilés sur téléphone, ils dessinaient un escalier. */
                className={
                  index > 0
                    ? "border-aubier/20 flex items-center gap-3 sm:border-l sm:pr-7 sm:pl-7"
                    : "flex items-center gap-3 sm:pr-7"
                }
              >
                <span className="border-seve/40 bg-ecorce/40 flex size-11 shrink-0 items-center justify-center rounded-full border backdrop-blur-[2px]">
                  <Icone size={19} strokeWidth={1.6} className="text-seve" aria-hidden="true" />
                </span>
                <span>
                  <span className="text-aubier block text-[15px] font-semibold">{titre}</span>
                  <span className="text-cendre-clair block text-[13px]">{texte}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          CONFIGURATEUR — grande carte claire qui chevauche le héros.
          C'est le cœur transactionnel : il est visible sans défiler.
          ═══════════════════════════════════════════════════════════════ */}
      <main id="commander" className="relative z-10 -mt-28 sm:-mt-32">
        <div className="mx-auto max-w-[1240px] px-5">
          {produits.length > 0 ? (
            <ChoixBois produits={produits} contexteLivraison={contexteLivraison} />
          ) : (
            <div className="border-aubier-bord bg-aubier-pur rounded-[14px] border p-7 shadow-[0_18px_50px_-28px_rgba(20,16,13,0.55)]">
              <p className="text-cendre">
                Aucun produit actif. Ajoutez-en depuis l&apos;administration.
              </p>
            </div>
          )}

          <div id="livraison" className="mt-5">
            <BandeauLivraison region={`Livraison rapide en ${secteur}.`} />
          </div>

          {/* ─── Réassurance ─── */}
          <section className="border-aubier-bord bg-aubier-pur mt-5 rounded-[14px] border">
            <ul className="grid grid-cols-1 gap-x-6 gap-y-6 p-6 sm:grid-cols-2 sm:p-7 lg:grid-cols-4">
              {reassurance.map(({ icone: Icone, titre, texte }, index) => (
                <li
                  key={titre}
                  className={
                    index > 0
                      ? "border-aubier-bord flex items-center gap-3.5 lg:border-l lg:pl-6"
                      : "flex items-center gap-3.5"
                  }
                >
                  <Icone
                    size={26}
                    strokeWidth={1.5}
                    className="text-sapin shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block font-semibold">{titre}</span>
                    <span className="text-cendre block text-[15px]">{texte}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Encart pédagogique : replié pour ne pas alourdir la page */}
          <details className="border-aubier-bord group mt-5 rounded-[14px] border border-dashed">
            <summary className="text-cendre hover:text-encre flex min-h-11 cursor-pointer items-center gap-2 p-5 text-[15px] font-semibold">
              Stère ou mètre cube apparent ?
            </summary>
            <p className="text-cendre prose-bois px-5 pb-5 text-[15px] leading-relaxed">
              Le stère n&apos;est plus une unité de mesure légale depuis 1977 : la vente se fait en{" "}
              <strong className="text-encre">mètres cubes apparents</strong>. Pour du bois en 1 m,
              un stère équivaut à 1 m³ apparent. Recoupé plus court, le bois s&apos;empile plus
              dense : 1 stère de 1 m donne environ 0,70 m³ apparent en 33 cm.
              {tenant.pricingBasis === "map_delivered"
                ? " Nos prix s'entendent au m³ apparent de la longueur que vous recevez."
                : " Nos prix s'entendent au stère équivalent bois de 1 m."}
            </p>
          </details>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════
          PIED DE PAGE — retour au registre sombre
          ═══════════════════════════════════════════════════════════════ */}
      <footer className="registre-sombre mt-16">
        <div className="mx-auto max-w-[1240px] px-5 py-14">
          <p className="font-display text-[26px]">{tenant.name}</p>
          <p className="text-cendre-clair mt-2">
            {[tenant.postalCode, tenant.city].filter(Boolean).join(" ")}
            {tenant.phoneDisplay ? ` · ${tenant.phoneDisplay}` : ""}
          </p>
          <p className="text-cendre-clair micro-label mt-8">Site en cours de construction</p>
        </div>
      </footer>
    </>
  );
}
