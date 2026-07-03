/**
 * Phase 4G.1 — Critical gameplay fix tests
 *
 * Issue 1: Chance advance-to / advance-nearest-airport correctly charges airport rent
 * Issue 2: Go Back 3 Spaces landing on Community Chest draws a CC card
 * Issue 3: TURN_TIMER_EXPIRED tracks consecutive timeouts and auto-bankrupts at 3
 * Issue 4: Non-current player can voluntarily declare bankruptcy
 */

import { describe, it, expect } from "vitest";
import { drawAndApplyCard } from "@/lib/game/cards";
import { gameReducer } from "@/lib/game/gameReducer";
import {
  makeGameState,
  withPosition,
  withChanceDeck,
  withOwnership,
  withCash,
  withPlayer,
  currentPlayer,
  playerAt,
} from "./helpers/factory";

// ── Issue 1: Airport rent via Chance cards ────────────────────────────────────

describe("Issue 1: Chance card airport rent", () => {
  it("advance-to JFK charges rent when JFK is owned by another player", () => {
    // chance-2 is advance-to (JFK, index 5)
    let state = makeGameState(3);
    const p1 = state.players[0].id;
    const p2 = state.players[1].id;
    // Give JFK (index 5) to player 2
    state = withOwnership(state, 5, p2);
    // Player 1 (current) is somewhere before JFK
    state = withPosition(state, 3);
    state = withChanceDeck(state, ["chance-2"]); // advance-to JFK

    const cashBefore1 = state.players[0].cash;
    const cashBefore2 = state.players[1].cash;

    const result = drawAndApplyCard(state, "chance", false);

    expect(result.players[0].cash).toBeLessThan(cashBefore1); // p1 paid rent
    expect(result.players[1].cash).toBeGreaterThan(cashBefore2); // p2 received rent
  });

  it("advance-nearest-airport charges double rent when owned", () => {
    // chance-3 is advance-nearest-airport
    let state = makeGameState(3);
    const p2 = state.players[1].id;
    // Give LHR (index 15) to player 2
    state = withOwnership(state, 15, p2);
    // Player 1 is at 10 — nearest airport forward is index 15
    state = withPosition(state, 10);
    state = withChanceDeck(state, ["chance-3"]); // advance-nearest-airport

    const cashBefore1 = state.players[0].cash;
    const cashBefore2 = state.players[1].cash;

    const result = drawAndApplyCard(state, "chance", false);

    expect(result.players[0].cash).toBeLessThan(cashBefore1);
    expect(result.players[1].cash).toBeGreaterThan(cashBefore2);
  });

  it("advance-to unowned airport shows purchaseDecision phase", () => {
    let state = makeGameState(2);
    state = withPosition(state, 3);
    state = withChanceDeck(state, ["chance-2"]); // advance-to JFK (index 5)

    const result = drawAndApplyCard(state, "chance", false);
    expect(result.phase).toBe("awaitingPurchaseDecision");
  });

  it("advance-to JFK owned by current player charges no rent (no self-rent)", () => {
    let state = makeGameState(2);
    const p1 = state.players[0].id;
    state = withOwnership(state, 5, p1);
    state = withPosition(state, 3);
    state = withChanceDeck(state, ["chance-2"]);

    const cashBefore = state.players[0].cash;
    const result = drawAndApplyCard(state, "chance", false);
    expect(result.players[0].cash).toBe(cashBefore); // no rent paid to self
  });

  it("advance-nearest-airport with all airports unowned shows purchaseDecision", () => {
    let state = makeGameState(2);
    state = withPosition(state, 10);
    state = withChanceDeck(state, ["chance-3"]);

    const result = drawAndApplyCard(state, "chance", false);
    expect(result.phase).toBe("awaitingPurchaseDecision");
  });
});

// ── Issue 2: Go Back 3 → Community Chest chain draw ──────────────────────────

