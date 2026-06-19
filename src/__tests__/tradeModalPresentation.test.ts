import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  getTradeModalRole,
  canEditTradeDraft,
  canSubmitTradeDraft,
  getTradeSideListedValue,
  getAfterTradeCash,
} from "@/lib/game/tradeHelpers";
import { makeGameState } from "./helpers/factory";
import type { TradeDraftState } from "@/types/multiplayer";

const ROOT = join(process.cwd(), "src");
function read(rel: string) { return readFileSync(join(ROOT, rel), "utf-8"); }

// ── Source-text assertions for TradePanel premium UI ─────────────────────────

describe("TradePanel — premium UI source assertions", () => {
  const src = read("components/TradePanel.tsx");

  it("renders DealTray component", () => {
    expect(src).toMatch(/DealTray/);
  });

  it("renders TradeSideColumn component", () => {
    expect(src).toMatch(/TradeSideColumn/);
  });

  it("renders ExchangeColumn with ⇄ symbol", () => {
    expect(src).toMatch(/ExchangeColumn/);
    expect(src).toMatch(/⇄/);
  });

  it("renders CashInput component with $ prefix", () => {
    expect(src).toMatch(/CashInput/);
    expect(src).toMatch(/\$/);
  });

  it("renders PropertyChip with color strip", () => {
    expect(src).toMatch(/PropertyChip/);
    expect(src).toMatch(/colorHex/);
  });

  it("shows 'Nothing selected yet' for empty deal tray", () => {
    expect(src).toMatch(/Nothing selected yet/);
  });

  it("shows 'Listed value' label in deal tray", () => {
    expect(src).toMatch(/Listed value/);
  });

  it("shows 'Cash after trade' in deal tray", () => {
    expect(src).toMatch(/Cash after trade/);
  });

  it("shows 'Not enough cash' for invalid cash offers", () => {
    expect(src).toMatch(/Not enough cash/);
  });

  it("shows 'Balance:' in cash input", () => {
    expect(src).toMatch(/Balance:/);
  });

  it("shows 'Exceeds balance' when cash is over limit", () => {
    expect(src).toMatch(/Exceeds balance/);
  });

  it("imports getTradeSideListedValue from tradeHelpers", () => {
    expect(src).toMatch(/getTradeSideListedValue/);
  });

  it("imports getAfterTradeCash from tradeHelpers", () => {
    expect(src).toMatch(/getAfterTradeCash/);
  });

  it("imports getTradePropertyCardPresentation from tradeHelpers", () => {
    expect(src).toMatch(/getTradePropertyCardPresentation/);
  });

  it("has gradient dark header (premium modal style)", () => {
    expect(src).toMatch(/from-indigo-900/);
  });

  it("proposer-only draft edit: toggleProp checks isProposer", () => {
    expect(src).toMatch(/if.*!isProposer.*return/);
  });

  it("recipient cannot start or cancel draft (no close handler for non-proposer)", () => {
    expect(src).toMatch(/isProposer.*onDraftCancel/);
  });

  it("only recipient can accept pending trade", () => {
    expect(src).toMatch(/ACCEPT_TRADE.*actorPlayerId.*recipientPlayerId|recipientPlayerId.*ACCEPT_TRADE/);
  });

  it("only initiator can cancel pending trade", () => {
    expect(src).toMatch(/CANCEL_TRADE.*actorPlayerId.*initiatorPlayerId|initiatorPlayerId.*CANCEL_TRADE/);
  });

  it("spectator sees read-only message", () => {
    expect(src).toMatch(/Watching trade negotiation/);
  });
});

// ── Permission regression tests (logic level) ─────────────────────────────────

describe("trade permission regression", () => {
  const draft: TradeDraftState = {
    proposerId: "p1",
    recipientId: "p2",
    offerFromProposer: { cash: 100, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
    offerFromRecipient: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
    updatedAt: Date.now(),
  };

  it("proposer can edit draft", () => {
    expect(canEditTradeDraft("p1", draft)).toBe(true);
  });

  it("recipient cannot edit proposer draft", () => {
    expect(canEditTradeDraft("p2", draft)).toBe(false);
  });

  it("spectator cannot edit draft", () => {
    expect(canEditTradeDraft("p3", draft)).toBe(false);
  });

  it("proposer can submit valid draft", () => {
    const state = makeGameState(2);
    const liveDraft: TradeDraftState = {
      ...draft,
      proposerId: state.players[0].id,
      recipientId: state.players[1].id,
    };
    expect(canSubmitTradeDraft(state, liveDraft.proposerId, liveDraft)).toBe(true);
  });

  it("recipient cannot submit draft", () => {
    const state = makeGameState(2);
    const liveDraft: TradeDraftState = {
      ...draft,
      proposerId: state.players[0].id,
      recipientId: state.players[1].id,
    };
    expect(canSubmitTradeDraft(state, liveDraft.recipientId, liveDraft)).toBe(false);
  });

  it("role lookup is correct for all roles", () => {
    expect(getTradeModalRole("p1", draft)).toBe("proposer");
    expect(getTradeModalRole("p2", draft)).toBe("recipient");
    expect(getTradeModalRole("p3", draft)).toBe("spectator");
    expect(getTradeModalRole(undefined, draft)).toBe("spectator");
  });
});

// ── Deal tray logic ───────────────────────────────────────────────────────────

describe("deal tray: listed value and cash summary", () => {
  it("empty offer has listed value of 0", () => {
    expect(getTradeSideListedValue({ cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 })).toBe(0);
  });

  it("listed value includes cash", () => {
    expect(getTradeSideListedValue({ cash: 300, propertySpaceIndices: [], getOutOfJailFreeCards: 0 })).toBe(300);
  });

  it("listed value includes property list prices", () => {
    // Index 1 = Guadalajara $60
    expect(getTradeSideListedValue({ cash: 0, propertySpaceIndices: [1], getOutOfJailFreeCards: 0 })).toBe(60);
  });

  it("after trade cash is valid when giving less than balance", () => {
    const r = getAfterTradeCash(1000, 200, 0);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.amount).toBe(800);
  });

  it("after trade cash is invalid when giving more than balance", () => {
    const r = getAfterTradeCash(100, 200, 0);
    expect(r.valid).toBe(false);
  });

  it("after trade cash accounts for cash received", () => {
    const r = getAfterTradeCash(500, 300, 100);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.amount).toBe(300);
  });
});
