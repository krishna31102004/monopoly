/**
 * noNegativeCash.test.ts
 *
 * Verifies Phase 4D.7: player cash NEVER goes below $0.
 * All mandatory payments (rent, tax, card bank payment, jail fee) that the
 * player cannot afford must create a bankruptcyPending debt state WITHOUT
 * touching the player's cash.
 */

import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { checkBankruptcy } from "@/lib/game/bankruptcy";
import {
  makeGameState,
  withPlayer,
  withOwnership,
  withPosition,
  withMortgage,
  withChanceDeck,
  withCommunityChestDeck,
  playerAt,
  playerById,
} from "@/__tests__/helpers/factory";

// Space indices
const GUADALAJARA = 1; // city, brown group
const CANCUN = 3;      // city, brown group
const JFK = 5;         // airport
const INCOME_TAX = 4;  // $200 tax
const LUXURY_TAX = 38; // $100 tax

// ── Helper ────────────────────────────────────────────────────────────────────

function allPlayerCash(state: ReturnType<typeof makeGameState>) {
  return state.players.filter((p) => !p.isBankrupt).map((p) => p.cash);
}

function assertNonNegativeCash(state: ReturnType<typeof makeGameState>) {
  for (const p of state.players) {
    if (!p.isBankrupt) {
      expect(p.cash).toBeGreaterThanOrEqual(0);
    }
  }
}

// ── Rent cannot make cash negative ───────────────────────────────────────────

describe("No-negative-cash: rent", () => {
  it("rent exceeding cash does NOT reduce cash below zero", () => {
    let state = makeGameState(2);
    const p1id = state.players[1].id;
    // p1 owns Guadalajara; p0 has only $1 (rent > $1)
    state = withOwnership(state, GUADALAJARA, p1id);
    state = withOwnership(state, CANCUN, p1id); // full brown set → double rent
    state = withPlayer(state, 0, { position: 0, cash: 1 });

    // Roll to Guadalajara (1 step from pos 0)
    const next = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 0, total: 1, isDouble: false },
    });

    assertNonNegativeCash(next);
    // Must have entered debt state
    expect(next.phase).toBe("bankruptcyPending");
    expect(next.bankruptcy?.debtorPlayerId).toBe(state.players[0].id);
    expect(next.bankruptcy?.creditor.type).toBe("player");
  });

  it("creditor does NOT receive rent until debt is paid", () => {
    let state = makeGameState(2);
    const p0id = state.players[0].id;
    const p1id = state.players[1].id;
    state = withOwnership(state, GUADALAJARA, p1id);
    state = withOwnership(state, CANCUN, p1id);
    state = withPlayer(state, 0, { position: 0, cash: 1 });

    const p1CashBefore = state.players[1].cash;

    const next = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 0, total: 1, isDouble: false },
    });

    // p1 (creditor) should NOT have received rent yet
    expect(playerById(next, p1id).cash).toBe(p1CashBefore);
  });

  it("bankruptcy state records correct amount owed for rent", () => {
    let state = makeGameState(2);
    const p1id = state.players[1].id;
    state = withOwnership(state, GUADALAJARA, p1id);
    state = withOwnership(state, CANCUN, p1id);
    state = withPlayer(state, 0, { position: 0, cash: 1 });

    const next = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 0, total: 1, isDouble: false },
    });

    expect(next.bankruptcy?.amountOwed).toBeGreaterThan(0);
    expect(next.bankruptcy?.amountOwed).toBeGreaterThan(1); // more than cash player has
  });

  it("debtor can pay rent debt after raising enough cash by mortgaging", () => {
    let state = makeGameState(2);
    const p0id = state.players[0].id;
    const p1id = state.players[1].id;
    state = withOwnership(state, GUADALAJARA, p1id);
    state = withOwnership(state, CANCUN, p1id);
    state = withPlayer(state, 0, { position: 0, cash: 1 });
    // Give p0 an airport to mortgage
    state = withOwnership(state, JFK, p0id);

    const next = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 0, total: 1, isDouble: false },
    });

    expect(next.phase).toBe("bankruptcyPending");
    const amountOwed = next.bankruptcy!.amountOwed;

    // Mortgage JFK to raise cash
    const s2 = gameReducer(next, { type: "MORTGAGE_PROPERTY", spaceIndex: JFK });
    // Now try to resolve — should work if cash >= amountOwed
    if (s2.players.find((p) => p.id === p0id)!.cash >= amountOwed) {
      const s3 = gameReducer(s2, { type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" });
      expect(s3.phase).not.toBe("bankruptcyPending");
      expect(s3.bankruptcy).toBeNull();
      assertNonNegativeCash(s3);
    }
  });

  it("paying rent debt transfers money to creditor", () => {
    let state = makeGameState(2);
    const p0id = state.players[0].id;
    const p1id = state.players[1].id;
    state = withOwnership(state, GUADALAJARA, p1id);
    state = withOwnership(state, CANCUN, p1id);
    state = withPlayer(state, 0, { position: 0, cash: 1 });
    state = withOwnership(state, JFK, p0id);

    const next = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 0, total: 1, isDouble: false },
    });

    const amountOwed = next.bankruptcy!.amountOwed;
    const p1CashBefore = playerById(next, p1id).cash;

    const s2 = gameReducer(next, { type: "MORTGAGE_PROPERTY", spaceIndex: JFK });
    const p0Cash = playerById(s2, p0id).cash;

    if (p0Cash >= amountOwed) {
      const s3 = gameReducer(s2, { type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" });
      // Creditor (p1) should now have received the rent
      expect(playerById(s3, p1id).cash).toBe(p1CashBefore + amountOwed);
      // Debtor's cash should have decreased by amountOwed
      expect(playerById(s3, p0id).cash).toBe(p0Cash - amountOwed);
    }
  });
});

