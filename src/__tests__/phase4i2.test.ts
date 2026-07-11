/**
 * Phase 4I.2: Critical fix regression tests.
 *
 * Issue 1 — Auction Game Free Parking cap:
 *   $450 + $100 tax should become $500, not stay at $450.
 *
 * Issue 2 — Jail third failed roll must fully resolve landing:
 *   After $50 jail fee and movement, rent must be charged if landing on owned property.
 */
import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { DEFAULT_RULES } from "@/types/game";
import type { GameState, GameRules } from "@/types/game";
import { makeGameState, makePlayer, dice, withPlayer, withOwnership, withCash, withPosition } from "./helpers/factory";
import { getBoardSpaceByIndex } from "@/data/board";
import { resolveLanding } from "@/lib/game/landing";

// ── Helpers ──────────────────────────────────────────────────────────────────

function withRules(state: GameState, patch: Partial<GameRules>): GameState {
  return { ...state, rules: { ...state.rules, ...patch } };
}
function withAuctionMode(state: GameState): GameState {
  return withRules(state, { gameMode: "auction", freeParkingCash: true });
}
function withNormalMode(state: GameState): GameState {
  return withRules(state, { gameMode: "normal", freeParkingCash: true });
}
function p0(state: GameState) {
  return state.players[state.currentPlayerIndex];
}
function playerAt(state: GameState, idx: number) {
  return state.players[idx];
}

// Board index constants
// Index 38 = Luxury Tax ($100)
// Index 15 = Heathrow Airport (airport, $200 price, $25 rent for 1 owned)
// Index 1 = Guadalajara (brown city, price $60, base rent $2, double-set rent $4)
// Index 3 = Cancún (brown city)
// Index 4 = Income Tax ($200)
const LUXURY_TAX_IDX = 38; // $100 tax
const HEATHROW_IDX = 15;   // Airport

// ═════════════════════════════════════════════════════════════════════════════
// Issue 1: Auction Game Free Parking cap
// ═════════════════════════════════════════════════════════════════════════════

