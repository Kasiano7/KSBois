/**
 * Vocabulaire des rôles d'administration.
 *
 * ⚠️ Volontairement dans `lib/` et non dans `server/membres.ts` : ces libellés
 * sont affichés par un composant CLIENT. Les importer depuis un module marqué
 * `server-only` embarquerait tout le module — et donc le client Supabase
 * d'administration — dans le bundle navigateur. Next refuse, à juste titre.
 *
 * Les descriptions sont écrites pour quelqu'un qui doit DÉCIDER : « Secrétariat »
 * ne dit pas si la personne verra les factures. La phrase, si (docs/05 §1).
 */

export const ROLES_ADMIN = ["owner", "staff", "driver"] as const;

export type RoleMembre = (typeof ROLES_ADMIN)[number];

export const LIBELLES_ROLE: Record<RoleMembre, string> = {
  owner: "Gérant",
  staff: "Secrétariat",
  driver: "Livreur",
};

export const DESCRIPTIONS_ROLE: Record<RoleMembre, string> = {
  owner: "Accès complet : réglages, facturation, tarifs et gestion des utilisateurs.",
  staff:
    "Commandes, devis, clients, stock, créneaux et tournées. Pas les réglages ni les factures.",
  driver: "Tournée du jour et bons de livraison uniquement.",
};
