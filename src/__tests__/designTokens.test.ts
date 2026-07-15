import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DESIGN_TOKENS, getDesignReadableTextColor } from "@/lib/ui/designTokens";
import { CITY_COLOR_HEX } from "@/lib/ui/propertyColors";
import { AUCTION_ACTION_TOKENS } from "@/lib/ui/auctionVisualTokens";
import { TRADE_VISUAL_TOKENS } from "@/lib/ui/tradeVisualTokens";

describe("shared premium design tokens", () => {
  it("defines the required dark, warm, action, and semantic foundations", () => {
    expect(DESIGN_TOKENS.surface).toMatchObject({
      midnight: "#07101F",
      navy: "#0F172A",
      navyRaised: "#182235",
      navyElevated: "#202C42",
      ivory: "#F6F1E8",
      paper: "#FFFDF8",
      boardFrame: "#34291C",
    });
    expect(DESIGN_TOKENS.action.gold).toBe("#C6A15B");
    expect(DESIGN_TOKENS.state).toEqual(expect.objectContaining({ success: "#22C55E", danger: "#EF4444", warning: "#F59E0B", info: "#3B82F6", muted: "#64748B" }));
  });

  it("keeps property identity in the existing central palette", () => {
    expect(Object.keys(CITY_COLOR_HEX)).toEqual(["brown", "light-blue", "pink", "orange", "red", "yellow", "green", "dark-blue"]);
    expect(DESIGN_TOKENS).not.toHaveProperty("property");
  });

  it("provides contrast-safe text for light, dark, and invalid accents", () => {
    expect(getDesignReadableTextColor("#eab308")).toBe("#0F172A");
    expect(getDesignReadableTextColor("#6ec6ea")).toBe("#0F172A");
    expect(getDesignReadableTextColor("#1d4ed8")).toBe("#FFFFFF");
    expect(getDesignReadableTextColor("#16a34a")).toBe("#FFFFFF");
    expect(getDesignReadableTextColor("not-a-colour")).toBe("#FFFFFF");
  });

  it("shares existing auction and trade semantic values instead of changing their appearance", () => {
    expect(AUCTION_ACTION_TOKENS.gold).toBe(DESIGN_TOKENS.action.gold);
    expect(AUCTION_ACTION_TOKENS.navy).toBe(DESIGN_TOKENS.surface.navy);
    expect(TRADE_VISUAL_TOKENS.gold).toBe(DESIGN_TOKENS.action.gold);
    expect(TRADE_VISUAL_TOKENS.shell).toBe(DESIGN_TOKENS.surface.navy);
  });
});

describe("design-system CSS safeguards", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

  it("exposes semantic primitives, tabular numbers, visible focus, and reduced-motion rules", () => {
    for (const token of ["--wc-midnight", "--wc-navy", "--wc-ivory", "--wc-gold", "--wc-success", "--wc-danger", "--wc-warning", "--wc-info"]) expect(css).toContain(token);
    expect(css).toContain(".wc-button-primary");
    expect(css).toContain(".wc-button-secondary");
    expect(css).toContain(".wc-button-danger");
    expect(css).toContain("font-variant-numeric: tabular-nums");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
