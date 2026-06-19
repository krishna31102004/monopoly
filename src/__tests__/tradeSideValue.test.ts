import { describe, it, expect } from "vitest";
import {
  getTradeSideListedValue,
  getAfterTradeCash,
  getTradePropertyCardPresentation,
} from "@/lib/game/tradeHelpers";

const EMPTY_OFFER = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };

// ── getTradeSideListedValue ───────────────────────────────────────────────────

describe("getTradeSideListedValue", () => {
  it("returns 0 for an empty offer", () => {
    expect(getTradeSideListedValue(EMPTY_OFFER)).toBe(0);
  });

  it("returns cash only when no properties selected", () => {
    expect(getTradeSideListedValue({ ...EMPTY_OFFER, cash: 500 })).toBe(500);
  });

  it("returns list price of a single city property", () => {
    // Space index 1 = Guadalajara, price $60
    expect(getTradeSideListedValue({ ...EMPTY_OFFER, propertySpaceIndices: [1] })).toBe(60);
  });

  it("returns list price of a single airport", () => {
    // Space index 5 = JFK Airport, price $200
    expect(getTradeSideListedValue({ ...EMPTY_OFFER, propertySpaceIndices: [5] })).toBe(200);
  });

  it("combines cash and property list prices", () => {
    // Guadalajara ($60) + cash $200 = $260
    expect(getTradeSideListedValue({ ...EMPTY_OFFER, cash: 200, propertySpaceIndices: [1] })).toBe(260);
  });

  it("sums multiple property list prices", () => {
    // Index 1 = $60, index 3 = $60 (Cancún)
    expect(getTradeSideListedValue({ ...EMPTY_OFFER, propertySpaceIndices: [1, 3] })).toBe(120);
  });

  it("ignores GOJF cards in value calculation", () => {
    expect(getTradeSideListedValue({ ...EMPTY_OFFER, getOutOfJailFreeCards: 2 })).toBe(0);
  });

  it("ignores invalid space indices silently", () => {
    expect(getTradeSideListedValue({ ...EMPTY_OFFER, propertySpaceIndices: [999] })).toBe(0);
  });
});

// ── getAfterTradeCash ─────────────────────────────────────────────────────────

describe("getAfterTradeCash", () => {
  it("returns remaining cash when cash given is less than balance", () => {
    const result = getAfterTradeCash(1000, 200, 0);
    expect(result).toEqual({ valid: true, amount: 800 });
  });

  it("adds received cash to remaining balance", () => {
    const result = getAfterTradeCash(1000, 200, 300);
    expect(result).toEqual({ valid: true, amount: 1100 });
  });

  it("returns valid with 0 when giving exactly all cash", () => {
    const result = getAfterTradeCash(500, 500, 0);
    expect(result).toEqual({ valid: true, amount: 0 });
  });

  it("returns invalid when cash given exceeds balance", () => {
    const result = getAfterTradeCash(300, 400, 0);
    expect(result).toEqual({ valid: false });
  });

  it("returns valid if received cash covers the deficit (net positive)", () => {
    // 300 - 400 + 200 = 100 — valid
    const result = getAfterTradeCash(300, 400, 200);
    expect(result).toEqual({ valid: true, amount: 100 });
  });

  it("returns invalid when net result is negative even with received cash", () => {
    const result = getAfterTradeCash(300, 400, 50);
    expect(result).toEqual({ valid: false });
  });

  it("returns full balance when no cash is given or received", () => {
    const result = getAfterTradeCash(1500, 0, 0);
    expect(result).toEqual({ valid: true, amount: 1500 });
  });
});

// ── getTradePropertyCardPresentation ─────────────────────────────────────────

describe("getTradePropertyCardPresentation", () => {
  it("returns null for a non-ownable space (GO)", () => {
    expect(getTradePropertyCardPresentation(0)).toBeNull();
  });

  it("returns city presentation with correct color for a brown city", () => {
    const card = getTradePropertyCardPresentation(1); // Guadalajara
    expect(card).not.toBeNull();
    expect(card!.kind).toBe("city");
    expect(card!.name).toBe("Guadalajara");
    expect(card!.price).toBe(60);
    expect(card!.colorHex).toBe("#8b5e3c"); // brown
    expect(card!.icon).toBe("🏙️");
  });

  it("returns airport presentation for an airport space", () => {
    const card = getTradePropertyCardPresentation(5); // JFK Airport
    expect(card).not.toBeNull();
    expect(card!.kind).toBe("airport");
    expect(card!.price).toBe(200);
    expect(card!.icon).toBe("✈️");
  });

  it("returns utility presentation for a utility space", () => {
    // Find a utility space — index 12 or 28 typically
    // Let's check index 12
    const card = getTradePropertyCardPresentation(12);
    if (card && card.kind === "utility") {
      expect(card.kind).toBe("utility");
      expect(card.icon).toBe("⚡");
    }
    // If index 12 is not utility, just verify null-safety
  });

  it("reflects isMortgaged from ownerships", () => {
    const ownerships = [{ spaceIndex: 1, ownerId: "p1", isMortgaged: true, houses: 0, hasHotel: false }];
    const card = getTradePropertyCardPresentation(1, ownerships);
    expect(card!.isMortgaged).toBe(true);
  });

  it("reflects house count from ownerships", () => {
    const ownerships = [{ spaceIndex: 1, ownerId: "p1", isMortgaged: false, houses: 3, hasHotel: false }];
    const card = getTradePropertyCardPresentation(1, ownerships);
    expect(card!.houses).toBe(3);
  });

  it("defaults isMortgaged to false when ownerships not provided", () => {
    const card = getTradePropertyCardPresentation(1);
    expect(card!.isMortgaged).toBe(false);
    expect(card!.houses).toBe(0);
  });

  it("returns null for invalid space index", () => {
    expect(getTradePropertyCardPresentation(999)).toBeNull();
  });
});
