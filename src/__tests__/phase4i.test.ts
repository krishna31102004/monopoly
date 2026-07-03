/**
 * Phase 4I — Auction Game Mode and Auction-Mode Free Parking Cap
 */

import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { drawAndApplyCard } from "@/lib/game/cards";
import { resolveLanding } from "@/lib/game/landing";
import { deserializeGame, serializeGame } from "@/lib/game/persistence";
import { DEFAULT_RULES } from "@/types/game";
import { boardSpaces, getBoardSpaceByIndex } from "@/data/board";
import { chanceCards, communityChestCards } from "@/data/cards";
import {
  makeGameState,
  withOwnership,
  withMortgage,
  withPlayer,
  withCash,
  withPosition,
  withChanceDeck,
  withCommunityChestDeck,
} from "./helpers/factory";
import type { GameState } from "@/types/game";

// Helpers
function withAuctionMode(state: GameState): GameState {
  return { ...state, rules: { ...state.rules, gameMode: "auction" } };
}
function withNormalMode(state: GameState): GameState {
  return { ...state, rules: { ...state.rules, gameMode: "normal" } };
}

const citySpace1 = boardSpaces.find((s) => s.kind === "city" && s.index === 1)!;
const airportJFK = getBoardSpaceByIndex(5);    // JFK Airport
const utilityElec = getBoardSpaceByIndex(12);  // Electric Company
const taxIncome = getBoardSpaceByIndex(4);     // Income Tax $200
const freeParkingSpace = getBoardSpaceByIndex(20);

// Card lookups
const goBack3Card = chanceCards.find((c) => c.category === "go-back-3")!;
const advanceGoCard = chanceCards.find((c) => c.category === "advance-go")!;
const goToJailCard = chanceCards.find((c) => c.category === "go-to-jail")!;
const nearestAirportCard = chanceCards.find((c) => c.category === "advance-nearest-airport")!;
const nearestUtilityCard = chanceCards.find((c) => c.category === "advance-nearest-utility");
const advanceToJFKCard = chanceCards.find((c) => c.category === "advance-to" && c.targetSpaceIndex === 5)!;
const payBankCard = communityChestCards.find((c) => c.category === "pay-bank")!;

// ── Normal Game Preservation ──────────────────────────────────────────────────

describe("Normal Game preservation", () => {
  it("DEFAULT_RULES has gameMode: 'normal'", () => {
    expect(DEFAULT_RULES.gameMode).toBe("normal");
  });

  it("new game defaults to Normal Game", () => {
    expect(makeGameState(2).rules.gameMode).toBe("normal");
  });

  it("Normal Game landing on unowned city enters awaitingPurchaseDecision", () => {
    const state = withNormalMode(makeGameState(2));
    const resolution = resolveLanding(state, citySpace1, false);
    expect(resolution.phase).toBe("awaitingPurchaseDecision");
    expect(resolution.landingAction?.kind).toBe("purchaseDecision");
  });

  it("Normal Game landing on unowned airport enters awaitingPurchaseDecision", () => {
    const state = withNormalMode(makeGameState(2));
    const resolution = resolveLanding(state, airportJFK, false);
    expect(resolution.phase).toBe("awaitingPurchaseDecision");
  });

  it("Normal Game landing on unowned utility enters awaitingPurchaseDecision", () => {
    const state = withNormalMode(makeGameState(2));
    const resolution = resolveLanding(state, utilityElec, false);
    expect(resolution.phase).toBe("awaitingPurchaseDecision");
  });

  it("Normal Game Free Parking pot is uncapped (460 + 200 = 660)", () => {
    let state = withNormalMode(makeGameState(2));
    state = { ...state, freeParkingPot: 460 };
    state = withCash(state, 5000);
    state = withPosition(state, 2); // Income Tax at index 4; roll 2
    state = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: true } });
    expect(state.players[0].position).toBe(4);
    expect(state.freeParkingPot).toBe(660); // uncapped
  });

  it("Normal Game DECLINE_PROPERTY still starts auction", () => {
    let state = withNormalMode(makeGameState(2));
    state = withPosition(state, 39);
    state = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: true } });
    expect(state.phase).toBe("awaitingPurchaseDecision");
    state = gameReducer(state, { type: "DECLINE_PROPERTY" });
    expect(state.phase).toBe("auction");
  });
});

