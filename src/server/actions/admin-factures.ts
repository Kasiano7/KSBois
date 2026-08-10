"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertRole } from "@/lib/auth";
import { uuidLike } from "@/lib/validation";
import { emettreAvoir, emettreFactureCommande } from "@/server/factures";
import type { ResultatAdmin } from "./admin-commandes";

/**
 * Actions de facturation.
 *
 * ⚠️ Réservées au GÉRANT, et pas par excès de prudence : émettre une facture ou
 * un avoir est une écriture comptable définitive, qui consomme un numéro de la
 * séquence légale. La politique RLS `invoices_owner_write` dit la même chose ;
 * ces actions passent par le client d'administration, donc le contrôle doit
 * être explicite ici.
 *
 * L'émission AUTOMATIQUE au passage en « livrée » échappe à cette restriction :
 * elle n'est pas un acte discrétionnaire mais la conséquence d'une livraison,
 * et le secrétariat doit pouvoir marquer une commande livrée.
 */

const CommandeSchema = z.object({ orderId: uuidLike });
const FactureSchema = z.object({ invoiceId: uuidLike });

export async function emettreFacture(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner"]);
  const parsed = CommandeSchema.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const resultat = await emettreFactureCommande(session.companyId, parsed.data.orderId);
  if (!resultat.ok) return { ok: false, message: resultat.message };

  revalidatePath(`/admin/commandes/${parsed.data.orderId}`);
  revalidatePath("/admin/clients");

  return {
    ok: true,
    message: resultat.dejaEmise
      ? `La facture ${resultat.facture.numero} existait déjà.`
      : `Facture ${resultat.facture.numero} émise.`,
  };
}

export async function annulerFactureParAvoir(entree: unknown): Promise<ResultatAdmin> {
  const session = await assertRole(["owner"]);
  const parsed = FactureSchema.safeParse(entree);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };

  const resultat = await emettreAvoir(session.companyId, parsed.data.invoiceId);
  if (!resultat.ok) return { ok: false, message: resultat.message };

  revalidatePath(`/admin/commandes/${resultat.facture.orderId}`);
  revalidatePath("/admin/clients");

  return { ok: true, message: `Avoir ${resultat.facture.numero} émis.` };
}
