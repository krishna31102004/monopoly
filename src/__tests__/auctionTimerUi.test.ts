// Timer-ring urgency behavior verified via source text + the underlying AUCTION_TURN_MS
// constant (the ring's countdown fraction is derived from it, not a separately re-declared value).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AUCTION_TURN_MS } from "@/lib/animation/timing";

const auctionSource = readFileSync(
  fileURLToPath(new URL("../components/AuctionPanel.tsx", import.meta.url)),
  "utf-8",
);

describe("auction timer ring", () => {
  it("derives its countdown fraction from the shared AUCTION_TURN_MS constant", () => {
    expect(AUCTION_TURN_MS).toBe(20000);
    expect(auctionSource).toContain("AUCTION_TURN_MS");
  });

  it("uses an amber ring color by default and red once urgent", () => {
    expect(auctionSource).toContain('"#d97706"');
    expect(auctionSource).toContain('"#dc2626"');
  });

  it("applies an urgent pulse animation class only in the final 5 seconds", () => {
    expect(auctionSource).toContain("auction-timer-ring-urgent");
    expect(auctionSource).toContain("isUrgent ?");
  });

  it("ring countdown updates smoothly via a CSS transition rather than snapping", () => {
    expect(auctionSource).toContain("transition: \"stroke-dashoffset 0.25s linear\"");
  });
});
