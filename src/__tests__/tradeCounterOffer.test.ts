import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { gameReducer } from "@/lib/game/gameReducer";
import {
  makeGameState,
  withPlayer,
} from "./helpers/factory";
import type { TradeOffer } from "@/types/game";

const ROOT = join(process.cwd(), "src");
function read(rel: string) { return readFileSync(join(ROOT, rel), "utf-8"); }

// ── Counter-offer reducer tests ───────────────────────────────────────────────

const EMPTY_OFFER: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };
const CASH_OFFER: TradeOffer = { cash: 100, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };

function stateWithPendingTrade() {
  const state = makeGameState(2);
  const p1 = state.players[0];
  const p2 = state.players[1];
  return gameReducer(state, {
    type: "PROPOSE_TRADE",
    actorPlayerId: p1.id,
    initiatorId: p1.id,
    recipientId: p2.id,
    offerFromInitiator: CASH_OFFER,
    offerFromRecipient: EMPTY_OFFER,
  });
}

describe("COUNTER_TRADE reducer", () => {
  it("recipient can counter a pending trade", () => {
    const state = stateWithPendingTrade();
    const recipientId = state.trade!.recipientPlayerId;
    const next = gameReducer(state, { type: "COUNTER_TRADE", actorPlayerId: recipientId });
    expect(next.trade).toBeNull();
    expect(next.counterTrade).not.toBeNull();
  });

  it("counterTrade.allowedProposerId is the old recipient", () => {
    const state = stateWithPendingTrade();
    const recipientId = state.trade!.recipientPlayerId;
    const next = gameReducer(state, { type: "COUNTER_TRADE", actorPlayerId: recipientId });
    expect(next.counterTrade?.allowedProposerId).toBe(recipientId);
  });

  it("counterTrade.allowedRecipientId is the old initiator", () => {
    const state = stateWithPendingTrade();
    const initiatorId = state.trade!.initiatorPlayerId;
    const recipientId = state.trade!.recipientPlayerId;
    const next = gameReducer(state, { type: "COUNTER_TRADE", actorPlayerId: recipientId });
    expect(next.counterTrade?.allowedRecipientId).toBe(initiatorId);
  });

  it("counter clears the pending trade", () => {
    const state = stateWithPendingTrade();
    const recipientId = state.trade!.recipientPlayerId;
    const next = gameReducer(state, { type: "COUNTER_TRADE", actorPlayerId: recipientId });
    expect(next.trade).toBeNull();
  });

  it("proposer cannot counter their own pending offer", () => {
    const state = stateWithPendingTrade();
    const initiatorId = state.trade!.initiatorPlayerId;
    const next = gameReducer(state, { type: "COUNTER_TRADE", actorPlayerId: initiatorId });
    expect(next.trade).not.toBeNull(); // trade unchanged
    expect(next.counterTrade).toBeNull();
  });

  it("cannot counter when no trade exists", () => {
    const state = makeGameState(2);
    const p2 = state.players[1];
    const next = gameReducer(state, { type: "COUNTER_TRADE", actorPlayerId: p2.id });
    expect(next.counterTrade).toBeNull();
    expect(next).toStrictEqual(state); // unchanged
  });

  it("bankrupt recipient cannot counter", () => {
    const state = stateWithPendingTrade();
    const recipientId = state.trade!.recipientPlayerId;
    const recipientIdx = state.players.findIndex((p) => p.id === recipientId);
    const bankruptState = withPlayer(state, recipientIdx, { isBankrupt: true });
    const next = gameReducer(bankruptState, { type: "COUNTER_TRADE", actorPlayerId: recipientId });
    expect(next.trade).not.toBeNull(); // unchanged
    expect(next.counterTrade).toBeNull();
  });

  it("counter logs a counter message", () => {
    const state = stateWithPendingTrade();
    const recipientId = state.trade!.recipientPlayerId;
    const next = gameReducer(state, { type: "COUNTER_TRADE", actorPlayerId: recipientId });
    expect(next.gameLog[0].message).toMatch(/counter-offer/i);
  });
});