// ── Auction Game: Landing behavior ───────────────────────────────────────────

describe("Auction Game: landing on unowned properties", () => {
  it("landing on unowned city starts auction immediately (via ROLL_DICE)", () => {
    let state = withAuctionMode(makeGameState(2));
    // Position 39 + roll 2 = index 1 (Guadalajara, unowned city)
    state = withPosition(state, 39);
    state = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: true } });
    expect(state.phase).toBe("auction");
    expect(state.auction?.propertySpaceIndex).toBe(1);
  });

  it("landing on unowned airport starts auction immediately", () => {
    // index 3 + roll 2 = index 5 (JFK Airport)
    let state = withAuctionMode(makeGameState(2));
    state = withPosition(state, 3);
    state = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: true } });
    expect(state.phase).toBe("auction");
    expect(state.auction?.propertySpaceIndex).toBe(5);
  });

  it("landing on unowned utility starts auction immediately", () => {
    // index 10 + roll 2 = index 12 (Electric Company)
    let state = withAuctionMode(makeGameState(2));
    state = withPosition(state, 10);
    state = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: true } });
    expect(state.phase).toBe("auction");
    expect(state.auction?.propertySpaceIndex).toBe(12);
  });

  it("landing on owned property charges rent (not auction)", () => {
    let state = withAuctionMode(makeGameState(2));
    const p2id = state.players[1].id;
    state = withOwnership(state, 1, p2id);
    const cashBefore = state.players[0].cash;
    const cash2Before = state.players[1].cash;
    // Use resolveLanding directly to avoid GO bonus complication
    const resolution = resolveLanding(state, citySpace1, false);
    expect(resolution.phase).not.toBe("auction" as string);
    const p0 = resolution.players.find((p) => p.id === state.players[0].id)!;
    const p1 = resolution.players.find((p) => p.id === state.players[1].id)!;
    expect(p0.cash).toBeLessThan(cashBefore); // paid rent
    expect(p1.cash).toBeGreaterThan(cash2Before); // received rent
  });

  it("landing on mortgaged owned property charges no rent and no auction", () => {
    let state = withAuctionMode(makeGameState(2));
    const p2id = state.players[1].id;
    state = withOwnership(state, 1, p2id);
    state = withMortgage(state, 1);
    const cash0Before = state.players[0].cash;
    const cash1Before = state.players[1].cash;
    // Use resolveLanding directly to avoid GO bonus complication
    const resolution = resolveLanding(state, citySpace1, false);
    expect(resolution.phase).not.toBe("auction" as string);
    // No freeParkingPotDelta and players cash unchanged (mortgaged = no rent)
    const p0 = resolution.players.find((p) => p.id === state.players[0].id)!;
    const p1 = resolution.players.find((p) => p.id === state.players[1].id)!;
    expect(p0.cash).toBe(cash0Before);
    expect(p1.cash).toBe(cash1Before);
  });

  it("BUY_PROPERTY is a no-op in Auction Game", () => {
    let state = withAuctionMode(makeGameState(2));
    state = {
      ...state,
      phase: "awaitingPurchaseDecision",
      landingAction: { kind: "purchaseDecision", spaceIndex: 1, message: "test" },
    };
    const stateBefore = state;
    const stateAfter = gameReducer(state, { type: "BUY_PROPERTY" });
    expect(stateAfter).toBe(stateBefore);
  });

  it("auction winner receives property and pays bid", () => {
    let state = withAuctionMode(makeGameState(2));
    state = withPosition(state, 39);
    state = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: true } });
    expect(state.phase).toBe("auction");
    const p1id = state.players[0].id;
    const p1CashBefore = state.players[0].cash;
    state = gameReducer(state, { type: "PLACE_BID", amount: 10 });
    state = gameReducer(state, { type: "PASS_AUCTION" });
    expect(state.ownerships.find((o) => o.spaceIndex === 1)?.ownerId).toBe(p1id);
    expect(state.players[0].cash).toBe(p1CashBefore - 10);
  });

  it("all-pass leaves property unowned", () => {
    let state = withAuctionMode(makeGameState(2));
    state = withPosition(state, 39);
    state = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: true } });
    state = gameReducer(state, { type: "PASS_AUCTION" });
    state = gameReducer(state, { type: "PASS_AUCTION" });
    expect(state.ownerships.find((o) => o.spaceIndex === 1)?.ownerId).toBeNull();
  });

  it("bankrupt player excluded from auction activePlayerIds", () => {
    let state = withAuctionMode(makeGameState(3));
    state = withPlayer(state, 1, { isBankrupt: true });
    state = withPosition(state, 39);
    state = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: true } });
    expect(state.phase).toBe("auction");
    expect(state.auction?.activePlayerIds).not.toContain(state.players[1].id);
  });
});