// ── Tax cannot make cash negative ─────────────────────────────────────────────

describe("No-negative-cash: tax", () => {
  it("income tax ($200) exceeding cash does NOT reduce cash below zero", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { position: 1, cash: 50 }); // $50 < $200 income tax

    const next = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 2, total: 3, isDouble: false },
    });
    // Lands on income tax (space 4)
    assertNonNegativeCash(next);
    expect(next.phase).toBe("bankruptcyPending");
    expect(next.bankruptcy?.amountOwed).toBe(200);
    expect(next.bankruptcy?.creditor.type).toBe("bank");
  });

  it("luxury tax ($100) exceeding cash does NOT reduce cash below zero", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { position: 35, cash: 50 }); // $50 < $100 luxury tax

    const next = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 2, total: 3, isDouble: false },
    });
    // Lands on luxury tax (space 38)
    assertNonNegativeCash(next);
    expect(next.phase).toBe("bankruptcyPending");
    expect(next.bankruptcy?.amountOwed).toBe(100);
  });

  it("tax player can afford pays normally — no debt", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { position: 1, cash: 500 }); // $500 > $200

    const next = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 2, total: 3, isDouble: false },
    });

    expect(next.phase).not.toBe("bankruptcyPending");
    assertNonNegativeCash(next);
  });
});

// ── Card bank payment cannot make cash negative ───────────────────────────────

describe("No-negative-cash: pay-bank card", () => {
  it("pay-bank card exceeding cash does NOT reduce cash below zero", () => {
    // cc-3 is a community chest pay-bank card ($50)
    // Space 17 is community chest; position 14 + 3 = 17 (no GO crossing)
    let state = makeGameState(2);
    state = withPlayer(state, 0, { position: 14, cash: 10 }); // $10 < $50
    state = withCommunityChestDeck(state, ["cc-3"]);

    const next = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 2, total: 3, isDouble: false },
    });
    // Lands on community chest (space 17)
    assertNonNegativeCash(next);
    expect(next.phase).toBe("bankruptcyPending");
    expect(next.bankruptcy?.creditor.type).toBe("bank");
  });

  it("pay-bank card affordable pays normally", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { position: 14, cash: 500 }); // $500 > $50
    state = withCommunityChestDeck(state, ["cc-3"]);

    const next = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 2, total: 3, isDouble: false },
    });

    assertNonNegativeCash(next);
    expect(next.phase).not.toBe("bankruptcyPending");
  });
});

// ── Debtor can still declare bankruptcy ───────────────────────────────────────

