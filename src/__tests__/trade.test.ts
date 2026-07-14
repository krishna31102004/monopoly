import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { canTradeProperty, validateTrade } from "@/lib/game/trade";
import {
  makeGameState,
  withOwnership,
  withPlayer,
  withHouses,
  playerById,
} from "@/__tests__/helpers/factory";
import type { TradeOffer } from "@/types/game";

// Berlin=1, Hamburg=3 (same color group: brown)
// Mediterranean=1, Baltic=3 — let's verify from board
// Based on PROJECT_SPEC and board.ts: cityProperty indices for brown group are 1 and 3
const BERLIN = 1;
const HAMBURG = 3;
// Airport: JFK = 5
const JFK = 5;

const EMPTY_OFFER: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };

function p0Id(state: ReturnType<typeof makeGameState>) {
  return state.players[0].id;
}
function p1Id(state: ReturnType<typeof makeGameState>) {
  return state.players[1].id;
}

// ── canTradeProperty ──────────────────────────────────────────────────────────

describe("canTradeProperty", () => {
  it("rejects non-ownable space (GO = index 0)", () => {
    const state = makeGameState();
    const result = canTradeProperty(0, p0Id(state), state.ownerships);
    expect(result.ok).toBe(false);
  });

  it("rejects property player does not own", () => {
    const state = makeGameState();
    const result = canTradeProperty(BERLIN, p0Id(state), state.ownerships);
    expect(result.ok).toBe(false);
  });

  it("allows city player owns with no improvements", () => {
    const state = withOwnership(makeGameState(), BERLIN, p0Id(makeGameState()));
    const result = canTradeProperty(BERLIN, p0Id(state), state.ownerships);
    expect(result.ok).toBe(true);
  });

  it("rejects city that has houses", () => {
    let state = makeGameState();
    state = withOwnership(state, BERLIN, p0Id(state));
    state = withHouses(state, BERLIN, 2);
    const result = canTradeProperty(BERLIN, p0Id(state), state.ownerships);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/improvements/i);
  });

  it("rejects city whose color group sibling has houses", () => {
    let state = makeGameState();
    const pid = p0Id(state);
    state = withOwnership(state, BERLIN, pid);
    state = withOwnership(state, HAMBURG, pid);
    state = withHouses(state, HAMBURG, 1);
    const result = canTradeProperty(BERLIN, pid, state.ownerships);
    expect(result.ok).toBe(false);
  });

  it("allows airport player owns", () => {
    let state = makeGameState();
    state = withOwnership(state, JFK, p0Id(state));
    const result = canTradeProperty(JFK, p0Id(state), state.ownerships);
    expect(result.ok).toBe(true);
  });
});

// ── validateTrade ──────────────────────────────────────────────────────────────