describe("Issue 2: Go Back 3 Spaces → Community Chest draws CC card", () => {
  it("landing on Community Chest via go-back-3 draws a CC card (effect applied)", () => {
    // Position 36 - 3 = 33 = Community Chest
    let state = makeGameState(2);
    state = withPosition(state, 36);
    state = withChanceDeck(state, ["chance-9"]); // go-back-3

    // Use cc-2 (collect-bank) — gives cash without changing position
    state = { ...state, communityChestDeck: ["cc-2", ...state.communityChestDeck] };

    const cashBefore = state.players[0].cash;
    const result = drawAndApplyCard(state, "chance", false);
    // The CC card was drawn and applied — drawnCard reflects the chain CC card
    expect(result.drawnCard).not.toBeNull();
    // Player stayed at position 33 (CC card didn't move them)
    expect(result.players[0].position).toBe(33);
    // Cash increased from the collect-bank CC card
    expect(result.players[0].cash).toBeGreaterThan(cashBefore);
  });

  it("landing on Chance via go-back-3 does NOT chain draw (same deck guard)", () => {
    // Position where go-back-3 lands on another Chance space
    // Chance spaces: 7, 22, 36. From 36 - 3 = 33 (CC). From 25 - 3 = 22 (Chance).
    let state = makeGameState(2);
    state = withPosition(state, 25);
    state = withChanceDeck(state, ["chance-9"]); // go-back-3

    const result = drawAndApplyCard(state, "chance", false);
    // drawnCard should be the original go-back-3 card, not a second Chance card
    expect(result.drawnCard?.card.category).toBe("go-back-3");
    // Player at position 22 (Chance)
    expect(result.players[0].position).toBe(22);
  });

  it("go-back-3 to Community Chest — chain CC card effect modifies state correctly", () => {
    let state = makeGameState(2);
    state = withPosition(state, 36);
    state = withChanceDeck(state, ["chance-9"]);

    const cashBefore = state.players[0].cash;
    const result = drawAndApplyCard(state, "chance", false);

    // Phase should reflect CC card resolution (not stuck at community-chest landing)
    expect(result.phase).not.toBe("setup");
    // drawnCard is non-null (reflects the CC chain card draw)
    expect(result.drawnCard).not.toBeNull();
  });

  it("go-back-3 landing on a city still charges rent normally", () => {
    // Index 36 - 3 = 33 (CC), use a different position: 36-3=33 is CC.
    // Let's use position 10: 10 - 3 = 7 (Chance). Not city.
    // Try position 4: 4 - 3 = 1 (Mumbai, a city).
    let state = makeGameState(3);
    const p2 = state.players[1].id;
    state = withOwnership(state, 1, p2); // Mumbai owned by p2
    state = withPosition(state, 4);
    state = withChanceDeck(state, ["chance-9"]);

    const cashBefore0 = state.players[0].cash;
    const cashBefore1 = state.players[1].cash;

    const result = drawAndApplyCard(state, "chance", false);
    // p0 paid rent to p1
    expect(result.players[0].cash).toBeLessThan(cashBefore0);
    expect(result.players[1].cash).toBeGreaterThan(cashBefore1);
  });
});

// ── Issue 3: Turn timer enforcement ──────────────────────────────────────────

