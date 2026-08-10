"use client";

import { useState, useTransition } from "react";
import { FileText, Loader2, ReceiptText, Truck } from "lucide-react";
import { annulerFactureParAvoir, emettreFacture } from "@/server/actions/admin-factures";
import { formatEuros } from "@/domain/units";
import { Button } from "@/components/ui/button";

/**
 * Documents d'une commande : bon de livraison, facture, avoir.
 *
 * Deux natures très différentes, et l'écran doit le dire :
 *  • le bon de livraison s'imprime autant de fois qu'on veut, il n'engage rien ;
 *  • la facture consomme un numéro de la séquence légale et ne s'annule que par
 *    un avoir. Le bouton le rappelle noir sur blanc avant le clic.
 */

const formatDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export interface FactureAffichee {
  id: string;
  numero: string;
  emiseLe: string;
  estAvoir: boolean;
  totalCents: number;
}

export function DocumentsCommande({
  orderId,
  estGerant,
  livrable,
  factures,
}: {
  orderId: string;
  estGerant: boolean;
  /** Une commande annulée n'a ni bon de livraison ni facture à produire. */
  livrable: boolean;
  factures: FactureAffichee[];
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);

  const factureEmise = factures.find((facture) => !facture.estAvoir) ?? null;
  const avoirEmis = factures.find((facture) => facture.estAvoir) ?? null;

  const lancer = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setMessage(null);
    demarrer(async () => {
      const resultat = await fn();
      setMessage({
        ton: resultat.ok ? "ok" : "erreur",
        texte: resultat.message ?? (resultat.ok ? "C'est fait." : "L'opération a échoué."),
      });
    });
  };

  return (
    <section className="border-ecorce-bord rounded-[12px] border p-5">
      <div className="flex items-center gap-2.5">
        <FileText className="text-seve" size={21} aria-hidden="true" />
        <h2 className="text-[19px] font-semibold">Documents</h2>
      </div>

      {!livrable ? (
        <p className="text-cendre-clair mt-4 text-[15px]">
          Cette commande est annulée : aucun document ne peut plus être édité.
        </p>
      ) : (
        <>
          <div className="mt-4">
            <Button asChild variant="outline" className="w-full justify-start">
              <a href={`/api/pdf/bon-livraison/${orderId}`} target="_blank" rel="noopener">
                <Truck size={19} strokeWidth={1.75} aria-hidden="true" />
                Bon de livraison (PDF)
              </a>
            </Button>
            <p className="text-cendre-clair mt-2 text-[13px]">
              À imprimer et à faire signer à la livraison. Réimprimable à l&apos;identique.
            </p>
          </div>

          <div className="border-ecorce-bord mt-5 border-t pt-5">
            {factures.length > 0 ? (
              <ul className="space-y-2">
                {factures.map((facture) => (
                  <li key={facture.id}>
                    <Button asChild variant="outline" className="h-auto w-full justify-start py-2.5">
                      <a href={`/api/pdf/facture/${facture.id}`} target="_blank" rel="noopener">
                        <ReceiptText size={19} strokeWidth={1.75} aria-hidden="true" />
                        <span className="flex-1 text-left">
                          <span className="block font-mono text-[14px]">{facture.numero}</span>
                          <span className="text-cendre-clair block text-[12px] font-normal">
                            {facture.estAvoir ? "Avoir" : "Facture"} du{" "}
                            {formatDate.format(new Date(`${facture.emiseLe}T12:00:00Z`))} ·{" "}
                            {formatEuros(facture.totalCents)}
                          </span>
                        </span>
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-cendre-clair text-[15px]">
                Aucune facture émise. Elle le sera automatiquement au passage en « livrée ».
              </p>
            )}

            {estGerant && !factureEmise && (
              <Button
                type="button"
                variant="default"
                className="mt-3 w-full"
                disabled={enCours}
                onClick={() => lancer(() => emettreFacture({ orderId }))}
              >
                {enCours ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Émettre la facture maintenant
              </Button>
            )}

            {estGerant && factureEmise && !avoirEmis && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  disabled={enCours}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Émettre un avoir annulant la facture ${factureEmise.numero} ?\n\n` +
                          `La facture ne sera pas supprimée : elle reste dans la numérotation, ` +
                          `et l'avoir en porte la contrepartie. Cette opération est définitive.`,
                      )
                    ) {
                      return;
                    }
                    lancer(() => annulerFactureParAvoir({ invoiceId: factureEmise.id }));
                  }}
                >
                  {enCours ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  Annuler cette facture par un avoir
                </Button>
                <p className="text-cendre-clair mt-2 text-[13px]">
                  Une facture émise ne se modifie ni ne se supprime : la correction passe par un
                  avoir, pour que la numérotation reste continue.
                </p>
              </>
            )}

            {!estGerant && (
              <p className="text-cendre-clair mt-3 text-[13px]">
                L&apos;émission et l&apos;annulation des factures sont réservées au gérant.
              </p>
            )}
          </div>
        </>
      )}

      {message && (
        <p
          role="status"
          className={`mt-4 text-[15px] ${message.ton === "ok" ? "text-succes" : "text-alerte"}`}
        >
          {message.texte}
        </p>
      )}
    </section>
  );
}
