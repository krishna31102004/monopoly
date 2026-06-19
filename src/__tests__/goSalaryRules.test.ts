import { describe, it, expect } from "vitest";
import { getGoAward, getGoAwardLogMessage } from "@/lib/game/goSalary";
import type { GameRules } from "@/types/game";
import { DEFAULT_RULES } from "@/types/game";

const rulesOff: GameRules = { ...DEFAULT_RULES, exactGoBonus: false };
const rulesOn: GameRules = { ...DEFAULT_RULES, exactGoBonus: true };

describe("getGoAward — toggle OFF", () => {
  it("passing GO gives $200", () => {
    expect(getGoAward(true, false, rulesOff)).toBe(200);
  });

  it("landing exactly on GO gives $200", () => {
    expect(getGoAward(true, true, rulesOff)).toBe(200);
  });

  it("no GO event gives $0", () => {
    expect(getGoAward(false, false, rulesOff)).toBe(0);
  });
});

describe("getGoAward — toggle ON", () => {
  it("passing GO without landing gives $200", () => {
    expect(getGoAward(true, false, rulesOn)).toBe(200);
  });

  it("landing exactly on GO gives $300", () => {
    expect(getGoAward(true, true, rulesOn)).toBe(300);
  });

  it("no GO event gives $0", () => {
    expect(getGoAward(false, false, rulesOn)).toBe(0);
  });

  it("$300 not $500 — no double payment on exact GO", () => {
    expect(getGoAward(true, true, rulesOn)).toBe(300);
    expect(getGoAward(true, true, rulesOn)).not.toBe(500);
  });
});

describe("getGoAwardLogMessage — toggle OFF", () => {
  it("passing GO log says collected $200", () => {
    const msg = getGoAwardLogMessage("Alice", true, false, rulesOff);
    expect(msg).toContain("$200");
    expect(msg).toContain("Alice");
  });

  it("landing on GO log says collected $200", () => {
    const msg = getGoAwardLogMessage("Alice", true, true, rulesOff);
    expect(msg).toContain("$200");
  });

  it("no GO event returns null", () => {
    expect(getGoAwardLogMessage("Alice", false, false, rulesOff)).toBeNull();
  });
});

describe("getGoAwardLogMessage — toggle ON", () => {
  it("landing exactly on GO log mentions $300", () => {
    const msg = getGoAwardLogMessage("Bob", true, true, rulesOn);
    expect(msg).toContain("$300");
    expect(msg).toContain("Bob");
  });

  it("passing GO without landing log mentions $200", () => {
    const msg = getGoAwardLogMessage("Bob", true, false, rulesOn);
    expect(msg).toContain("$200");
  });

  it("no GO event returns null", () => {
    expect(getGoAwardLogMessage("Bob", false, false, rulesOn)).toBeNull();
  });
});
