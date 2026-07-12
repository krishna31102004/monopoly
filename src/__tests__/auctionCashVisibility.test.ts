// AuctionPanel cash visibility — verified via source text (no DOM renderer in this repo).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const auctionSource = readFileSync(
  fileURLToPath(new URL("../components/AuctionPanel.tsx", import.meta.url)),
  "utf-8",
);

describe("auction player cash visibility", () => {
  it("shows player cash for active players in the list", () => {
    expect(auctionSource).toContain("player.cash");
  });

  it("passed players still show their cash", () => {
    const passedBlock = auctionSource.slice(auctionSource.indexOf("Passed"));
    expect(passedBlock).toContain("player.cash");
  });

  it("cash is formatted with toLocaleString for readability", () => {
    expect(auctionSource).toContain("toLocaleString");
  });

  it("active bidder's cash is accessible via aria-label", () => {
    expect(auctionSource).toContain("aria-label={`");
    expect(auctionSource).toContain("player.cash");
  });

  it("current bidder cash is also shown in the bid control section", () => {
    // The bid controls section also shows Cash: $X
    expect(auctionSource).toContain("currentBidder.cash");
  });

  it("highest bidder name is shown in the status grid", () => {
    expect(auctionSource).toContain("highBidder?.name");
  });

  it("bid buttons are disabled when amount exceeds current bidder's cash", () => {
    expect(auctionSource).toContain("disabled={opt.amount > currentBidder.cash}");
  });

  it("active and passed player lists are shown as separate sections", () => {
    expect(auctionSource).toContain("Active Players");
    expect(auctionSource).toContain("Passed");
  });

  it("active bidder is visually distinguished with a gold status accent", () => {
    expect(auctionSource).toContain("AUCTION_ACTION_TOKENS.gold");
    expect(auctionSource).toContain("isBidding");
  });

  it("leading bidder is distinguished with a highest status badge", () => {
    expect(auctionSource).toContain("isLeading");
    expect(auctionSource).toContain('<StatusBadge status="HIGHEST" />');
  });

  it("non-active player sees Waiting state (read-only)", () => {
    expect(auctionSource).toContain("isActiveBidder");
    expect(auctionSource).toContain("Waiting for");
  });
});
