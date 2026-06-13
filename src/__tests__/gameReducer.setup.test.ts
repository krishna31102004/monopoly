import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { createSetupGameState } from "@/lib/game/createInitialGameState";
import { makeGameState, makePlayer } from "./helpers/factory";

describe("Game setup", () => {
  it("initial state is setup phase", () => {
    const state = createSetupGameState();
    expect(state.phase).toBe("setup");
    expect(state.players).toHaveLength(0);
  });

  it("START_GAME with 2 players initializes correctly", () => {
    const setup = createSetupGameState();
    const state = gameReducer(setup, {
      type: "START_GAME",
      players: [makePlayer(0), makePlayer(1)],
    });
    expect(state.players).toHaveLength(2);
    expect(state.phase).toBe("readyToRoll");
    expect(state.currentPlayerIndex).toBe(0);
  });

  it("START_GAME with 6 players works", () => {
    const setup = createSetupGameState();
    const state = gameReducer(setup, {
      type: "START_GAME",
      players: [0, 1, 2, 3, 4, 5].map(makePlayer),
    });
    expect(state.players).toHaveLength(6);
    expect(state.phase).toBe("readyToRoll");
  });

  it("all players start at GO (position 0)", () => {
    const state = makeGameState(4);
    for (const player of state.players) {
      expect(player.position).toBe(0);
    }
  });

  it("all players start with $1500", () => {
    const state = makeGameState(4);
    for (const player of state.players) {
      expect(player.cash).toBe(1500);
    }
  });

  it("no player starts bankrupt", () => {
    const state = makeGameState(4);
    for (const player of state.players) {
      expect(player.isBankrupt).toBe(false);
    }
  });

  it("no player starts in Jail", () => {
    const state = makeGameState(4);
    for (const player of state.players) {
      expect(player.isInJail).toBe(false);
      expect(player.jailTurns).toBe(0);
    }
  });

  it("all players start with 0 Get Out of Jail Free cards", () => {
    const state = makeGameState(4);
    for (const player of state.players) {
      expect(player.getOutOfJailFreeCards).toBe(0);
    }
  });

  it("all ownerships start unowned", () => {
    const state = makeGameState(2);
    for (const o of state.ownerships) {
      expect(o.ownerId).toBeNull();
      expect(o.isMortgaged).toBe(false);
      expect(o.houses).toBe(0);
      expect(o.hasHotel).toBe(false);
    }
  });

  it("Chance and Community Chest decks are initialized and non-empty", () => {
    const state = makeGameState(2);
    expect(state.chanceDeck.length).toBeGreaterThan(0);
    expect(state.communityChestDeck.length).toBeGreaterThan(0);
  });

  it("game log has a start entry", () => {
    const state = makeGameState(2);
    expect(state.gameLog.length).toBeGreaterThan(0);
    expect(state.gameLog[0].message).toMatch(/started/i);
  });

  it("players have unique IDs", () => {
    const state = makeGameState(6);
    const ids = state.players.map((p) => p.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("log entries have id and createdAt fields", () => {
    const state = makeGameState(2);
    for (const entry of state.gameLog) {
      expect(entry.id).toBeTruthy();
      expect(entry.createdAt).toBeTruthy();
    }
  });

  it("phase is readyToRoll after game start", () => {
    const state = makeGameState(2);
    expect(state.phase).toBe("readyToRoll");
  });

  it("winnerId is null at game start", () => {
    const state = makeGameState(2);
    expect(state.winnerId).toBeNull();
  });

  it("drawnCard is null at game start", () => {
    const state = makeGameState(2);
    expect(state.drawnCard).toBeNull();
  });
});
