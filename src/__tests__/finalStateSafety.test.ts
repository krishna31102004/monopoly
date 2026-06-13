import { describe, it, expect } from "vitest";
import { validateGameShape, deserializeGame, importGameJson, serializeGame } from "@/lib/game/persistence";
import { gameReducer } from "@/lib/game/gameReducer";
import { makeGameState } from "@/__tests__/helpers/factory";
import type { GameState } from "@/types/game";

// ── Helper ────────────────────────────────────────────────────────────────────

function rawState(state: GameState): Record<string, unknown> {
  return state as unknown as Record<string, unknown>;
}

// ── validateGameShape ─────────────────────────────────────────────────────────

describe("validateGameShape", () => {
  it("accepts a valid 2-player state", () => {
    const state = makeGameState(2);
    expect(validateGameShape(state)).toBe(true);
  });

  it("accepts a valid 4-player state", () => {
    const state = makeGameState(4);
    expect(validateGameShape(state)).toBe(true);
  });

  it("rejects null", () => {
    expect(validateGameShape(null)).toBe(false);
  });

  it("rejects a number", () => {
    expect(validateGameShape(42)).toBe(false);
  });

  it("rejects a string", () => {
    expect(validateGameShape("state")).toBe(false);
  });

  it("rejects invalid phase", () => {
    const state = { ...makeGameState(2), phase: "unknownPhase" };
    expect(validateGameShape(state)).toBe(false);
  });

  it("rejects player with position < 0", () => {
    const state = makeGameState(2);
    const s = rawState(state);
    const players = (s.players as Record<string, unknown>[]).map((p, i) =>
      i === 0 ? { ...p, position: -1 } : p,
    );
    expect(validateGameShape({ ...s, players })).toBe(false);
  });

  it("rejects player with position > 39", () => {
    const state = makeGameState(2);
    const s = rawState(state);
    const players = (s.players as Record<string, unknown>[]).map((p, i) =>
      i === 0 ? { ...p, position: 40 } : p,
    );
    expect(validateGameShape({ ...s, players })).toBe(false);
  });

  it("rejects currentPlayerIndex >= players.length", () => {
    const state = makeGameState(2);
    expect(validateGameShape({ ...state, currentPlayerIndex: 5 })).toBe(false);
  });

  it("rejects currentPlayerIndex < 0", () => {
    const state = makeGameState(2);
    expect(validateGameShape({ ...state, currentPlayerIndex: -1 })).toBe(false);
  });

  it("rejects invalid phase string", () => {
    expect(validateGameShape({ ...makeGameState(2), phase: "flying" })).toBe(false);
  });

  it("rejects ownership with ownerId not in players", () => {
    const state = makeGameState(2);
    const badOwnerships = state.ownerships.map((o, i) =>
      i === 0 ? { ...o, ownerId: "ghost-player-999" } : o,
    );
    expect(validateGameShape({ ...state, ownerships: badOwnerships })).toBe(false);
  });

  it("accepts ownership with ownerId null", () => {
    const state = makeGameState(2);
    // All default ownerships have ownerId null — verify this still passes
    expect(state.ownerships.every((o) => o.ownerId === null)).toBe(true);
    expect(validateGameShape(state)).toBe(true);
  });

  it("accepts ownership with ownerId pointing to existing player", () => {
    const state = makeGameState(2);
    const ownerships = state.ownerships.map((o, i) =>
      i === 0 ? { ...o, ownerId: state.players[0].id } : o,
    );
    expect(validateGameShape({ ...state, ownerships })).toBe(true);
  });

  it("rejects winnerId pointing to non-existent player", () => {
    const state = makeGameState(2);
    expect(
      validateGameShape({ ...state, phase: "gameOver", winnerId: "ghost-player-999" }),
    ).toBe(false);
  });

  it("accepts winnerId pointing to existing player", () => {
    const state = makeGameState(2);
    expect(
      validateGameShape({ ...state, phase: "gameOver", winnerId: state.players[1].id }),
    ).toBe(true);
  });

  it("rejects auction with startedByPlayerId not in players", () => {
    const state = makeGameState(2);
    const badState = {
      ...state,
      auction: {
        spaceIndex: 1,
        propertyName: "Guadalajara",
        startedByPlayerId: "ghost-player",
        currentBid: 0,
        highBidderId: null,
        activeBidderIds: [state.players[0].id],
        passedPlayerIds: [],
        minimumNextBid: 10,
        status: "active",
        currentAuctionBidderId: state.players[0].id,
      },
    };
    expect(validateGameShape(badState)).toBe(false);
  });

  it("rejects auction with highBidderId not in players", () => {
    const state = makeGameState(2);
    const badState = {
      ...state,
      auction: {
        spaceIndex: 1,
        propertyName: "Guadalajara",
        startedByPlayerId: state.players[0].id,
        currentBid: 50,
        highBidderId: "ghost-player",
        activeBidderIds: [state.players[0].id],
        passedPlayerIds: [],
        minimumNextBid: 60,
        status: "active",
        currentAuctionBidderId: state.players[0].id,
      },
    };
    expect(validateGameShape(badState)).toBe(false);
  });

  it("rejects trade with initiatorPlayerId not in players", () => {
    const state = makeGameState(2);
    const badState = {
      ...state,
      trade: {
        initiatorPlayerId: "ghost-player",
        recipientPlayerId: state.players[1].id,
        offerFromInitiator: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
        offerFromRecipient: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      },
    };
    expect(validateGameShape(badState)).toBe(false);
  });

  it("rejects trade with recipientPlayerId not in players", () => {
    const state = makeGameState(2);
    const badState = {
      ...state,
      trade: {
        initiatorPlayerId: state.players[0].id,
        recipientPlayerId: "ghost-player",
        offerFromInitiator: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
        offerFromRecipient: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      },
    };
    expect(validateGameShape(badState)).toBe(false);
  });

  it("rejects bankruptcy with debtorPlayerId not in players", () => {
    const state = makeGameState(2);
    const badState = {
      ...state,
      phase: "bankruptcyPending",
      bankruptcy: {
        debtorPlayerId: "ghost-player",
        creditor: { type: "bank" },
        amountOwed: 50,
        reason: "test",
        status: "pending",
        phaseBeforeBankruptcy: "turnComplete",
      },
    };
    expect(validateGameShape(badState)).toBe(false);
  });

  it("rejects bankruptcy with invalid phaseBeforeBankruptcy", () => {
    const state = makeGameState(2);
    const badState = {
      ...state,
      phase: "bankruptcyPending",
      bankruptcy: {
        debtorPlayerId: state.players[0].id,
        creditor: { type: "bank" },
        amountOwed: 50,
        reason: "test",
        status: "pending",
        phaseBeforeBankruptcy: "notAPhase",
      },
    };
    expect(validateGameShape(badState)).toBe(false);
  });

  it("rejects missing players array", () => {
    const state = makeGameState(2);
    const bad = { ...rawState(state), players: undefined };
    expect(validateGameShape(bad)).toBe(false);
  });

  it("rejects non-array ownerships", () => {
    const state = makeGameState(2);
    expect(validateGameShape({ ...state, ownerships: {} })).toBe(false);
  });
});

