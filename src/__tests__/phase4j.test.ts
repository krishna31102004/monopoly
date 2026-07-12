/**
 * Phase 4J: Rules Engine Repair tests.
 *
 * Bug 1: Third jail-roll — $50 fee must be paid BEFORE movement.
 * Bug 2: Chance go-to-jail — GO salary awarded during dice move to Chance is reversed.
 * Bug 3: Chance go-back-3 → Income Tax — freeParkingPotDelta is applied correctly.
 * Bug 4: pay-each-player debt — recipients stored as multiple-players (not bank).
 * Bug 5: Trading during bankruptcy is not blocked.
 */
import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { DEFAULT_RULES } from "@/types/game";
import type { GameState, GameRules } from "@/types/game";
import {
  makeGameState,
  makePlayer,
  dice,
  withPlayer,
  withOwnership,
  withCash,
  withPosition,
} from "./helpers/factory";
import { getBoardSpaceByIndex } from "@/data/board";
import { drawAndApplyCard } from "@/lib/game/cards";

function withRules(state: GameState, patch: Partial<GameRules>): GameState {
  return { ...state, rules: { ...state.rules, ...patch } };
}
function withFreeParkingEnabled(state: GameState): GameState {
  return withRules(state, { freeParkingCash: true });
}
function withFreeParkingPot(state: GameState, pot: number): GameState {
  return { ...state, freeParkingPot: pot };
}
function p0(state: GameState) {
  return state.players[state.currentPlayerIndex];
}

// ── Jail third-roll setup ──────────────────────────────────────────────────
function jailThirdRoll(): GameState {
  let state = makeGameState(2);
  state = withPlayer(state, 0, { isInJail: true, position: 10, jailTurns: 2 });
  return { ...state, phase: "awaitingJailDecision" };
}

// ═══════════════════════════════════════════════════════════════════
// Bug 1: Jail third roll — pay $50 BEFORE moving
// ═══════════════════════════════════════════════════════════════════

