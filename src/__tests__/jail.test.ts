import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import {
  makeGameState,
  dice,
  withPosition,
  withPlayer,
  currentPlayer,
  playerAt,
  withOwnership,
} from "./helpers/factory";

/** Helper: build a state where current player is in jail */
function jailedState(playerCount = 2) {
  const state = makeGameState(playerCount);
  return withPlayer(state, 0, { isInJail: true, jailTurns: 0, position: 10 });
}

describe("Going to Jail", () => {
  it("landing on Go To Jail space (index 30) sends player to Jail", () => {
    const state = withPosition(makeGameState(), 24);
    const next = gameReducer(state, { type: "ROLL_DICE", dice: dice(3, 3) });
    // 24 + 6 = 30 (Go To Jail). But wait: 3+3 is doubles, doublesCount goes to 1.
    // Actually doubles at position 24 → 30 (Go To Jail) should jail them
    const p = currentPlayer(next);
    expect(p.isInJail).toBe(true);
    expect(p.position).toBe(10);
  });

  it("landing on Go To Jail ends turn (turnComplete or next turn)", () => {
    const state = withPosition(makeGameState(), 24);
    const next = gameReducer(state, { type: "ROLL_DICE", dice: dice(3, 3) });
    // Go To Jail cancels extra roll from doubles and moves to next turn
    expect(next.phase).not.toBe("readyToRoll");
    // Current player should have moved to jail
    expect(currentPlayer(next).isInJail).toBe(true);
  });

  it("player in jail starts turn in awaitingJailDecision phase", () => {
    const state = makeGameState(2);
    // Jail player 1 via Go To Jail landing
    const s1 = withPosition(state, 24);
    const jailed = gameReducer(s1, { type: "ROLL_DICE", dice: dice(3, 3) });
    // Now it should be player 2's turn
    // End the (potentially wrapped) turn to get to next player
    const ended =
      jailed.phase === "turnComplete"
        ? gameReducer(jailed, { type: "END_TURN" })
        : jailed;
    // Player 1 (index 0) is in jail, player 2's turn is readyToRoll
    // Now end player 2's turn
    const p2pos = withPosition({ ...ended }, 5);
    const p2rolled = gameReducer(p2pos, { type: "ROLL_DICE", dice: dice(2, 3) });
    const p2ended = gameReducer(p2rolled, { type: "END_TURN" });
    // Should be back to player 1 (in jail) → awaitingJailDecision
    expect(p2ended.currentPlayerIndex).toBe(0);
    expect(p2ended.phase).toBe("awaitingJailDecision");
  });
});

describe("PAY_JAIL_FEE", () => {
  it("deducts $50 from player cash", () => {
    const state = { ...jailedState(), phase: "awaitingJailDecision" as const };
    const cashBefore = currentPlayer(state).cash;
    const next = gameReducer(state, { type: "PAY_JAIL_FEE" });
    expect(currentPlayer(next).cash).toBe(cashBefore - 50);
  });

  it("releases player from Jail", () => {
    const state = { ...jailedState(), phase: "awaitingJailDecision" as const };
    const next = gameReducer(state, { type: "PAY_JAIL_FEE" });
    expect(currentPlayer(next).isInJail).toBe(false);
  });

  it("resets jailTurns to 0", () => {
    const state = { ...withPlayer(jailedState(), 0, { jailTurns: 2 }), phase: "awaitingJailDecision" as const };
    const next = gameReducer(state, { type: "PAY_JAIL_FEE" });
    expect(currentPlayer(next).jailTurns).toBe(0);
  });

  it("sets phase to readyToRoll so player can roll", () => {
    const state = { ...jailedState(), phase: "awaitingJailDecision" as const };
    const next = gameReducer(state, { type: "PAY_JAIL_FEE" });
    expect(next.phase).toBe("readyToRoll");
  });

  it("creates a log entry", () => {
    const state = { ...jailedState(), phase: "awaitingJailDecision" as const };
    const next = gameReducer(state, { type: "PAY_JAIL_FEE" });
    const found = next.gameLog.some((e) => e.message.toLowerCase().includes("paid") && e.message.includes("50"));
    expect(found).toBe(true);
  });

  it("is ignored when phase is not awaitingJailDecision", () => {
    const state = makeGameState();
    const before = currentPlayer(state).cash;
    const next = gameReducer(state, { type: "PAY_JAIL_FEE" });
    expect(currentPlayer(next).cash).toBe(before); // unchanged
  });
});

