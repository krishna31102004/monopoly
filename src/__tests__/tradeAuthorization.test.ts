import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { RoomManager } from "@/lib/multiplayer/rooms";
import { makeGameState, withPlayer, withOwnership } from "@/__tests__/helpers/factory";
import type { TradeOffer } from "@/types/game";
import type { DiceRoll } from "@/types/game";

const EMPTY: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };
const BERLIN = 1;
const JFK = 5;
const NON_DOUBLE: DiceRoll = { die1: 2, die2: 5, total: 7, isDouble: false };

function p0(s: ReturnType<typeof makeGameState>) { return s.players[0].id; }
function p1(s: ReturnType<typeof makeGameState>) { return s.players[1].id; }

function propose(state: ReturnType<typeof makeGameState>, initiatorIdx = 0, recipientIdx = 1) {
  state = withOwnership(state, BERLIN, state.players[initiatorIdx].id);
  return gameReducer(state, {
    type: "PROPOSE_TRADE",
    actorPlayerId: state.players[initiatorIdx].id,
    initiatorId: state.players[initiatorIdx].id,
    recipientId: state.players[recipientIdx].id,
    offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
    offerFromRecipient: EMPTY,
  });
}

// ── PROPOSE_TRADE authorization ───────────────────────────────────────────────

describe("PROPOSE_TRADE — turn authorization", () => {
  it("current player (index 0) can propose a valid trade", () => {
    const state = makeGameState();
    const next = propose(state);
    expect(next.trade).not.toBeNull();
    expect(next.trade?.initiatorPlayerId).toBe(p0(state));
  });

  it("non-current player (index 1) cannot propose a trade", () => {
    const state = makeGameState(); // currentPlayerIndex = 0
    const next = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: state.players[1].id, // not the current player
      initiatorId: state.players[1].id,
      recipientId: state.players[0].id,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    });
    expect(next.trade).toBeNull();
  });

  it("cannot propose trade as someone other than yourself (actorPlayerId ≠ initiatorId)", () => {
    const state = makeGameState();
    const next = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p0(state),
      initiatorId: p1(state), // wrong: actor is p0 but claims p1 as initiator
      recipientId: p0(state),
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    });
    expect(next.trade).toBeNull();
  });

  it("cannot propose while another trade is already pending", () => {
    let state = makeGameState(3);
    state = propose(state, 0, 1);
    expect(state.trade).not.toBeNull();
    const next = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: state.players[0].id,
      initiatorId: state.players[0].id,
      recipientId: state.players[2].id,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    });
    expect(next.trade?.recipientPlayerId).toBe(state.players[1].id); // still original trade
  });

  it("cannot propose during awaitingPurchaseDecision phase", () => {
    const state = { ...makeGameState(), phase: "awaitingPurchaseDecision" as const };
    const next = propose(state);
    expect(next.trade).toBeNull();
  });

  it("cannot propose during auction phase", () => {
    const state = { ...makeGameState(), phase: "auction" as const };
    const next = propose(state);
    expect(next.trade).toBeNull();
  });

  it("cannot propose during bankruptcyPending phase", () => {
    const state = { ...makeGameState(), phase: "bankruptcyPending" as const };
    const next = propose(state);
    expect(next.trade).toBeNull();
  });

  it("cannot propose during gameOver phase", () => {
    const state = { ...makeGameState(), phase: "gameOver" as const };
    const next = propose(state);
    expect(next.trade).toBeNull();
  });

  it("cannot propose to yourself", () => {
    const state = makeGameState();
    const next = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p0(state),
      initiatorId: p0(state),
      recipientId: p0(state),
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    });
    expect(next.trade).toBeNull();
  });

  it("cannot propose if initiator is bankrupt", () => {
    let state = makeGameState();
    state = withPlayer(state, 0, { isBankrupt: true });
    const next = propose(state);
    expect(next.trade).toBeNull();
  });

  it("cannot propose to a bankrupt recipient", () => {
    let state = makeGameState();
    state = withPlayer(state, 1, { isBankrupt: true });
    const next = propose(state);
    expect(next.trade).toBeNull();
  });
});

// ── ACCEPT_TRADE authorization ────────────────────────────────────────────────