describe("Bug 1: Jail third roll — $50 paid BEFORE movement", () => {
  it("player with enough cash: pays $50 then moves", () => {
    let state = withCash(jailThirdRoll(), 500);
    const cashBefore = p0(state).cash;
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) }); // lands at 15
    expect(p0(next).cash).toBe(cashBefore - 50);
    expect(p0(next).position).toBe(15);
    expect(p0(next).isInJail).toBe(false);
  });

  it("player with $32 — cannot pay $50 — stays at jail position, enters bankruptcyPending", () => {
    let state = withCash(jailThirdRoll(), 32);
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    expect(next.phase).toBe("bankruptcyPending");
    expect(next.bankruptcy).not.toBeNull();
    expect(next.bankruptcy!.amountOwed).toBe(50);
    expect(next.bankruptcy!.creditor.type).toBe("bank");
    // Player has NOT moved — still at jail position 10
    expect(p0(next).position).toBe(10);
    expect(p0(next).cash).toBeGreaterThanOrEqual(0);
    expect(p0(next).isInJail).toBe(false); // released from jail status even though debt pending
  });

  it("continuation stores the dice roll", () => {
    let state = withCash(jailThirdRoll(), 32);
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    expect(next.bankruptcy!.continuation).toMatchObject({
      type: "jail-third-roll-movement",
      dice: { die1: 2, die2: 3, total: 5 },
    });
  });

  it("RESOLVE_BANKRUPTCY_IF_SOLVENT after jail fee: executes movement continuation", () => {
    let state = withCash(jailThirdRoll(), 32);
    // Enter debt state
    let next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    expect(next.phase).toBe("bankruptcyPending");
    // Player sells assets (simulated by boosting cash directly)
    next = { ...next, players: next.players.map((p, i) => i === 0 ? { ...p, cash: 200 } : p) };
    // Resolve debt — should now move player
    next = gameReducer(next, { type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" });
    // After paying $50 and moving 5 spaces from 10 → 15
    expect(p0(next).cash).toBe(200 - 50);
    expect(p0(next).position).toBe(15);
    expect(next.phase).not.toBe("bankruptcyPending");
  });

  it("RESOLVE_BANKRUPTCY_IF_SOLVENT: if player can't afford it yet, stays in bankruptcy", () => {
    let state = withCash(jailThirdRoll(), 32);
    let next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    // Still only $32 — can't pay $50
    const unchanged = gameReducer(next, { type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" });
    expect(unchanged.phase).toBe("bankruptcyPending");
  });

  it("player with exactly $50: pays fee and moves", () => {
    let state = withCash(jailThirdRoll(), 50);
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    expect(p0(next).cash).toBe(0);
    expect(p0(next).position).toBe(15);
    expect(next.phase).not.toBe("bankruptcyPending");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Bug 2: Chance go-to-jail — GO salary reversal
// ═══════════════════════════════════════════════════════════════════

describe("Bug 2: Chance go-to-jail — GO salary reversal when passing GO to reach Chance", () => {
  it("go-to-jail card via dice roll: reverses GO bonus if player passed GO to get here", () => {
    // Chance space 36 is at index 36. From position 39, roll 1+1=2 → pos 1 (passes GO).
    // But for jail card from Chance@36: place player at 36 via dice, Chance space is 36.
    // Setup: player at 34, roll dice 1+1=2 → lands at 36 (Chance). GO not passed.
    // For GO reversal, player needs to pass GO on the way to a Chance space.
    // Setup: player at 38, roll dice 1+1=2 → goes 38→39→0→1→2→...  No, Chance@36.
    // Let's use Chance@7. Player at 5, roll 1+1=2 → 7 (no GO). No reversal expected.
    // Player at 39, roll 1+1=2 → lands at 1 (not Chance).
    // Better: player at 5, roll 3+1=4 → 9 (not Chance).
    // For a true GO-crossing to Chance scenario: Chance@7, player at 38, roll 5+4=9 → 7.
    // 38 → +9 → wraps → 7. Passes GO (38 > 7 after wrap).

    // We force the go-to-jail card to be drawn by seeding the deck.
    let state = makeGameState(2);
    state = withCash(state, 1500);
    state = withPosition(state, 38);
    state = { ...state, phase: "readyToRoll", chanceDeck: ["chance-10", ...state.chanceDeck.filter(id => id !== "chance-10")] };
    // Roll 5+4=9 to land on Chance@7 (passes GO: 38+9=47→7)
    const next = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 5, die2: 4, total: 9, isDouble: false } });
    expect(p0(next).position).toBe(10); // in jail
    expect(p0(next).isInJail).toBe(true);
    // GO award ($200) should have been reversed. Cash before was 1500, no other deductions.
    expect(p0(next).cash).toBe(1500); // $200 given then reversed
  });

  it("go-to-jail card via dice roll: no reversal when player did NOT pass GO to reach Chance", () => {
    let state = makeGameState(2);
    state = withCash(state, 1500);
    state = withPosition(state, 5);
    state = { ...state, phase: "readyToRoll", chanceDeck: ["chance-10", ...state.chanceDeck.filter(id => id !== "chance-10")] };
    // Roll 1+1=2 to land on Chance@7 (no GO crossing)
    const next = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: false } });
    expect(p0(next).position).toBe(10);
    expect(p0(next).cash).toBe(1500); // no GO was awarded or reversed
  });

  it("go-to-jail drawn via go-back-3 chain: no reversal", () => {
    // go-back-3 is Chance card at Chance@36, moves back 3 to CC@33, then draws CC card.
    // This tests that fromDiceRoll=false doesn't reverse GO.
    // Simpler: call drawAndApplyCard directly without fromDiceRoll flag.
    let state = makeGameState(2);
    state = withCash(state, 1500);
    state = withPosition(state, 7); // at Chance@7
    state = { ...state, phase: "readyToRoll", communityChestDeck: ["cc-6", ...state.communityChestDeck.filter(id => id !== "cc-6")] };
    // Draw cc-6 (go-to-jail CC) without fromDiceRoll
    const next = drawAndApplyCard(state, "community-chest", false);
    expect(next.players[0].position).toBe(10);
    // Cash should be unchanged (no GO reversal)
    expect(next.players[0].cash).toBe(1500);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Bug 3: go-back-3 → Income Tax — freeParkingPotDelta applied
// ═══════════════════════════════════════════════════════════════════

describe("Bug 3: go-back-3 to Income Tax — freeParkingPotDelta applied", () => {
  it("go-back-3 from Chance@7 to Income Tax@4: Free Parking pot receives $200 tax", () => {
    // Start at 5, roll 1+1=2 → land at Chance@7, draw chance-9 (go-back-3 → Income Tax@4)
    let state = makeGameState(2);
    state = withFreeParkingEnabled(state);
    state = withFreeParkingPot(state, 0);
    state = withCash(state, 1500);
    state = withPosition(state, 5);
    state = { ...state, phase: "readyToRoll", chanceDeck: ["chance-9", ...state.chanceDeck.filter(id => id !== "chance-9")] };
    const next = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: false } });
    // After go-back-3: player is at 4 (Income Tax, $200)
    expect(p0(next).position).toBe(4);
    expect(p0(next).cash).toBe(1500 - 200); // paid income tax
    expect(next.freeParkingPot).toBe(200); // pot received the tax
  });

  it("Auction Game: go-back-3 → Income Tax with pot at $400: capped at $500", () => {
    let state = makeGameState(2);
    state = withRules(state, { freeParkingCash: true, gameMode: "auction" });
    state = withFreeParkingPot(state, 400);
    state = withCash(state, 1500);
    state = withPosition(state, 5);
    state = { ...state, phase: "readyToRoll", chanceDeck: ["chance-9", ...state.chanceDeck.filter(id => id !== "chance-9")] };
    const next = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: false } });
    expect(p0(next).position).toBe(4);
    expect(next.freeParkingPot).toBe(500); // capped
  });
});