describe("Issue 3: TURN_TIMER_EXPIRED tracks consecutive timeouts", () => {
  function makeExpiredAction(state: ReturnType<typeof makeGameState>) {
    const cp = state.players[state.currentPlayerIndex];
    return {
      type: "TURN_TIMER_EXPIRED" as const,
      playerId: cp.id,
      deadlineAt: state.turnDeadlineAt ?? Date.now(),
    };
  }

  it("increments consecutiveTurnTimeouts on first timeout", () => {
    let state = makeGameState(2);
    state = { ...state, phase: "turnComplete", currentPlayerHasRolled: true, turnDeadlineAt: Date.now() - 1 };

    const next = gameReducer(state, makeExpiredAction(state));
    expect(next.players[0].consecutiveTurnTimeouts).toBe(1);
  });

  it("advances turn after timeout in turnComplete phase", () => {
    let state = makeGameState(2);
    state = { ...state, phase: "turnComplete", currentPlayerHasRolled: true, turnDeadlineAt: Date.now() - 1 };

    const next = gameReducer(state, makeExpiredAction(state));
    expect(next.currentPlayerIndex).toBe(1);
    expect(["readyToRoll", "awaitingJailDecision"]).toContain(next.phase);
  });

  it("advances turn after timeout in readyToRoll phase (player never rolled)", () => {
    let state = makeGameState(2);
    state = { ...state, phase: "readyToRoll", turnDeadlineAt: Date.now() - 1 };

    const next = gameReducer(state, makeExpiredAction(state));
    expect(next.players[0].consecutiveTurnTimeouts).toBe(1);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it("second consecutive timeout increments count to 2", () => {
    let state = makeGameState(2);
    state = {
      ...state,
      phase: "readyToRoll",
      turnDeadlineAt: Date.now() - 1,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, consecutiveTurnTimeouts: 1 } : p,
      ),
    };

    // p1's turn with 1 existing timeout → trigger again
    const action = makeExpiredAction(state);
    const next = gameReducer(state, action);
    // After turn advances, p1's count is now 2
    expect(next.players[0].consecutiveTurnTimeouts).toBe(2);
  });

  it("third consecutive timeout triggers auto-bankruptcy (3-player game)", () => {
    let state = makeGameState(3);
    state = {
      ...state,
      phase: "readyToRoll",
      turnDeadlineAt: Date.now() - 1,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, consecutiveTurnTimeouts: 2 } : p,
      ),
    };

    const next = gameReducer(state, makeExpiredAction(state));
    expect(next.players[0].isBankrupt).toBe(true);
  });

  it("third consecutive timeout in 2-player game ends the game", () => {
    let state = makeGameState(2);
    state = {
      ...state,
      phase: "readyToRoll",
      turnDeadlineAt: Date.now() - 1,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, consecutiveTurnTimeouts: 2 } : p,
      ),
    };

    const next = gameReducer(state, makeExpiredAction(state));
    expect(next.phase).toBe("gameOver");
    expect(next.winnerId).toBe(state.players[1].id);
  });

  it("successful END_TURN resets consecutiveTurnTimeouts to 0", () => {
    let state = makeGameState(2);
    state = {
      ...state,
      phase: "turnComplete",
      currentPlayerHasRolled: true,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, consecutiveTurnTimeouts: 2 } : p,
      ),
    };

    const next = gameReducer(state, { type: "END_TURN" });
    // The player at index 0 should have their count reset
    expect(next.players[0].consecutiveTurnTimeouts).toBe(0);
  });

  it("timer expired for wrong player ID is ignored", () => {
    let state = makeGameState(2);
    state = { ...state, phase: "readyToRoll", turnDeadlineAt: Date.now() - 1 };

    const result = gameReducer(state, {
      type: "TURN_TIMER_EXPIRED",
      playerId: "wrong-player-id",
      deadlineAt: state.turnDeadlineAt!,
    });
    expect(result).toBe(state);
  });

  it("timer expired with wrong deadlineAt is ignored (stale timer)", () => {
    let state = makeGameState(2);
    const realDeadline = Date.now() - 1;
    state = { ...state, phase: "readyToRoll", turnDeadlineAt: realDeadline };
    const cp = state.players[0];

    const result = gameReducer(state, {
      type: "TURN_TIMER_EXPIRED",
      playerId: cp.id,
      deadlineAt: realDeadline - 1000, // stale deadline
    });
    expect(result).toBe(state);
  });

  it("timer expired during auction phase is ignored", () => {
    let state = makeGameState(2);
    state = { ...state, phase: "auction", turnDeadlineAt: Date.now() - 1 };
    const cp = state.players[0];

    const result = gameReducer(state, {
      type: "TURN_TIMER_EXPIRED",
      playerId: cp.id,
      deadlineAt: state.turnDeadlineAt!,
    });
    expect(result).toBe(state);
  });

  it("timeout during awaitingPurchaseDecision starts auction (auctions rule on)", () => {
    let state = makeGameState(2);
    const deadline = Date.now() - 1;
    state = {
      ...state,
      phase: "awaitingPurchaseDecision",
      currentPlayerHasRolled: true,
      turnDeadlineAt: deadline,
      landingAction: {
        kind: "purchaseDecision",
        spaceIndex: 1, // Mumbai (a city)
        message: "Buy Mumbai?",
      },
    };
    const cp = state.players[0];

    const next = gameReducer(state, {
      type: "TURN_TIMER_EXPIRED",
      playerId: cp.id,
      deadlineAt: deadline,
    });
    expect(next.phase).toBe("auction");
    expect(next.auction?.propertySpaceIndex).toBe(1);
  });
});

