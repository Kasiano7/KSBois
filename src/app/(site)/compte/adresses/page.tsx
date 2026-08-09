import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, TriangleAlert } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant";
import { listerCommandesClient } from "@/server/compte";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { formatDateFr } from "@/lib/jours";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Mes adresses",
  robots: { index: false, follow: false },
};

interface AdresseLivree {
  cle: string;
  ligne1: string | null;
  ligne2: string | null;
  codePostal: string | null;
  ville: string | null;
  accesNotes: string | null;
  derniereLivraison: string;
}

/**
 * Adresses de livraison du client.
 *
 * ⚠️ Ces adresses viennent des COMMANDES passées, pas de la table `addresses` :
 * aujourd'hui, le tunnel fige l'adresse dans `orders.shipping_address` et
 * n'alimente jamais `addresses`. Afficher un carnet d'adresses vide et
 * modifiable serait mentir sur ce que le site sait faire. On montre donc ce
 * qu'on connaît réellement, en disant d'où ça vient.
 */
export default async function PageAdresses() {
  const session = await requireClient("/compte/adresses");
  const tenant = await requireTenant();

  const [commandes, { data: contact }] = await Promise.all([
    listerCommandesClient(tenant.id, session.customerId, 100),
    createSupabaseAdminClient()
      .from("orders")
      .select("shipping_address, created_at")
      .eq("company_id", tenant.id)
      .eq("customer_id", session.customerId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  // Dédoublonnage sur l'adresse elle-même : un client qui a commandé quatre fois
  // au même endroit n'a pas quatre adresses.
  const parCle = new Map<string, AdresseLivree>();
  for (const ligne of contact ?? []) {
    const a = (ligne.shipping_address ?? {}) as Record<string, unknown>;
    const ligne1 = typeof a.line1 === "string" ? a.line1 : null;
    const ville = typeof a.city === "string" ? a.city : null;
    if (!ligne1 && !ville) continue;

    const cle = `${ligne1 ?? ""}|${ville ?? ""}`.toLowerCase();
    if (parCle.has(cle)) continue;

    parCle.set(cle, {
      cle,
      ligne1,
      ligne2: typeof a.line2 === "string" ? a.line2 : null,
      codePostal: typeof a.postalCode === "string" ? a.postalCode : null,
      ville,
      accesNotes: typeof a.accessNotes === "string" ? a.accessNotes : null,
      derniereLivraison: ligne.created_at,
    });
  }

  const adresses = [...parCle.values()];

  return (
    <main className="mx-auto w-full max-w-[820px] px-5 py-10 sm:py-14">
      <h1 className="text-[32px] sm:text-[42px]">Mes adresses</h1>
      <p className="text-cendre mt-3 max-w-[62ch] text-[17px] leading-relaxed">
        Les adresses où nous vous avons déjà livré. Nous reprenons la plus récente quand vous
        recommandez ; vous pouvez toujours la corriger au moment de la commande.
      </p>

      {adresses.length === 0 ? (
        <div className="border-aubier-bord mt-8 rounded-[8px] border border-dashed p-6">
          <p className="text-[19px] font-semibold">Aucune adresse enregistrée</p>
          <p className="text-cendre mt-2 text-[17px] leading-relaxed">
            Elle apparaîtra ici après votre première livraison.
          </p>
          <Button asChild variant="or" size="lg" className="mt-5">
            <Link href="/#commander">Commander mon bois</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {adresses.map((a) => (
            <li
              key={a.cle}
              className="border-aubier-bord bg-aubier-pur rounded-[14px] border p-5 text-[17px]"
            >
              <p className="flex items-start gap-2.5 font-semibold">
                <MapPin
                  size={20}
                  strokeWidth={1.9}
                  className="text-cendre mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  {a.ligne1}
                  {a.ligne2 && (
                    <>
                      <br />
                      {a.ligne2}
                    </>
                  )}
                  <br />
                  {[a.codePostal, a.ville].filter(Boolean).join(" ")}
                </span>
              </p>

              {a.accesNotes && (
                <p className="border-alerte/30 bg-alerte/8 mt-3 flex items-start gap-2 rounded-[6px] border p-3 text-[15px] leading-relaxed">
                  <TriangleAlert
                    size={18}
                    strokeWidth={1.9}
                    className="text-alerte mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Accès :</strong> {a.accesNotes}
                  </span>
                </p>
              )}

              <p className="text-cendre mt-3 text-[15px]">
                Dernière commande le{" "}
                {formatDateFr(a.derniereLivraison.slice(0, 10), {
                  jourSemaine: false,
                  annee: true,
                })}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-cendre mt-10 text-[15px] leading-relaxed">
        Pour changer une adresse ou nous signaler une contrainte d&apos;accès (chemin étroit,
        portail, pente), indiquez-le à la prochaine commande ou appelez-nous au{" "}
        <a
          href={`tel:${(tenant.phone ?? "").replace(/\s/g, "")}`}
          className="font-semibold underline underline-offset-4"
        >
          {tenant.phoneDisplay ?? tenant.phone}
        </a>
        . {commandes.length > 0 && "Nous notons tout sur votre fiche."}
      </p>
    </main>
  );
}