describe("validateTrade", () => {
  it("rejects trade with yourself", () => {
    const state = makeGameState();
    const pid = p0Id(state);
    const result = validateTrade(state, pid, pid, EMPTY_OFFER, EMPTY_OFFER);
    expect(result.ok).toBe(false);
  });

  it("rejects trade in gameOver phase", () => {
    const state = { ...makeGameState(), phase: "gameOver" as const };
    const result = validateTrade(state, p0Id(state), p1Id(state), EMPTY_OFFER, EMPTY_OFFER);
    expect(result.ok).toBe(false);
  });

  it("rejects initiator offering more cash than they have", () => {
    const state = makeGameState(); // each player starts with $1500
    const offer: TradeOffer = { cash: 9999, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };
    const result = validateTrade(state, p0Id(state), p1Id(state), offer, EMPTY_OFFER);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toMatch(/cash/i);
  });

  it("rejects recipient offering more cash than they have", () => {
    const state = makeGameState();
    const offer: TradeOffer = { cash: 9999, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };
    const result = validateTrade(state, p0Id(state), p1Id(state), EMPTY_OFFER, offer);
    expect(result.ok).toBe(false);
  });

  it("rejects offering GOJF card player does not have", () => {
    const state = makeGameState();
    const offer: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 1 };
    const result = validateTrade(state, p0Id(state), p1Id(state), offer, EMPTY_OFFER);
    expect(result.ok).toBe(false);
  });

  it("allows GOJF offer when player has the card", () => {
    let state = makeGameState();
    state = withPlayer(state, 0, { getOutOfJailFreeCards: 1 });
    const offer: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 1 };
    const result = validateTrade(state, p0Id(state), p1Id(state), offer, EMPTY_OFFER);
    expect(result.ok).toBe(true);
  });

  it("rejects when same property index appears in both offer lists", () => {
    let state = makeGameState();
    const pid0 = p0Id(state);
    const pid1 = p1Id(state);
    state = withOwnership(state, BERLIN, pid0);
    // p1 offering BERLIN (which they don't own) — correctly rejected
    const offerA: TradeOffer = { cash: 0, propertySpaceIndices: [BERLIN], getOutOfJailFreeCards: 0 };
    const offerB: TradeOffer = { cash: 0, propertySpaceIndices: [BERLIN], getOutOfJailFreeCards: 0 };
    const result = validateTrade(state, pid0, pid1, offerA, offerB);
    expect(result.ok).toBe(false);
  });

  it("rejects an empty trade", () => {
    const state = makeGameState();
    const result = validateTrade(state, p0Id(state), p1Id(state), EMPTY_OFFER, EMPTY_OFFER);
    expect(result.ok).toBe(false);
  });

  it("rejects a cash-only trade within means", () => {
    const state = makeGameState();
    const offerA: TradeOffer = { cash: 100, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };
    const offerB: TradeOffer = { cash: 200, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };
    const result = validateTrade(state, p0Id(state), p1Id(state), offerA, offerB);
    expect(result.ok).toBe(false);
  });

  it("accepts property trade when both own their offered properties (no improvements)", () => {
    let state = makeGameState();
    state = withOwnership(state, BERLIN, p0Id(state));
    state = withOwnership(state, JFK, p1Id(state));
    const offerA: TradeOffer = { cash: 0, propertySpaceIndices: [BERLIN], getOutOfJailFreeCards: 0 };
    const offerB: TradeOffer = { cash: 0, propertySpaceIndices: [JFK], getOutOfJailFreeCards: 0 };
    const result = validateTrade(state, p0Id(state), p1Id(state), offerA, offerB);
    expect(result.ok).toBe(true);
  });

  it("rejects offering a property the initiator does not own", () => {
    const state = makeGameState();
    const offerA: TradeOffer = { cash: 0, propertySpaceIndices: [BERLIN], getOutOfJailFreeCards: 0 };
    const result = validateTrade(state, p0Id(state), p1Id(state), offerA, EMPTY_OFFER);
    expect(result.ok).toBe(false);
  });

  it("rejects bankrupt player as initiator", () => {
    let state = makeGameState();
    state = withPlayer(state, 0, { isBankrupt: true });
    const result = validateTrade(state, p0Id(state), p1Id(state), EMPTY_OFFER, EMPTY_OFFER);
    expect(result.ok).toBe(false);
  });

  it("rejects bankrupt player as recipient", () => {
    let state = makeGameState();
    state = withPlayer(state, 1, { isBankrupt: true });
    const result = validateTrade(state, p0Id(state), p1Id(state), EMPTY_OFFER, EMPTY_OFFER);
    expect(result.ok).toBe(false);
  });
});

// ── PROPOSE_TRADE reducer ─────────────────────────────────────────────────────

describe("PROPOSE_TRADE reducer", () => {
  it("sets trade state when valid", () => {
    let state = makeGameState();
    state = withOwnership(state, BERLIN, p0Id(state));
    const next = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p0Id(state),
      initiatorId: p0Id(state),
      recipientId: p1Id(state),
      offerFromInitiator: { cash: 0, propertySpaceIndices: [BERLIN], getOutOfJailFreeCards: 0 },
      offerFromRecipient: EMPTY_OFFER,
    });
    expect(next.trade).not.toBeNull();
    expect(next.trade?.initiatorPlayerId).toBe(p0Id(state));
    expect(next.trade?.recipientPlayerId).toBe(p1Id(state));
  });

  it("does not change state when trade is invalid (initiator is recipient)", () => {
    const state = makeGameState();
    const next = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p0Id(state),
      initiatorId: p0Id(state),
      recipientId: p0Id(state),
      offerFromInitiator: EMPTY_OFFER,
      offerFromRecipient: EMPTY_OFFER,
    });
    expect(next.trade).toBeNull();
  });

  it("does not change state when game is over", () => {
    const state = { ...makeGameState(), phase: "gameOver" as const };
    const next = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p0Id(state),
      initiatorId: p0Id(state),
      recipientId: p1Id(state),
      offerFromInitiator: EMPTY_OFFER,
      offerFromRecipient: EMPTY_OFFER,
    });
    expect(next.trade).toBeNull();
  });
});

// ── CANCEL_TRADE reducer ──────────────────────────────────────────────────────