describe("No-negative-cash: declare bankruptcy from debt state", () => {
  it("debtor can declare bankruptcy when in debt pending state", () => {
    let state = makeGameState(2);
    const p1id = state.players[1].id;
    state = withOwnership(state, GUADALAJARA, p1id);
    state = withOwnership(state, CANCUN, p1id);
    state = withPlayer(state, 0, { position: 0, cash: 1 });

    const next = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 0, total: 1, isDouble: false },
    });

    expect(next.phase).toBe("bankruptcyPending");

    const declared = gameReducer(next, { type: "DECLARE_BANKRUPTCY" });
    expect(declared.players[0].isBankrupt).toBe(true);
  });

  it("winner is correctly determined after bankruptcy declaration from debt state", () => {
    let state = makeGameState(2);
    const p1id = state.players[1].id;
    state = withOwnership(state, GUADALAJARA, p1id);
    state = withOwnership(state, CANCUN, p1id);
    state = withPlayer(state, 0, { position: 0, cash: 1 });

    const next = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 0, total: 1, isDouble: false },
    });

    const declared = gameReducer(next, { type: "DECLARE_BANKRUPTCY" });
    expect(declared.phase).toBe("gameOver");
    expect(declared.winnerId).toBe(p1id);
  });
});

// ── General invariant ─────────────────────────────────────────────────────────

describe("No-negative-cash: general invariant", () => {
  it("RESOLVE_BANKRUPTCY_IF_SOLVENT is a no-op when cash < amountOwed", () => {
    // Player has $30, owes $100
    let state = makeGameState(2);
    state = {
      ...state,
      phase: "bankruptcyPending",
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, cash: 30 } : p,
      ),
      bankruptcy: {
        debtorPlayerId: state.players[0].id,
        creditor: { type: "bank" },
        amountOwed: 100,
        reason: "test",
        status: "pending",
        phaseBeforeBankruptcy: "turnComplete",
      },
    };

    const next = gameReducer(state, { type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" });
    expect(next.phase).toBe("bankruptcyPending"); // unchanged
    expect(next.players[0].cash).toBe(30); // unchanged
  });

  it("RESOLVE_BANKRUPTCY_IF_SOLVENT transfers money when cash >= amountOwed", () => {
    let state = makeGameState(2);
    state = {
      ...state,
      phase: "bankruptcyPending",
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, cash: 150 } : p,
      ),
      bankruptcy: {
        debtorPlayerId: state.players[0].id,
        creditor: { type: "bank" },
        amountOwed: 100,
        reason: "test",
        status: "pending",
        phaseBeforeBankruptcy: "turnComplete",
      },
    };

    const next = gameReducer(state, { type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" });
    expect(next.phase).toBe("turnComplete");
    expect(next.bankruptcy).toBeNull();
    expect(next.players[0].cash).toBe(50); // 150 - 100
    assertNonNegativeCash(next);
  });

  it("RESOLVE_BANKRUPTCY_IF_SOLVENT pays player creditor correctly", () => {
    let state = makeGameState(2);
    const p1id = state.players[1].id;
    const p1CashBefore = state.players[1].cash;
    state = {
      ...state,
      phase: "bankruptcyPending",
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, cash: 200 } : p,
      ),
      bankruptcy: {
        debtorPlayerId: state.players[0].id,
        creditor: { type: "player", playerId: p1id },
        amountOwed: 150,
        reason: "test",
        status: "pending",
        phaseBeforeBankruptcy: "turnComplete",
      },
    };

    const next = gameReducer(state, { type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" });
    expect(next.players[0].cash).toBe(50); // 200 - 150
    expect(playerById(next, p1id).cash).toBe(p1CashBefore + 150);
    assertNonNegativeCash(next);
  });

  it("cash stays non-negative after PAY_JAIL_FEE is rejected when insufficient", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { cash: 10, isInJail: true, jailTurns: 0 });
    state = { ...state, phase: "awaitingJailDecision" };

    // Attempting to pay $50 jail fee with only $10
    const next = gameReducer(state, { type: "PAY_JAIL_FEE" });
    // Should be blocked since player can't afford it
    expect(next.players[0].cash).toBe(10); // unchanged
    expect(next.phase).toBe("awaitingJailDecision"); // unchanged
  });
});
