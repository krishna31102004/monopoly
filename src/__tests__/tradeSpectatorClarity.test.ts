import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  getTradeModalRole,
  canEditTradeDraft,
  canAcceptTrade,
  canCancelTrade,
} from "@/lib/game/tradeHelpers";
import type { TradeDraftState } from "@/types/multiplayer";
import type { TradeState } from "@/types/game";

const ROOT = join(process.cwd(), "src");
function read(rel: string) { return readFileSync(join(ROOT, rel), "utf-8"); }

const src = read("components/TradePanel.tsx");

// ── Spectator role identification ─────────────────────────────────────────────

const draft: TradeDraftState = {
  proposerId: "p1",
  recipientId: "p2",
  offerFromProposer: { cash: 200, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
  offerFromRecipient: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
  updatedAt: Date.now(),
};

const trade: TradeState = {
  initiatorPlayerId: "p1",
  recipientPlayerId: "p2",
  offerFromInitiator: { cash: 200, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
  offerFromRecipient: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
};

describe("spectator role detection", () => {
  it("third player is spectator in a draft", () => {
    expect(getTradeModalRole("p3", draft)).toBe("spectator");
  });

  it("undefined player is spectator in a draft", () => {
    expect(getTradeModalRole(undefined, draft)).toBe("spectator");
  });

  it("proposer is 'proposer' role", () => {
    expect(getTradeModalRole("p1", draft)).toBe("proposer");
  });

  it("recipient is 'recipient' role in draft", () => {
    expect(getTradeModalRole("p2", draft)).toBe("recipient");
  });

  it("getTradeModalRole handles pending trade (TradeState) not just draft", () => {
    expect(getTradeModalRole("p1", trade)).toBe("proposer");
    expect(getTradeModalRole("p2", trade)).toBe("recipient");
    expect(getTradeModalRole("p3", trade)).toBe("spectator");
  });
});

// ── Spectator cannot edit draft ───────────────────────────────────────────────

describe("spectator cannot edit draft", () => {
  it("canEditTradeDraft returns false for spectator", () => {
    expect(canEditTradeDraft("p3", draft)).toBe(false);
  });

  it("canEditTradeDraft returns false for undefined player", () => {
    expect(canEditTradeDraft(undefined, draft)).toBe(false);
  });

  it("only proposer can edit draft", () => {
    expect(canEditTradeDraft("p1", draft)).toBe(true);
    expect(canEditTradeDraft("p2", draft)).toBe(false);
  });
});

// ── Spectator cannot accept/cancel trade ─────────────────────────────────────

describe("spectator cannot accept or cancel pending trade", () => {
  it("spectator cannot accept trade", () => {
    expect(canAcceptTrade("p3", trade)).toBe(false);
  });

  it("spectator cannot cancel trade", () => {
    expect(canCancelTrade("p3", trade)).toBe(false);
  });

  it("only recipient can accept trade", () => {
    expect(canAcceptTrade("p2", trade)).toBe(true);
    expect(canAcceptTrade("p1", trade)).toBe(false);
  });

  it("only initiator can cancel trade", () => {
    expect(canCancelTrade("p1", trade)).toBe(true);
    expect(canCancelTrade("p2", trade)).toBe(false);
  });

  it("undefined player cannot accept or cancel", () => {
    expect(canAcceptTrade(undefined, trade)).toBe(false);
    expect(canCancelTrade(undefined, trade)).toBe(false);
  });
});

// ── Spectator UI source assertions (draft mode) ───────────────────────────────

describe("LiveDraftModal — spectator clarity source assertions", () => {
  it("draft modal has isSpectator variable", () => {
    expect(src).toMatch(/isSpectator/);
  });

  it("draft modal subtitle changes for spectator vs proposer", () => {
    // Subtitle uses isSpectator conditional (text may be in isCounter branch)
    expect(src).toMatch(/isSpectator[\s\S]{0,400}Watching[\s\S]{0,50}draft|Watching[\s\S]{0,50}draft[\s\S]{0,400}isSpectator/);
  });

  it("draft modal footer has read-only message for non-proposers", () => {
    // Non-proposer sees a read-only/info footer (not Send Offer button)
    expect(src).toMatch(/can edit or send this offer/);
  });

  it("Send Offer button exists in source (proposer only)", () => {
    expect(src).toMatch(/Send Offer/);
  });

  it("onClose prop is only passed when isProposer (so spectator/recipient cannot dismiss draft)", () => {
    expect(src).toMatch(/isProposer.*onDraftCancel/);
  });
});

// ── Spectator UI source assertions (contract/pending mode) ────────────────────

describe("PendingTradeView — spectator clarity source assertions", () => {
  it("isSpectator variable is defined in PendingTradeView", () => {
    expect(src).toMatch(/isSpectator/);
  });

  it("spectator footer says only recipient can respond", () => {
    expect(src).toMatch(/recipient.*can.*respond|Spectator view/i);
  });

  it("Accept Trade dispatch is gated behind isRecipient and !isInitiator", () => {
    expect(src).toMatch(/isRecipient.*&&.*!isInitiator|!isInitiator.*&&.*isRecipient/);
  });

  it("Cancel Offer dispatch is gated behind isInitiator and !isRecipient", () => {
    expect(src).toMatch(/isInitiator.*&&.*!isRecipient|!isRecipient.*&&.*isInitiator/);
  });

  it("spectator sees both sides of the trade via TwoSideLayout and ContractSide", () => {
    expect(src).toMatch(/TwoSideLayout/);
    expect(src).toMatch(/ContractSide/);
  });

  it("spectator footer text references the recipient's role", () => {
    expect(src).toMatch(/accept.*decline|accept or decline/i);
  });
});

// ── Authorization regression ──────────────────────────────────────────────────

describe("trade authorization regression", () => {
  it("ACCEPT_TRADE uses recipientPlayerId as actorPlayerId", () => {
    expect(src).toMatch(/ACCEPT_TRADE[\s\S]{0,100}actorPlayerId[\s\S]{0,100}recipientPlayerId|recipientPlayerId[\s\S]{0,100}ACCEPT_TRADE/);
  });

  it("DECLINE_TRADE uses recipientPlayerId as actorPlayerId", () => {
    expect(src).toMatch(/DECLINE_TRADE[\s\S]{0,100}actorPlayerId[\s\S]{0,100}recipientPlayerId|recipientPlayerId[\s\S]{0,100}DECLINE_TRADE/);
  });

  it("CANCEL_TRADE uses initiatorPlayerId as actorPlayerId", () => {
    expect(src).toMatch(/CANCEL_TRADE[\s\S]{0,100}actorPlayerId[\s\S]{0,100}initiatorPlayerId|initiatorPlayerId[\s\S]{0,100}CANCEL_TRADE/);
  });
});
