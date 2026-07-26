import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const panel = fs.readFileSync(path.resolve(__dirname, "../components/HiddenAuctionPanel.tsx"), "utf8");
const localLayout = fs.readFileSync(path.resolve(__dirname, "../components/GameLayout.tsx"), "utf8");
const multiplayerLayout = fs.readFileSync(path.resolve(__dirname, "../components/multiplayer/GameLayoutMultiplayer.tsx"), "utf8");

describe("Hidden Auction presentation safeguards", () => {
  it("uses its own modal and never imports the open AuctionPanel", () => {
    expect(panel).toContain("Hidden Auction");
    expect(panel).not.toContain('from "@/components/AuctionPanel"');
    expect(panel).toContain('aria-modal="true"');
  });

  it("keeps secret-bid copy, editable input, countdown, and result presentation", () => {
    expect(panel).toContain("Your bid is secret.");
    expect(panel).toContain("Your hidden bid");
    expect(panel).toContain("Bid saved");
    expect(panel).toContain("Remaining");
    expect(panel).toContain("Revealing the sealed result");
    expect(panel).toContain("No winning bid");
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
});
