import { describe, it, expect } from "vitest";
import {
  getOwnerBadgeLabel,
  getOwnerBadgePlacement,
  isFullSetOwner,
} from "@/lib/ui/boardTilePresentation";
import { getColorGroupSpaces } from "@/lib/game/propertyDevelopment";
import { makeGameState, withOwnership } from "./helpers/factory";
import type { CityProperty } from "@/types/board";

describe("getOwnerBadgeLabel", () => {
  it("uses initials for multi-word names", () => {
    expect(getOwnerBadgeLabel("Krishna Balaji")).toBe("KB");
  });

  it("uppercases short single-word names in full", () => {
    expect(getOwnerBadgeLabel("ansh")).toBe("ANSH");
    expect(getOwnerBadgeLabel("kb")).toBe("KB");
  });

  it("never returns a truncated 'PLAY…'-style fragment for long single words", () => {
    const label = getOwnerBadgeLabel("Player");
    expect(label).not.toContain("PLAY");
    expect(label).not.toContain("…");
    expect(label).toBe("PL");
  });

  it("combines letter + trailing digits for names like 'Player2'", () => {
    expect(getOwnerBadgeLabel("Player2")).toBe("P2");
  });

  it("handles empty/whitespace names safely", () => {
    expect(getOwnerBadgeLabel("   ")).toBe("?");
  });
});

describe("getOwnerBadgePlacement", () => {
  it("places bottom-row spaces (0-10) on the bottom edge", () => {
    expect(getOwnerBadgePlacement(0)).toBe("bottom");
    expect(getOwnerBadgePlacement(5)).toBe("bottom");
    expect(getOwnerBadgePlacement(10)).toBe("bottom");
  });

  it("places left-column spaces (11-20) on the left edge", () => {
    expect(getOwnerBadgePlacement(11)).toBe("left");
    expect(getOwnerBadgePlacement(20)).toBe("left");
  });

  it("places top-row spaces (21-30) on the top edge", () => {
    expect(getOwnerBadgePlacement(21)).toBe("top");
    expect(getOwnerBadgePlacement(30)).toBe("top");
  });

  it("places right-column spaces (31-39) on the right edge", () => {
    expect(getOwnerBadgePlacement(31)).toBe("right");
    expect(getOwnerBadgePlacement(39)).toBe("right");
  });
});

describe("isFullSetOwner", () => {
  it("returns false when the player owns only some of the color group", () => {
    let state = makeGameState();
    const ownerId = state.players[0].id;
    const space = getColorGroupSpaces(
      // any brown city — use index lookup via factory's ownerships
      { colorGroup: "brown" } as CityProperty,
    )[0];
    state = withOwnership(state, space.index, ownerId);
    expect(isFullSetOwner(space, state.ownerships, ownerId)).toBe(false);
  });

  it("returns true once the player owns every city in the color group", () => {
    let state = makeGameState();
    const ownerId = state.players[0].id;
    const groupSpaces = getColorGroupSpaces({ colorGroup: "brown" } as CityProperty);
    for (const s of groupSpaces) {
      state = withOwnership(state, s.index, ownerId);
    }
    expect(isFullSetOwner(groupSpaces[0], state.ownerships, ownerId)).toBe(true);
  });

  it("returns false if a different player owns one of the group's cities", () => {
    let state = makeGameState();
    const ownerId = state.players[0].id;
    const otherId = state.players[1].id;
    const groupSpaces = getColorGroupSpaces({ colorGroup: "brown" } as CityProperty);
    state = withOwnership(state, groupSpaces[0].index, ownerId);
    state = withOwnership(state, groupSpaces[1].index, otherId);
    expect(isFullSetOwner(groupSpaces[0], state.ownerships, ownerId)).toBe(false);
  });
});