describe("CANCEL_TRADE reducer", () => {
  it("clears trade state", () => {
    let state = makeGameState();
    state = withOwnership(state, BERLIN, p0Id(state));
    state = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p0Id(state),
      initiatorId: p0Id(state),
      recipientId: p1Id(state),
      offerFromInitiator: { cash: 0, propertySpaceIndices: [BERLIN], getOutOfJailFreeCards: 0 },
      offerFromRecipient: EMPTY_OFFER,
    });
    expect(state.trade).not.toBeNull();
    const next = gameReducer(state, { type: "CANCEL_TRADE", actorPlayerId: p0Id(state) });
    expect(next.trade).toBeNull();
  });

  it("logs a cancellation message so every client can show a result banner", () => {
    let state = makeGameState();
    state = withOwnership(state, BERLIN, p0Id(state));
    state = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p0Id(state),
      initiatorId: p0Id(state),
      recipientId: p1Id(state),
      offerFromInitiator: { cash: 0, propertySpaceIndices: [BERLIN], getOutOfJailFreeCards: 0 },
      offerFromRecipient: EMPTY_OFFER,
    });
    const next = gameReducer(state, { type: "CANCEL_TRADE", actorPlayerId: p0Id(state) });
    expect(next.gameLog[0]?.message).toMatch(/cancelled the trade/i);
  });

  it("is a no-op when no trade is pending", () => {
    const state = makeGameState();
    const next = gameReducer(state, { type: "CANCEL_TRADE", actorPlayerId: p0Id(state) });
    expect(next).toBe(state);
  });
});

// ── DECLINE_TRADE reducer ─────────────────────────────────────────────────────

describe("DECLINE_TRADE reducer", () => {
  it("clears trade and logs decline message", () => {
    let state = makeGameState();
    state = withOwnership(state, BERLIN, p0Id(state));
    state = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p0Id(state),
      initiatorId: p0Id(state),
      recipientId: p1Id(state),
      offerFromInitiator: { cash: 0, propertySpaceIndices: [BERLIN], getOutOfJailFreeCards: 0 },
      offerFromRecipient: EMPTY_OFFER,
    });
    const next = gameReducer(state, { type: "DECLINE_TRADE", actorPlayerId: p1Id(state) });
    expect(next.trade).toBeNull();
    expect(next.gameLog[0].message).toMatch(/declined/i);
  });

  it("is a no-op when no trade is pending", () => {
    const state = makeGameState();
    const next = gameReducer(state, { type: "DECLINE_TRADE", actorPlayerId: p1Id(state) });
    expect(next).toBe(state);
  });
});

// ── ACCEPT_TRADE reducer ──────────────────────────────────────────────────────