describe("USE_JAIL_CARD", () => {
  it("releases player from Jail", () => {
    const state = {
      ...withPlayer(jailedState(), 0, { getOutOfJailFreeCards: 1 }),
      phase: "awaitingJailDecision" as const,
    };
    const next = gameReducer(state, { type: "USE_JAIL_CARD" });
    expect(currentPlayer(next).isInJail).toBe(false);
  });

  it("decrements getOutOfJailFreeCards by 1", () => {
    const state = {
      ...withPlayer(jailedState(), 0, { getOutOfJailFreeCards: 1 }),
      phase: "awaitingJailDecision" as const,
    };
    const next = gameReducer(state, { type: "USE_JAIL_CARD" });
    expect(currentPlayer(next).getOutOfJailFreeCards).toBe(0);
  });

  it("sets phase to readyToRoll", () => {
    const state = {
      ...withPlayer(jailedState(), 0, { getOutOfJailFreeCards: 1 }),
      phase: "awaitingJailDecision" as const,
    };
    const next = gameReducer(state, { type: "USE_JAIL_CARD" });
    expect(next.phase).toBe("readyToRoll");
  });

  it("is ignored if player has no GOJF card", () => {
    const state = { ...jailedState(), phase: "awaitingJailDecision" as const };
    const next = gameReducer(state, { type: "USE_JAIL_CARD" });
    expect(currentPlayer(next).isInJail).toBe(true); // still in jail
  });

  it("returns card to chance deck", () => {
    const state = {
      ...withPlayer(jailedState(), 0, { getOutOfJailFreeCards: 1 }),
      phase: "awaitingJailDecision" as const,
      chanceDeck: ["chance-1"],
    };
    const next = gameReducer(state, { type: "USE_JAIL_CARD" });
    expect(next.chanceDeck).toContain("chance-8");
  });

  it("creates a log entry", () => {
    const state = {
      ...withPlayer(jailedState(), 0, { getOutOfJailFreeCards: 1 }),
      phase: "awaitingJailDecision" as const,
    };
    const next = gameReducer(state, { type: "USE_JAIL_CARD" });
    const found = next.gameLog.some((e) =>
      e.message.toLowerCase().includes("get out of jail"),
    );
    expect(found).toBe(true);
  });
});

describe("ROLL_IN_JAIL: doubles release", () => {
  it("rolling doubles releases player from jail", () => {
    const state = { ...jailedState(), phase: "awaitingJailDecision" as const };
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(3, 3) });
    expect(currentPlayer(next).isInJail).toBe(false);
  });

  it("player moves by dice total after doubles release from jail", () => {
    const state = { ...jailedState(), phase: "awaitingJailDecision" as const };
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(3, 3) });
    // Position 10 + 6 = 16 (Sharjah)
    expect(currentPlayer(next).position).toBe(16);
  });

  it("rolling doubles in jail does NOT grant an extra roll", () => {
    const state = { ...jailedState(), phase: "awaitingJailDecision" as const };
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(3, 3) });
    // doublesCount should be 0 — no extra roll
    expect(next.doublesCount).toBe(0);
    // Phase should not be readyToRoll from doubles bonus
    expect(next.phase).not.toBe("readyToRoll");
  });

  it("jail turns reset to 0 after doubles release", () => {
    const state = {
      ...withPlayer(jailedState(), 0, { jailTurns: 2 }),
      phase: "awaitingJailDecision" as const,
    };
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(3, 3) });
    expect(currentPlayer(next).jailTurns).toBe(0);
  });
});

describe("ROLL_IN_JAIL: failed roll", () => {
  it("non-doubles increments jailTurns", () => {
    const state = { ...jailedState(), phase: "awaitingJailDecision" as const };
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    expect(currentPlayer(next).jailTurns).toBe(1);
  });

  it("first failed roll sets phase to turnComplete", () => {
    const state = { ...jailedState(), phase: "awaitingJailDecision" as const };
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    expect(next.phase).toBe("turnComplete");
  });

  it("second failed roll still in jail with jailTurns=2", () => {
    const state = {
      ...withPlayer(jailedState(), 0, { jailTurns: 1 }),
      phase: "awaitingJailDecision" as const,
    };
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    expect(currentPlayer(next).jailTurns).toBe(2);
    expect(currentPlayer(next).isInJail).toBe(true);
    expect(next.phase).toBe("turnComplete");
  });

  it("third failed roll charges $50 and releases player", () => {
    const state = {
      ...withPlayer(jailedState(), 0, { jailTurns: 2 }),
      phase: "awaitingJailDecision" as const,
    };
    const cashBefore = currentPlayer(state).cash;
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    // Position 10 + 5 = 15 (Heathrow Airport, unowned)
    expect(currentPlayer(next).isInJail).toBe(false);
    // Cash: before - $50 (forced release) + landing resolution (no extra deductions for unowned)
    // Unowned airport → awaitingPurchaseDecision, cash not deducted yet
    expect(currentPlayer(next).cash).toBe(cashBefore - 50);
  });

  it("third failed roll moves player by dice total", () => {
    const state = {
      ...withPlayer(jailedState(), 0, { jailTurns: 2 }),
      phase: "awaitingJailDecision" as const,
    };
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    // 10 + 5 = 15 (Heathrow)
    expect(currentPlayer(next).position).toBe(15);
  });

  it("creates log entries for jail roll", () => {
    const state = { ...jailedState(), phase: "awaitingJailDecision" as const };
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(2, 3) });
    const hasRollLog = next.gameLog.some((e) => e.message.includes("rolled"));
    expect(hasRollLog).toBe(true);
  });
});

describe("ROLL_IN_JAIL: ignored when not in jail", () => {
  it("ROLL_IN_JAIL is ignored when phase is not awaitingJailDecision", () => {
    const state = makeGameState();
    const before = currentPlayer(state).position;
    const next = gameReducer(state, { type: "ROLL_IN_JAIL", dice: dice(3, 3) });
    expect(currentPlayer(next).position).toBe(before);
  });
});
