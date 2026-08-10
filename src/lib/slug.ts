/**
 * Slugs d'URL.
 *
 * ⚠️ Dans `lib/` et non dans `server/contenu.ts` : c'est une fonction pure, et
 * la laisser dans un module `server-only` la rendait intestable — vitest ne
 * peut pas résoudre `server-only`. Une fonction sans I/O n'a rien à faire
 * derrière cette barrière.
 */

/** « Boulieu-lès-Annonay » → « boulieu-les-annonay ». */
export function slugCommune(ville: string): string {
  return (
    ville
      .normalize("NFD")
      // Diacritiques échappés : écrits littéralement, ils sont invisibles dans
      // l'éditeur et un copier-coller les perd sans que rien ne le signale.
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}
