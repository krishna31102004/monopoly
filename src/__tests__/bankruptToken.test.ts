import { describe, it, expect } from "vitest";
import { getRenderablePlayersForSpace } from "@/lib/game/boardRender";
import { gameReducer } from "@/lib/game/gameReducer";
import { makeGameState, withPlayer, withPosition } from "./helpers/factory";

describe("getRenderablePlayersForSpace", () => {
  it("includes non-bankrupt players on the given space", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { position: 5 });
    state = withPlayer(state, 1, { position: 7 });
    const result = getRenderablePlayersForSpace(state.players, 5);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(state.players[0].id);
  });

  it("excludes bankrupt players even if their position matches the space", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { position: 5, isBankrupt: true });
    const result = getRenderablePlayersForSpace(state.players, 5);
    expect(result).toHaveLength(0);
  });

  it("filters bankrupt player from a shared space, keeping the non-bankrupt one", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { position: 5, isBankrupt: true });
    state = withPlayer(state, 1, { position: 5 });
    const result = getRenderablePlayersForSpace(state.players, 5);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(state.players[1].id);
  });

  it("returns empty array for a space with no players", () => {
    const state = makeGameState(2);
    const result = getRenderablePlayersForSpace(state.players, 99);
    expect(result).toHaveLength(0);
  });

  it("non-bankrupt players on the same space are all included", () => {
    let state = makeGameState(3);
    state = withPlayer(state, 0, { position: 10 });
    state = withPlayer(state, 1, { position: 10 });
    state = withPlayer(state, 2, { position: 10, isBankrupt: true });
    const result = getRenderablePlayersForSpace(state.players, 10);
    expect(result).toHaveLength(2);
    expect(result.every((p) => !p.isBankrupt)).toBe(true);
  });
});

describe("Bankruptcy gameplay side effects", () => {
  it("bankrupt player is excluded from new auction's activePlayerIds", () => {
    let state = makeGameState(3);
    state = withPlayer(state, 2, { isBankrupt: true });
    state = withPosition(state, 38);
    state = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 3, die2: 0, total: 3, isDouble: false },
    });
    state = gameReducer(state, { type: "DECLINE_PROPERTY" });
    expect(state.auction?.activePlayerIds).not.toContain(state.players[2].id);
  });
});
