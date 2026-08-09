import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { listerStockParEssence, listerLongueurs } from "@/server/stock";
import { formatVolume } from "@/domain/units";
import { CarteEssence } from "@/components/admin/carte-essence";
import { NouvelleEssence } from "@/components/admin/nouvelle-essence";

export const metadata: Metadata = { title: "Stock", robots: { index: false, follow: false } };

export default async function PageStock() {
  const session = await requireRole(["owner", "staff"], "/admin/stock");

  const [groupes, longueurs] = await Promise.all([
    listerStockParEssence(session.companyId),
    listerLongueurs(session.companyId),
  ]);

  // Prix et catalogue sont réservés au gérant : le secrétariat saisit la
  // production et corrige l'inventaire, mais ne fixe pas les tarifs.
  const peutModifierPrix = session.role === "owner";

  const volumeTotal = Math.round(groupes.reduce((s, g) => s + g.disponibleTotal, 0) * 1000) / 1000;
  const aRefaire = groupes.flatMap((g) => g.formats).filter((f) => f.etat !== "ok");

  return (
    <main className="p-5 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-[28px] sm:text-[36px]">Stock et tarifs</h1>
        <p className="text-cendre-clair text-[17px]">
          {formatVolume(volumeTotal)} disponibles, toutes gammes confondues
        </p>
      </div>

      {aRefaire.length > 0 && (
        <p className="text-alerte mt-4 text-[17px]">
          À refaire : {aRefaire.map((f) => `${f.productName} ${f.format}`).join(" · ")}
        </p>
      )}

      {peutModifierPrix && (
        <div className="mt-7">
          <NouvelleEssence longueurs={longueurs} />
        </div>
      )}

      {groupes.length === 0 ? (
        <p className="text-cendre-clair mt-8 text-[17px]">
          Aucune gamme active. Créez-en une pour commencer à vendre.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {groupes.map((groupe) => (
            <CarteEssence
              key={groupe.productId}
              groupe={groupe}
              longueurs={longueurs}
              peutModifierPrix={peutModifierPrix}
            />
          ))}
        </ul>
      )}

      <p className="text-cendre-clair mt-8 max-w-[62ch] text-[15px] leading-relaxed">
        Le stock disponible se calcule tout seul : il baisse dès qu&apos;une commande est passée et
        se décrémente définitivement à la livraison. Vous n&apos;avez qu&apos;à saisir ce que vous
        produisez.
        {peutModifierPrix &&
          " Les prix et les nouvelles gammes sont publiés sur le site dès l'enregistrement."}
      </p>
    </main>
  );
}
