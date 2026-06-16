import { describe, it, expect } from "vitest";
import {
  getOwnerBadgeClassName,
  getOwnerBadgeLabel,
  getOwnerBadgePlacement,
  isFullSetOwner,
} from "@/lib/ui/boardTilePresentation";
import { getColorGroupSpaces } from "@/lib/game/propertyDevelopment";
import { makeGameState, withOwnership } from "./helpers/factory";
import type { CityProperty } from "@/types/board";

describe("getOwnerBadgeLabel", () => {
  it("shows the full player name verbatim, not initials", () => {
    expect(getOwnerBadgeLabel("kb")).toBe("kb");
    expect(getOwnerBadgeLabel("ansh")).toBe("ansh");
    expect(getOwnerBadgeLabel("botdaddy")).toBe("botdaddy");
  });

  it("preserves case rather than forcing uppercase", () => {
    expect(getOwnerBadgeLabel("Krishna")).toBe("Krishna");
  });

  it("never returns initials for multi-word names", () => {
    expect(getOwnerBadgeLabel("Krishna Balaji")).not.toBe("KB");
    expect(getOwnerBadgeLabel("Krishna B")).toBe("Krishna B");
  });

  it("never returns a 'PLAY…'-style debug fragment", () => {
    const label = getOwnerBadgeLabel("Player");
    expect(label).not.toContain("PLAY");
    expect(label).toBe("Player");
  });

  it("truncates with a clean ellipsis only when the name is too long for the tile", () => {
    const label = getOwnerBadgeLabel("ExtremelyLongPlayerName");
    expect(label.length).toBeLessThan("ExtremelyLongPlayerName".length);
    expect(label.endsWith("…")).toBe(true);
    expect(label).not.toContain("PLAY");
  });

  it("handles empty/whitespace names safely", () => {
    expect(getOwnerBadgeLabel("   ")).toBe("?");
  });
});

describe("getOwnerBadgePlacement and getOwnerBadgeClassName", () => {
  it("returns the same single placement for every board side (bottom, left, top, right)", () => {
    const indices = [0, 5, 10, 11, 15, 20, 21, 25, 30, 31, 35, 39];
    const placements = indices.map((i) => getOwnerBadgePlacement(i));
    expect(new Set(placements).size).toBe(1);
  });

  it("returns the same single class name for every board side", () => {
    const indices = [0, 5, 10, 11, 15, 20, 21, 25, 30, 31, 35, 39];
    const classNames = indices.map((i) => getOwnerBadgeClassName(i));
    expect(new Set(classNames).size).toBe(1);
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
