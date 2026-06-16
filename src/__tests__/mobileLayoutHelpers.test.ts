import { describe, it, expect } from "vitest";
import { getBoardSpaceAnchorId, getCurrentPlayerSpaceIndex } from "@/lib/ui/mobileLayoutHelpers";
import { makeGameState, withPosition } from "@/__tests__/helpers/factory";

describe("getBoardSpaceAnchorId", () => {
  it("maps valid indices to stable, unique anchor ids", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const id = getBoardSpaceAnchorId(i);
      expect(id).toBe(`board-space-${i}`);
      ids.add(id);
    }
    expect(ids.size).toBe(40);
  });
});

describe("getCurrentPlayerSpaceIndex", () => {
  it("returns the current player's position (GO at start)", () => {
    const state = makeGameState();
    expect(getCurrentPlayerSpaceIndex(state)).toBe(0);
  });

  it("targets the current player's position after moving", () => {
    let state = makeGameState();
    state = withPosition(state, 15);
    expect(getCurrentPlayerSpaceIndex(state)).toBe(15);
  });

  it("combines with getBoardSpaceAnchorId to find the current player's tile id", () => {
    let state = makeGameState();
    state = withPosition(state, 27);
    const anchorId = getBoardSpaceAnchorId(getCurrentPlayerSpaceIndex(state));
    expect(anchorId).toBe("board-space-27");
  });
});
