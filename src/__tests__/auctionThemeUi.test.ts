import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../components/AuctionPanel.tsx", import.meta.url)), "utf-8");

describe("auction theme presentation safeguards", () => {
  it("consumes the shared property-aware theme for panel, header, group strip, and tabs", () => {
    expect(source).toContain("getAuctionTheme");
    expect(source).toContain("bodyTintColor");
    expect(source).toContain("borderColor: theme.borderColor");
    expect(source).toContain("backgroundColor: theme.accentColor");
    expect(source).toContain("AuctionSetOverview context={propertyContext} theme={theme}");
  });

  it("keeps auction action and state colors independent of the property accent", () => {
    expect(source).toContain('TURN:    "bg-amber-500');
    expect(source).toContain('HIGHEST: "bg-emerald-600');
    expect(source).toContain('PASSED:  "bg-slate-800');
    expect(source).toContain('bg-amber-500 px-2 py-3');
    expect(source).toContain('isUrgent ? "#dc2626"');
  });
});
