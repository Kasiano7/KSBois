import "server-only";

import Stripe from "stripe";

/**
 * Client Stripe côté serveur.
 *
 * ⚠️ La clé secrète ne doit JAMAIS transiter vers le navigateur. Ce module est
 * marqué `server-only` : une importation depuis un composant client échoue à la
 * compilation, pas silencieusement à l'exécution.
 */

export function stripeConfigure(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function webhookConfigure(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) {
    throw new Error("STRIPE_SECRET_KEY absente : le paiement par carte est indisponible.");
  }
  // Instance réutilisée : Stripe recommande de ne pas la recréer par requête.
  client ??= new Stripe(cle, {
    // Le SDK impose sa version d'API : on ne la surcharge pas, pour éviter
    // qu'une mise à jour de dépendance change silencieusement le comportement.
    typescript: true,
    appInfo: { name: "Bucheron", version: "0.1.0" },
  });
  return client;
}
