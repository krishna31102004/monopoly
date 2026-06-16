import { describe, it, expect } from "vitest";
import { drawAndApplyCard } from "@/lib/game/cards";
import { chanceCards, communityChestCards } from "@/data/cards";
import {
  makeGameState,
  withPosition,
  withChanceDeck,
  withOwnership,
  withMortgage,
  withCash,
  withPlayer,
  currentPlayer,
  playerById,
} from "./helpers/factory";

const JFK = 5;
const HEATHROW = 15;
const ELECTRIC = 12;
const WATER_WORKS = 28;

function ownAllAirports(state: ReturnType<typeof makeGameState>, ownerId: string) {
  return [5, 15, 25, 35].reduce((s, idx) => withOwnership(s, idx, ownerId), state);
}

function ownAirports(state: ReturnType<typeof makeGameState>, ownerId: string, count: number) {
  return [5, 15, 25, 35].slice(0, count).reduce((s, idx) => withOwnership(s, idx, ownerId), state);
}

// ── Bug regression: nearest Airport card must double the rent ──────────────────

describe("Regression: nearest Airport card pays double rent", () => {
  it("Ansh owns all 4 airports, kb draws nearest-airport card, lands on JFK, pays $400", () => {
    let state = makeGameState(2);
    const ansh = state.players[1].id; // not current player
    state = ownAllAirports(state, ansh);
    state = withPosition(state, 3); // kb (current player) near JFK
    state = withChanceDeck(state, ["chance-4"]);

    const kbCashBefore = currentPlayer(state).cash;
    const anshCashBefore = playerById(state, ansh).cash;

    const next = drawAndApplyCard(state, "chance", false);

    expect(currentPlayer(next).position).toBe(JFK);
    expect(currentPlayer(next).cash).toBe(kbCashBefore - 400);
    expect(playerById(next, ansh).cash).toBe(anshCashBefore + 400);
    expect(currentPlayer(next).cash).toBeGreaterThanOrEqual(0);
  });
});

