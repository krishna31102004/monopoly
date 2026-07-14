import { describe, it, expect } from "vitest";
import {
  getTradeModalRole,
  canEditTradeDraft,
  canSubmitTradeDraft,
  getTradeStatusBadgeText,
  classifyTradeResultFromLogMessage,
} from "@/lib/game/tradeHelpers";
import { makeGameState } from "./helpers/factory";
import type { TradeDraftState } from "@/types/multiplayer";

// No DOM testing library (jsdom/@testing-library) is installed in this repo,
// and this Vitest project runs .test.ts files without a JSX transform, so the
// premium trade modal (TradePanel.tsx, a "use client" component) can't be
// imported or rendered directly from a .test.ts file. These tests instead
// lock in the role/permission decisions the component relies on to decide
// what to render for a given viewer — proposer vs. recipient vs. spectator —
// which is where regressions would actually bite.

describe("Premium trade UI — three visual states map to distinct roles", () => {
  const draft: TradeDraftState = {
    proposerId: "p1",
    recipientId: "p2",
    offerFromProposer: { cash: 100, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
    offerFromRecipient: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
    updatedAt: Date.now(),
  };

  it("draft state: proposer sees editable controls, recipient and spectators do not", () => {
    expect(canEditTradeDraft("p1", draft)).toBe(true);
    expect(canEditTradeDraft("p2", draft)).toBe(false);
    expect(canEditTradeDraft("p3", draft)).toBe(false);
  });

  it("draft state: role lookup distinguishes proposer / recipient / spectator for live-view labelling", () => {
    expect(getTradeModalRole("p1", draft)).toBe("proposer");
    expect(getTradeModalRole("p2", draft)).toBe("recipient");
    expect(getTradeModalRole("p3", draft)).toBe("spectator");
  });

  it("draft state: only the proposer's submit action is gated by validation, never the recipient's", () => {
    const state = makeGameState(2);
    const liveDraft: TradeDraftState = { ...draft, proposerId: state.players[0].id, recipientId: state.players[1].id };
    expect(canSubmitTradeDraft(state, liveDraft.proposerId, liveDraft)).toBe(false);
    expect(canSubmitTradeDraft(state, liveDraft.recipientId, liveDraft)).toBe(false);
  });
});

describe("trade modal status badge text reflects the negotiation stage", () => {
  it("shows 'Drafting' for the proposer before anything is sent", () => {
    expect(getTradeStatusBadgeText({ hasDraft: true, hasPendingTrade: false, isProposer: true })).toBe("Drafting");
  });

  it("shows 'Live Draft' to the recipient/spectators watching a draft", () => {
    expect(getTradeStatusBadgeText({ hasDraft: true, hasPendingTrade: false, isProposer: false })).toBe("Live Draft");
  });

  it("shows 'Waiting for <recipient>' to the proposer once the offer is sent", () => {
    expect(
      getTradeStatusBadgeText({ hasDraft: false, hasPendingTrade: true, isProposer: true, recipientName: "Ravi" }),
    ).toBe("Waiting for Ravi");
  });

  it("shows 'Offer Sent' to the recipient/spectators once the offer is sent", () => {
    expect(getTradeStatusBadgeText({ hasDraft: false, hasPendingTrade: true, isProposer: false })).toBe("Offer Sent");
  });
});

describe("trade result banner classification from the game log", () => {
  it("classifies an accepted trade", () => {
    expect(classifyTradeResultFromLogMessage("Trade accepted: P1 gave $100 to P2 in exchange for nothing.")).toBe("accepted");
  });

  it("classifies a declined trade", () => {
    expect(classifyTradeResultFromLogMessage("P2 declined the trade.")).toBe("declined");
  });

  it("classifies a cancelled trade", () => {
    expect(classifyTradeResultFromLogMessage("P1 cancelled the trade.")).toBe("cancelled");
  });

  it("returns null for unrelated log messages or no message", () => {
    expect(classifyTradeResultFromLogMessage("P1 rolled a 6 and a 4.")).toBeNull();
    expect(classifyTradeResultFromLogMessage(undefined)).toBeNull();
  });
});
