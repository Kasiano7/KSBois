import { createHmac, randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth";

/**
 * Paramètres signés autorisant un upload direct navigateur → ImageKit.
 * docs/04 §4.1
 *
 * ⚠️ **C'est la seule surface d'attaque de l'upload.** Non protégée, elle
 * permet à n'importe qui de remplir le compte ImageKit de l'entreprise — et la
 * facturation est à l'usage. Contrôle de rôle ET limitation de débit sont donc
 * obligatoires, pas optionnels.
 *
 * La clé privée ne quitte JAMAIS le serveur : on ne renvoie que le triplet
 * `{ token, expire, signature }`, valable dix minutes au plus, plus la clé
 * publique qui, elle, est publique par nature.
 *
 * Signature ImageKit : `HMAC-SHA1(token + expire, clé privée)`, en hexadécimal.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Durée de validité d'un jeton d'upload. Le maximum accepté est 1 heure. */
const VALIDITE_SECONDES = 600;

/**
 * Limitation de débit en mémoire — 30 uploads par tranche de 5 minutes.
 *
 * ⚠️ Même dette que `actions/devis.ts` : en serverless, chaque instance a sa
 * propre mémoire, donc le plafond réel est « 30 × nombre d'instances ». C'est
 * un garde-fou contre l'accident, pas contre un attaquant déterminé. À porter
 * en base ou sur Upstash en même temps que l'autre (docs/06).
 */
const FENETRE_MS = 5 * 60_000;
const MAX_PAR_FENETRE = 30;
const compteurs = new Map<string, { debut: number; nombre: number }>();

function debitDepasse(cle: string): boolean {
  const maintenant = Date.now();
  const courant = compteurs.get(cle);

  if (!courant || maintenant - courant.debut > FENETRE_MS) {
    compteurs.set(cle, { debut: maintenant, nombre: 1 });
    // Ménage opportuniste : sans lui, la table grossit indéfiniment.
    if (compteurs.size > 500) {
      for (const [autre, valeur] of compteurs) {
        if (maintenant - valeur.debut > FENETRE_MS) compteurs.delete(autre);
      }
    }
    return false;
  }

  courant.nombre += 1;
  return courant.nombre > MAX_PAR_FENETRE;
}

export async function GET() {
  const session = await getSession();
  if (!session || !["owner", "staff"].includes(session.role)) {
    return Response.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  const clePrivee = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  const clePublique = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY?.trim();
  if (!clePrivee || !clePublique) {
    // Message explicite : l'exploitant doit comprendre que ce n'est pas une
    // panne mais une configuration absente (docs/04 §2).
    return Response.json(
      {
        erreur:
          "ImageKit n'est pas configuré. Renseignez NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY et " +
          "IMAGEKIT_PRIVATE_KEY dans les variables d'environnement.",
      },
      { status: 503 },
    );
  }

  if (debitDepasse(session.userId)) {
    return Response.json(
      { erreur: "Trop d'envois d'affilée. Réessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  const token = randomUUID();
  const expire = Math.floor(Date.now() / 1000) + VALIDITE_SECONDES;
  const signature = createHmac("sha1", clePrivee).update(token + expire).digest("hex");

  return Response.json(
    { token, expire, signature, publicKey: clePublique },
    { headers: { "Cache-Control": "no-store" } },
  );
}
