import Image from "next/image";
import { Truck, Droplets, MapPin, Leaf, ShieldCheck, Star, Users } from "lucide-react";
import { ChoixBois } from "@/components/produit/choix-bois";
import { BandeauLivraison } from "@/components/produit/bandeau-livraison";
import { getTenant } from "@/lib/tenant";
import { listProducts } from "@/server/catalogue";
import { getContexteLivraison } from "@/server/livraison-contexte";
import herosBucheron from "@/assets/heros-bucheron.png";

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
      <section className="registre-sombre relative isolate overflow-hidden">
        <Image
          src={herosBucheron}
          alt=""
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          /* Cadrage centré : sur grand écran le bandeau est plus large que la
             photo, le rognage est donc vertical et la position horizontale n'a
             aucun effet. Sur téléphone, en revanche, elle décide de ce qu'on
             voit — et c'est le bûcheron qu'on veut garder, pas la cabane. */
          className="-z-20 object-cover object-center"
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
            background:
              "linear-gradient(100deg, rgba(16,13,10,0.95) 0%, rgba(16,13,10,0.86) 34%, rgba(16,13,10,0.42) 62%, rgba(16,13,10,0.30) 100%)",
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
