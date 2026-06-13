import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { makeGameState, withPlayer, withCash, withChanceDeck, withCommunityChestDeck } from "./helpers/factory";
import type { GameState, GameRules } from "@/types/game";

function withRules(state: GameState, rules: Partial<GameRules>): GameState {
  return { ...state, rules: { ...state.rules, ...rules } };
}

function withFreeParkingPot(state: GameState, amount: number): GameState {
  return { ...state, freeParkingPot: amount };
}

// ── Tax increases the pot ─────────────────────────────────────────────────────

describe("freeParkingCash — tax adds to pot", () => {
  it("adds income tax ($200) to pot when rule is ON", () => {
    // Income Tax is space 4; position 1 + total 3 = space 4
    let state = makeGameState();
    state = withRules(state, { freeParkingCash: true });
    state = withPlayer(state, 0, { position: 1 });

    const result = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 2, total: 3, isDouble: false } });
    expect(result.freeParkingPot).toBe(200);
  });

  it("does NOT add tax to pot when rule is OFF", () => {
    let state = makeGameState();
    state = withRules(state, { freeParkingCash: false });
    state = withPlayer(state, 0, { position: 1 });

    const result = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 2, total: 3, isDouble: false } });
    expect(result.freeParkingPot).toBe(0);
  });

  it("adds luxury tax ($100) to pot when rule is ON", () => {
    // Luxury Tax is space 38; position 35 + total 3 = space 38
    let state = makeGameState();
    state = withRules(state, { freeParkingCash: true });
    state = withPlayer(state, 0, { position: 35 });

    const result = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 2, total: 3, isDouble: false } });
    expect(result.freeParkingPot).toBe(100);
  });
});

// ── Landing on free parking collects pot ──────────────────────────────────────

describe("freeParkingCash — landing on free parking", () => {
  it("player collects pot when landing on free parking (index 20) with rule ON", () => {
    // Free parking is space 20; position 17 + total 3 = space 20
    let state = makeGameState();
    state = withRules(state, { freeParkingCash: true });
    state = withFreeParkingPot(state, 350);
    const playerBefore = state.players[0].cash;
    state = withPlayer(state, 0, { position: 17 });

    const result = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 2, total: 3, isDouble: false } });
    expect(result.players[0].cash).toBe(playerBefore + 350);
    expect(result.freeParkingPot).toBe(0);
  });

  it("player does NOT collect pot when rule is OFF", () => {
    let state = makeGameState();
    state = withRules(state, { freeParkingCash: false });
    state = withFreeParkingPot(state, 350);
    const playerBefore = state.players[0].cash;
    state = withPlayer(state, 0, { position: 17 });

    const result = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 2, total: 3, isDouble: false } });
    expect(result.players[0].cash).toBe(playerBefore);
    expect(result.freeParkingPot).toBe(350); // unchanged
  });

  it("nothing happens when landing on free parking with empty pot even if rule is ON", () => {
    let state = makeGameState();
    state = withRules(state, { freeParkingCash: true });
    state = withFreeParkingPot(state, 0);
    const playerBefore = state.players[0].cash;
    state = withPlayer(state, 0, { position: 17 });

    const result = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 2, total: 3, isDouble: false } });
    expect(result.players[0].cash).toBe(playerBefore);
    expect(result.freeParkingPot).toBe(0);
  });
});

// ── pay-bank card adds to pot ─────────────────────────────────────────────────

describe("freeParkingCash — pay-bank card", () => {
  it("adds card payment to pot when rule is ON", () => {
    // cc-3 is a pay-bank community chest card (amount: 50)
    // Space 2 is community chest; position 39 + total 3 = space 2 (wraps)
    let state = makeGameState();
    state = withRules(state, { freeParkingCash: true });
    state = withPlayer(state, 0, { position: 39 });
    state = withCommunityChestDeck(state, ["cc-3"]);

    const result = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 2, total: 3, isDouble: false } });
    expect(result.freeParkingPot).toBe(50);
  });

  it("does NOT add card payment to pot when rule is OFF", () => {
    let state = makeGameState();
    state = withRules(state, { freeParkingCash: false });
    state = withPlayer(state, 0, { position: 39 });
    state = withCommunityChestDeck(state, ["cc-3"]);

    const result = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 2, total: 3, isDouble: false } });
    expect(result.freeParkingPot).toBe(0);
  });
});