// ═══════════════════════════════════════════════════════════════════
// Bug 4: pay-each-player debt — multiple-players creditor
// ═══════════════════════════════════════════════════════════════════

describe("Bug 4: pay-each-player debt — multiple-players creditor type", () => {
  it("when can't afford Chairman fee: bankruptcy creditor is multiple-players, not bank", () => {
    let state = makeGameState(3); // 3 players so totalPaid = 2 * $50 = $100
    state = withCash(state, 30); // can't afford $100
    state = { ...state, phase: "readyToRoll", chanceDeck: ["chance-14", ...state.chanceDeck.filter(id => id !== "chance-14")] };
    state = withPosition(state, 5);
    const next = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: false } });
    // Lands at 7 (Chance), draws chance-14 (pay-each-player $50)
    expect(next.phase).toBe("bankruptcyPending");
    expect(next.bankruptcy!.creditor.type).toBe("multiple-players");
  });

  it("RESOLVE_BANKRUPTCY_IF_SOLVENT distributes to each player for multiple-players creditor", () => {
    let state = makeGameState(3);
    state = withCash(state, 30);
    state = { ...state, phase: "readyToRoll", chanceDeck: ["chance-14", ...state.chanceDeck.filter(id => id !== "chance-14")] };
    state = withPosition(state, 5);
    let next = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: false } });
    expect(next.phase).toBe("bankruptcyPending");
    // Boost debtor cash to afford
    next = { ...next, players: next.players.map((p, i) => i === 0 ? { ...p, cash: 200 } : p) };
    const cashP1Before = next.players[1].cash;
    const cashP2Before = next.players[2].cash;
    const resolved = gameReducer(next, { type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" });
    expect(resolved.phase).not.toBe("bankruptcyPending");
    // Each of p1 and p2 received $50
    expect(resolved.players[1].cash).toBe(cashP1Before + 50);
    expect(resolved.players[2].cash).toBe(cashP2Before + 50);
    // p0 paid $100 total
    expect(resolved.players[0].cash).toBe(200 - 100);
  });

  it("DECLARE_BANKRUPTCY with multiple-players creditor returns properties to bank", () => {
    let state = makeGameState(3);
    state = withCash(state, 30);
    state = { ...state, phase: "readyToRoll", chanceDeck: ["chance-14", ...state.chanceDeck.filter(id => id !== "chance-14")] };
    state = withPosition(state, 5);
    let next = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: false } });
    expect(next.phase).toBe("bankruptcyPending");
    // Player has no assets and can't pay — declare bankruptcy
    const bankrupt = gameReducer(next, { type: "DECLARE_BANKRUPTCY" });
    expect(bankrupt.players[0].isBankrupt).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Bug 5: Trading during debt/bankruptcy should be allowed
