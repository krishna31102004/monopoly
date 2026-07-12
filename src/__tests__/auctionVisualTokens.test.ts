import { describe, expect, it } from "vitest";
import { getAuctionTheme } from "@/lib/ui/auctionTheme";
import { AUCTION_ACTION_TOKENS } from "@/lib/ui/auctionVisualTokens";
import { getBoardSpaceByIndex } from "@/data/board";

describe("premium auction action tokens", () => {
  it("defines restrained metallic-gold actions and separate state colors", () => {
    expect(AUCTION_ACTION_TOKENS.gold).toBe("#C6A15B");
    expect(AUCTION_ACTION_TOKENS.goldHover).toBe("#D8BA72");
    expect(AUCTION_ACTION_TOKENS.goldSoft).toMatch(/^rgba\(/);
    expect(AUCTION_ACTION_TOKENS.highest).toBe("#22C55E");
    expect(AUCTION_ACTION_TOKENS.urgent).toBe("#DC2626");
    expect(AUCTION_ACTION_TOKENS.passed).toBe("#64748B");
  });

  it("keeps property identity separate from the global gold action system", () => {
    expect(getAuctionTheme(getBoardSpaceByIndex(19)).accentColor).toBe("#f97316");
    expect(getAuctionTheme(getBoardSpaceByIndex(5)).accentColor).toBe("#475569");
    expect(getAuctionTheme(getBoardSpaceByIndex(12)).accentColor).toBe("#2563eb");
    expect(getAuctionTheme(getBoardSpaceByIndex(28)).accentColor).toBe("#0891b2");
    expect(getAuctionTheme(getBoardSpaceByIndex(19)).accentColor).not.toBe(AUCTION_ACTION_TOKENS.gold);
  });
});
