/**
 * Phase 4G — Gameplay/UX stability tests
 *
 * Issue 1: Voluntary bankruptcy / forfeit with property auction queue
 * Issue 2: Go Back 3 Spaces triggers full landing resolution (rent)
 * Issue 3: Turn timer (turnDeadlineAt) is set on each new turn
 * Issue 5: End Turn reminder fires after canEndTurn (unit logic)
 * Issue 6: exactGoBonus defaults to true
 */

import { describe, it, expect } from "vitest";
import { drawAndApplyCard } from "@/lib/game/cards";
import { gameReducer } from "@/lib/game/gameReducer";
import { DEFAULT_RULES } from "@/types/game";
import {
  makeGameState,
  withPosition,
  withChanceDeck,
  withOwnership,
  withCash,
  currentPlayer,
  playerAt,
} from "./helpers/factory";

// ── Helpers ───────────────────────────────────────────────────────────────────

function p1Id(state: ReturnType<typeof makeGameState>) {
  return state.players[0].id;
}
function p2Id(state: ReturnType<typeof makeGameState>) {
  return state.players[1].id;
}

// ── Issue 6: exactGoBonus default ─────────────────────────────────────────────

describe("exactGoBonus default", () => {
  it("DEFAULT_RULES.exactGoBonus is true", () => {
    expect(DEFAULT_RULES.exactGoBonus).toBe(true);
  });

  it("new game uses exactGoBonus: true", () => {
    const state = makeGameState();
    expect(state.rules.exactGoBonus).toBe(true);
  });
});

// ── Issue 2: Go Back 3 Spaces rent resolution ─────────────────────────────────

describe("Go Back 3 Spaces — landing resolution", () => {
  // Board index 6 is a city. Player at 9, draws go-back-3 → lands on 6.
  // If index 6 is owned by player 2, player 1 must pay rent.
  it("triggers rent payment when landing on owned property", () => {
    let state = makeGameState(3);
    const owner = state.players[1].id; // player 2 owns it
    const renter = state.players[0].id; // player 1 (current) pays

    // Give space 6 to player 2
    state = withOwnership(state, 6, owner);
    // Player 1 (current) at position 9, draws go-back-3
    state = withPosition(state, 9);
    state = withChanceDeck(state, ["chance-9"]);

    const before1 = state.players.find((p) => p.id === renter)!.cash;
    const before2 = state.players.find((p) => p.id === owner)!.cash;

    const next = drawAndApplyCard(state, "chance", false);

    const after1 = next.players.find((p) => p.id === renter)!.cash;
    const after2 = next.players.find((p) => p.id === owner)!.cash;

    // Player 1 paid rent — cash decreased
    expect(after1).toBeLessThan(before1);
    // Player 2 received rent — cash increased
    expect(after2).toBeGreaterThan(before2);
  });

  it("sets landingAction to rentPayment when landing on owned property", () => {
    let state = makeGameState(3);
    state = withOwnership(state, 6, state.players[1].id);
    state = withPosition(state, 9);
    state = withChanceDeck(state, ["chance-9"]);

    const next = drawAndApplyCard(state, "chance", false);
    expect(next.landingAction?.kind).toBe("rentPayment");
  });

  it("sets phase to turnComplete when landing on non-owned city", () => {
    let state = makeGameState(2);
    state = withPosition(state, 9);
    state = withChanceDeck(state, ["chance-9"]);

    const next = drawAndApplyCard(state, "chance", false);
    // Unowned: should offer purchase decision
    expect(["awaitingPurchaseDecision", "turnComplete"]).toContain(next.phase);
  });

  it("player lands on correct position after go-back-3 from 9", () => {
    let state = makeGameState();
    state = withPosition(state, 9);
    state = withChanceDeck(state, ["chance-9"]);

    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).position).toBe(6);
  });
});

// ── Issue 3: Turn timer ───────────────────────────────────────────────────────

