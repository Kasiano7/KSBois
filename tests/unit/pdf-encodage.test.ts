import { describe, it, expect } from "vitest";
import { formatEuros, formatVolume, formatStereHint, formatStereHintPdf } from "@/domain/units";

/**
 * Garde-fou d'encodage des documents PDF.
 *
 * Tant que les PDF utilisent les polices standard (Helvetica), tout caractère
 * absent de l'encodage WinAnsi est remplacé SILENCIEUSEMENT par un autre glyphe.
 * Le bug réel rencontré : « ≈ 5 stères » s'imprimait « H 5 stères ».
 *
 * Ce test verrouille la règle. Si un jour on embarque une police complète via
 * `Font.register`, on pourra le relâcher — mais pas avant.
 */

/** Jeu de caractères représentable en WinAnsi (cp1252). */
const WINANSI_SUPPLEMENTAIRES = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

function caracteresNonWinAnsi(texte: string): string[] {
  return [...texte].filter((c) => {
    const code = c.codePointAt(0)!;
    if (code <= 0x7e && code >= 0x20) return false; // ASCII imprimable
    if (code >= 0xa0 && code <= 0xff) return false; // Latin-1 supplément
    return !WINANSI_SUPPLEMENTAIRES.includes(c);
  });
}

describe("caracteresNonWinAnsi", () => {
  it("détecte bien le caractère fautif", () => {
    expect(caracteresNonWinAnsi("≈ 5 stères")).toEqual(["≈"]);
  });

  it("laisse passer les caractères réellement supportés", () => {
    expect(caracteresNonWinAnsi("m³ · € — « Chêne » 20 % °C ’")).toEqual([]);
  });
});

describe("chaînes destinées aux PDF", () => {
  const volumes = [0.5, 1, 2.5, 5, 42];

  it("formatStereHintPdf est sûr pour un PDF", () => {
    for (const v of volumes) {
      const texte = formatStereHintPdf(v);
      expect(caracteresNonWinAnsi(texte), texte).toEqual([]);
      expect(texte).toContain("environ");
      expect(texte).not.toContain("≈");
    }
  });

  it("formatVolume est sûr pour un PDF", () => {
    for (const v of volumes) {
      expect(caracteresNonWinAnsi(formatVolume(v)), formatVolume(v)).toEqual([]);
    }
  });

  it("formatEuros est sûr pour un PDF", () => {
    for (const c of [0, 999, 10_400, 1_234_567]) {
      const texte = formatEuros(c);
      // L'espace insécable étroit (U+202F) du format monétaire français n'est
      // PAS dans WinAnsi : il faut le savoir, mais il se dégrade en espace et
      // non en glyphe erroné. On vérifie qu'aucun autre caractère ne passe.
      const fautifs = caracteresNonWinAnsi(texte).filter((x) => x !== " " && x !== " ");
      expect(fautifs, texte).toEqual([]);
    }
  });

  it("formatStereHint reste réservé à l'écran et contient bien ≈", () => {
    // Documenté volontairement : c'est la version qu'il ne faut PAS mettre en PDF.
    expect(formatStereHint(5)).toContain("≈");
    expect(caracteresNonWinAnsi(formatStereHint(5))).toEqual(["≈"]);
  });
});
