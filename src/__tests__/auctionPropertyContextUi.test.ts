import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("../components/AuctionPanel.tsx", import.meta.url)),
  "utf-8",
);

describe("auction property context presentation", () => {
  it("renders a shared group overview and compact property details", () => {
    expect(source).toContain("AuctionSetOverview");
    expect(source).toContain("AuctionPropertyDetails");
    expect(source).toContain("auction-set-overview");
    expect(source).toContain("auction-property-details");
    expect(source).toContain("Being auctioned");
    expect(source).toContain("Mortgaged");
  });

  it("keeps desktop bid controls and player portfolios alongside the overview", () => {
    expect(source).toContain("data-testid=\"bid-controls\"");
    expect(source).toContain("PlayerOwnershipCard");
    expect(source).toContain("lg:max-w-5xl");
  });

  it("provides accessible SET, PLAYERS, and DETAILS mobile sections", () => {
    expect(source).toContain('useState<AuctionMobileSection>("set")');
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain("aria-selected");
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain('["set", "players", "details"]');
  });
});