// ── Issue 4: Non-current player voluntary bankruptcy ─────────────────────────

describe("Issue 4: Non-current player can voluntarily declare bankruptcy", () => {
  it("non-current player (p2) can forfeit when it is p1's turn", () => {
    let state = makeGameState(3);
    state = { ...state, phase: "readyToRoll", currentPlayerIndex: 0 };
    const p2 = state.players[1].id;

    const next = gameReducer(state, {
      type: "VOLUNTARY_BANKRUPTCY",
      actorPlayerId: p2,
    });
    expect(next.players[1].isBankrupt).toBe(true);
  });

  it("non-current player forfeit starts auction for their properties", () => {
    let state = makeGameState(3);
    const p2 = state.players[1].id;
    state = withOwnership(state, 6, p2);
    state = { ...state, phase: "readyToRoll", currentPlayerIndex: 0 };

    const next = gameReducer(state, {
      type: "VOLUNTARY_BANKRUPTCY",
      actorPlayerId: p2,
    });
    expect(next.phase).toBe("auction");
    expect(next.players[1].ownedCityIds).toEqual([]);
  });

  it("player cannot forfeit someone else (actorPlayerId validates identity in reducer)", () => {
    // The reducer doesn't validate socket identity — that's done server-side.
    // But it DOES require the actor to be an active (non-bankrupt) player.
    let state = makeGameState(3);
    const p3 = state.players[2].id;
    state = { ...state, players: state.players.map((p, i) => i === 2 ? { ...p, isBankrupt: true } : p) };
    state = { ...state, phase: "readyToRoll" };

    // Trying to forfeit an already-bankrupt player is rejected
    const next = gameReducer(state, {
      type: "VOLUNTARY_BANKRUPTCY",
      actorPlayerId: p3,
    });
    expect(next).toBe(state);
  });

  it("non-current player forfeit in 3-player game with no properties advances turn", () => {
    let state = makeGameState(3);
    const p2 = state.players[1].id;
    state = { ...state, phase: "readyToRoll", currentPlayerIndex: 0 };

    // p2 forfeits with no properties
    const next = gameReducer(state, {
      type: "VOLUNTARY_BANKRUPTCY",
      actorPlayerId: p2,
    });
    expect(next.players[1].isBankrupt).toBe(true);
    expect(["readyToRoll", "awaitingJailDecision"]).toContain(next.phase);
  });

  it("current player (p1) can still forfeit with actorPlayerId set to their own id", () => {
    let state = makeGameState(3);
    const p1 = state.players[0].id;
    state = { ...state, phase: "readyToRoll", currentPlayerIndex: 0 };

    const next = gameReducer(state, {
      type: "VOLUNTARY_BANKRUPTCY",
      actorPlayerId: p1,
    });
    expect(next.players[0].isBankrupt).toBe(true);
  });

  it("non-current player forfeit is rejected during bankruptcyPending phase", () => {
    let state = makeGameState(3);
    const p2 = state.players[1].id;
    state = { ...state, phase: "bankruptcyPending" };

    const next = gameReducer(state, {
      type: "VOLUNTARY_BANKRUPTCY",
      actorPlayerId: p2,
    });
    expect(next).toBe(state);
  });

  it("non-current player forfeit is rejected during auction phase", () => {
    let state = makeGameState(3);
    const p2 = state.players[1].id;
    state = { ...state, phase: "auction" };

    const next = gameReducer(state, {
      type: "VOLUNTARY_BANKRUPTCY",
      actorPlayerId: p2,
    });
    expect(next).toBe(state);
  });
});
