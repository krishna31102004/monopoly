import { describe, it, expect } from "vitest";
import {
  canMortgageNow,
  canOpenTradeNow,
  canBuyLandedPropertyNow,
  getAllowedActionsForPhase,
} from "@/lib/game/turnTimingRules";
import { makeGameState } from "./helpers/factory";

describe("canMortgageNow", () => {
  it("allows mortgage during readyToRoll", () => {
    const state = makeGameState();
    const result = canMortgageNow(state, state.players[0].id);
    expect(result.ok).toBe(true);
  });

  it("blocks mortgage during awaitingPurchaseDecision", () => {
    const state = { ...makeGameState(), phase: "awaitingPurchaseDecision" as const };
    const result = canMortgageNow(state, state.players[0].id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/property purchase/i);
  });

  it("blocks mortgage during auction", () => {
    const state = { ...makeGameState(), phase: "auction" as const };
    const result = canMortgageNow(state, state.players[0].id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/auction/i);
  });

  it("allows debtor to mortgage during bankruptcyPending", () => {
    const base = makeGameState();
    const debtorId = base.players[0].id;
    const state = {
      ...base,
      phase: "bankruptcyPending" as const,
      bankruptcy: {
        debtorPlayerId: debtorId,
        creditor: { type: "bank" as const },
        amountOwed: 100,
        reason: "rent",
        status: "pending" as const,
        phaseBeforeBankruptcy: "turnComplete" as const,
      },
    };
    const result = canMortgageNow(state, debtorId);
    expect(result.ok).toBe(true);
  });

  it("blocks non-debtor from mortgaging during bankruptcyPending", () => {
    const base = makeGameState();
    const debtorId = base.players[0].id;
    const otherId = base.players[1].id;
    const state = {
      ...base,
      phase: "bankruptcyPending" as const,
      bankruptcy: {
        debtorPlayerId: debtorId,
        creditor: { type: "bank" as const },
        amountOwed: 100,
        reason: "rent",
        status: "pending" as const,
        phaseBeforeBankruptcy: "turnComplete" as const,
      },
    };
    const result = canMortgageNow(state, otherId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/trades are available/i);
  });
});

describe("canOpenTradeNow", () => {
  it("allows trade during readyToRoll", () => {
    const state = makeGameState();
    const result = canOpenTradeNow(state, state.players[0].id);
    expect(result.ok).toBe(true);
  });

  it("blocks trade during awaitingPurchaseDecision", () => {
    const state = { ...makeGameState(), phase: "awaitingPurchaseDecision" as const };
    const result = canOpenTradeNow(state, state.players[0].id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/property purchase/i);
  });

  it("blocks trade during auction", () => {
    const state = { ...makeGameState(), phase: "auction" as const };
    const result = canOpenTradeNow(state, state.players[0].id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/auction/i);
  });

  it("blocks trade during gameOver", () => {
    const state = { ...makeGameState(), phase: "gameOver" as const };
    const result = canOpenTradeNow(state, state.players[0].id);
    expect(result.ok).toBe(false);
  });
});

describe("canBuyLandedPropertyNow", () => {
  it("allows buy when sufficient cash and awaitingPurchaseDecision", () => {
    const state = { ...makeGameState(), phase: "awaitingPurchaseDecision" as const };
    const result = canBuyLandedPropertyNow(state, state.players[0].id, 200);
    expect(result.ok).toBe(true);
  });

  it("blocks buy when insufficient cash", () => {
    const base = makeGameState();
    const state = {
      ...base,
      phase: "awaitingPurchaseDecision" as const,
      players: base.players.map((p, i) => (i === 0 ? { ...p, cash: 50 } : p)),
    };
    const result = canBuyLandedPropertyNow(state, state.players[0].id, 200);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(
        "You do not have enough cash to buy this property. Decline to send it to auction.",
      );
    }
  });

  it("blocks buy when not in awaitingPurchaseDecision phase", () => {
    const state = makeGameState();
    const result = canBuyLandedPropertyNow(state, state.players[0].id, 200);
    expect(result.ok).toBe(false);
  });
});

describe("getAllowedActionsForPhase", () => {
  it("readyToRoll allows roll and trade and mortgage", () => {
    const actions = getAllowedActionsForPhase("readyToRoll");
    expect(actions.canRoll).toBe(true);
    expect(actions.canTrade).toBe(true);
    expect(actions.canMortgage).toBe(true);
    expect(actions.canEndTurn).toBe(false);
    expect(actions.canBuyOrDecline).toBe(false);
  });

  it("awaitingPurchaseDecision only allows buy/decline", () => {
    const actions = getAllowedActionsForPhase("awaitingPurchaseDecision");
    expect(actions.canBuyOrDecline).toBe(true);
    expect(actions.canRoll).toBe(false);
    expect(actions.canTrade).toBe(false);
    expect(actions.canMortgage).toBe(false);
  });

  it("auction phase disallows trade, mortgage, roll, end turn, buy", () => {
    const actions = getAllowedActionsForPhase("auction");
    expect(actions.canTrade).toBe(false);
    expect(actions.canMortgage).toBe(false);
    expect(actions.canRoll).toBe(false);
    expect(actions.canEndTurn).toBe(false);
    expect(actions.canBuyOrDecline).toBe(false);
  });

  it("turnComplete allows end turn and mortgage but not roll or trade", () => {
    const actions = getAllowedActionsForPhase("turnComplete");
    expect(actions.canEndTurn).toBe(true);
    expect(actions.canMortgage).toBe(true);
    expect(actions.canRoll).toBe(false);
    expect(actions.canTrade).toBe(false);
  });
});
