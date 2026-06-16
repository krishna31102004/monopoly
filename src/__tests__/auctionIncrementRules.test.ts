import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { makeGameState, withPosition } from "./helpers/factory";

function stateAtGuadalajara(playerCount = 2) {
  const state = makeGameState(playerCount);
  const positioned = withPosition(state, 38);
  return gameReducer(positioned, {
    type: "ROLL_DICE",
    dice: { die1: 3, die2: 0, total: 3, isDouble: false },
  });
}

function startAuction(playerCount = 2) {
  return gameReducer(stateAtGuadalajara(playerCount), { type: "DECLINE_PROPERTY" });
}

describe("Auction bid increment rules", () => {
  it("opening bid of exactly $10 is accepted", () => {
    const declined = startAuction();
    const bid = gameReducer(declined, { type: "PLACE_BID", amount: 10 });
    expect(bid.auction?.currentBid).toBe(10);
  });

  it("opening bid below $10 is rejected", () => {
    const declined = startAuction();
    const bid = gameReducer(declined, { type: "PLACE_BID", amount: 9 });
    expect(bid.auction?.currentBid).toBe(0);
  });

  it("opening bid above $10 is rejected (must be exactly $10)", () => {
    const declined = startAuction();
    const bid = gameReducer(declined, { type: "PLACE_BID", amount: 11 });
    expect(bid.auction?.currentBid).toBe(0);
  });

  it("+$1 increment is accepted after opening bid", () => {
    let state = startAuction();
    state = gameReducer(state, { type: "PLACE_BID", amount: 10 });
    const bid = gameReducer(state, { type: "PLACE_BID", amount: 11 });
    expect(bid.auction?.currentBid).toBe(11);
  });

  it("+$10 increment is accepted after opening bid", () => {
    let state = startAuction();
    state = gameReducer(state, { type: "PLACE_BID", amount: 10 });
    const bid = gameReducer(state, { type: "PLACE_BID", amount: 20 });
    expect(bid.auction?.currentBid).toBe(20);
  });

  it("+$100 increment is accepted after opening bid", () => {
    let state = startAuction();
    state = gameReducer(state, { type: "PLACE_BID", amount: 10 });
    const bid = gameReducer(state, { type: "PLACE_BID", amount: 110 });
    expect(bid.auction?.currentBid).toBe(110);
  });

  it("arbitrary non-matching increment is rejected", () => {
    let state = startAuction();
    state = gameReducer(state, { type: "PLACE_BID", amount: 10 });
    const bid = gameReducer(state, { type: "PLACE_BID", amount: 25 });
    expect(bid.auction?.currentBid).toBe(10);
  });

  it("bid lower than current bid is rejected", () => {
    let state = startAuction();
    state = gameReducer(state, { type: "PLACE_BID", amount: 10 });
    const bid = gameReducer(state, { type: "PLACE_BID", amount: 5 });
    expect(bid.auction?.currentBid).toBe(10);
  });

  it("stacked valid increments compound correctly", () => {
    let state = startAuction();
    state = gameReducer(state, { type: "PLACE_BID", amount: 10 });
    state = gameReducer(state, { type: "PLACE_BID", amount: 11 });
    state = gameReducer(state, { type: "PLACE_BID", amount: 21 });
    state = gameReducer(state, { type: "PLACE_BID", amount: 121 });
    expect(state.auction?.currentBid).toBe(121);
  });
});