describe("Turn timer (turnDeadlineAt)", () => {
  it("new game state has turnDeadlineAt as null in setup", () => {
    const state = makeGameState();
    // createInitialGameState leaves turnDeadlineAt null (set by withNextTurn)
    // Real-game: START_GAME sets up state but first player gets null until reducer sets it
    // After START_GAME action, check that turnDeadlineAt is set
    const started = gameReducer(state, {
      type: "START_GAME",
      players: [
        { name: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
        { name: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      ],
    });
    // START_GAME creates initial state without running withNextTurn, so deadline is null
    // Deadline is set when END_TURN is dispatched (calling withNextTurn)
    expect(started.turnDeadlineAt).toBeNull();
  });

  it("turnDeadlineAt is set after END_TURN", () => {
    // Simulate a turn: get to turnComplete, then end turn
    let state = makeGameState(2);

    // Force phase to turnComplete
    state = { ...state, phase: "turnComplete", currentPlayerHasRolled: true };

    const before = Date.now();
    const next = gameReducer(state, { type: "END_TURN" });
    const after = Date.now();

    expect(next.turnDeadlineAt).not.toBeNull();
    // Deadline should be ~3 minutes from now
    expect(next.turnDeadlineAt!).toBeGreaterThan(before + 170_000);
    expect(next.turnDeadlineAt!).toBeLessThan(after + 185_000);
  });

  it("forfeitAuctionQueue is cleared on END_TURN", () => {
    let state = makeGameState(2);
    state = { ...state, phase: "turnComplete", currentPlayerHasRolled: true, forfeitAuctionQueue: [6] };
    const next = gameReducer(state, { type: "END_TURN" });
    expect(next.forfeitAuctionQueue).toEqual([]);
  });
});

// ── Issue 1: Voluntary bankruptcy / forfeit ───────────────────────────────────

describe("VOLUNTARY_BANKRUPTCY", () => {
  it("marks current player as bankrupt (2-player ends game)", () => {
    let state = makeGameState(2);
    state = { ...state, phase: "readyToRoll" };
    const next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    // In 2-player: forfeiting = immediate game over, but player still marked bankrupt
    expect(next.players[0].isBankrupt).toBe(true);
  });

  it("clears forfeiting player's owned properties (3-player)", () => {
    let state = makeGameState(3);
    const p1 = state.players[0].id;
    state = withOwnership(state, 6, p1);
    state = { ...state, phase: "readyToRoll" };
    const next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    expect(next.players[0].ownedCityIds).toEqual([]);
  });

  it("resets forfeited property ownerships to null (3-player)", () => {
    let state = makeGameState(3);
    state = withOwnership(state, 6, state.players[0].id);
    state = { ...state, phase: "readyToRoll" };
    const next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    const o = next.ownerships.find((o) => o.spaceIndex === 6)!;
    expect(o.ownerId).toBeNull();
    expect(o.houses).toBe(0);
    expect(o.isMortgaged).toBe(false);
  });

  it("starts auction for forfeited properties (3-player game)", () => {
    // Need 3 players: forfeiter + 2 remaining → auction makes sense
    let state = makeGameState(3);
    state = withOwnership(state, 6, state.players[0].id);
    state = { ...state, phase: "readyToRoll" };
    const next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    expect(next.phase).toBe("auction");
    expect(next.auction?.propertySpaceIndex).toBe(6);
  });

  it("queues multiple forfeited properties for successive auctions (3-player)", () => {
    let state = makeGameState(3);
    state = withOwnership(state, 6, state.players[0].id);
    state = withOwnership(state, 9, state.players[0].id);
    state = { ...state, phase: "readyToRoll" };
    const next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    expect(next.phase).toBe("auction");
    // One in auction, one queued
    expect(next.forfeitAuctionQueue).toHaveLength(1);
  });

  it("proceeds to next turn if forfeiting player has no properties (3-player)", () => {
    let state = makeGameState(3);
    state = { ...state, phase: "readyToRoll" };
    const next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    // No properties → next turn (not game over since 2 remain)
    expect(["readyToRoll", "awaitingJailDecision"]).toContain(next.phase);
    expect(next.players[next.currentPlayerIndex].isBankrupt).toBe(false);
  });

  it("ends game when only one active player remains after forfeit (2-player)", () => {
    // In 2-player: one player forfeits → other wins immediately (no point auctioning to 1 bidder)
    let state = makeGameState(2);
    state = { ...state, phase: "readyToRoll" };
    const p2 = state.players[1].id;
    const next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    expect(next.phase).toBe("gameOver");
    expect(next.winnerId).toBe(p2);
  });

  it("is rejected during bankruptcyPending phase", () => {
    let state = makeGameState(2);
    state = { ...state, phase: "bankruptcyPending" };
    const next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    expect(next).toBe(state); // unchanged
  });

  it("is rejected during auction phase", () => {
    let state = makeGameState(2);
    state = { ...state, phase: "auction" };
    const next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    expect(next).toBe(state);
  });

  it("cancels active trade on forfeit (3-player)", () => {
    let state = makeGameState(3);
    state = {
      ...state,
      phase: "readyToRoll",
      trade: {
        initiatorPlayerId: state.players[0].id,
        recipientPlayerId: state.players[1].id,
        offerFromInitiator: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
        offerFromRecipient: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      },
    };
    const next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    expect(next.trade).toBeNull();
  });

  it("auction started by forfeit includes only non-bankrupt players as bidders", () => {
    // Need 4 players: p1 forfeits, p4 already bankrupt, p2 & p3 remain
    let state = makeGameState(4);
    const p1 = state.players[0].id;
    const p4 = state.players[3].id;
    state = withOwnership(state, 6, p1);
    state = {
      ...state,
      phase: "readyToRoll",
      players: state.players.map((p, i) => (i === 3 ? { ...p, isBankrupt: true } : p)),
    };
    const next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    expect(next.phase).toBe("auction");
    // Forfeiter (p1, now bankrupt) and pre-bankrupt (p4) excluded from bidders
    expect(next.auction?.activePlayerIds).not.toContain(p1);
    expect(next.auction?.activePlayerIds).not.toContain(p4);
    expect(next.auction?.activePlayerIds).toHaveLength(2); // p2 and p3
  });
});

// ── Forfeit auction queue draining ────────────────────────────────────────────

describe("Forfeit auction queue draining", () => {
  it("after winning a forfeit auction, next queued property goes to auction (3-player)", () => {
    let state = makeGameState(3);
    const p1 = state.players[0].id;
    state = withOwnership(state, 6, p1);
    state = withOwnership(state, 9, p1);
    state = { ...state, phase: "readyToRoll" };

    // Forfeit → first auction starts
    let next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    expect(next.phase).toBe("auction");
    const firstProp = next.auction!.propertySpaceIndex;

    // One of the remaining players bids — 2 active bidders so bid just advances
    next = gameReducer(next, { type: "PLACE_BID", amount: 10 });
    // Pass others until auction resolves
    while (next.phase === "auction" && next.auction?.propertySpaceIndex === firstProp) {
      next = gameReducer(next, { type: "PASS_AUCTION" });
    }

    // After first auction resolves, check queue drained or second auction started
    if (next.phase === "auction") {
      expect(next.auction!.propertySpaceIndex).not.toBe(firstProp);
    } else {
      expect(next.forfeitAuctionQueue).toEqual([]);
    }
  });

  it("after all forfeit auctions pass with no bids, advance to next turn (3-player)", () => {
    let state = makeGameState(3);
    state = withOwnership(state, 6, state.players[0].id);
    state = { ...state, phase: "readyToRoll" };

    let next = gameReducer(state, { type: "VOLUNTARY_BANKRUPTCY" });
    expect(next.phase).toBe("auction");

    // Both remaining players pass → no bids → property stays unowned, no queue left
    next = gameReducer(next, { type: "PASS_AUCTION" });
    next = gameReducer(next, { type: "PASS_AUCTION" });

    // No more in queue → next turn
    expect(next.forfeitAuctionQueue).toEqual([]);
    expect(["readyToRoll", "awaitingJailDecision"]).toContain(next.phase);
  });
});

// ── forfeitAuctionQueue initialized ──────────────────────────────────────────

describe("GameState initial fields", () => {
  it("forfeitAuctionQueue is initialized as empty array", () => {
    const state = makeGameState();
    expect(state.forfeitAuctionQueue).toEqual([]);
  });

  it("turnDeadlineAt is null initially", () => {
    const state = makeGameState();
    expect(state.turnDeadlineAt).toBeNull();
  });
});
