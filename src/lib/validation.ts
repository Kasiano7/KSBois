import { z } from "zod";

/**
 * Identifiant de type `uuid` Postgres.
 *
 * ⚠️ On n'utilise PAS `z.string().uuid()` : Zod 4 valide strictement le champ de
 * version RFC 4122 (nibble 1 à 8) et refuse donc des valeurs que Postgres
 * accepte parfaitement — notamment les identifiants lisibles des jeux de
 * données de test (`44444444-0000-0000-0000-000000000002`).
 *
 * Le validateur d'entrée doit correspondre à ce que la base accepte, ni plus
 * strict ni plus permissif. Un identifiant de production vient de
 * `gen_random_uuid()` et sera un v4 valide de toute façon ; la contrainte de
 * version n'apporte aucune sécurité, elle ne fait que casser les fixtures.
 */
export const uuidLike = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Identifiant invalide.",
  );
