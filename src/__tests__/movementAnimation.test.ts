import { describe, it, expect } from "vitest";
import { getBoardMovementPath, isJailTeleport } from "@/lib/animation/movementPath";

describe("getBoardMovementPath", () => {
  it("returns a forward path between two spaces", () => {
    const path = getBoardMovementPath(0, 5);
    expect(path).toEqual([1, 2, 3, 4, 5]);
  });

  it("wraps around GO (0) correctly", () => {
    const path = getBoardMovementPath(38, 2);
    expect(path).toEqual([39, 0, 1, 2]);
  });

  it("returns [toIndex] for same-position (no movement)", () => {
    const path = getBoardMovementPath(7, 7);
    expect(path).toEqual([7]);
  });

  it("handles full-board wrap (1-step back)", () => {
    // from 1 to 0 requires going all the way around
    // that's 39 steps — exceeds TELEPORT_THRESHOLD so snaps
    const path = getBoardMovementPath(1, 0);
    expect(path).toEqual([0]);
  });

  it("includes all intermediate spaces for a 6-step move", () => {
    const path = getBoardMovementPath(10, 16);
    expect(path).toHaveLength(6);
    expect(path[0]).toBe(11);
    expect(path[path.length - 1]).toBe(16);
  });

  it("path from 36 to 4 wraps through 37,38,39,0,1,2,3,4", () => {
    const path = getBoardMovementPath(36, 4);
    expect(path).toEqual([37, 38, 39, 0, 1, 2, 3, 4]);
  });

  it("handles board size parameter", () => {
    const path = getBoardMovementPath(8, 2, 10);
    expect(path).toEqual([9, 0, 1, 2]);
  });

  it("respects TELEPORT_THRESHOLD: Go To Jail snap from space 30 to 10", () => {
    // 30 → 10 forward = 20 steps, exceeds threshold → snap
    const path = getBoardMovementPath(30, 10);
    expect(path).toEqual([10]);
  });

  it("short move to jail animates normally", () => {
    // 4 → 10 = 6 steps, under threshold, should animate
    const path = getBoardMovementPath(4, 10);
    expect(path).toHaveLength(6);
    expect(path[path.length - 1]).toBe(10);
  });
});

describe("isJailTeleport", () => {
  it("returns true when going from far away to jail (space 10)", () => {
    expect(isJailTeleport(30, 10)).toBe(true);
  });

  it("returns false when destination is not jail", () => {
    expect(isJailTeleport(30, 15)).toBe(false);
  });

  it("returns false when moving to jail from nearby", () => {
    expect(isJailTeleport(4, 10)).toBe(false);
  });
});