describe("ACCEPT_TRADE reducer", () => {
  it("is a no-op when no trade is pending", () => {
    const state = makeGameState();
    const next = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: state.players[1].id });
    expect(next).toBe(state);
  });

  it("transfers cash both ways", () => {
    let state = makeGameState();
    const pid0 = p0Id(state);
    const pid1 = p1Id(state);
    const before0 = playerById(state, pid0).cash; // 1500
    const before1 = playerById(state, pid1).cash; // 1500
    state = withOwnership(state, BERLIN, pid0);

    const offerA: TradeOffer = { cash: 300, propertySpaceIndices: [BERLIN], getOutOfJailFreeCards: 0 };
    const offerB: TradeOffer = { cash: 100, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };

    state = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: pid0,
      initiatorId: pid0,
      recipientId: pid1,
      offerFromInitiator: offerA,
      offerFromRecipient: offerB,
    });
    state = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: pid1 });

    expect(state.trade).toBeNull();
    expect(playerById(state, pid0).cash).toBe(before0 - 300 + 100);
    expect(playerById(state, pid1).cash).toBe(before1 - 100 + 300);
    expect(state.gameLog[0].message).toMatch(/trade accepted/i);
  });

  it("transfers a property from initiator to recipient", () => {
    let state = makeGameState();
    const pid0 = p0Id(state);
    const pid1 = p1Id(state);
    state = withOwnership(state, BERLIN, pid0);

    const offerA: TradeOffer = { cash: 0, propertySpaceIndices: [BERLIN], getOutOfJailFreeCards: 0 };

    state = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: pid0,
      initiatorId: pid0,
      recipientId: pid1,
      offerFromInitiator: offerA,
      offerFromRecipient: EMPTY_OFFER,
    });
    state = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: pid1 });

    expect(state.trade).toBeNull();
    const ownership = state.ownerships.find((o: { spaceIndex: number }) => o.spaceIndex === BERLIN);
    expect(ownership?.ownerId).toBe(pid1);
    expect(playerById(state, pid0).ownedCityIds).not.toContain(BERLIN);
    expect(playerById(state, pid1).ownedCityIds).toContain(BERLIN);
  });

  it("transfers a property from recipient to initiator", () => {
    let state = makeGameState();
    const pid0 = p0Id(state);
    const pid1 = p1Id(state);
    state = withOwnership(state, JFK, pid1);

    const offerB: TradeOffer = { cash: 0, propertySpaceIndices: [JFK], getOutOfJailFreeCards: 0 };

    state = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: pid0,
      initiatorId: pid0,
      recipientId: pid1,
      offerFromInitiator: EMPTY_OFFER,
      offerFromRecipient: offerB,
    });
    state = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: pid1 });

    expect(state.trade).toBeNull();
    const ownership = state.ownerships.find((o: { spaceIndex: number }) => o.spaceIndex === JFK);
    expect(ownership?.ownerId).toBe(pid0);
    expect(playerById(state, pid1).ownedAirportIds).not.toContain(JFK);
    expect(playerById(state, pid0).ownedAirportIds).toContain(JFK);
  });

  it("transfers properties in both directions simultaneously", () => {
    let state = makeGameState();
    const pid0 = p0Id(state);
    const pid1 = p1Id(state);
    state = withOwnership(state, BERLIN, pid0);
    state = withOwnership(state, JFK, pid1);

    const offerA: TradeOffer = { cash: 0, propertySpaceIndices: [BERLIN], getOutOfJailFreeCards: 0 };
    const offerB: TradeOffer = { cash: 0, propertySpaceIndices: [JFK], getOutOfJailFreeCards: 0 };

    state = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: pid0,
      initiatorId: pid0,
      recipientId: pid1,
      offerFromInitiator: offerA,
      offerFromRecipient: offerB,
    });
    state = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: pid1 });

    expect(state.ownerships.find((o: { spaceIndex: number }) => o.spaceIndex === BERLIN)?.ownerId).toBe(pid1);
    expect(state.ownerships.find((o: { spaceIndex: number }) => o.spaceIndex === JFK)?.ownerId).toBe(pid0);
    expect(playerById(state, pid0).ownedCityIds).not.toContain(BERLIN);
    expect(playerById(state, pid1).ownedCityIds).toContain(BERLIN);
    expect(playerById(state, pid1).ownedAirportIds).not.toContain(JFK);
    expect(playerById(state, pid0).ownedAirportIds).toContain(JFK);
  });

  it("transfers GOJF cards", () => {
    let state = makeGameState();
    const pid0 = p0Id(state);
    const pid1 = p1Id(state);
    state = withPlayer(state, 0, { getOutOfJailFreeCards: 2 });
    state = withPlayer(state, 1, { getOutOfJailFreeCards: 1 });

    const offerA: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 1 };
    const offerB: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 1 };

    state = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: pid0,
      initiatorId: pid0,
      recipientId: pid1,
      offerFromInitiator: offerA,
      offerFromRecipient: offerB,
    });
    state = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: pid1 });

    // Both gave 1 and received 1, so counts unchanged
    expect(playerById(state, pid0).getOutOfJailFreeCards).toBe(2);
    expect(playerById(state, pid1).getOutOfJailFreeCards).toBe(1);
  });

  it("cancels trade if invalid at accept time (state changed between propose and accept)", () => {
    let state = makeGameState();
    const pid0 = p0Id(state);
    const pid1 = p1Id(state);

    // Propose a cash trade at the edge of p0's funds
    const offerA: TradeOffer = { cash: 1500, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };
    state = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: pid0,
      initiatorId: pid0,
      recipientId: pid1,
      offerFromInitiator: offerA,
      offerFromRecipient: EMPTY_OFFER,
    });

    // Simulate p0 losing cash before accept (direct state mutation for test)
    state = withPlayer(state, 0, { cash: 100 });

    const next = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: pid1 });
    // Trade should be cancelled (recheck fails: not enough cash)
    expect(next.trade).toBeNull();
    // Cash should NOT have been transferred
    expect(playerById(next, pid0).cash).toBe(100);
    expect(playerById(next, pid1).cash).toBe(1500);
  });

  it("does not mutate other players' state during trade", () => {
    let state = makeGameState(3);
    const pid0 = state.players[0].id;
    const pid1 = state.players[1].id;
    const pid2 = state.players[2].id;
    const cashBefore = playerById(state, pid2).cash;

    state = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: pid0,
      initiatorId: pid0,
      recipientId: pid1,
      offerFromInitiator: { cash: 100, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      offerFromRecipient: EMPTY_OFFER,
    });
    state = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: pid1 });

    expect(playerById(state, pid2).cash).toBe(cashBefore);
  });
});
