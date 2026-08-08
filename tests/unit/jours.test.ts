import { describe, it, expect } from "vitest";
import { formatJoursLivraison, nomJour } from "@/lib/jours";

describe("formatJoursLivraison", () => {
  it("regroupe une semaine complète plutôt que d'énumérer", () => {
    // Le défaut naïf produisait « le lundi et le mardi et le mercredi et… »
    expect(formatJoursLivraison([1, 2, 3, 4, 5])).toBe("du lundi au vendredi");
  });

  it("énumère deux jours non consécutifs", () => {
    expect(formatJoursLivraison([2, 4])).toBe("le mardi et le jeudi");
  });

  it("gère un jour unique", () => {
    expect(formatJoursLivraison([4])).toBe("le jeudi");
  });

  it("gère deux jours consécutifs sans passer en plage", () => {
    expect(formatJoursLivraison([2, 3])).toBe("le mardi et le mercredi");
  });

  it("combine plusieurs plages", () => {
    expect(formatJoursLivraison([1, 2, 3, 5, 6, 7])).toBe(
      "du lundi au mercredi et du vendredi au dimanche",
    );
  });

  it("trie et déduplique une saisie désordonnée", () => {
    expect(formatJoursLivraison([4, 2, 4])).toBe("le mardi et le jeudi");
  });

  it("ignore les valeurs hors bornes", () => {
    expect(formatJoursLivraison([0, 2, 9])).toBe("le mardi");
  });

  it("retourne une chaîne vide sans jour", () => {
    expect(formatJoursLivraison([])).toBe("");
  });
});

describe("nomJour", () => {
  it("suit la numérotation ISO", () => {
    expect(nomJour(1)).toBe("lundi");
    expect(nomJour(7)).toBe("dimanche");
    expect(nomJour(0)).toBe("");
    expect(nomJour(12)).toBe("");
  });
});