describe("ACCEPT_TRADE — recipient authorization", () => {
  it("recipient can accept a trade", () => {
    let state = makeGameState();
    state = propose(state); // p0 → p1
    const next = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: p1(state) });
    expect(next.trade).toBeNull();
    expect(next.gameLog[0].message).toMatch(/trade accepted/i);
  });

  it("initiator cannot accept their own trade (regression: production bug)", () => {
    let state = makeGameState();
    state = propose(state); // p0 → p1
    const next = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: p0(state) });
    // State must not change — trade still pending
    expect(next.trade).not.toBeNull();
    expect(next.trade?.initiatorPlayerId).toBe(p0(state));
  });

  it("unrelated third player cannot accept trade", () => {
    let state = makeGameState(3);
    state = propose(state, 0, 1);
    const thirdId = state.players[2].id;
    const next = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: thirdId });
    expect(next.trade).not.toBeNull(); // trade still pending
  });

  it("accepting revalidates: if initiator lost cash between propose and accept, trade is cancelled", () => {
    let state = makeGameState();
    const offerA: TradeOffer = { cash: 1500, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };
    state = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p0(state),
      initiatorId: p0(state),
      recipientId: p1(state),
      offerFromInitiator: offerA,
      offerFromRecipient: EMPTY,
    });
    // p0 loses cash after proposing
    state = withPlayer(state, 0, { cash: 10 });
    const next = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: p1(state) });
    expect(next.trade).toBeNull();
    // No money transferred
    expect(next.players[0].cash).toBe(10);
    expect(next.players[1].cash).toBe(1500);
  });

  it("accepting revalidates: if initiator lost ownership after proposing, trade is cancelled", () => {
    let state = makeGameState();
    state = withOwnership(state, BERLIN, p0(state));
    const offerA: TradeOffer = { cash: 0, propertySpaceIndices: [BERLIN], getOutOfJailFreeCards: 0 };
    state = gameReducer(state, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p0(state),
      initiatorId: p0(state),
      recipientId: p1(state),
      offerFromInitiator: offerA,
      offerFromRecipient: EMPTY,
    });
    // Remove p0's ownership (simulate transfer to bank/someone else)
    state = withOwnership(state, BERLIN, p1(state));
    const next = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: p1(state) });
    expect(next.trade).toBeNull();
    // Ownership should NOT have transferred again
    expect(next.ownerships.find(o => o.spaceIndex === BERLIN)?.ownerId).toBe(p1(state));
  });
});

// ── DECLINE_TRADE authorization ───────────────────────────────────────────────

describe("DECLINE_TRADE — recipient authorization", () => {
  it("recipient can decline a trade", () => {
    let state = makeGameState();
    state = propose(state);
    const next = gameReducer(state, { type: "DECLINE_TRADE", actorPlayerId: p1(state) });
    expect(next.trade).toBeNull();
    expect(next.gameLog[0].message).toMatch(/declined/i);
  });

  it("initiator cannot decline as if they were the recipient", () => {
    let state = makeGameState();
    state = propose(state);
    const next = gameReducer(state, { type: "DECLINE_TRADE", actorPlayerId: p0(state) });
    expect(next.trade).not.toBeNull();
  });

  it("unrelated player cannot decline", () => {
    let state = makeGameState(3);
    state = propose(state, 0, 1);
    const next = gameReducer(state, { type: "DECLINE_TRADE", actorPlayerId: state.players[2].id });
    expect(next.trade).not.toBeNull();
  });

  it("declining does not mutate cash or properties", () => {
    let state = makeGameState();
    const cashBefore0 = state.players[0].cash;
    const cashBefore1 = state.players[1].cash;
    state = propose(state);
    const next = gameReducer(state, { type: "DECLINE_TRADE", actorPlayerId: p1(state) });
    expect(next.players[0].cash).toBe(cashBefore0);
    expect(next.players[1].cash).toBe(cashBefore1);
  });
});

// ── CANCEL_TRADE authorization ────────────────────────────────────────────────

describe("CANCEL_TRADE — initiator authorization", () => {
  it("initiator can cancel a trade", () => {
    let state = makeGameState();
    state = propose(state);
    const next = gameReducer(state, { type: "CANCEL_TRADE", actorPlayerId: p0(state) });
    expect(next.trade).toBeNull();
  });

  it("recipient cannot cancel as if they were the initiator", () => {
    let state = makeGameState();
    state = propose(state);
    const next = gameReducer(state, { type: "CANCEL_TRADE", actorPlayerId: p1(state) });
    expect(next.trade).not.toBeNull();
  });

  it("unrelated player cannot cancel", () => {
    let state = makeGameState(3);
    state = propose(state, 0, 1);
    const next = gameReducer(state, { type: "CANCEL_TRADE", actorPlayerId: state.players[2].id });
    expect(next.trade).not.toBeNull();
  });

  it("cancelling does not mutate cash or properties", () => {
    let state = makeGameState();
    const cashBefore0 = state.players[0].cash;
    const cashBefore1 = state.players[1].cash;
    state = propose(state);
    const next = gameReducer(state, { type: "CANCEL_TRADE", actorPlayerId: p0(state) });
    expect(next.players[0].cash).toBe(cashBefore0);
    expect(next.players[1].cash).toBe(cashBefore1);
  });
});

