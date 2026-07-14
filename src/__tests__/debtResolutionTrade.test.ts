import { describe, expect, it } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { calculateGuaranteedDebtCapacity, getTradingMode, validateTrade } from "@/lib/game/trade";
import { makeGameState, withMortgage, withOwnership, withPlayer } from "@/__tests__/helpers/factory";
import type { GameState, TradeOffer } from "@/types/game";

const GUADALAJARA = 1;
const CANCUN = 3;
const JFK = 5;
const empty: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };

function pendingDebt(state: GameState, amount = 450): GameState {
  const debtor = state.players[0];
  return {
    ...state,
    phase: "bankruptcyPending",
    bankruptcy: {
      debtorPlayerId: debtor.id,
      creditor: { type: "player", playerId: state.players[1].id },
      amountOwed: amount,
      reason: "Rent is due.",
      status: "pending",
      phaseBeforeBankruptcy: "turnComplete",
    },
  };
}

describe("creditor-protected debt-resolution trading", () => {
  it("normal mode bans empty and cash-only trades but retains property gifts", () => {
    let state = makeGameState(2);
    const [debtor, counterparty] = state.players;
    expect(validateTrade(state, debtor.id, counterparty.id, empty, empty).ok).toBe(false);
    expect(validateTrade(state, debtor.id, counterparty.id, { ...empty, cash: 20 }, empty).ok).toBe(false);
    state = withOwnership(state, GUADALAJARA, debtor.id);
    expect(validateTrade(state, debtor.id, counterparty.id, { ...empty, propertySpaceIndices: [GUADALAJARA] }, empty).ok).toBe(true);
  });

  it("blocks the cash-and-property dumping exploit and preserves the creditor debt", () => {
    let state = makeGameState(3);
    const [kb, jai, ansh] = state.players;
    state = withPlayer(state, 0, { cash: 436 });
    state = withOwnership(state, GUADALAJARA, kb.id);
    state = withOwnership(state, CANCUN, kb.id);
    state = withOwnership(state, JFK, kb.id);
    state = pendingDebt(state);
    const offer: TradeOffer = { cash: 436, propertySpaceIndices: [GUADALAJARA, CANCUN, JFK], getOutOfJailFreeCards: 0 };
    const check = validateTrade(state, kb.id, ansh.id, offer, empty);
    expect(check.ok).toBe(false);
    const next = gameReducer(state, { type: "PROPOSE_TRADE", actorPlayerId: kb.id, initiatorId: kb.id, recipientId: ansh.id, offerFromInitiator: offer, offerFromRecipient: empty });
    expect(next).toBe(state);
    expect(next.bankruptcy?.creditor).toEqual({ type: "player", playerId: jai.id });
  });

  it("allows an asset-for-$14 liquidation that makes the debtor able to pay", () => {
    let state = makeGameState(3);
    const [kb, jai, ansh] = state.players;
    state = withPlayer(state, 0, { cash: 436 });
    state = withOwnership(state, GUADALAJARA, kb.id);
    state = pendingDebt(state);
    const debtorOffer = { ...empty, propertySpaceIndices: [GUADALAJARA] };
    const buyerOffer = { ...empty, cash: 14 };
    expect(getTradingMode(state)).toMatchObject({ type: "debt-resolution", debtorPlayerId: kb.id, outstandingAmount: 450 });
    expect(validateTrade(state, kb.id, ansh.id, debtorOffer, buyerOffer).ok).toBe(true);
    state = gameReducer(state, { type: "PROPOSE_TRADE", actorPlayerId: kb.id, initiatorId: kb.id, recipientId: ansh.id, offerFromInitiator: debtorOffer, offerFromRecipient: buyerOffer });
    state = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: ansh.id });
    expect(state.players[0].cash).toBe(450);
    expect(state.bankruptcy?.creditor).toEqual({ type: "player", playerId: jai.id });
    expect(validateTrade(state, kb.id, ansh.id, debtorOffer, buyerOffer).ok).toBe(false);
  });

  it("counts only retained unmortgaged assets as mortgage capacity", () => {
    let state = makeGameState(3);
    const [kb, , ansh] = state.players;
    state = withPlayer(state, 0, { cash: 436 });
    state = withOwnership(state, GUADALAJARA, kb.id);
    state = withOwnership(state, JFK, kb.id);
    state = withMortgage(state, GUADALAJARA);
    state = pendingDebt(state);
    const mortgagedAsset = { ...empty, propertySpaceIndices: [GUADALAJARA] };
    expect(validateTrade(state, kb.id, ansh.id, mortgagedAsset, { ...empty, cash: 5 }).ok).toBe(true);
    const capacity = calculateGuaranteedDebtCapacity(state, kb.id);
    expect(capacity.remainingMortgageProceeds).toBe(100);

    const noRetainedCapacity = pendingDebt(withMortgage(state, JFK));
    expect(validateTrade(noRetainedCapacity, kb.id, ansh.id, mortgagedAsset, { ...empty, cash: 4 }).ok).toBe(false);
  });
});
