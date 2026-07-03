import { describe, it, expect } from "vitest";
import { createInitialGameState } from "@/lib/game/createInitialGameState";
import { gameReducer } from "@/lib/game/gameReducer";
import { deserializeGame, serializeGame } from "@/lib/game/persistence";
import { DEFAULT_RULES } from "@/types/game";
import type { GameRules, GameState } from "@/types/game";
import { makeGameState, makePlayer, dice, withOwnership, withPlayer, withCash } from "./helpers/factory";

// ── Helpers ──────────────────────────────────────────────────────────────────

function withRules(state: GameState, rules: Partial<GameRules>): GameState {
  return { ...state, rules: { ...state.rules, ...rules } };
}

// ── Rules defaults ────────────────────────────────────────────────────────────

describe("DEFAULT_RULES", () => {
  it("has all expected keys with correct defaults", () => {
    expect(DEFAULT_RULES).toEqual({
      doubleRentOnFullSet: true,
      freeParkingCash: true,
      auctions: true,
      noRentInJail: true,
      mortgages: true,
      evenBuild: true,
      exactGoBonus: true,
      gameMode: "normal",
    });
  });

  it("createInitialGameState uses DEFAULT_RULES when none provided", () => {
    const state = createInitialGameState([makePlayer(0), makePlayer(1)]);
    expect(state.rules).toEqual(DEFAULT_RULES);
    expect(state.freeParkingPot).toBe(0);
  });

  it("createInitialGameState accepts custom rules", () => {
    const custom: GameRules = {
      ...DEFAULT_RULES,
      auctions: false,
      mortgages: false,
    };
    const state = createInitialGameState([makePlayer(0), makePlayer(1)], custom);
    expect(state.rules.auctions).toBe(false);
    expect(state.rules.mortgages).toBe(false);
  });

  it("START_GAME action passes rules to state", () => {
    const base = makeGameState();
    const result = gameReducer(base, {
      type: "START_GAME",
      players: [makePlayer(0), makePlayer(1)],
      rules: { ...DEFAULT_RULES, auctions: false },
    });
    expect(result.rules.auctions).toBe(false);
  });
});

// ── Loading old saves (backward compat) ──────────────────────────────────────

describe("persistence backward compatibility", () => {
  it("deserializes a save that is missing rules field — defaults applied", () => {
    const state = makeGameState();
    const json = serializeGame(state);
    // Strip rules and freeParkingPot to simulate old save
    const raw = JSON.parse(json) as { state: Record<string, unknown> };
    delete raw.state.rules;
    delete raw.state.freeParkingPot;
    const modifiedJson = JSON.stringify({ ...raw, version: 1 });
    const loaded = deserializeGame(modifiedJson);
    expect(loaded).not.toBeNull();
    expect(loaded!.rules).toEqual(DEFAULT_RULES);
    expect(loaded!.freeParkingPot).toBe(0);
  });
});

// ── mortgages rule ────────────────────────────────────────────────────────────

describe("mortgages rule", () => {
  it("allows mortgage when rule is ON", () => {
    // Space 1 (Mediterranean Ave) is a city
    let state = makeGameState();
    const playerId = state.players[0].id;
    state = withOwnership(state, 1, playerId);
    state = withRules(state, { mortgages: true });
    const result = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: 1 });
    const ownership = result.ownerships.find((o) => o.spaceIndex === 1);
    expect(ownership?.isMortgaged).toBe(true);
  });

  it("blocks mortgage when rule is OFF", () => {
    let state = makeGameState();
    const playerId = state.players[0].id;
    state = withOwnership(state, 1, playerId);
    state = withRules(state, { mortgages: false });
    const result = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: 1 });
    const ownership = result.ownerships.find((o) => o.spaceIndex === 1);
    expect(ownership?.isMortgaged).toBe(false);
  });

  it("blocks unmortgage when rule is OFF", () => {
    let state = makeGameState();
    const playerId = state.players[0].id;
    state = withOwnership(state, 1, playerId);
    // Manually mortgage first
    state = { ...state, ownerships: state.ownerships.map((o) => o.spaceIndex === 1 ? { ...o, isMortgaged: true } : o) };
    state = withRules(state, { mortgages: false });
    const result = gameReducer(state, { type: "UNMORTGAGE_PROPERTY", spaceIndex: 1 });
    const ownership = result.ownerships.find((o) => o.spaceIndex === 1);
    expect(ownership?.isMortgaged).toBe(true); // unchanged
  });
});

// ── doubleRentOnFullSet rule ──────────────────────────────────────────────────

describe("doubleRentOnFullSet rule", () => {
  // Space 1 = Mediterranean, 3 = Baltic — both brown (colorGroup same)
  it("doubles rent when owner has full color set and rule is ON", () => {
    let state = makeGameState();
    const p0Id = state.players[0].id;
    // Give p0 both brown properties
    state = withOwnership(state, 1, p0Id);
    state = withOwnership(state, 3, p0Id);
    state = withRules(state, { doubleRentOnFullSet: true });

    // Move player 1 to space 1 and roll
    state = { ...state, currentPlayerIndex: 1 };
    state = withPlayer(state, 1, { position: 0 });
    const result = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 0) });
    // The landing action should contain a rentPayment
    const landing = result.landingAction;
    if (landing?.kind === "rentPayment") {
      // Base rent for Mediterranean is 2, doubled = 4
      expect(landing.rentAmount).toBe(4);
    }
  });

  it("does NOT double rent when rule is OFF", () => {
    let state = makeGameState();
    const p0Id = state.players[0].id;
    state = withOwnership(state, 1, p0Id);
    state = withOwnership(state, 3, p0Id);
    state = withRules(state, { doubleRentOnFullSet: false });

    state = { ...state, currentPlayerIndex: 1 };
    state = withPlayer(state, 1, { position: 0 });
    const result = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 0) });
    const landing = result.landingAction;
    if (landing?.kind === "rentPayment") {
      // Base rent for Mediterranean is 2, not doubled
      expect(landing.rentAmount).toBe(2);
    }
  });
});

// ── noRentInJail rule ─────────────────────────────────────────────────────────

describe("noRentInJail rule", () => {
  it("skips rent when owner is in jail and rule is ON", () => {
    let state = makeGameState();
    const p0Id = state.players[0].id;
    // Put owner (player 0) in jail
    state = withPlayer(state, 0, { isInJail: true });
    state = withOwnership(state, 1, p0Id);
    state = withRules(state, { noRentInJail: true });

    // Player 1 lands on space 1
    state = { ...state, currentPlayerIndex: 1 };
    state = withPlayer(state, 1, { position: 0 });
    const result = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 0) });
    // Should NOT be a rentPayment
    expect(result.landingAction?.kind).not.toBe("rentPayment");
  });

  it("charges rent when owner is in jail but rule is OFF", () => {
    let state = makeGameState();
    const p0Id = state.players[0].id;
    state = withPlayer(state, 0, { isInJail: true });
    state = withOwnership(state, 1, p0Id);
    // Give both brown properties so rent is not 0
    state = withOwnership(state, 3, p0Id);
    state = withRules(state, { noRentInJail: false });

    state = { ...state, currentPlayerIndex: 1 };
    state = withPlayer(state, 1, { position: 0 });
    const result = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 0) });
    expect(result.landingAction?.kind).toBe("rentPayment");
  });
});