// ── Corrupt save does not crash ───────────────────────────────────────────────

describe("Corrupt save safety", () => {
  it("deserializeGame does not throw on completely corrupt JSON", () => {
    expect(() => deserializeGame("corruption!!!")).not.toThrow();
    expect(deserializeGame("corruption!!!")).toBeNull();
  });

  it("deserializeGame does not throw on empty string", () => {
    expect(() => deserializeGame("")).not.toThrow();
    expect(deserializeGame("")).toBeNull();
  });

  it("deserializeGame does not throw on deeply nested garbage", () => {
    const garbage = JSON.stringify({ version: 1, state: { players: "not-an-array" } });
    expect(() => deserializeGame(garbage)).not.toThrow();
    expect(deserializeGame(garbage)).toBeNull();
  });

  it("importGameJson does not throw on arbitrary garbage strings", () => {
    expect(() => importGameJson("DROP TABLE users;")).not.toThrow();
    const result = importGameJson("DROP TABLE users;");
    expect(result.ok).toBe(false);
  });

  it("RESET_GAME action restores to setup state", () => {
    const state = makeGameState(2);
    const next = gameReducer(state, { type: "RESET_GAME" });
    expect(next.phase).toBe("setup");
    expect(next.players).toHaveLength(0);
    expect(next.ownerships).toHaveLength(0);
    expect(next.bankruptcy).toBeNull();
    expect(next.trade).toBeNull();
    expect(next.auction).toBeNull();
  });

  it("LOAD_GAME action replaces state entirely", () => {
    const stateA = makeGameState(2);
    const stateB = makeGameState(3);
    const next = gameReducer(stateA, { type: "LOAD_GAME", state: stateB });
    expect(next.players).toHaveLength(3);
  });
});
