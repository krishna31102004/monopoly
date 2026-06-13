import { describe, it, expect } from "vitest";
import { hasTokenIcon } from "@/lib/tokenMeta";
import type { PlayerToken } from "@/types/player";

const ALL_TOKENS: PlayerToken[] = ["car", "hat", "ship", "shoe", "dog", "cat"];

describe("TokenIcon — hasTokenIcon", () => {
  it("returns true for every defined token type", () => {
    for (const token of ALL_TOKENS) {
      expect(hasTokenIcon(token), `token "${token}" should have an icon`).toBe(true);
    }
  });

  it("returns false for unknown token strings", () => {
    expect(hasTokenIcon("boat")).toBe(false);
    expect(hasTokenIcon("")).toBe(false);
    expect(hasTokenIcon("THIMBLE")).toBe(false);
  });

  it("all token values from PlayerToken type are covered", () => {
    const covered = ALL_TOKENS.filter(hasTokenIcon);
    expect(covered).toHaveLength(ALL_TOKENS.length);
  });
});
