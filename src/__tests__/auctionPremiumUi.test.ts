// AuctionPanel's premium markup is verified via source text (no DOM renderer in this repo's
// test setup); auction logic/rules regressions are covered separately in auction.test.ts,
// auctionRules.test.ts, auctionIncrementRules.test.ts, and auctionTimer.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const auctionSource = readFileSync(
  fileURLToPath(new URL("../components/AuctionPanel.tsx", import.meta.url)),
  "utf-8",
);

describe("premium auction modal", () => {
  it("uses a dark, high-quality backdrop", () => {
    expect(auctionSource).toContain("bg-slate-950/85");
  });

  it("shows the property being auctioned", () => {
    expect(auctionSource).toContain("{space.name}");
  });

  it("displays the current bid prominently", () => {
    expect(auctionSource).toContain("Current Bid");
    expect(auctionSource).toContain("auction.currentBid");
  });

  it("displays the highest bidder", () => {
    expect(auctionSource).toContain("Highest Bidder");
    expect(auctionSource).toContain("highBidder");
  });

  it("spotlights the active bidder", () => {
    expect(auctionSource).toContain("turn to bid");
  });

  it("shows passed players in a visually greyed-out, separate list", () => {
    expect(auctionSource).toContain("passedPlayerIds");
    expect(auctionSource).toContain("line-through");
  });

  it("renders a circular countdown ring rather than a plain numeric badge", () => {
    expect(auctionSource).toContain("TimerRing");
    expect(auctionSource).toContain("<svg");
    expect(auctionSource).toContain("strokeDashoffset");
  });

  it("intensifies visually in the final 5 seconds", () => {
    expect(auctionSource).toContain("isUrgent");
    expect(auctionSource).toContain("secondsLeft <= 5");
    expect(auctionSource).toContain("auction-modal-urgent");
  });

  it("never renders a custom bid amount input", () => {
    expect(auctionSource).not.toContain('type="number"');
    expect(auctionSource).not.toContain("<input");
  });

  it("offers chunky +$1/+$10/+$100/Pass controls and an exact $10 opening bid", () => {
    expect(auctionSource).toContain('"+$1"');
    expect(auctionSource).toContain('"+$10"');
    expect(auctionSource).toContain('"+$100"');
    expect(auctionSource).toContain("Open bid $10");
    expect(auctionSource).toContain("PASS_AUCTION");
    expect(auctionSource).toContain("Pass");
  });

  it("only the active bidder sees enabled controls — everyone else sees a read-only waiting state", () => {
    expect(auctionSource).toContain("isActiveBidder");
    expect(auctionSource).toContain("Waiting for");
  });

  it("shows a brief premium result state for winner or no-bid outcomes", () => {
    expect(auctionSource).toContain("resultMessage");
    expect(auctionSource).toContain("Auction Result");
  });

  it("the result state is scoped to this modal only, not a floating banner elsewhere", () => {
    // The result state is gated on `!auction && resultMessage` and rendered from within
    // AuctionPanel's own return — it never touches GameEventBanner or board-center status.
    expect(auctionSource).not.toContain("GameEventBanner");
    expect(auctionSource).not.toContain("centerStatus");
  });
});
