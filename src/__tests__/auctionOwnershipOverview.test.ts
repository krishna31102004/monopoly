// Ownership overview panel in AuctionPanel — verified via source text (no DOM renderer).
// Regression tests for auction logic remain in auction.test.ts and auctionRules.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(
  fileURLToPath(new URL("../components/AuctionPanel.tsx", import.meta.url)),
  "utf-8",
);

describe("AuctionPanel ownership overview — source-text checks", () => {
  it("renders an ownership overview section for all active players", () => {
    expect(src).toContain("Active Players · Properties");
    expect(src).toContain("Active Players");
    expect(src).toContain("allAuctionPlayers");
  });

  it("shows each player's name in the ownership card", () => {
    expect(src).toContain("PlayerOwnershipCard");
    expect(src).toContain("player.name");
  });

  it("shows each player's cash in the ownership card", () => {
    // PlayerOwnershipCard renders the player's cash
    expect(src).toContain("player.cash");
    expect(src).toContain("toLocaleString");
  });

  it("renders city properties for each player", () => {
    expect(src).toContain("city-properties");
    expect(src).toContain('kind === "city"');
  });

  it("renders airport properties for each player", () => {
    expect(src).toContain("airport-properties");
    expect(src).toContain('kind === "airport"');
  });

  it("renders utility properties for each player", () => {
    expect(src).toContain("utility-properties");
    expect(src).toContain('kind === "utility"');
  });

  it("shows 'No properties yet' for players with no properties", () => {
    expect(src).toContain("No properties yet");
  });

  it("shows mortgaged badge on mortgaged properties", () => {
    expect(src).toContain("isMortgaged");
    expect(src).toContain('"M"');
  });

  it("shows hotel badge on hotel properties", () => {
    expect(src).toContain("hasHotel");
    expect(src).toContain('"🏨"');
  });

  it("shows house count badge (H1..H4) on properties with houses", () => {
    expect(src).toContain("`H${houses}`");
  });

  it("uses color dots to indicate city color groups", () => {
    expect(src).toContain("CITY_COLOR_HEX");
    expect(src).toContain("backgroundColor: dotColor");
  });

  it("highlights the current bidder in the ownership card", () => {
    expect(src).toContain("isBidding");
  });

  it("highlights the highest bidder (leading) in the ownership card", () => {
    expect(src).toContain("isLeading");
  });

  it("excludes bankrupt players from the overview", () => {
    expect(src).toContain("isBankrupt");
    expect(src).toContain("allAuctionPlayers");
  });

  it("uses a wider max-w-3xl modal for more display space", () => {
    expect(src).toContain("max-w-3xl");
  });

  it("uses a two-column grid layout on medium+ screens", () => {
    expect(src).toContain("md:grid-cols-[1fr_1fr]");
  });

  it("renders PropertyChip for individual property display", () => {
    expect(src).toContain("PropertyChip");
  });

  it("ownership overview is inside the auction panel (not a separate floating banner)", () => {
    expect(src).not.toContain("GameEventBanner");
    expect(src).not.toContain("centerStatus");
  });
});
