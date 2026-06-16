// Vitest in this repo cannot parse JSX from "use client" .tsx components in .test.ts files,
// so BoardSpace's owner-badge markup is verified against its source text — the underlying
// label/placement logic is unit-tested directly in boardTilePresentation.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const boardSpaceSource = readFileSync(
  fileURLToPath(new URL("../components/board/BoardSpace.tsx", import.meta.url)),
  "utf-8",
);

describe("owner badge cleanup", () => {
  it("uses the getOwnerBadgeLabel helper instead of ad-hoc truncation", () => {
    expect(boardSpaceSource).toContain("getOwnerBadgeLabel");
    expect(boardSpaceSource).not.toContain('owner.name.slice(0, 4) + "…"');
  });

  it("uses the getOwnerBadgeClassName helper for the restored fixed positioning", () => {
    expect(boardSpaceSource).toContain("getOwnerBadgeClassName");
  });

  it("badge sits at the restored fixed top-center placement, not edge-varying", () => {
    expect(boardSpaceSource).toContain('top: "2px"');
    expect(boardSpaceSource).toContain('left: "50%"');
    expect(boardSpaceSource).toContain('transform: "translateX(-50%)"');
  });

  it("the badge component never hardcodes a 'PLAY' style label", () => {
    expect(boardSpaceSource).not.toContain('"PLAY');
    expect(boardSpaceSource).not.toContain("'PLAY");
  });

  it("badge is positioned absolutely so it cannot disrupt tile layout flow", () => {
    expect(boardSpaceSource).toContain('position: "absolute"');
  });

  it("OwnerNameBadge is rendered for city, airport, and utility ownership alike (single shared component)", () => {
    // BoardSpace renders one OwnerNameBadge call gated on `owner`, independent of space.kind —
    // confirms cities/airports/utilities all support the badge through the same code path.
    const badgeUsageCount = (boardSpaceSource.match(/<OwnerNameBadge/g) ?? []).length;
    expect(badgeUsageCount).toBe(1);
    expect(boardSpaceSource).toContain("!isCorner && owner ? <OwnerNameBadge");
  });

  it("player tokens render via a separate component from the owner badge", () => {
    expect(boardSpaceSource).toContain("<PlayerToken");
    expect(boardSpaceSource).toContain("<OwnerNameBadge");
  });
});
