import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import {
  makeGameState,
  withPosition,
} from "./helpers/factory";

/** Helper: get state to awaitingPurchaseDecision on Guadalajara (index 1) */
function stateAtGuadalajara(playerCount = 2) {
  const state = makeGameState(playerCount);
  const positioned = withPosition(state, 38); // will pass GO and land on pos 1
  return gameReducer(positioned, {
    type: "ROLL_DICE",
    dice: { die1: 3, die2: 0, total: 3, isDouble: false },
  });
}

describe("Auction", () => {
  it("declining unowned property starts auction", () => {
    const rolled = stateAtGuadalajara();
    expect(rolled.phase).toBe("awaitingPurchaseDecision");
    const declined = gameReducer(rolled, { type: "DECLINE_PROPERTY" });
    expect(declined.phase).toBe("auction");
    expect(declined.auction).not.toBeNull();
    expect(declined.auction?.propertySpaceIndex).toBe(1);
  });

  it("auction includes all non-bankrupt players", () => {
    const declined = gameReducer(stateAtGuadalajara(3), { type: "DECLINE_PROPERTY" });
    expect(declined.auction?.activePlayerIds).toHaveLength(3);
  });

  it("bankrupt players are excluded from auction", () => {
    const base = makeGameState(3);
    const withBankrupt = {
      ...base,
      players: base.players.map((p, i) => (i === 2 ? { ...p, isBankrupt: true } : p)),
    };
    const positioned = withPosition(withBankrupt, 38);
    const rolled = gameReducer(positioned, {
      type: "ROLL_DICE",
      dice: { die1: 3, die2: 0, total: 3, isDouble: false },
    });
    const declined = gameReducer(rolled, { type: "DECLINE_PROPERTY" });
    expect(declined.auction?.activePlayerIds).toHaveLength(2);
  });

  it("opening bid must be exactly $10", () => {
    const declined = gameReducer(stateAtGuadalajara(), { type: "DECLINE_PROPERTY" });
    const badBid = gameReducer(declined, { type: "PLACE_BID", amount: 5 });
    expect(badBid.auction?.currentBid).toBe(0); // unchanged
    const tooHigh = gameReducer(declined, { type: "PLACE_BID", amount: 50 });
    expect(tooHigh.auction?.currentBid).toBe(0); // unchanged
  });

  it("subsequent bid must be currentBid + 1, +10, or +100", () => {
    const declined = gameReducer(stateAtGuadalajara(), { type: "DECLINE_PROPERTY" });
    const opened = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    expect(opened.auction?.currentBid).toBe(10);

    const badNext = gameReducer(opened, { type: "PLACE_BID", amount: 15 });
    expect(badNext.auction?.currentBid).toBe(10); // unchanged — invalid increment

    const plus1 = gameReducer(opened, { type: "PLACE_BID", amount: 11 });
    expect(plus1.auction?.currentBid).toBe(11);
  });

  it("bid cannot exceed bidder's cash", () => {
    const declined = gameReducer(stateAtGuadalajara(), { type: "DECLINE_PROPERTY" });
    const auction = declined.auction!;
    const bidder = declined.players.find(
      (p) => p.id === auction.activePlayerIds[auction.currentBidderIndex],
    )!;
    const overBid = gameReducer(declined, { type: "PLACE_BID", amount: bidder.cash + 1 });
    expect(overBid.auction?.currentBid).toBe(0); // unchanged
  });

  it("valid first bid is accepted", () => {
    const declined = gameReducer(stateAtGuadalajara(), { type: "DECLINE_PROPERTY" });
    const bidded = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    expect(bidded.auction?.currentBid).toBe(10);
    expect(bidded.auction?.highestBidderId).toBeTruthy();
  });

  it("passing removes player from active bidders", () => {
    const declined = gameReducer(stateAtGuadalajara(3), { type: "DECLINE_PROPERTY" });
    const passed = gameReducer(declined, { type: "PASS_AUCTION" });
    expect(passed.auction?.activePlayerIds.length).toBe(2);
    expect(passed.auction?.passedPlayerIds.length).toBe(1);
  });

  it("everyone passing with no bids leaves property unowned", () => {
    const declined = gameReducer(stateAtGuadalajara(2), { type: "DECLINE_PROPERTY" });
    const pass1 = gameReducer(declined, { type: "PASS_AUCTION" });
    const pass2 = gameReducer(pass1, { type: "PASS_AUCTION" });
    expect(pass2.phase).not.toBe("auction");
    const ownership = pass2.ownerships.find((o) => o.spaceIndex === 1);
    expect(ownership?.ownerId).toBeNull();
  });

  it("last remaining bidder wins", () => {
    const declined = gameReducer(stateAtGuadalajara(2), { type: "DECLINE_PROPERTY" });
    const auction = declined.auction!;
    const firstBidderId = auction.activePlayerIds[auction.currentBidderIndex];
    // First bidder opens
    const bid1 = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    // Second player passes → first player wins
    const pass = gameReducer(bid1, { type: "PASS_AUCTION" });
    expect(pass.phase).not.toBe("auction");
    const ownership = pass.ownerships.find((o) => o.spaceIndex === 1);
    expect(ownership?.ownerId).toBe(firstBidderId);
  });

  it("winning bid is deducted from winner", () => {
    const declined = gameReducer(stateAtGuadalajara(2), { type: "DECLINE_PROPERTY" });
    const auction = declined.auction!;
    const firstBidderId = auction.activePlayerIds[auction.currentBidderIndex];
    const winnerBefore = declined.players.find((p) => p.id === firstBidderId)!;
    const bid1 = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    const pass = gameReducer(bid1, { type: "PASS_AUCTION" });
    const winnerAfter = pass.players.find((p) => p.id === firstBidderId)!;
    expect(winnerAfter.cash).toBe(winnerBefore.cash - 10);
  });

  it("auction clears after resolution", () => {
    const declined = gameReducer(stateAtGuadalajara(2), { type: "DECLINE_PROPERTY" });
    const bid = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    const pass = gameReducer(bid, { type: "PASS_AUCTION" });
    expect(pass.auction).toBeNull();
  });

  it("turn resumes correctly after auction (non-double → turnComplete)", () => {
    const declined = gameReducer(stateAtGuadalajara(2), { type: "DECLINE_PROPERTY" });
    const bid = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    const pass = gameReducer(bid, { type: "PASS_AUCTION" });
    // non-double roll was used → turnComplete or similar
    expect(["turnComplete", "readyToRoll"]).toContain(pass.phase);
  });

  it("game log has auction started entry", () => {
    const declined = gameReducer(stateAtGuadalajara(2), { type: "DECLINE_PROPERTY" });
    const found = declined.gameLog.some((e) => e.message.toLowerCase().includes("auction"));
    expect(found).toBe(true);
  });

  it("game log has bid entry", () => {
    const declined = gameReducer(stateAtGuadalajara(2), { type: "DECLINE_PROPERTY" });
    const bid = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    const found = bid.gameLog.some((e) => e.message.toLowerCase().includes("bid"));
    expect(found).toBe(true);
  });

  it("game log has pass entry", () => {
    const declined = gameReducer(stateAtGuadalajara(2), { type: "DECLINE_PROPERTY" });
    const pass = gameReducer(declined, { type: "PASS_AUCTION" });
    const found = pass.gameLog.some((e) => e.message.toLowerCase().includes("pass"));
    expect(found).toBe(true);
  });

  it("game log has won entry", () => {
    const declined = gameReducer(stateAtGuadalajara(2), { type: "DECLINE_PROPERTY" });
    const bid = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    const pass = gameReducer(bid, { type: "PASS_AUCTION" });
    const found = pass.gameLog.some((e) => e.message.toLowerCase().includes("won"));
    expect(found).toBe(true);
  });

  it("property ownership transfers to auction winner", () => {
    const declined = gameReducer(stateAtGuadalajara(2), { type: "DECLINE_PROPERTY" });
    const auction = declined.auction!;
    const firstBidderId = auction.activePlayerIds[auction.currentBidderIndex];
    const bid = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    const pass = gameReducer(bid, { type: "PASS_AUCTION" });
    const winner = pass.players.find((p) => p.id === firstBidderId)!;
    expect(winner.ownedCityIds).toContain(1);
  });
});
