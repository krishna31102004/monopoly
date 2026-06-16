import { describe, it, expect } from "vitest";
import {
  getTradeModalRole,
  canEditTradeDraft,
  canSubmitTradeDraft,
  canAcceptTrade,
  canCancelTrade,
  getTradeSideSummary,
} from "@/lib/game/tradeHelpers";
import { makeGameState, withPlayer } from "./helpers/factory";
import type { TradeDraftState } from "@/types/multiplayer";
import type { TradeState } from "@/types/game";

const EMPTY = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };

describe("getTradeModalRole", () => {
  it("returns 'none' when there is no trade or draft", () => {
    expect(getTradeModalRole("p1", null)).toBe("none");
  });

  it("identifies the proposer of a live draft", () => {
    const draft: TradeDraftState = { proposerId: "p1", recipientId: "p2", offerFromProposer: EMPTY, offerFromRecipient: EMPTY, updatedAt: 0 };
    expect(getTradeModalRole("p1", draft)).toBe("proposer");
  });

  it("identifies the recipient of a live draft", () => {
    const draft: TradeDraftState = { proposerId: "p1", recipientId: "p2", offerFromProposer: EMPTY, offerFromRecipient: EMPTY, updatedAt: 0 };
    expect(getTradeModalRole("p2", draft)).toBe("recipient");
  });

  it("treats anyone else as a spectator", () => {
    const draft: TradeDraftState = { proposerId: "p1", recipientId: "p2", offerFromProposer: EMPTY, offerFromRecipient: EMPTY, updatedAt: 0 };
    expect(getTradeModalRole("p3", draft)).toBe("spectator");
  });

  it("works for a pending (already-proposed) TradeState too", () => {
    const trade: TradeState = { initiatorPlayerId: "p1", recipientPlayerId: "p2", offerFromInitiator: EMPTY, offerFromRecipient: EMPTY };
    expect(getTradeModalRole("p1", trade)).toBe("proposer");
    expect(getTradeModalRole("p2", trade)).toBe("recipient");
    expect(getTradeModalRole("p3", trade)).toBe("spectator");
  });

  it("treats an undefined actor (no identity) as a spectator when a draft exists", () => {
    const draft: TradeDraftState = { proposerId: "p1", recipientId: "p2", offerFromProposer: EMPTY, offerFromRecipient: EMPTY, updatedAt: 0 };
    expect(getTradeModalRole(undefined, draft)).toBe("spectator");
  });
});

describe("canEditTradeDraft", () => {
  const draft: TradeDraftState = { proposerId: "p1", recipientId: "p2", offerFromProposer: EMPTY, offerFromRecipient: EMPTY, updatedAt: 0 };

  it("only the proposer can edit", () => {
    expect(canEditTradeDraft("p1", draft)).toBe(true);
    expect(canEditTradeDraft("p2", draft)).toBe(false);
    expect(canEditTradeDraft("p3", draft)).toBe(false);
  });

  it("is false when there is no draft", () => {
    expect(canEditTradeDraft("p1", null)).toBe(false);
  });
});

describe("canSubmitTradeDraft", () => {
  it("is true for the proposer when the draft is valid", () => {
    const state = makeGameState(2);
    const p0 = state.players[0].id;
    const p1 = state.players[1].id;
    const draft: TradeDraftState = {
      proposerId: p0,
      recipientId: p1,
      offerFromProposer: { cash: 100, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      offerFromRecipient: EMPTY,
      updatedAt: 0,
    };
    expect(canSubmitTradeDraft(state, p0, draft)).toBe(true);
  });

  it("is false for the recipient even if the draft is valid", () => {
    const state = makeGameState(2);
    const p0 = state.players[0].id;
    const p1 = state.players[1].id;
    const draft: TradeDraftState = {
      proposerId: p0,
      recipientId: p1,
      offerFromProposer: { cash: 100, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      offerFromRecipient: EMPTY,
      updatedAt: 0,
    };
    expect(canSubmitTradeDraft(state, p1, draft)).toBe(false);
  });

  it("is false when the proposer cannot afford the offered cash", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { cash: 10 });
    const p0 = state.players[0].id;
    const p1 = state.players[1].id;
    const draft: TradeDraftState = {
      proposerId: p0,
      recipientId: p1,
      offerFromProposer: { cash: 500, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      offerFromRecipient: EMPTY,
      updatedAt: 0,
    };
    expect(canSubmitTradeDraft(state, p0, draft)).toBe(false);
  });
});

describe("canAcceptTrade / canCancelTrade", () => {
  const trade: TradeState = { initiatorPlayerId: "p1", recipientPlayerId: "p2", offerFromInitiator: EMPTY, offerFromRecipient: EMPTY };

  it("only the recipient can accept", () => {
    expect(canAcceptTrade("p2", trade)).toBe(true);
    expect(canAcceptTrade("p1", trade)).toBe(false);
  });

  it("only the initiator can cancel", () => {
    expect(canCancelTrade("p1", trade)).toBe(true);
    expect(canCancelTrade("p2", trade)).toBe(false);
  });

  it("both are false when there is no trade", () => {
    expect(canAcceptTrade("p1", null)).toBe(false);
    expect(canCancelTrade("p1", null)).toBe(false);
  });
});

describe("getTradeSideSummary", () => {
  it("flags an offer with nothing in it as empty", () => {
    expect(getTradeSideSummary(EMPTY).isEmpty).toBe(true);
  });

  it("flags an offer with cash as non-empty", () => {
    expect(getTradeSideSummary({ cash: 1, propertySpaceIndices: [], getOutOfJailFreeCards: 0 }).isEmpty).toBe(false);
  });

  it("flags an offer with a property as non-empty", () => {
    expect(getTradeSideSummary({ cash: 0, propertySpaceIndices: [5], getOutOfJailFreeCards: 0 }).isEmpty).toBe(false);
  });
});
