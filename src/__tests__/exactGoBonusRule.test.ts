import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { createInitialGameState } from "@/lib/game/createInitialGameState";
import { drawAndApplyCard } from "@/lib/game/cards";
import type { GameState } from "@/types/game";
import { DEFAULT_RULES } from "@/types/game";

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialGameState(
    [{ name: "Alice", token: "hat" as const, tokenLabel: "Top Hat", color: "#f00" }],
    { ...DEFAULT_RULES, exactGoBonus: false },
  );
  return { ...base, phase: "readyToRoll", ...overrides };
}

function makeDice(die1: number, die2: number) {
  return { die1, die2, total: die1 + die2, isDouble: die1 === die2 };
}

// ─── Toggle OFF ───────────────────────────────────────────────────────────────

describe("dice movement — exactGoBonus OFF", () => {
  it("passing GO from position 36, roll 7 → lands pos 3, gets $200", () => {
    // 36 + 7 = 43 % 40 = 3 (Cancún, a city — safe landing)
    const state = makeState();
    state.players[0].position = 36;
    state.players[0].cash = 1000;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: makeDice(4, 3) });
    expect(next.players[0].position).toBe(3);
    expect(next.players[0].cash).toBe(1200);
  });

  it("landing exactly on GO from pos 38, roll 2 → pos 0, gets $200", () => {
    const state = makeState();
    state.players[0].position = 38;
    state.players[0].cash = 1000;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: makeDice(1, 1) });
    expect(next.players[0].position).toBe(0);
    expect(next.players[0].cash).toBe(1200);
  });

  it("landing exactly on GO from pos 37, roll 3 → pos 0, gets $200", () => {
    const state = makeState();
    state.players[0].position = 37;
    state.players[0].cash = 1000;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: makeDice(2, 1) });
    expect(next.players[0].position).toBe(0);
    expect(next.players[0].cash).toBe(1200);
  });

  it("not passing GO → no salary", () => {
    const state = makeState();
    state.players[0].position = 5;
    state.players[0].cash = 1000;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: makeDice(2, 2) });
    expect(next.players[0].position).toBe(9);
    expect(next.players[0].cash).toBe(1000);
  });
});

// ─── Toggle ON ────────────────────────────────────────────────────────────────

describe("dice movement — exactGoBonus ON", () => {
  function makeStateOn(overrides: Partial<GameState> = {}): GameState {
    const base = createInitialGameState(
      [{ name: "Alice", token: "hat" as const, tokenLabel: "Top Hat", color: "#f00" }],
      { ...DEFAULT_RULES, exactGoBonus: true },
    );
    return { ...base, phase: "readyToRoll", ...overrides };
  }

  it("passing GO without landing (pos 36, roll 7) → $200", () => {
    // 36 + 7 = 43 % 40 = 3 (Cancún — safe landing, not GO)
    const state = makeStateOn();
    state.players[0].position = 36;
    state.players[0].cash = 1000;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: makeDice(4, 3) });
    expect(next.players[0].position).toBe(3);
    expect(next.players[0].cash).toBe(1200);
  });

  it("landing exactly on GO (pos 38, roll 2) → $300, not $200 or $500", () => {
    const state = makeStateOn();
    state.players[0].position = 38;
    state.players[0].cash = 1000;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: makeDice(1, 1) });
    expect(next.players[0].position).toBe(0);
    expect(next.players[0].cash).toBe(1300);
  });

  it("landing exactly on GO (pos 37, roll 3) → $300", () => {
    const state = makeStateOn();
    state.players[0].position = 37;
    state.players[0].cash = 1000;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: makeDice(2, 1) });
    expect(next.players[0].position).toBe(0);
    expect(next.players[0].cash).toBe(1300);
  });

  it("log mentions $300 for exact GO landing", () => {
    const state = makeStateOn();
    state.players[0].position = 38;
    state.players[0].cash = 1000;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: makeDice(1, 1) });
    const logText = next.gameLog.map((e) => e.message).join(" ");
    expect(logText).toContain("$300");
  });

  it("log mentions $200 for pass-only (not exact landing)", () => {
    const state = makeStateOn();
    state.players[0].position = 36;
    state.players[0].cash = 1000;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: makeDice(4, 3) });
    const logText = next.gameLog.map((e) => e.message).join(" ");
    expect(logText).toContain("$200");
    expect(logText).not.toContain("$300");
  });

  it("no GO event → no salary", () => {
    const state = makeStateOn();
    state.players[0].position = 5;
    state.players[0].cash = 1000;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: makeDice(2, 2) });
    expect(next.players[0].cash).toBe(1000);
  });
});

// ─── advance-go card ─────────────────────────────────────────────────────────

describe("advance-go card", () => {
  it("toggle OFF: advance to GO from pos 5 → $200", () => {
    const state = makeState();
    state.players[0].position = 5;
    state.players[0].cash = 1000;
    state.chanceDeck = ["chance-1", ...state.chanceDeck.filter((id) => id !== "chance-1")];
    const next = drawAndApplyCard(state, "chance", false);
    expect(next.players[0].position).toBe(0);
    expect(next.players[0].cash).toBe(1200);
  });

  it("toggle ON: advance to GO from pos 5 → $300", () => {
    const state = makeState();
    state.rules = { ...state.rules, exactGoBonus: true };
    state.players[0].position = 5;
    state.players[0].cash = 1000;
    state.chanceDeck = ["chance-1", ...state.chanceDeck.filter((id) => id !== "chance-1")];
    const next = drawAndApplyCard(state, "chance", false);
    expect(next.players[0].position).toBe(0);
    expect(next.players[0].cash).toBe(1300);
  });

  it("toggle ON: already on GO → no salary (not passing GO)", () => {
    const state = makeState();
    state.rules = { ...state.rules, exactGoBonus: true };
    state.players[0].position = 0;
    state.players[0].cash = 1000;
    state.chanceDeck = ["chance-1", ...state.chanceDeck.filter((id) => id !== "chance-1")];
    const next = drawAndApplyCard(state, "chance", false);
    expect(next.players[0].position).toBe(0);
    expect(next.players[0].cash).toBe(1000);
  });

  it("toggle ON: advance-to card that passes GO gives $200 (not $300 since not landing on GO)", () => {
    // chance-2: advance to JFK (space 5) from pos 20 — passes GO, lands on 5 not GO
    const state = makeState();
    state.rules = { ...state.rules, exactGoBonus: true };
    state.players[0].position = 20;
    state.players[0].cash = 1000;
    state.chanceDeck = ["chance-2", ...state.chanceDeck.filter((id) => id !== "chance-2")];
    const next = drawAndApplyCard(state, "chance", false);
    expect(next.players[0].position).toBe(5);
    expect(next.players[0].cash).toBe(1200);
  });
});

// ─── Rule defaults / persistence ─────────────────────────────────────────────

describe("rule defaults", () => {
  it("DEFAULT_RULES has exactGoBonus = false", () => {
    expect(DEFAULT_RULES.exactGoBonus).toBe(false);
  });

  it("createInitialGameState uses provided rules including exactGoBonus", () => {
    const state = createInitialGameState(
      [{ name: "A", token: "hat" as const, tokenLabel: "Hat", color: "#f00" }],
      { ...DEFAULT_RULES, exactGoBonus: true },
    );
    expect(state.rules.exactGoBonus).toBe(true);
  });
});
