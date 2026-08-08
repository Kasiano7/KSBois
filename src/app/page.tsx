import { Truck, Droplets, Wallet, MapPin } from "lucide-react";
import { Configurateur } from "@/components/produit/configurateur";
import { getTenant } from "@/lib/tenant";
import { getFeaturedProduct } from "@/server/catalogue";

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

  const produit = await getFeaturedProduct(tenant.id);

  const reassurance = [
    {
      icone: Truck,
      titre: "Livré sous 5 jours",
      texte: `Autour de ${tenant.city ?? "notre dépôt"}`,
    },
    {
      icone: Droplets,
      titre: "Humidité mesurée",
      texte: "Chaque lot est testé, la mesure est publiée",
    },
    {
      icone: Wallet,
      titre: "Paiement à la livraison",
      texte: "Carte, espèces ou chèque, au choix",
    },
    { icone: MapPin, titre: "Bois local", texte: "Coupé dans nos forêts" },
  ];

  return (
    <>
      {/* ---------------------------------------------------------------
          HERO — registre sombre. « On vend la confiance dans le noir. »
          --------------------------------------------------------------- */}
      <header className="registre-sombre relative overflow-hidden">
        <div className="mx-auto max-w-[1240px] px-5 py-20 sm:py-28 lg:py-32">
          <p className="micro-label text-seve">
            {tenant.city}
            {tenant.postalCode ? ` · ${tenant.postalCode}` : ""}
          </p>

          <h1 className="mt-5 max-w-[16ch] text-[40px] leading-[0.95] sm:text-[64px] lg:text-[76px]">
            Du bois sec,
            <br />
            coupé et livré
            <br />
            près de chez vous.
          </h1>

          <p className="text-cendre-clair prose-bois mt-6 text-[19px] leading-relaxed">
            Nous abattons, fendons et séchons notre bois nous-mêmes. Vous commandez en ligne en deux
            minutes, nous livrons chez vous.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#commander"
              className="bg-braise inline-flex h-14 items-center justify-center rounded-[4px] px-8 text-[17px] font-semibold text-white transition-colors duration-150 hover:bg-[#A83F12]"
            >
              Commander mon bois
            </a>
            <a
              href="#livraison"
              className="border-ecorce-bord text-aubier hover:bg-ecorce-eleve inline-flex h-14 items-center justify-center rounded-[4px] border px-8 text-[17px] font-semibold transition-colors duration-150"
            >
              Vérifier ma commune
            </a>
          </div>

          <ul className="text-cendre-clair mt-10 flex flex-wrap gap-x-8 gap-y-2">
            {["Livré sous 5 jours", "Bois sec mesuré", "Entreprise locale"].map((item) => (
              <li key={item} className="micro-label">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </header>

      {/* ---------------------------------------------------------------
          RÉASSURANCE — bascule franche vers le registre clair
          --------------------------------------------------------------- */}
      <section className="border-aubier-bord bg-aubier-pur border-b">
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-6 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {reassurance.map(({ icone: Icone, titre, texte }) => (
            <div key={titre} className="flex gap-3">
              <Icone size={22} strokeWidth={1.75} className="text-sapin mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{titre}</p>
                <p className="text-cendre text-[15px]">{texte}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------
          CONFIGURATEUR — le cœur transactionnel
          --------------------------------------------------------------- */}
      <main id="commander" className="mx-auto max-w-[1240px] px-5 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_460px] lg:gap-16">
          <div>
            <p className="micro-label text-braise-texte">Notre bois de chauffage</p>
            <h2 className="mt-2 text-[32px] sm:text-[42px]">Choisissez votre longueur</h2>
            <p className="text-cendre prose-bois mt-4 text-[19px]">
              Les bûches sont dessinées à l&apos;échelle réelle : celle de 50 cm fait exactement
              deux fois la longueur de celle de 25 cm. Vous voyez tout de suite ce qui rentre dans
              votre poêle.
            </p>

            <div className="border-aubier-bord mt-8 rounded-[8px] border border-dashed p-5">
              <p className="micro-label text-cendre">Stère ou mètre cube apparent ?</p>
              <p className="text-cendre mt-2.5 text-[15px] leading-relaxed">
                Le stère n&apos;est plus une unité de mesure légale depuis 1977 : la vente se fait
                en <strong className="text-encre">mètres cubes apparents</strong>. Pour du bois en
                1 m, un stère équivaut à 1 m³ apparent. Recoupé plus court, le bois s&apos;empile
                plus dense : 1 stère de 1 m donne environ 0,70 m³ apparent en 33 cm.
                {tenant.pricingBasis === "map_delivered"
                  ? " Nos prix s'entendent au m³ apparent de la longueur que vous recevez."
                  : " Nos prix s'entendent au stère équivalent bois de 1 m."}
              </p>
            </div>
          </div>

          {produit ? (
            <Configurateur product={produit} subtitle={produit.shortDescription ?? undefined} />
          ) : (
            <div className="border-aubier-bord bg-aubier-pur rounded-[8px] border p-7">
              <p className="text-cendre">
                Aucun produit mis en avant. Ajoutez-en un depuis l&apos;administration.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ---------------------------------------------------------------
          PIED DE PAGE — retour au registre sombre
          --------------------------------------------------------------- */}
      <footer id="livraison" className="registre-sombre mt-auto">
        <div className="mx-auto max-w-[1240px] px-5 py-14">
          <p className="font-display text-[26px]">{tenant.name}</p>
          <p className="text-cendre-clair mt-2">
            {[tenant.postalCode, tenant.city].filter(Boolean).join(" ")}
            {tenant.phoneDisplay ? ` · ${tenant.phoneDisplay}` : ""}
          </p>
          <p className="text-cendre-clair micro-label mt-8">
            Site en cours de construction
          </p>
        </div>
      </footer>
    </>
  );
}
