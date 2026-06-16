import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { makeGameState, withPosition } from "./helpers/factory";
import { AUCTION_TURN_MS } from "@/lib/animation/timing";

function stateAtGuadalajara(playerCount = 2) {
  const state = makeGameState(playerCount);
  const positioned = withPosition(state, 38);
  return gameReducer(positioned, {
    type: "ROLL_DICE",
    dice: { die1: 3, die2: 0, total: 3, isDouble: false },
  });
}

describe("Auction timer fields", () => {
  it("sets turnStartedAt and turnDeadlineAt exactly AUCTION_TURN_MS apart on start", () => {
    const declined = gameReducer(stateAtGuadalajara(), { type: "DECLINE_PROPERTY" });
    const auction = declined.auction!;
    expect(auction.turnDeadlineAt - auction.turnStartedAt).toBe(AUCTION_TURN_MS);
  });

  it("refreshes turnStartedAt/turnDeadlineAt after a valid PLACE_BID", async () => {
    const declined = gameReducer(stateAtGuadalajara(), { type: "DECLINE_PROPERTY" });
    const before = declined.auction!.turnStartedAt;
    await new Promise((r) => setTimeout(r, 5));
    const bid = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    expect(bid.auction!.turnStartedAt).toBeGreaterThanOrEqual(before);
    expect(bid.auction!.turnDeadlineAt - bid.auction!.turnStartedAt).toBe(AUCTION_TURN_MS);
  });

  it("refreshes turnStartedAt/turnDeadlineAt after a PASS_AUCTION that doesn't end the auction", async () => {
    const declined = gameReducer(stateAtGuadalajara(3), { type: "DECLINE_PROPERTY" });
    const before = declined.auction!.turnStartedAt;
    await new Promise((r) => setTimeout(r, 5));
    const passed = gameReducer(declined, { type: "PASS_AUCTION" });
    expect(passed.phase).toBe("auction");
    expect(passed.auction!.turnStartedAt).toBeGreaterThanOrEqual(before);
    expect(passed.auction!.turnDeadlineAt - passed.auction!.turnStartedAt).toBe(AUCTION_TURN_MS);
  });

  it("does not carry timer fields once auction resolves", () => {
    const declined = gameReducer(stateAtGuadalajara(2), { type: "DECLINE_PROPERTY" });
    const bid = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    const resolved = gameReducer(bid, { type: "PASS_AUCTION" });
    expect(resolved.auction).toBeNull();
  });

  it("currentBidderIndex advances within bounds of activePlayerIds after a bid", () => {
    const declined = gameReducer(stateAtGuadalajara(3), { type: "DECLINE_PROPERTY" });
    const bid = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    const auction = bid.auction!;
    expect(auction.currentBidderIndex).toBeGreaterThanOrEqual(0);
    expect(auction.currentBidderIndex).toBeLessThan(auction.activePlayerIds.length);
  });
});