describe("Nearest Airport card — double rent by ownership count", () => {
  const cases: Array<[number, number, number]> = [
    [1, 25, 50],
    [2, 50, 100],
    [3, 100, 200],
    [4, 200, 400],
  ];

  for (const [count, normalRent, doubledRent] of cases) {
    it(`${count} airport(s) owned: normal $${normalRent}, card rent $${doubledRent}`, () => {
      let state = makeGameState(2);
      const owner = state.players[1].id;
      state = ownAirports(state, owner, count);
      state = withPosition(state, 3);
      state = withChanceDeck(state, ["chance-4"]);

      const payerCashBefore = currentPlayer(state).cash;
      const next = drawAndApplyCard(state, "chance", false);

      expect(currentPlayer(next).cash).toBe(payerCashBefore - doubledRent);
    });
  }

  it("unowned nearest airport triggers purchase decision, not rent", () => {
    const state = withChanceDeck(withPosition(makeGameState(2), 3), ["chance-4"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(next.phase).toBe("awaitingPurchaseDecision");
    expect(next.landingAction?.kind).toBe("purchaseDecision");
  });

  it("self-owned nearest airport charges $0", () => {
    let state = makeGameState(2);
    const selfId = state.players[0].id;
    state = ownAllAirports(state, selfId);
    state = withPosition(state, 3);
    state = withChanceDeck(state, ["chance-4"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore);
  });

  it("mortgaged nearest airport charges $0", () => {
    let state = makeGameState(2);
    const owner = state.players[1].id;
    state = ownAllAirports(state, owner);
    state = withMortgage(state, JFK);
    state = withPosition(state, 3);
    state = withChanceDeck(state, ["chance-4"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore);
  });

  it("insufficient cash for doubled rent creates debt/payment-pending without going negative", () => {
    let state = makeGameState(2);
    const owner = state.players[1].id;
    state = ownAllAirports(state, owner); // doubled rent = $400
    state = withPosition(state, 3);
    state = withCash(state, 100); // can't afford $400
    state = withChanceDeck(state, ["chance-4"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(100); // unchanged, no negative
    expect(currentPlayer(next).cash).toBeGreaterThanOrEqual(0);
    expect(next.phase).toBe("bankruptcyPending");
    expect(next.bankruptcy?.amountOwed).toBe(400);
  });

  it("landing log/action mentions doubled rent reason and full doubled amount", () => {
    let state = makeGameState(2);
    const owner = state.players[1].id;
    state = ownAllAirports(state, owner);
    state = withPosition(state, 3);
    state = withChanceDeck(state, ["chance-4"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(next.landingAction?.message).toMatch(/\$400/);
    expect(next.landingAction?.message).toMatch(/doubled by card/i);
    const found = next.gameLog.some((e) => e.message.includes("$400") && /doubled by card/i.test(e.message));
    expect(found).toBe(true);
  });
});

// ── Nearest Utility card ────────────────────────────────────────────────────

describe("Nearest Utility card — pay 10x dice regardless of ownership count", () => {
  it("unowned nearest utility triggers purchase decision", () => {
    const state = withChanceDeck(withPosition(makeGameState(2), 5), ["chance-6"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(next.phase).toBe("awaitingPurchaseDecision");
  });

  it("owned utility (1 owned) charges 10x last dice roll, not the normal 4x rate", () => {
    let state = makeGameState(2);
    const owner = state.players[1].id;
    state = withOwnership(state, ELECTRIC, owner); // owner has only 1 utility
    state = withPosition(state, 5);
    state = { ...state, diceRoll: { die1: 3, die2: 4, total: 7, isDouble: false } };
    state = withChanceDeck(state, ["chance-6"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    // 10x7 = 70, NOT the normal single-utility 4x7=28
    expect(currentPlayer(next).cash).toBe(cashBefore - 70);
  });

  it("owned utility (both owned) still charges 10x dice (same as normal in this case)", () => {
    let state = makeGameState(2);
    const owner = state.players[1].id;
    state = withOwnership(state, ELECTRIC, owner);
    state = withOwnership(state, WATER_WORKS, owner);
    state = withPosition(state, 5);
    state = { ...state, diceRoll: { die1: 2, die2: 3, total: 5, isDouble: false } };
    state = withChanceDeck(state, ["chance-6"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore - 50);
  });

  it("self-owned nearest utility charges $0", () => {
    let state = makeGameState(2);
    const selfId = state.players[0].id;
    state = withOwnership(state, ELECTRIC, selfId);
    state = withPosition(state, 5);
    state = withChanceDeck(state, ["chance-6"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore);
  });

  it("mortgaged nearest utility charges $0", () => {
    let state = makeGameState(2);
    const owner = state.players[1].id;
    state = withOwnership(state, ELECTRIC, owner);
    state = withMortgage(state, ELECTRIC);
    state = withPosition(state, 5);
    state = withChanceDeck(state, ["chance-6"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore);
  });

  it("insufficient cash for utility card rent creates debt/payment-pending without going negative", () => {
    let state = makeGameState(2);
    const owner = state.players[1].id;
    state = withOwnership(state, ELECTRIC, owner);
    state = withOwnership(state, WATER_WORKS, owner);
    state = withPosition(state, 5);
    state = { ...state, diceRoll: { die1: 6, die2: 6, total: 12, isDouble: true } }; // 10x12=120
    state = withCash(state, 50);
    state = withChanceDeck(state, ["chance-6"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(50);
    expect(currentPlayer(next).cash).toBeGreaterThanOrEqual(0);
    expect(next.phase).toBe("bankruptcyPending");
    expect(next.bankruptcy?.amountOwed).toBe(120);
  });
});

// ── Movement card audit: rent/buy/self-own/mortgage paths all reachable ────────

describe("Movement card audit — advance-to card resolves landing normally", () => {
  it("advance-to JFK charges normal (non-doubled) rent when owned", () => {
    let state = makeGameState(2);
    const owner = state.players[1].id;
    state = withOwnership(state, JFK, owner); // 1 airport owned → $25 normal
    state = withPosition(state, 1); // chance-2 targets JFK(5), no GO pass
    state = withChanceDeck(state, ["chance-2"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore - 25); // normal, not doubled
  });

  it("advance-to unowned property triggers buy/decline flow", () => {
    const state = withChanceDeck(withPosition(makeGameState(2), 1), ["chance-2"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(next.phase).toBe("awaitingPurchaseDecision");
  });

  it("advance-to self-owned property charges $0", () => {
    let state = makeGameState(2);
    const selfId = state.players[0].id;
    state = withOwnership(state, JFK, selfId);
    state = withPosition(state, 1);
    state = withChanceDeck(state, ["chance-2"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore);
  });

  it("advance-to mortgaged property charges $0", () => {
    let state = makeGameState(2);
    const owner = state.players[1].id;
    state = withOwnership(state, JFK, owner);
    state = withMortgage(state, JFK);
    state = withPosition(state, 1);
    state = withChanceDeck(state, ["chance-2"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore);
  });
});

// ── Table-driven: every card category has a tested resolver path (no silent fall-through) ──

describe("Card category coverage — no category falls through to default unhandled", () => {
  const handledCategories = new Set([
    "advance-go",
    "advance-to",
    "advance-nearest-airport",
    "advance-nearest-utility",
    "go-back-3",
    "go-to-jail",
    "collect-bank",
    "pay-bank",
    "collect-each-player",
    "pay-each-player",
    "get-out-of-jail-free",
    "repairs",
  ]);

  it("every chance/community-chest card category is one of the explicitly handled categories", () => {
    const allCards = [...chanceCards, ...communityChestCards];
    for (const card of allCards) {
      expect(handledCategories.has(card.category)).toBe(true);
    }
  });
});
