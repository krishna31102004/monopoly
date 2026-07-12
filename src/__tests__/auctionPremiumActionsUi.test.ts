import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../components/AuctionPanel.tsx", import.meta.url)), "utf-8");

describe("premium auction action presentation safeguards", () => {
  it("uses the shared action palette for buttons, timer, statuses, and waiting", () => {
    expect(source).toContain("AUCTION_ACTION_TOKENS");
    expect(source).toContain("Waiting for {currentBidder.name} to bid");
    expect(source).toContain("ringColor = isUrgent ? AUCTION_ACTION_TOKENS.urgent : AUCTION_ACTION_TOKENS.gold");
    expect(source).toContain("backgroundColor: AUCTION_ACTION_TOKENS.gold");
    expect(source).toContain("backgroundColor: AUCTION_ACTION_TOKENS.raised");
  });

  it("keeps participant rows dark with compact textual status badges", () => {
    expect(source).toContain("boxShadow: `inset 3px 0 0 ${AUCTION_ACTION_TOKENS.gold}`");
    expect(source).toContain("boxShadow: `inset 3px 0 0 ${AUCTION_ACTION_TOKENS.highest}`");
    expect(source).toContain('<StatusBadge status="HIGHEST" />');
    expect(source).not.toContain('bg-amber-500 text-slate-950 font-black');
    expect(source).not.toContain('bg-emerald-600 text-white font-black');
  });
});
