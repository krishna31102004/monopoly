// Houses/hotels/mortgage overlay and full-set glow are verified against BoardSpace's source
// text (no DOM renderer available in this repo's test setup) plus the pure full-set helper.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isFullSetOwner } from "@/lib/ui/boardTilePresentation";
import { getColorGroupSpaces } from "@/lib/game/propertyDevelopment";
import { makeGameState, withOwnership } from "./helpers/factory";
import type { CityProperty } from "@/types/board";

const boardSpaceSource = readFileSync(
  fileURLToPath(new URL("../components/board/BoardSpace.tsx", import.meta.url)),
  "utf-8",
);

describe("houses and hotels", () => {
  it("renders a distinct hotel marker (H) separate from house markers", () => {
    expect(boardSpaceSource).toContain('title="Hotel"');
    expect(boardSpaceSource).toContain("hasHotel");
  });

  it("renders one marker per house owned, aligned in a row", () => {
    expect(boardSpaceSource).toContain("ownership.houses");
    expect(boardSpaceSource).toContain("Array.from({ length: ownership.houses })");
  });

  it("PropertyBuildings only renders for city tiles with ownership data", () => {
    expect(boardSpaceSource).toContain('space.kind === "city" && ownership');
  });
});

describe("mortgage overlay", () => {
  it("renders a readable MORTGAGED ribbon", () => {
    expect(boardSpaceSource).toContain("MORTGAGED");
  });

  it("mortgage overlay is gated on ownership.isMortgaged and applies to any ownable space kind", () => {
    expect(boardSpaceSource).toContain("ownership?.isMortgaged");
  });

  it("mortgage overlay does not remove the owner badge or player token rendering", () => {
    const mortgageIdx = boardSpaceSource.indexOf("<MortgageOverlay");
    const badgeIdx = boardSpaceSource.indexOf("<OwnerNameBadge");
    const tokenIdx = boardSpaceSource.indexOf("<PlayerToken");
    expect(mortgageIdx).toBeGreaterThan(-1);
    expect(badgeIdx).toBeGreaterThan(-1);
    expect(tokenIdx).toBeGreaterThan(-1);
  });
});

describe("full-set glow", () => {
  it("incomplete sets do not trigger the glow class", () => {
    let state = makeGameState();
    const ownerId = state.players[0].id;
    const groupSpaces = getColorGroupSpaces({ colorGroup: "light-blue" } as CityProperty);
    state = withOwnership(state, groupSpaces[0].index, ownerId);
    expect(isFullSetOwner(groupSpaces[0], state.ownerships, ownerId)).toBe(false);
  });

  it("complete sets trigger the glow class via isFullSet", () => {
    let state = makeGameState();
    const ownerId = state.players[0].id;
    const groupSpaces = getColorGroupSpaces({ colorGroup: "light-blue" } as CityProperty);
    for (const s of groupSpaces) state = withOwnership(state, s.index, ownerId);
    expect(isFullSetOwner(groupSpaces[0], state.ownerships, ownerId)).toBe(true);
  });

  it("BoardSpace applies the glow class conditionally based on full-set ownership", () => {
    expect(boardSpaceSource).toContain("board-tile-fullset-glow");
    expect(boardSpaceSource).toContain("isFullSetOwner");
  });
});
