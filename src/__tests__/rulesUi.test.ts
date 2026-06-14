/**
 * rulesUi.test.ts
 *
 * Logic-only tests (no JSX/DOM) verifying that game rules flow correctly
 * from setup through to initial game state.
 */

import { describe, it, expect } from "vitest";
import { createInitialGameState } from "@/lib/game/createInitialGameState";
import { gameReducer } from "@/lib/game/gameReducer";
import { RoomManager } from "@/lib/multiplayer/rooms";
import { DEFAULT_RULES } from "@/types/game";
import type { GameRules } from "@/types/game";
import { makePlayer } from "./helpers/factory";

// ── Default rules ─────────────────────────────────────────────────────────────

describe("rules defaults", () => {
  it("DEFAULT_RULES has all 6 rules set to true", () => {
    const keys: (keyof GameRules)[] = [
      "doubleRentOnFullSet",
      "freeParkingCash",
      "auctions",
      "noRentInJail",
      "mortgages",
      "evenBuild",
    ];
    for (const key of keys) {
      expect(DEFAULT_RULES[key]).toBe(true);
    }
  });
});

// ── createInitialGameState ────────────────────────────────────────────────────

describe("createInitialGameState rules", () => {
  it("uses DEFAULT_RULES when no rules argument is provided", () => {
    const state = createInitialGameState([makePlayer(0), makePlayer(1)]);
    expect(state.rules).toEqual(DEFAULT_RULES);
  });

  it("stores custom rules when provided", () => {
    const custom: GameRules = {
      ...DEFAULT_RULES,
      auctions: false,
      mortgages: false,
    };
    const state = createInitialGameState([makePlayer(0), makePlayer(1)], custom);
    expect(state.rules.auctions).toBe(false);
    expect(state.rules.mortgages).toBe(false);
    // Others unchanged
    expect(state.rules.freeParkingCash).toBe(true);
  });

  it("initialises freeParkingPot to 0 regardless of rules", () => {
    const state = createInitialGameState([makePlayer(0), makePlayer(1)]);
    expect(state.freeParkingPot).toBe(0);
  });
});

// ── START_GAME action ─────────────────────────────────────────────────────────

describe("START_GAME action rules", () => {
  it("passes custom rules into game state", () => {
    const setupState = createInitialGameState([makePlayer(0), makePlayer(1)]);
    const customRules: GameRules = { ...DEFAULT_RULES, auctions: false };
    const result = gameReducer(setupState, {
      type: "START_GAME",
      players: [makePlayer(0), makePlayer(1)],
      rules: customRules,
    });
    expect(result.rules.auctions).toBe(false);
  });

  it("uses DEFAULT_RULES when START_GAME has no rules field", () => {
    const setupState = createInitialGameState([makePlayer(0), makePlayer(1)]);
    const result = gameReducer(setupState, {
      type: "START_GAME",
      players: [makePlayer(0), makePlayer(1)],
    });
    expect(result.rules).toEqual(DEFAULT_RULES);
  });
});

// ── Rules are immutable after game starts ─────────────────────────────────────

describe("rules immutability", () => {
  it("rules in game state do not change after rolling dice", () => {
    const customRules: GameRules = { ...DEFAULT_RULES, auctions: false };
    let state = createInitialGameState([makePlayer(0), makePlayer(1)], customRules);
    // Simulate a dice roll
    state = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 1, die2: 2, total: 3, isDouble: false },
    });
    expect(state.rules.auctions).toBe(false);
    expect(state.rules).toEqual(customRules);
  });
});

// ── RoomManager startGame passes rules ───────────────────────────────────────

describe("RoomManager startGame rules", () => {
  function makeRoom() {
    const manager = new RoomManager();
    const { playerId, room } = manager.createRoom(
      {
        displayName: "Alice",
        token: "car",
        tokenLabel: "CAR",
        color: "#ef4444",
      },
      "socket-alice",
    );
    manager.joinRoom(
      {
        roomCode: room.roomCode,
        displayName: "Bob",
        token: "hat",
        tokenLabel: "HAT",
        color: "#2563eb",
      },
      "socket-bob",
    );
    return { manager, hostPlayerId: playerId, roomCode: room.roomCode };
  }

  it("passes custom rules to game state", () => {
    const { manager, hostPlayerId, roomCode } = makeRoom();
    const customRules: GameRules = { ...DEFAULT_RULES, freeParkingCash: false };
    const result = manager.startGame(roomCode, hostPlayerId, customRules);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.gameState.rules.freeParkingCash).toBe(false);
    }
  });

  it("uses DEFAULT_RULES when no rules provided", () => {
    const { manager, hostPlayerId, roomCode } = makeRoom();
    const result = manager.startGame(roomCode, hostPlayerId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.gameState.rules).toEqual(DEFAULT_RULES);
    }
  });

  it("rules cannot change after game starts — subsequent startGame is rejected", () => {
    const { manager, hostPlayerId, roomCode } = makeRoom();
    const first = manager.startGame(roomCode, hostPlayerId);
    expect(first.ok).toBe(true);
    // Trying to start again should fail
    const second = manager.startGame(roomCode, hostPlayerId);
    expect(second.ok).toBe(false);
  });
});