describe("PROPOSE_TRADE after counter (bypass turn restriction)", () => {
  it("counter-proposer can submit trade even if not current player", () => {
    const state = stateWithPendingTrade();
    const recipientId = state.trade!.recipientPlayerId;
    const initiatorId = state.trade!.initiatorPlayerId;

    // Counter: recipient becomes proposer
    const counterState = gameReducer(state, { type: "COUNTER_TRADE", actorPlayerId: recipientId });
    expect(counterState.counterTrade).not.toBeNull();

    // Old recipient (now counter-proposer) submits counter
    const finalState = gameReducer(counterState, {
      type: "PROPOSE_TRADE",
      actorPlayerId: recipientId,
      initiatorId: recipientId,
      recipientId: initiatorId,
      offerFromInitiator: CASH_OFFER,
      offerFromRecipient: EMPTY_OFFER,
    });

    expect(finalState.trade).not.toBeNull();
    expect(finalState.trade?.initiatorPlayerId).toBe(recipientId);
    expect(finalState.trade?.recipientPlayerId).toBe(initiatorId);
    expect(finalState.counterTrade).toBeNull(); // cleared after proposal
  });

  it("counter-proposer cannot propose to a third player", () => {
    const state = makeGameState(3);
    const p1 = state.players[0];
    const p2 = state.players[1];
    const p3 = state.players[2];

    const pendingState = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p1.id,
      initiatorId: p1.id,
      recipientId: p2.id,
      offerFromInitiator: CASH_OFFER,
      offerFromRecipient: EMPTY_OFFER,
    });

    const counterState = gameReducer(pendingState, { type: "COUNTER_TRADE", actorPlayerId: p2.id });

    // p2 tries to propose to p3 (not allowed — must go back to p1)
    const attemptState = gameReducer(counterState, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p2.id,
      initiatorId: p2.id,
      recipientId: p3.id,
      offerFromInitiator: CASH_OFFER,
      offerFromRecipient: EMPTY_OFFER,
    });

    expect(attemptState.trade).toBeNull(); // rejected
    expect(attemptState.counterTrade).not.toBeNull(); // counter still in progress
  });

  it("old proposer cannot propose in counter-trade state", () => {
    const state = stateWithPendingTrade();
    const initiatorId = state.trade!.initiatorPlayerId;
    const recipientId = state.trade!.recipientPlayerId;

    const counterState = gameReducer(state, { type: "COUNTER_TRADE", actorPlayerId: recipientId });

    // Old initiator tries to propose — should be blocked
    const attemptState = gameReducer(counterState, {
      type: "PROPOSE_TRADE",
      actorPlayerId: initiatorId,
      initiatorId,
      recipientId,
      offerFromInitiator: CASH_OFFER,
      offerFromRecipient: EMPTY_OFFER,
    });

    expect(attemptState.trade).toBeNull(); // rejected
    expect(attemptState.counterTrade).not.toBeNull(); // still in progress
  });
});

describe("CANCEL_COUNTER_TRADE", () => {
  it("counter-proposer can cancel the counter draft", () => {
    const state = stateWithPendingTrade();
    const recipientId = state.trade!.recipientPlayerId;
    const counterState = gameReducer(state, { type: "COUNTER_TRADE", actorPlayerId: recipientId });
    const cancelState = gameReducer(counterState, { type: "CANCEL_COUNTER_TRADE", actorPlayerId: recipientId });
    expect(cancelState.counterTrade).toBeNull();
  });

  it("cancel counter logs a cancelled message (triggers stamp)", () => {
    const state = stateWithPendingTrade();
    const recipientId = state.trade!.recipientPlayerId;
    const counterState = gameReducer(state, { type: "COUNTER_TRADE", actorPlayerId: recipientId });
    const cancelState = gameReducer(counterState, { type: "CANCEL_COUNTER_TRADE", actorPlayerId: recipientId });
    expect(cancelState.gameLog[0].message).toMatch(/cancelled the trade/i);
  });

  it("only counter-proposer can cancel the counter", () => {
    const state = stateWithPendingTrade();
    const initiatorId = state.trade!.initiatorPlayerId;
    const recipientId = state.trade!.recipientPlayerId;
    const counterState = gameReducer(state, { type: "COUNTER_TRADE", actorPlayerId: recipientId });

    // Old initiator (not counter-proposer) tries to cancel
    const attemptState = gameReducer(counterState, { type: "CANCEL_COUNTER_TRADE", actorPlayerId: initiatorId });
    expect(attemptState.counterTrade).not.toBeNull(); // unchanged
  });

  it("cannot cancel counter when no counter in progress", () => {
    const state = makeGameState(2);
    const p1 = state.players[0];
    const next = gameReducer(state, { type: "CANCEL_COUNTER_TRADE", actorPlayerId: p1.id });
    expect(next).toStrictEqual(state);
  });
});

