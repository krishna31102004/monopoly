import { describe, it, expect } from "vitest";
import { getBoardCenterStatus } from "@/lib/ui/gameEventPresentation";
import { makeGameState, dice } from "./helpers/factory";
import type { AuctionState, BankruptcyState, TradeState } from "@/types/game";
import type { TradeDraftState } from "@/types/multiplayer";

describe("getBoardCenterStatus", () => {
  it("shows branding/current-turn in the idle state", () => {
    const state = makeGameState();
    const status = getBoardCenterStatus(state);
    expect(status.title).toBe(`Current Turn: ${state.players[0].name}`);
  });

  it("shows the last dice roll once the player has rolled", () => {
    let state = makeGameState();
    state = { ...state, diceRoll: dice(5, 4), currentPlayerHasRolled: true };
    expect(getBoardCenterStatus(state).title).toBe("Rolled 5 + 4 = 9");
  });

  it("shows the Free Parking pot when the rule is ON and the pot is positive", () => {
    let state = makeGameState();
    state = { ...state, freeParkingPot: 400 };
    const status = getBoardCenterStatus(state);
    expect(status.subtitle).toBe("Free Parking Pot: $400");
  });

  it("does not show the Free Parking pot when the rule is OFF", () => {
    let state = makeGameState();
    state = { ...state, freeParkingPot: 400, rules: { ...state.rules, freeParkingCash: false } };
    const status = getBoardCenterStatus(state);
    expect(status.subtitle).toBeUndefined();
  });

  it("shows an auction summary while an auction is active", () => {
    let state = makeGameState();
    const auction: AuctionState = {
      propertySpaceIndex: 5,
      activePlayerIds: [state.players[0].id, state.players[1].id],
      passedPlayerIds: [],
      currentBid: 0,
      highestBidderId: null,
      currentBidderIndex: 0,
      turnStartedAt: Date.now(),
      turnDeadlineAt: Date.now() + 15000,
      status: "active",
    };
    state = { ...state, phase: "auction", auction };
    expect(getBoardCenterStatus(state).title).toBe("Auction: JFK Airport");
  });

  it("shows a trade summary when a pending trade exists", () => {
    let state = makeGameState();
    const trade: TradeState = {
      initiatorPlayerId: state.players[0].id,
      recipientPlayerId: state.players[1].id,
      offerFromInitiator: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      offerFromRecipient: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
    };
    state = { ...state, trade };
    expect(getBoardCenterStatus(state).title).toBe("Trade Negotiation Active");
  });

  it("shows a trade summary when a live multiplayer draft exists, even with no pending trade", () => {
    const state = makeGameState();
    const draft: TradeDraftState = {
      proposerId: state.players[0].id,
      recipientId: state.players[1].id,
      offerFromProposer: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      offerFromRecipient: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      updatedAt: Date.now(),
    };
    expect(getBoardCenterStatus(state, { tradeDraft: draft }).title).toBe("Trade Negotiation Active");
  });

  it("shows a payment-required summary while bankruptcy is pending", () => {
    let state = makeGameState();
    const bankruptcy: BankruptcyState = {
      debtorPlayerId: state.players[0].id,
      creditor: { type: "player", playerId: state.players[1].id },
      amountOwed: 850,
      reason: "rent",
      status: "pending",
      phaseBeforeBankruptcy: "turnComplete",
    };
    state = { ...state, bankruptcy };
    const status = getBoardCenterStatus(state);
    expect(status.title).toBe("Payment Required");
    expect(status.subtitle).toBe(`${state.players[0].name} owes $850`);
  });

  it("shows a Chance/Community Chest card-drawn status while a card is on display", () => {
    let state = makeGameState();
    state = {
      ...state,
      drawnCard: { card: { id: "x", deck: "chance", text: "Test", category: "collect-bank" }, resolvedMessage: "" },
    };
    expect(getBoardCenterStatus(state).title).toBe("Chance Card Drawn");
  });

  it("shows the game-over winner when the game has ended", () => {
    let state = makeGameState();
    state = { ...state, phase: "gameOver", winnerId: state.players[0].id };
    const status = getBoardCenterStatus(state);
    expect(status.title).toBe("Game Over");
    expect(status.subtitle).toBe(`${state.players[0].name} wins!`);
  });
});
