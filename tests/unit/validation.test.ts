import { describe, it, expect } from "vitest";
import { uuidLike } from "@/lib/validation";

describe("uuidLike", () => {
  it("accepte un UUID v4 de production", () => {
    expect(uuidLike.safeParse("3f2504e0-4f89-41d3-9a0c-0305e82c3301").success).toBe(true);
  });

  it("accepte les identifiants lisibles des jeux de test", () => {
    // C'est LE cas qui cassait avec z.string().uuid() de Zod 4 : le nibble de
    // version vaut 0, ce que Postgres accepte mais pas la RFC stricte.
    expect(uuidLike.safeParse("44444444-0000-0000-0000-000000000002").success).toBe(true);
    expect(uuidLike.safeParse("11111111-1111-1111-1111-111111111111").success).toBe(true);
  });

  it("accepte les majuscules", () => {
    expect(uuidLike.safeParse("3F2504E0-4F89-41D3-9A0C-0305E82C3301").success).toBe(true);
  });

  it("refuse ce que Postgres refuserait aussi", () => {
    for (const invalide of [
      "",
      "pas-un-uuid",
      "44444444000000000000000000000002",
      "44444444-0000-0000-0000-00000000000",
      "44444444-0000-0000-0000-0000000000021",
      "gggggggg-0000-0000-0000-000000000002",
      "44444444-0000-0000-000000000000-0002",
    ]) {
      expect(uuidLike.safeParse(invalide).success, invalide).toBe(false);
    }
  });
});
