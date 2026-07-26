import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DESIGN_TOKENS, getContrastRatio, getDesignReadableTextColor } from "@/lib/ui/designTokens";
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

  it("selects the higher-contrast WCAG foreground for every design accent", () => {
    const accents = {
      Brown: CITY_COLOR_HEX.brown,
      "Light Blue": CITY_COLOR_HEX["light-blue"],
      Pink: CITY_COLOR_HEX.pink,
      Orange: CITY_COLOR_HEX.orange,
      Red: CITY_COLOR_HEX.red,
      Yellow: CITY_COLOR_HEX.yellow,
      Green: CITY_COLOR_HEX.green,
      "Dark Blue": CITY_COLOR_HEX["dark-blue"],
      Airport: "#475569",
      "Electric Company": "#2563eb",
      "Water Works": "#0891b2",
      "Metallic gold": DESIGN_TOKENS.action.gold,
    };

    for (const [name, accent] of Object.entries(accents)) {
      const selected = getDesignReadableTextColor(accent);
      const selectedContrast = getContrastRatio(accent, selected);
      const alternative = selected === "#0F172A" ? "#FFFFFF" : "#0F172A";
      const alternativeContrast = getContrastRatio(accent, alternative);

      expect(selected, name).toMatch(/^#(?:0F172A|FFFFFF)$/);
      expect(selectedContrast, name).not.toBeNull();
      expect(alternativeContrast, name).not.toBeNull();
      expect(selectedContrast!, name).toBeGreaterThanOrEqual(alternativeContrast!);
      expect(selectedContrast!, name).toBeGreaterThanOrEqual(4.5);
    }

    expect(getDesignReadableTextColor("not-a-colour")).toBe("#FFFFFF");
    expect(getContrastRatio("not-a-colour", "#FFFFFF")).toBeNull();
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

  function cssProperty(name: string): string {
    const match = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`, "i"));
    expect(match, `Missing ${name}`).not.toBeNull();
    return match![1].replace(/\s+/g, "").toLowerCase();
  }

  it("exposes semantic primitives, tabular numbers, visible focus, and reduced-motion rules", () => {
    for (const token of ["--wc-midnight", "--wc-navy", "--wc-ivory", "--wc-gold", "--wc-success", "--wc-danger", "--wc-warning", "--wc-info"]) expect(css).toContain(token);
    expect(css).toContain(".wc-button-primary");
    expect(css).toContain(".wc-button-secondary");
    expect(css).toContain(".wc-button-danger");
    expect(css).toContain("font-variant-numeric: tabular-nums");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("keeps core CSS custom properties in parity with TypeScript tokens", () => {
    const parity = {
      "--wc-midnight": DESIGN_TOKENS.surface.midnight,
      "--wc-navy": DESIGN_TOKENS.surface.navy,
      "--wc-navy-raised": DESIGN_TOKENS.surface.navyRaised,
      "--wc-navy-elevated": DESIGN_TOKENS.surface.navyElevated,
      "--wc-ivory": DESIGN_TOKENS.surface.ivory,
      "--wc-paper": DESIGN_TOKENS.surface.paper,
      "--wc-board-frame": DESIGN_TOKENS.surface.boardFrame,
      "--wc-gold": DESIGN_TOKENS.action.gold,
      "--wc-gold-hover": DESIGN_TOKENS.action.goldHover,
      "--wc-success": DESIGN_TOKENS.state.success,
      "--wc-danger": DESIGN_TOKENS.state.danger,
      "--wc-warning": DESIGN_TOKENS.state.warning,
      "--wc-info": DESIGN_TOKENS.state.info,
      "--wc-muted": DESIGN_TOKENS.state.muted,
    };

    for (const [cssName, tokenValue] of Object.entries(parity)) {
      expect(cssProperty(cssName)).toBe(tokenValue.replace(/\s+/g, "").toLowerCase());
    }
  });
});