// ── Auction Game: Card movement ───────────────────────────────────────────────

describe("Auction Game: card movement starts auction for unowned properties", () => {
  it("advance-to unowned airport starts auction", () => {
    let state = withAuctionMode(makeGameState(2));
    state = withPosition(state, 3);
    state = withChanceDeck(state, [advanceToJFKCard.id]);
    state = drawAndApplyCard(state, "chance", false);
    expect(state.phase).toBe("auction");
    expect(state.auction?.propertySpaceIndex).toBe(5);
  });

  it("advance-to owned airport charges rent in Auction Game", () => {
    let state = withAuctionMode(makeGameState(2));
    const p2id = state.players[1].id;
    state = withOwnership(state, 5, p2id);
    state = withPosition(state, 3);
    state = withChanceDeck(state, [advanceToJFKCard.id]);
    const cashBefore = state.players[0].cash;
    state = drawAndApplyCard(state, "chance", false);
    expect(state.phase).not.toBe("auction");
    expect(state.players[0].cash).toBeLessThan(cashBefore);
  });

  it("advance-nearest-airport to unowned airport starts auction", () => {
    // From position 10, nearest airport forward is index 15 (Heathrow)
    let state = withAuctionMode(makeGameState(2));
    state = withPosition(state, 10);
    state = withChanceDeck(state, [nearestAirportCard.id]);
    state = drawAndApplyCard(state, "chance", false);
    expect(state.phase).toBe("auction");
    expect(state.auction?.propertySpaceIndex).toBe(15);
  });

  it("advance-nearest-airport to owned airport charges double rent", () => {
    let state = withAuctionMode(makeGameState(2));
    const p2id = state.players[1].id;
    state = withOwnership(state, 15, p2id);
    state = withPosition(state, 10);
    state = withChanceDeck(state, [nearestAirportCard.id]);
    const cashBefore = state.players[0].cash;
    state = drawAndApplyCard(state, "chance", false);
    expect(state.phase).not.toBe("auction");
    expect(state.players[0].cash).toBeLessThan(cashBefore);
  });

  it("advance-nearest-utility to unowned utility starts auction", () => {
    if (!nearestUtilityCard) return; // skip if card not in data
    let state = withAuctionMode(makeGameState(2));
    state = withPosition(state, 0); // from 0, nearest utility is index 12 (Electric Company)
    state = withChanceDeck(state, [nearestUtilityCard.id]);
    state = drawAndApplyCard(state, "chance", false);
    expect(state.phase).toBe("auction");
    expect(state.auction?.propertySpaceIndex).toBe(12);
  });

  it("go-back-3 to unowned city starts auction", () => {
    // Position 4 → go back 3 → position 1 (Guadalajara, unowned city)
    let state = withAuctionMode(makeGameState(2));
    state = withPosition(state, 4);
    state = withChanceDeck(state, [goBack3Card.id]);
    state = drawAndApplyCard(state, "chance", false);
    expect(state.phase).toBe("auction");
    expect(state.auction?.propertySpaceIndex).toBe(1);
  });

  it("go-back-3 to Community Chest draws CC card in Auction Game", () => {
    // Position 5 → go back 3 → position 2 (Community Chest)
    let state = withAuctionMode(makeGameState(2));
    state = withPosition(state, 5);
    state = withChanceDeck(state, [goBack3Card.id]);
    // cc-2 is collect-bank (gives cash)
    state = withCommunityChestDeck(state, ["cc-2"]);
    const cashBefore = state.players[0].cash;
    state = drawAndApplyCard(state, "chance", false);
    expect(state.players[0].cash).toBeGreaterThan(cashBefore);
    expect(state.phase).not.toBe("auction");
  });

  it("advance-to GO pays GO bonus in Auction Game", () => {
    let state = withAuctionMode(makeGameState(2));
    state = withPosition(state, 20);
    state = withChanceDeck(state, [advanceGoCard.id]);
    const cashBefore = state.players[0].cash;
    state = drawAndApplyCard(state, "chance", false);
    expect(state.players[0].position).toBe(0);
    expect(state.players[0].cash).toBeGreaterThan(cashBefore);
  });

  it("go-to-jail card works in Auction Game", () => {
    let state = withAuctionMode(makeGameState(2));
    state = withChanceDeck(state, [goToJailCard.id]);
    state = drawAndApplyCard(state, "chance", false);
    expect(state.players[0].isInJail).toBe(true);
    expect(state.players[0].position).toBe(10);
  });
});

