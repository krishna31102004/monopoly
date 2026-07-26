import { describe, expect, it } from "vitest";
import { getBoardSpaceByIndex } from "@/data/board";
import { getAuctionTheme, getReadableTextColor } from "@/lib/ui/auctionTheme";

describe("auction property theme", () => {
  it.each([
    [1, "#8b5e3c"], [6, "#6ec6ea"], [11, "#d946a8"], [16, "#f97316"],
    [21, "#dc2626"], [26, "#eab308"], [31, "#16a34a"], [37, "#1d4ed8"],
  ])("maps city space %i to its established board accent", (spaceIndex, accentColor) => {
    const theme = getAuctionTheme(getBoardSpaceByIndex(spaceIndex));
    expect(theme.accentColor).toBe(accentColor);
    expect(theme.groupLabel).toContain("Color Group");
    expect(theme.bodyTintColor).toMatch(/^rgba\(/);
  });

  it("uses a shared airport network theme", () => {
    const theme = getAuctionTheme(getBoardSpaceByIndex(5));
    expect(theme).toMatchObject({ accentColor: "#475569", groupLabel: "Airport Network", icon: "✈️" });
  });

  it("distinguishes electric and water utility accents within the utility family", () => {
    expect(getAuctionTheme(getBoardSpaceByIndex(12))).toMatchObject({ accentColor: "#2563eb", groupLabel: "Utilities", icon: "⚡" });
    expect(getAuctionTheme(getBoardSpaceByIndex(28))).toMatchObject({ accentColor: "#0891b2", groupLabel: "Utilities", icon: "💧" });
  });

  it("falls back safely for unknown spaces", () => {
    expect(getAuctionTheme(getBoardSpaceByIndex(0))).toMatchObject({ accentColor: "#475569", accentTextColor: "#ffffff" });
  });
});

describe("auction theme contrast", () => {
  it("uses the shared higher-contrast navy or white foreground", () => {
    expect(getReadableTextColor("#eab308")).toBe("#0f172a");
    expect(getReadableTextColor("#6ec6ea")).toBe("#0f172a");
    expect(getReadableTextColor("#1d4ed8")).toBe("#ffffff");
    expect(getReadableTextColor("#16a34a")).toBe("#0f172a");
    expect(getReadableTextColor("#d946a8")).toBe("#0f172a");
    expect(getReadableTextColor("invalid")).toBe("#ffffff");
  });
});