// ── Multiplayer server enforcement ───────────────────────────────────────────

describe("RoomManager — trade action server authorization", () => {
  function setup() {
    const mgr = new RoomManager();
    const { room, playerId: aliceId } = mgr.createRoom(
      { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-alice",
    );
    const roomCode = room.roomCode;
    const joinResult = mgr.joinRoom(
      { roomCode, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      "socket-bob",
    );
    if (!joinResult.ok) throw new Error("join failed");
    const bobId = joinResult.value.playerId;
    const startResult = mgr.startGame(roomCode, aliceId);
    if (!startResult.ok) throw new Error("start failed");
    const gs = startResult.value.gameState;
    // currentPlayerIndex=0, which maps to Alice (first active player)
    const firstId = gs.players[gs.currentPlayerIndex].id;
    const secondId = gs.players.find(p => p.id !== firstId)!.id;
    // A real normal trade must include a non-cash asset.
    const ownerIndex = gs.players.findIndex((player) => player.id === firstId);
    gs.ownerships = gs.ownerships.map((ownership) => ownership.spaceIndex === BERLIN ? { ...ownership, ownerId: firstId } : ownership);
    gs.players = gs.players.map((player, index) => index === ownerIndex ? { ...player, ownedCityIds: [...player.ownedCityIds, BERLIN] } : player);
    // Map game IDs back to room socket IDs
    // Since we fixed room IDs = game IDs, aliceId/bobId are same as game player IDs
    return { mgr, roomCode, aliceId, bobId, firstId, secondId, gs };
  }

  it("server accepts PROPOSE_TRADE from current player", () => {
    const { mgr, roomCode, firstId, secondId } = setup();
    const result = mgr.applyGameAction(roomCode, firstId, {
      type: "PROPOSE_TRADE",
      initiatorId: firstId,
      recipientId: secondId,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    }, null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.trade).not.toBeNull();
  });

  it("server rejects PROPOSE_TRADE from non-current player", () => {
    const { mgr, roomCode, secondId, firstId } = setup();
    const result = mgr.applyGameAction(roomCode, secondId, {
      type: "PROPOSE_TRADE",
      initiatorId: secondId,
      recipientId: firstId,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/current player/i);
  });

  it("server rejects PROPOSE_TRADE where playerId ≠ initiatorId", () => {
    const { mgr, roomCode, firstId, secondId } = setup();
    const result = mgr.applyGameAction(roomCode, firstId, {
      type: "PROPOSE_TRADE",
      initiatorId: secondId, // pretending to be someone else
      recipientId: firstId,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/yourself/i);
  });

  it("server accepts ACCEPT_TRADE from trade recipient", () => {
    const { mgr, roomCode, firstId, secondId } = setup();
    // First player proposes to second
    mgr.applyGameAction(roomCode, firstId, {
      type: "PROPOSE_TRADE",
      initiatorId: firstId,
      recipientId: secondId,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    }, null);
    // Recipient accepts
    const result = mgr.applyGameAction(roomCode, secondId, { type: "ACCEPT_TRADE" }, null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.trade).toBeNull();
  });

  it("server rejects ACCEPT_TRADE from trade initiator (production bug regression)", () => {
    const { mgr, roomCode, firstId, secondId } = setup();
    mgr.applyGameAction(roomCode, firstId, {
      type: "PROPOSE_TRADE",
      initiatorId: firstId,
      recipientId: secondId,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    }, null);
    // Initiator tries to accept their own trade
    const result = mgr.applyGameAction(roomCode, firstId, { type: "ACCEPT_TRADE" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/recipient/i);
    // Game state must not have changed (trade still pending)
    const gs = mgr.getGameState(roomCode)!;
    expect(gs.trade).not.toBeNull();
  });

  it("server rejects ACCEPT_TRADE from unrelated third player", () => {
    const mgr = new RoomManager();
    const { room, playerId: aliceId } = mgr.createRoom(
      { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-alice",
    );
    const roomCode = room.roomCode;
    const joinB = mgr.joinRoom({ roomCode, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" }, "socket-bob");
    const joinC = mgr.joinRoom({ roomCode, displayName: "Carol", token: "ship", tokenLabel: "SHI", color: "#16a34a" }, "socket-carol");
    if (!joinB.ok || !joinC.ok) throw new Error("join failed");
    const bobId = joinB.value.playerId;
    const carolId = joinC.value.playerId;
    const start = mgr.startGame(roomCode, aliceId);
    if (!start.ok) throw new Error("start failed");
    const gs = start.value.gameState;
    const firstId = gs.players[gs.currentPlayerIndex].id;
    const secondId = gs.players.find(p => p.id !== firstId && p.id !== carolId)?.id ?? bobId;
    const thirdId = gs.players.find(p => p.id !== firstId && p.id !== secondId)!.id;
    gs.ownerships = gs.ownerships.map((ownership) => ownership.spaceIndex === BERLIN ? { ...ownership, ownerId: firstId } : ownership);
    gs.players = gs.players.map((player) => player.id === firstId ? { ...player, ownedCityIds: [...player.ownedCityIds, BERLIN] } : player);
    // Propose trade between first and second
    mgr.applyGameAction(roomCode, firstId, {
      type: "PROPOSE_TRADE",
      initiatorId: firstId,
      recipientId: secondId,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    }, null);
    // Third player tries to accept
    const result = mgr.applyGameAction(roomCode, thirdId, { type: "ACCEPT_TRADE" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/recipient/i);
  });

  it("server rejects DECLINE_TRADE from initiator", () => {
    const { mgr, roomCode, firstId, secondId } = setup();
    mgr.applyGameAction(roomCode, firstId, {
      type: "PROPOSE_TRADE",
      initiatorId: firstId,
      recipientId: secondId,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    }, null);
    const result = mgr.applyGameAction(roomCode, firstId, { type: "DECLINE_TRADE" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/recipient/i);
    expect(mgr.getGameState(roomCode)!.trade).not.toBeNull();
  });

  it("server accepts DECLINE_TRADE from recipient", () => {
    const { mgr, roomCode, firstId, secondId } = setup();
    mgr.applyGameAction(roomCode, firstId, {
      type: "PROPOSE_TRADE",
      initiatorId: firstId,
      recipientId: secondId,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    }, null);
    const result = mgr.applyGameAction(roomCode, secondId, { type: "DECLINE_TRADE" }, null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.trade).toBeNull();
  });

  it("server rejects CANCEL_TRADE from recipient", () => {
    const { mgr, roomCode, firstId, secondId } = setup();
    mgr.applyGameAction(roomCode, firstId, {
      type: "PROPOSE_TRADE",
      initiatorId: firstId,
      recipientId: secondId,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    }, null);
    const result = mgr.applyGameAction(roomCode, secondId, { type: "CANCEL_TRADE" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/initiator/i);
    expect(mgr.getGameState(roomCode)!.trade).not.toBeNull();
  });

  it("server accepts CANCEL_TRADE from initiator", () => {
    const { mgr, roomCode, firstId, secondId } = setup();
    mgr.applyGameAction(roomCode, firstId, {
      type: "PROPOSE_TRADE",
      initiatorId: firstId,
      recipientId: secondId,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    }, null);
    const result = mgr.applyGameAction(roomCode, firstId, { type: "CANCEL_TRADE" }, null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.trade).toBeNull();
  });

  it("invalid trade action does not mutate room game state", () => {
    const { mgr, roomCode, firstId, secondId } = setup();
    mgr.applyGameAction(roomCode, firstId, {
      type: "PROPOSE_TRADE",
      initiatorId: firstId,
      recipientId: secondId,
      offerFromInitiator: { ...EMPTY, propertySpaceIndices: [BERLIN] },
      offerFromRecipient: EMPTY,
    }, null);
    const stateBefore = JSON.stringify(mgr.getGameState(roomCode));
    // Initiator tries to accept — must be rejected, state unchanged
    mgr.applyGameAction(roomCode, firstId, { type: "ACCEPT_TRADE" }, null);
    const stateAfter = JSON.stringify(mgr.getGameState(roomCode));
    expect(stateAfter).toBe(stateBefore);
  });

  it("server rejects ACCEPT_TRADE when no trade is pending", () => {
    const { mgr, roomCode, secondId } = setup();
    const result = mgr.applyGameAction(roomCode, secondId, { type: "ACCEPT_TRADE" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/pending/i);
  });
});