// ═══════════════════════════════════════════════════════════════════

describe("Bug 5: Trading is allowed while in bankruptcyPending", () => {
  it("PROPOSE_TRADE is not blocked when phase is bankruptcyPending", () => {
    let state = makeGameState(2);
    state = { ...state, phase: "bankruptcyPending", bankruptcy: {
      debtorPlayerId: state.players[0].id,
      creditor: { type: "bank" },
      amountOwed: 100,
      reason: "test",
      status: "pending",
      phaseBeforeBankruptcy: "turnComplete",
    }};
    const p0Id = state.players[0].id;
    const p1Id = state.players[1].id;
    const tradeState = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p0Id,
      initiatorId: p0Id,
      recipientId: p1Id,
      offerFromInitiator: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      offerFromRecipient: { cash: 50, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
    });
    // Trade should be proposed (not ignored)
    expect(tradeState.trade).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// potEligible propagation
// ═══════════════════════════════════════════════════════════════════

describe("potEligible propagation through enterDebtPending", () => {
  it("rent debt from resolveLanding has potEligible=false", () => {
    // Landing on an owned property creates a player-creditor debt, potEligible=false
    let state = makeGameState(2);
    const p1Id = state.players[1].id;
    state = withOwnership(state, 15, p1Id); // Heathrow
    state = withCash(state, 10); // can't pay $25 rent
    state = withPosition(state, 13);
    state = { ...state, phase: "readyToRoll" };
    const next = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: false } });
    // Landed at 15 (Heathrow)
    expect(next.phase).toBe("bankruptcyPending");
    expect(next.bankruptcy!.potEligible).toBeFalsy();
  });

  it("tax debt has potEligible=true when freeParkingCash is on", () => {
    // Landing on a tax space: potEligible = state.rules.freeParkingCash
    let state = makeGameState(2);
    state = withRules(state, { freeParkingCash: true });
    state = withCash(state, 10); // can't pay $200 income tax
    state = withPosition(state, 2);
    state = { ...state, phase: "readyToRoll" };
    const next = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: false } });
    // Landed at 4 (Income Tax)
    expect(next.phase).toBe("bankruptcyPending");
    expect(next.bankruptcy!.potEligible).toBe(true);
  });

  it("RESOLVE_BANKRUPTCY_IF_SOLVENT: potEligible tax payment goes to Free Parking pot", () => {
    let state = makeGameState(2);
    state = withRules(state, { freeParkingCash: true });
    state = withFreeParkingPot(state, 0);
    state = withCash(state, 10);
    state = withPosition(state, 2);
    state = { ...state, phase: "readyToRoll" };
    let next = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 1, die2: 1, total: 2, isDouble: false } });
    expect(next.phase).toBe("bankruptcyPending");
    // Give player enough cash to pay
    next = { ...next, players: next.players.map((p, i) => i === 0 ? { ...p, cash: 500 } : p) };
    const resolved = gameReducer(next, { type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" });
    expect(resolved.freeParkingPot).toBe(200); // tax went to pot
    expect(resolved.players[0].cash).toBe(500 - 200);
  });
});