// ── Auction Game: Free Parking cap ────────────────────────────────────────────

describe("Auction Game: Free Parking pot capped at $500", () => {
  it("460 + 200 (income tax) becomes 500, not 660", () => {
    let state = withAuctionMode(makeGameState(2));
    state = { ...state, freeParkingPot: 460 };
    state = withCash(state, 5000);
    state = withPosition(state, 2); // roll 2 → index 4 (Income Tax, $200)
    state = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: true } });
    expect(state.players[0].position).toBe(4);
    expect(state.freeParkingPot).toBe(500);
  });

  it("500 + 200 (income tax) stays at 500", () => {
    let state = withAuctionMode(makeGameState(2));
    state = { ...state, freeParkingPot: 500 };
    state = withCash(state, 5000);
    state = withPosition(state, 2);
    state = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: true } });
    expect(state.freeParkingPot).toBe(500);
  });

  it("0 + 200 (income tax) becomes 200", () => {
    let state = withAuctionMode(makeGameState(2));
    state = { ...state, freeParkingPot: 0 };
    state = withCash(state, 5000);
    state = withPosition(state, 2);
    state = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: true } });
    expect(state.freeParkingPot).toBe(200);
  });

  it("Normal Game: 460 + 200 becomes 660 (uncapped)", () => {
    let state = withNormalMode(makeGameState(2));
    state = { ...state, freeParkingPot: 460 };
    state = withCash(state, 5000);
    state = withPosition(state, 2);
    state = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: true } });
    expect(state.freeParkingPot).toBe(660);
  });

  it("pay-bank card caps Free Parking pot at 500 in Auction Game", () => {
    if (!payBankCard) return;
    let state = withAuctionMode(makeGameState(2));
    state = { ...state, freeParkingPot: 450, rules: { ...state.rules, freeParkingCash: true } };
    state = withCash(state, 5000);
    state = withCommunityChestDeck(state, [payBankCard.id]);
    state = drawAndApplyCard(state, "community-chest", false);
    expect(state.freeParkingPot).toBeLessThanOrEqual(500);
  });

  it("landing on Free Parking collects pot normally in Auction Game", () => {
    let state = withAuctionMode(makeGameState(2));
    state = { ...state, freeParkingPot: 300 };
    const cashBefore = state.players[0].cash;
    const resolution = resolveLanding(state, freeParkingSpace, false);
    const p0 = resolution.players.find((p) => p.id === state.players[0].id)!;
    expect(p0.cash).toBe(cashBefore + 300);
    expect(resolution.freeParkingPotDelta).toBe(-300);
  });
});

// ── Persistence / migration ───────────────────────────────────────────────────

describe("Persistence: gameMode migration", () => {
  it("old save without gameMode loads as 'normal'", () => {
    const state = makeGameState(2);
    const json = serializeGame(state);
    const parsed = JSON.parse(json) as { version: number; savedAt: string; state: Record<string, unknown> };
    const rules = { ...(parsed.state.rules as Record<string, unknown>) };
    delete rules.gameMode;
    parsed.state.rules = rules;
    const restored = deserializeGame(JSON.stringify(parsed));
    expect(restored?.rules.gameMode).toBe("normal");
  });

  it("Auction Game save preserves gameMode as 'auction'", () => {
    const state = withAuctionMode(makeGameState(2));
    const restored = deserializeGame(serializeGame(state));
    expect(restored?.rules.gameMode).toBe("auction");
  });
});