describe("full counter-offer loop", () => {
  it("accept after counter-offer accepts the counter-offer (not the original)", () => {
    const state = makeGameState(2);
    const p1 = state.players[0];
    const p2 = state.players[1];
    const originalCash = 100;
    const counterCash = 50;

    // p1 proposes: gives $100
    const pendingState = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p1.id,
      initiatorId: p1.id,
      recipientId: p2.id,
      offerFromInitiator: { cash: originalCash, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      offerFromRecipient: EMPTY_OFFER,
    });

    // p2 counters
    const counterState = gameReducer(pendingState, { type: "COUNTER_TRADE", actorPlayerId: p2.id });

    // p2 submits counter: gives $50
    const counterPendingState = gameReducer(counterState, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p2.id,
      initiatorId: p2.id,
      recipientId: p1.id,
      offerFromInitiator: { cash: counterCash, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      offerFromRecipient: EMPTY_OFFER,
    });

    expect(counterPendingState.trade?.initiatorPlayerId).toBe(p2.id);
    expect(counterPendingState.trade?.recipientPlayerId).toBe(p1.id);

    // p1 accepts counter-offer
    const p1CashBefore = counterPendingState.players.find((p) => p.id === p1.id)!.cash;
    const p2CashBefore = counterPendingState.players.find((p) => p.id === p2.id)!.cash;
    const acceptState = gameReducer(counterPendingState, { type: "ACCEPT_TRADE", actorPlayerId: p1.id });

    expect(acceptState.trade).toBeNull();
    const p1After = acceptState.players.find((p) => p.id === p1.id)!;
    const p2After = acceptState.players.find((p) => p.id === p2.id)!;
    // p2 (initiator of counter) gave $50 to p1 (recipient of counter)
    expect(p2After.cash).toBe(p2CashBefore - counterCash);
    expect(p1After.cash).toBe(p1CashBefore + counterCash);
  });

  it("double counter: kb counters back and ansh accepts final offer", () => {
    const state = makeGameState(2);
    const kb = state.players[0];   // current player = kb
    const ansh = state.players[1];
    const OFFER_1: TradeOffer = { cash: 200, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };
    const COUNTER_1: TradeOffer = { cash: 150, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };
    const COUNTER_2: TradeOffer = { cash: 175, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };

    // Round 1: kb → ansh
    let s = gameReducer(state, { type: "PROPOSE_TRADE", actorPlayerId: kb.id, initiatorId: kb.id, recipientId: ansh.id, offerFromInitiator: OFFER_1, offerFromRecipient: EMPTY_OFFER });
    // ansh counters
    s = gameReducer(s, { type: "COUNTER_TRADE", actorPlayerId: ansh.id });
    // ansh submits counter: ansh → kb ($150)
    s = gameReducer(s, { type: "PROPOSE_TRADE", actorPlayerId: ansh.id, initiatorId: ansh.id, recipientId: kb.id, offerFromInitiator: COUNTER_1, offerFromRecipient: EMPTY_OFFER });
    expect(s.trade?.initiatorPlayerId).toBe(ansh.id);
    expect(s.trade?.recipientPlayerId).toBe(kb.id);
    // kb counters back
    s = gameReducer(s, { type: "COUNTER_TRADE", actorPlayerId: kb.id });
    // kb submits: kb → ansh ($175)
    s = gameReducer(s, { type: "PROPOSE_TRADE", actorPlayerId: kb.id, initiatorId: kb.id, recipientId: ansh.id, offerFromInitiator: COUNTER_2, offerFromRecipient: EMPTY_OFFER });
    expect(s.trade?.initiatorPlayerId).toBe(kb.id);
    expect(s.trade?.recipientPlayerId).toBe(ansh.id);
    // ansh accepts
    const anshBefore = s.players.find((p) => p.id === ansh.id)!.cash;
    const kbBefore = s.players.find((p) => p.id === kb.id)!.cash;
    s = gameReducer(s, { type: "ACCEPT_TRADE", actorPlayerId: ansh.id });
    expect(s.trade).toBeNull();
    const anshAfter = s.players.find((p) => p.id === ansh.id)!.cash;
    const kbAfter = s.players.find((p) => p.id === kb.id)!.cash;
    expect(kbAfter).toBe(kbBefore - 175);
    expect(anshAfter).toBe(anshBefore + 175);
  });
});

// ── UI source assertions ──────────────────────────────────────────────────────

describe("TradePanel — counter offer UI source assertions", () => {
  const src = read("components/TradePanel.tsx");

  it("has Counter Offer button for recipient", () => {
    expect(src).toMatch(/Counter Offer/);
  });

  it("Counter Offer button is behind isRecipient && !isInitiator guard", () => {
    expect(src).toMatch(/isRecipient.*!isInitiator[\s\S]{0,1000}Counter Offer/);
  });

  it("proposer does not see Counter Offer button", () => {
    // The isInitiator && !isRecipient block only shows Cancel Offer (not Counter Offer)
    expect(src).toMatch(/isInitiator.*!isRecipient[\s\S]{0,500}Cancel Offer/);
  });

  it("has COUNTER_TRADE action dispatch", () => {
    expect(src).toMatch(/COUNTER_TRADE/);
  });

  it("has CANCEL_COUNTER_TRADE action dispatch", () => {
    expect(src).toMatch(/CANCEL_COUNTER_TRADE/);
  });

  it("has LocalCounterForm component", () => {
    expect(src).toMatch(/LocalCounterForm/);
  });

  it("counter draft shows 'Send Counter Offer' button", () => {
    expect(src).toMatch(/Send Counter Offer/);
  });

  it("counter draft shows 'Counter Draft' badge", () => {
    expect(src).toMatch(/Counter Draft/);
  });

  it("counter draft title shows 'Counter:' prefix", () => {
    expect(src).toMatch(/Counter:/);
  });

  it("spectator footer updated to mention counter option", () => {
    // Spectator message includes accept, decline, or counter
    expect(src).toMatch(/accept.*decline.*counter|accept, decline, or counter/i);
  });

  it("state.counterTrade is checked in TradePanel", () => {
    expect(src).toMatch(/state\.counterTrade/);
  });
});
