import { describe, it, expect } from "vitest";
import { moveAroundBoard } from "@/lib/game/movement";

describe("moveAroundBoard", () => {
  it("moves forward by steps", () => {
    const result = moveAroundBoard(0, 6);
    expect(result.to).toBe(6);
    expect(result.from).toBe(0);
    expect(result.passedGo).toBe(false);
  });

  it("wraps around 40-space board", () => {
    const result = moveAroundBoard(38, 5);
    expect(result.to).toBe(3);
    expect(result.passedGo).toBe(true);
  });

  it("landing exactly on GO (space 0) after wrap passes GO", () => {
    const result = moveAroundBoard(36, 4);
    expect(result.to).toBe(0);
    expect(result.passedGo).toBe(true);
  });

  it("does not mark passedGo when staying within same lap", () => {
    const result = moveAroundBoard(5, 10);
    expect(result.to).toBe(15);
    expect(result.passedGo).toBe(false);
  });

  it("moves from position 39 by 1 wraps to 0 with passedGo", () => {
    const result = moveAroundBoard(39, 1);
    expect(result.to).toBe(0);
    expect(result.passedGo).toBe(true);
  });

  it("moving 0 steps stays in place, does not pass GO", () => {
    const result = moveAroundBoard(10, 0);
    expect(result.to).toBe(10);
    expect(result.passedGo).toBe(false);
  });

  it("moving from GO by large steps wraps correctly", () => {
    const result = moveAroundBoard(0, 40);
    expect(result.to).toBe(0);
    expect(result.passedGo).toBe(true);
  });

  it("records from position correctly", () => {
    const result = moveAroundBoard(15, 7);
    expect(result.from).toBe(15);
    expect(result.to).toBe(22);
  });
});
