import { describe, it, expect } from "vitest";
import {
  evaluateSlot,
  availableSlots,
  isLastPlaces,
  isoWeekday,
  addDays,
  type Slot,
  type SlotContext,
} from "@/domain/slots";

const creneau = (over: Partial<Slot> = {}): Slot => ({
  id: "s1",
  date: "2026-10-13", // un mardi
  startTime: "08:00",
  endTime: "12:00",
  label: "Matin (8h – 12h)",
  maxDeliveries: 6,
  maxVolumeM3: 18,
  bookedDeliveries: 0,
  bookedVolumeM3: 0,
  isOpen: true,
  zoneIds: [],
  vehicleId: null,
  ...over,
});

const contexte = (over: Partial<SlotContext> = {}): SlotContext => ({
  today: "2026-10-06",
  leadTimeDays: 3,
  bookingHorizonDays: 45,
  orderVolumeM3: 5,
  zoneId: "zoneA",
  allowedWeekdays: [2, 4],
  blackouts: [],
  ...over,
});

describe("utilitaires de date", () => {
  it("calcule le jour ISO", () => {
    expect(isoWeekday("2026-10-13")).toBe(2); // mardi
    expect(isoWeekday("2026-10-12")).toBe(1); // lundi
    expect(isoWeekday("2026-10-18")).toBe(7); // dimanche
  });

  it("ajoute des jours en franchissant les mois", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("evaluateSlot", () => {
  it("accepte un créneau conforme", () => {
    const r = evaluateSlot(creneau(), contexte());
    expect(r.available).toBe(true);
    expect(r.remainingVolumeM3).toBe(18);
  });

  it("refuse un créneau fermé", () => {
    expect(evaluateSlot(creneau({ isOpen: false }), contexte()).reason).toBe("ferme");
  });

  it("respecte le délai de préparation", () => {
    // 8 octobre = J+2, en deçà du délai de 3 jours
    expect(evaluateSlot(creneau({ date: "2026-10-08" }), contexte()).reason).toBe(
      "delai_trop_court",
    );
  });

  it("refuse au-delà de l'horizon de réservation", () => {
    expect(evaluateSlot(creneau({ date: "2027-06-01" }), contexte()).reason).toBe("hors_horizon");
  });

  it("refuse un jour non desservi dans la commune", () => {
    // 14 octobre = mercredi, absent de [2, 4]
    expect(evaluateSlot(creneau({ date: "2026-10-14" }), contexte()).reason).toBe(
      "jour_non_desservi",
    );
  });

  it("refuse pendant une période bloquée", () => {
    const ctx = contexte({
      blackouts: [{ startDate: "2026-10-12", endDate: "2026-10-16", reason: "congés", zoneIds: [] }],
    });
    expect(evaluateSlot(creneau(), ctx).reason).toBe("periode_bloquee");
  });

  it("n'applique un blocage ciblé qu'à la zone concernée", () => {
    const blackout = {
      startDate: "2026-10-12",
      endDate: "2026-10-16",
      reason: "route coupée",
      zoneIds: ["zoneB"],
    };
    expect(evaluateSlot(creneau(), contexte({ blackouts: [blackout] })).available).toBe(true);
    expect(
      evaluateSlot(creneau(), contexte({ blackouts: [blackout], zoneId: "zoneB" })).reason,
    ).toBe("periode_bloquee");
  });

  it("respecte la restriction de zone d'un créneau", () => {
    expect(evaluateSlot(creneau({ zoneIds: ["zoneB"] }), contexte()).reason).toBe("hors_zone");
    expect(evaluateSlot(creneau({ zoneIds: ["zoneA"] }), contexte()).available).toBe(true);
  });

  it("refuse quand le nombre de livraisons est atteint", () => {
    expect(evaluateSlot(creneau({ bookedDeliveries: 6 }), contexte()).reason).toBe(
      "complet_livraisons",
    );
  });

  it("REFUSE SUR LE VOLUME même s'il reste des places — la vraie contrainte", () => {
    // 1 livraison restante sur 6, mais seulement 3 m³ de capacité pour 5 m³ demandés.
    const r = evaluateSlot(creneau({ bookedDeliveries: 5, bookedVolumeM3: 15 }), contexte());
    expect(r.reason).toBe("complet_volume");
    expect(r.remainingDeliveries).toBe(1);
    expect(r.remainingVolumeM3).toBe(3);
  });

  it("accepte quand le volume restant est exactement suffisant", () => {
    expect(
      evaluateSlot(creneau({ bookedVolumeM3: 13 }), contexte({ orderVolumeM3: 5 })).available,
    ).toBe(true);
  });
});

describe("availableSlots", () => {
  it("ne renvoie que les créneaux proposables, triés", () => {
    const slots = [
      creneau({ id: "b", date: "2026-10-15", startTime: "14:00" }),
      creneau({ id: "a", date: "2026-10-15", startTime: "08:00" }),
      creneau({ id: "plein", date: "2026-10-13", bookedVolumeM3: 18 }),
      creneau({ id: "mercredi", date: "2026-10-14" }),
      creneau({ id: "tot", date: "2026-10-13" }),
    ];
    const ids = availableSlots(slots, contexte()).map((r) => r.slot.id);
    expect(ids).toEqual(["tot", "a", "b"]);
  });

  it("renvoie une liste vide plutôt qu'une erreur quand rien n'est disponible", () => {
    expect(availableSlots([creneau({ isOpen: false })], contexte())).toEqual([]);
  });
});

describe("isLastPlaces", () => {
  it("ne signale la rareté que lorsqu'elle est réelle", () => {
    const plein = evaluateSlot(creneau({ bookedDeliveries: 4 }), contexte());
    expect(isLastPlaces(plein)).toBe(true);
    const vide = evaluateSlot(creneau(), contexte());
    expect(isLastPlaces(vide)).toBe(false);
  });
});
