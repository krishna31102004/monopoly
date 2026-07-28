import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const panel = fs.readFileSync(path.resolve(__dirname, "../components/HiddenAuctionPanel.tsx"), "utf8");
const localLayout = fs.readFileSync(path.resolve(__dirname, "../components/GameLayout.tsx"), "utf8");
const multiplayerLayout = fs.readFileSync(path.resolve(__dirname, "../components/multiplayer/GameLayoutMultiplayer.tsx"), "utf8");

describe("Hidden Auction presentation safeguards", () => {
  it("uses its own modal while reusing the open auction's public presentation primitives", () => {
    expect(panel).toContain("Hidden Auction");
    expect(panel).toContain('from "@/components/AuctionPanel"');
    expect(panel).toContain("AuctionSetOverview");
    expect(panel).toContain("AuctionPropertyDetails");
    expect(panel).toContain("PlayerOwnershipCard");
    expect(panel).toContain('aria-modal="true"');
  });

  it("keeps secret-bid copy, editable input, countdown, and result presentation", () => {
    expect(panel).toContain("Your bid is secret.");
    expect(panel).toContain("Your hidden bid");
    expect(panel).toContain("Bid saved");
    expect(panel).toContain("seconds remaining");
    expect(panel).toContain("Revealing the sealed result");
    expect(panel).toContain("No winning bid");
    expect(panel).toContain("Tie-break round");
    expect(panel).toContain("Tie-break auction starting with only the tied players.");
    expect(panel).toContain("You are not in this tie-break.");
    expect(panel).toContain("HIDDEN_AUCTION_BID_MS");
    expect(panel).toContain("getHiddenAuctionRevealStep");
  });

  it("is mounted outside mobile navigation in local and multiplayer layouts", () => {
    expect(localLayout).toContain('<HiddenAuctionPanel state={state} dispatch={dispatch} />');
    expect(multiplayerLayout).toContain("<HiddenAuctionPanel");
    expect(multiplayerLayout).toContain("serverAuthoritative");
  });

  it("uses an owner-only socket value rather than any public bid list", () => {
    expect(multiplayerLayout).toContain("hiddenAuctionOwnBid");
    expect(panel).not.toContain("highestBidder");
    expect(panel).not.toContain("currentBid");
  });

  it("does not contain open-auction controls or random tie resolution", () => {
    expect(panel).not.toContain("+$1");
    expect(panel).not.toContain("Highest Bidder");
    expect(panel).not.toContain("resolved randomly");
  });

  it("shows public cash and property context without exposing private bid data", () => {
    expect(panel).toContain("Your cash:");
    expect(panel).toContain("Active players · Properties");
    expect(panel).toContain("hidden-auction-ownership-overview");
    expect(panel).not.toContain("highestBidder");
    expect(panel).not.toContain("currentBid");
  });

  it("renders an after-close final-bids leaderboard with a visible winner and No bid state", () => {
    expect(panel).toContain("Final bids");
    expect(panel).toContain("Winner");
    expect(panel).toContain("No bid");
    expect(panel).toContain("HiddenAuctionFinalBids");
  });
});