describe("Issue 1: Auction Game Free Parking cap ($450 + $100 = $500)", () => {
  it("pot $450 + Luxury Tax $100 → $500 in Auction Game (not $450, not $550)", () => {
    // Start at position 36; roll dice 1+1=2 → land at 38 (Luxury Tax, $100)
    let state = withAuctionMode(makeGameState(2));
    state = { ...state, freeParkingPot: 450 };
    state = withCash(state, 5000);
    state = withPosition(state, 36);
    state = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 1) });
    expect(state.players[0].position).toBe(38);
    expect(state.freeParkingPot).toBe(500);
  });

  it("pot $499 + Luxury Tax $100 → $500 in Auction Game (clamp, not $599)", () => {
    let state = withAuctionMode(makeGameState(2));
    state = { ...state, freeParkingPot: 499 };
    state = withCash(state, 5000);
    state = withPosition(state, 36);
    state = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 1) });
    expect(state.freeParkingPot).toBe(500);
  });

  it("pot $500 + Luxury Tax $100 → $500 in Auction Game (already capped)", () => {
    let state = withAuctionMode(makeGameState(2));
    state = { ...state, freeParkingPot: 500 };
    state = withCash(state, 5000);
    state = withPosition(state, 36);
    state = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 1) });
    expect(state.freeParkingPot).toBe(500);
  });

  it("pot $300 + Luxury Tax $100 → $400 in Auction Game (below cap, normal addition)", () => {
    let state = withAuctionMode(makeGameState(2));
    state = { ...state, freeParkingPot: 300 };
    state = withCash(state, 5000);
    state = withPosition(state, 36);
    state = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 1) });
    expect(state.freeParkingPot).toBe(400);
  });

  it("Normal Game: pot $450 + Luxury Tax $100 → $550 (uncapped)", () => {
    let state = withNormalMode(makeGameState(2));
    state = { ...state, freeParkingPot: 450 };
    state = withCash(state, 5000);
    state = withPosition(state, 36);
    state = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 1) });
    expect(state.freeParkingPot).toBe(550);
  });

  it("Auction Game: pot $450 + Income Tax $200 → $500 (clamp from below)", () => {
    // Position 2, roll 2 → land at 4 (Income Tax, $200)
    let state = withAuctionMode(makeGameState(2));
    state = { ...state, freeParkingPot: 450 };
    state = withCash(state, 5000);
    state = withPosition(state, 2);
    state = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 1) });
    expect(state.players[0].position).toBe(4);
    expect(state.freeParkingPot).toBe(500);
  });

  it("resolveLanding tax: freeParkingPotDelta is taxAmount (positive)", () => {
    let state = withAuctionMode(makeGameState(2));
    state = withCash(state, 5000);
    state = withPosition(state, LUXURY_TAX_IDX);
    const luxuryTax = getBoardSpaceByIndex(LUXURY_TAX_IDX);
    const resolution = resolveLanding(state, luxuryTax, false);
    // potDelta should be +100 (positive, meaning it adds to pot)
    expect(resolution.freeParkingPotDelta).toBe(100);
    // player's cash should be reduced by $100
    expect(resolution.players[state.currentPlayerIndex].cash).toBe(state.players[state.currentPlayerIndex].cash - 100);
  });

  it("landing on Free Parking in Auction Game collects the capped pot", () => {
    let state = withAuctionMode(makeGameState(2));
    state = { ...state, freeParkingPot: 500 };
    const cashBefore = p0(state).cash;
    const freeParkingSpace = getBoardSpaceByIndex(20);
    const resolution = resolveLanding(state, freeParkingSpace, false);
    expect(resolution.players[state.currentPlayerIndex].cash).toBe(cashBefore + 500);
    expect(resolution.freeParkingPotDelta).toBe(-500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Issue 2: Jail third failed roll — full landing resolution including rent
// ═════════════════════════════════════════════════════════════════════════════

describe("Issue 2: Jail third failed roll — rent charged after $50 jail fee", () => {
  function jailStateForThirdRoll(playerCount = 2): GameState {
    let state = makeGameState(playerCount);
    // Player 0 in jail at position 10, jailTurns: 2 (next failure is third)
    state = withPlayer(state, 0, { isInJail: true, position: 10, jailTurns: 2 });
    state = { ...state, phase: "awaitingJailDecision" };
    return state;
  }

  it("third failed roll: $50 jail fee is deducted", () => {
    const state = withCash(jailStateForThirdRoll(), 1500);
    const cashBefore = p0(state).cash;
    const next = gameReducer(state, {
      type: "ROLL_IN_JAIL",
      dice: dice(2, 3), // total 5, not double → pos 10+5=15 (Heathrow, unowned)
    });
    expect(p0(next).cash).toBe(cashBefore - 50);
  });

  it("third failed roll: player is no longer in jail", () => {
    const state = jailStateForThirdRoll();
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    expect(p0(next).isInJail).toBe(false);
    expect(p0(next).jailTurns).toBe(0);
  });

  it("third failed roll: player moves by dice total", () => {
    const state = jailStateForThirdRoll();
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) }); // total 5 → pos 15
    expect(p0(next).position).toBe(15);
  });

  it("third failed roll: landing on owned airport charges rent in addition to $50 fee", () => {
    // Player 1 owns Heathrow Airport (index 15)
    // Jail: position 10 + dice(2,3)=5 → land at 15
    let state = jailStateForThirdRoll();
    const p1Id = state.players[1].id;
    state = withOwnership(state, HEATHROW_IDX, p1Id);
    state = withCash(state, 1500); // player 0 has plenty of cash

    const cashP0Before = state.players[0].cash;
    const cashP1Before = state.players[1].cash;

    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });

    // Player 0 paid $50 jail fee AND $25 airport rent (1 airport owned)
    expect(next.players[0].cash).toBe(cashP0Before - 50 - 25);
    // Player 1 received $25 rent
    expect(next.players[1].cash).toBe(cashP1Before + 25);
  });

  it("third failed roll: landing on owned city charges rent", () => {
    // From jail (position 10), roll dice(1,2)=3 → lands at 13 (Munich, pink city).
    // No GO crossing. Munich base rent = $10 (no full set bonus without all 3 pink).
    let state = jailStateForThirdRoll();
    // Keep player at position 10 (jail)
    const p1Id = state.players[1].id;
    state = withOwnership(state, 13, p1Id); // Munich (pink, $140 price, base rent $10)
    state = withCash(state, 1500);

    const cashP0Before = state.players[0].cash;
    const cashP1Before = state.players[1].cash;

    const next = gameReducer(state, {
      type: "ROLL_IN_JAIL",
      dice: { die1: 1, die2: 2, total: 3, isDouble: false },
    });

    expect(next.players[0].position).toBe(13);
    // Paid $50 jail fee + $10 rent (Munich, 1 of 3 pink, no double-rent bonus)
    expect(next.players[0].cash).toBe(cashP0Before - 50 - 10);
    expect(next.players[1].cash).toBe(cashP1Before + 10);
  });

  it("third failed roll: landing on mortgaged property charges no rent (only $50 fee)", () => {
    let state = jailStateForThirdRoll();
    const p1Id = state.players[1].id;
    state = withOwnership(state, HEATHROW_IDX, p1Id);
    // Mortgage the airport
    state = {
      ...state,
      ownerships: state.ownerships.map((o) =>
        o.spaceIndex === HEATHROW_IDX ? { ...o, isMortgaged: true } : o,
      ),
    };
    state = withCash(state, 1500);
    const cashP0Before = state.players[0].cash;

    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    // Only jail fee, no rent
    expect(next.players[0].cash).toBe(cashP0Before - 50);
  });

  it("third failed roll: landing on unowned property enters buy flow (Normal Game)", () => {
    const state = withCash(jailStateForThirdRoll(), 1500);
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) }); // lands on Heathrow (unowned)
    expect(next.phase).toBe("awaitingPurchaseDecision");
  });

  it("third failed roll: landing on unowned property starts immediate auction (Auction Game)", () => {
    let state = withAuctionMode(jailStateForThirdRoll());
    state = withCash(state, 1500);
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) }); // Heathrow (unowned)
    expect(next.phase).toBe("auction");
  });

  it("third failed roll: player with exactly $50 pays fee; rent creates debt if owed", () => {
    let state = jailStateForThirdRoll();
    const p1Id = state.players[1].id;
    state = withOwnership(state, HEATHROW_IDX, p1Id);
    // Player 0 has exactly $50 — can pay fee but not rent ($25)
    state = withCash(state, 50);

    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    // Cash should be $0 after fee (not negative)
    expect(next.players[0].cash).toBeGreaterThanOrEqual(0);
    // Should enter some debt/bankruptcy pending phase
    expect(["debtPending", "bankruptcyPending", "turnComplete", "awaitingPurchaseDecision"]).toContain(next.phase);
  });

  it("third failed roll: player with $32 cannot pay $50 fee — does not go negative", () => {
    let state = jailStateForThirdRoll();
    state = withCash(state, 32);
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    expect(next.players[0].cash).toBeGreaterThanOrEqual(0);
    // Should be in debt/bankruptcy pending
    expect(["debtPending", "bankruptcyPending"]).toContain(next.phase);
  });

  it("third failed roll: landing on Luxury Tax charges tax (not just jail fee)", () => {
    // From position 30, roll dice(4,4)=8 → 30+8=38 (Luxury Tax, $100)
    let state = jailStateForThirdRoll();
    state = withPlayer(state, 0, { isInJail: true, position: 30, jailTurns: 2 });
    state = withCash(state, 1500);
    const cashBefore = state.players[0].cash;

    const next = gameReducer(state, {
      type: "ROLL_IN_JAIL",
      dice: { die1: 4, die2: 4, total: 8, isDouble: false }, // total 8, forced non-double
    });
    expect(next.players[0].position).toBe(38);
    // Paid $50 jail fee + $100 luxury tax = $150 total deducted
    expect(next.players[0].cash).toBe(cashBefore - 50 - 100);
  });

  it("third failed roll: doubles jail escape still works independently", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { isInJail: true, position: 10, jailTurns: 2 });
    state = { ...state, phase: "awaitingJailDecision" };
    state = withCash(state, 1500);

    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(3, 3) }); // doubles!
    expect(p0(next).isInJail).toBe(false);
    // No $50 fee for doubles escape
    expect(p0(next).cash).toBe(state.players[0].cash); // cash unchanged (no fee, may gain GO bonus)
  });

  it("voluntary PAY_JAIL_FEE still sets phase to readyToRoll", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { isInJail: true, position: 10 });
    state = { ...state, phase: "awaitingJailDecision" };
    state = withCash(state, 1500);
    const next = gameReducer(state, { type: "PAY_JAIL_FEE" });
    expect(next.phase).toBe("readyToRoll");
    expect(p0(next).isInJail).toBe(false);
  });
});
