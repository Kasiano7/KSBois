import { describe, it, expect } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  canTransition,
  nextStatuses,
  isTerminal,
  holdsStock,
  shortestPath,
  assertTransition,
  InvalidTransitionError,
  initialStatus,
} from "@/domain/orders/state-machine";

/**
 * La machine à états décide de ce que l'exploitant peut faire d'une commande et
 * du moment où le stock est libéré. Elle n'avait aucun test dédié : ce fichier
 * verrouille les règles écrites dans docs/02 §5.1.
 */

describe("transitions", () => {
  it("suit le chemin nominal", () => {
    expect(canTransition("nouvelle", "a_preparer")).toBe(true);
    expect(canTransition("a_preparer", "prete")).toBe(true);
    expect(canTransition("prete", "planifiee")).toBe(true);
    expect(canTransition("planifiee", "livree")).toBe(true);
  });

  it("interdit les sauts en arrière et les raccourcis", () => {
    expect(canTransition("livree", "prete")).toBe(false);
    expect(canTransition("nouvelle", "livree")).toBe(false);
    expect(canTransition("annulee", "nouvelle")).toBe(false);
  });

  it("autorise l'annulation depuis tout état non terminal", () => {
    for (const statut of ORDER_STATUSES) {
      if (statut === "livree" || statut === "annulee") continue;
      expect(canTransition(statut, "annulee"), statut).toBe(true);
    }
  });

  it("lève une erreur explicite sur une transition interdite", () => {
    expect(() => assertTransition("livree", "prete")).toThrow(InvalidTransitionError);
    // Le message parle à un humain, pas à une machine.
    expect(() => assertTransition("livree", "prete")).toThrow(/Livrée/);
  });

  it("n'a que deux états terminaux", () => {
    const terminaux = ORDER_STATUSES.filter(isTerminal);
    expect(terminaux).toEqual(["livree", "annulee"]);
    expect(nextStatuses("livree")).toEqual([]);
  });
});

describe("holdsStock", () => {
  it("libère le stock uniquement une fois livrée ou annulée", () => {
    expect(holdsStock("nouvelle")).toBe(true);
    expect(holdsStock("planifiee")).toBe(true);
    expect(holdsStock("livree")).toBe(false);
    expect(holdsStock("annulee")).toBe(false);
  });
});

describe("shortestPath", () => {
  it("emprunte le chemin légal quand le livreur brûle une étape", () => {
    // « Marquer comme livrée » depuis « à préparer » : on passe par « prête ».
    expect(shortestPath("a_preparer", "livree")).toEqual(["prete", "livree"]);
  });

  it("renvoie un chemin vide entre un état et lui-même", () => {
    expect(shortestPath("prete", "prete")).toEqual([]);
  });

  it("renvoie null quand aucun chemin n'existe", () => {
    expect(shortestPath("livree", "nouvelle")).toBeNull();
  });
});

describe("initialStatus", () => {
  it("ne marque jamais payée une commande réglée à la livraison", () => {
    expect(initialStatus("cash")).toBe("a_preparer");
    expect(initialStatus("sumup")).toBe("a_preparer");
  });

  it("attend l'encaissement pour le chèque et le virement", () => {
    expect(initialStatus("check")).toBe("en_attente_paiement");
    expect(initialStatus("transfer")).toBe("en_attente_paiement");
  });

  it("laisse la carte en « nouvelle » : seul le webhook Stripe fait foi", () => {
    expect(initialStatus("card")).toBe("nouvelle");
  });

  it("accepte l'absence de mode de paiement — commande créée depuis un devis", () => {
    expect(initialStatus(null)).toBe("nouvelle");
    // Et depuis là, tous les chemins de règlement restent ouverts.
    expect(canTransition("nouvelle", "en_attente_paiement")).toBe(true);
    expect(canTransition("nouvelle", "a_preparer")).toBe(true);
  });
});

describe("libellés", () => {
  it("couvre tous les statuts, en français", () => {
    for (const statut of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[statut], statut).toBeTruthy();
    }
  });
});
