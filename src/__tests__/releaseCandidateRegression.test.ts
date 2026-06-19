/**
 * Release Candidate Regression Suite — Phase 4Z
 *
 * Covers the highest-risk flows across recent changes:
 *  - Roll-off tie-breaker (Phase 4F.2D server-side)
 *  - Trade accept/decline/cancel (Phase 4E.9D counter-offer removal)
 *  - No-negative-cash invariant
 *  - Dice → movement → landing smoke
 *  - Auction smoke
 *  - Counter-offer absence regression guard
 *  - RollOffScreen actor/observer fix source assertions
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { gameReducer } from "@/lib/game/gameReducer";
import { RoomManager } from "@/lib/multiplayer/rooms";
import type { RollOffEntry } from "@/lib/game/rollOff";
import {
  makeGameState,
  withPlayer,
  withPosition,
  withOwnership,
  dice,
} from "./helpers/factory";
import type { TradeOffer } from "@/types/game";

// ── Helpers ───────────────────────────────────────────────────────────────────

function readSrc(rel: string) {
  return readFileSync(join(process.cwd(), "src", rel), "utf-8");
}

function rollEntry(die1: number, die2: number): RollOffEntry {
  return { die1, die2, total: die1 + die2 };
}

const EMPTY_OFFER: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };

let socketSeed = 2000;
function nextSocket() { return `sock-rc-${socketSeed++}`; }

function makeRoom(manager: RoomManager, count = 2) {
  const { room, playerId: hostId } = manager.createRoom(
    { displayName: "Host", token: "car", tokenLabel: "CAR", color: "#ef4444" },
    nextSocket(),
  );
  const guestIds: string[] = [];
  for (let i = 1; i < count; i++) {
    const r = manager.joinRoom(
      {
        roomCode: room.roomCode,
        displayName: `Guest${i}`,
        token: (["hat", "ship", "shoe"] as const)[i - 1],
        tokenLabel: "HAT",
        color: "#2563eb",
      },
      nextSocket(),
    );
    if (!r.ok) throw new Error(r.error);
    guestIds.push(r.value.playerId);
  }
  manager.startRollOff(room.roomCode, hostId);
  return { roomCode: room.roomCode, hostId, guestIds };
}

// ── A. Roll-off tie-breaker server smoke ─────────────────────────────────────

describe("Roll-off tie-breaker smoke", () => {
  it("no-tie: resolves immediately with correct order", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager);

    manager.applyRollOffRoll(roomCode, hostId, rollEntry(6, 6));
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], rollEntry(1, 2));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ro = res.value.room.rollOff!;
    expect(ro.gameReady).toBe(true);
    expect(ro.resolvedOrder![0]).toBe(hostId);
    expect(ro.resolvedOrder![1]).toBe(guestIds[0]);
  });

  it("tie round 1 → round 2 resolves correctly", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager);

    manager.applyRollOffRoll(roomCode, hostId, rollEntry(3, 4));
    manager.applyRollOffRoll(roomCode, guestIds[0], rollEntry(4, 3));
    manager.applyRollOffRoll(roomCode, hostId, rollEntry(1, 2));
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], rollEntry(5, 5));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ro = res.value.room.rollOff!;
    expect(ro.gameReady).toBe(true);
    expect(ro.resolvedOrder![0]).toBe(guestIds[0]);
    expect(ro.round).toBe(2);
  });

  it("lastRoundRolls is set after tie (actor sees own result even after rolls reset)", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager);

    manager.applyRollOffRoll(roomCode, hostId, rollEntry(3, 4));
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], rollEntry(4, 3));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.room.rollOff!.lastRoundRolls[hostId]).toBeDefined();
    expect(res.value.room.rollOff!.lastRoundRolls[guestIds[0]]).toBeDefined();
    expect(res.value.room.rollOff!.rolls).toEqual({});
  });

  it("allRolls accumulates across rounds", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager);

    manager.applyRollOffRoll(roomCode, hostId, rollEntry(3, 4));
    manager.applyRollOffRoll(roomCode, guestIds[0], rollEntry(4, 3));

    const view = manager.getRoom(roomCode)!;
    expect(view.rollOff!.allRolls[hostId]).toEqual({ die1: 3, die2: 4, total: 7 });
    expect(view.rollOff!.allRolls[guestIds[0]]).toEqual({ die1: 4, die2: 3, total: 7 });
  });

  it("duplicate roll rejected in same round", () => {
    const manager = new RoomManager();
    const { roomCode, hostId } = makeRoom(manager);
    manager.applyRollOffRoll(roomCode, hostId, rollEntry(3, 4));
    const second = manager.applyRollOffRoll(roomCode, hostId, rollEntry(5, 5));
    expect(second.ok).toBe(false);
  });

  it("final order contains every player exactly once", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 3);

    manager.applyRollOffRoll(roomCode, hostId, rollEntry(5, 5));
    manager.applyRollOffRoll(roomCode, guestIds[0], rollEntry(3, 3));
    const res = manager.applyRollOffRoll(roomCode, guestIds[1], rollEntry(1, 2));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ro = res.value.room.rollOff!;
    expect(ro.gameReady).toBe(true);
    expect(ro.resolvedOrder!).toHaveLength(3);
    expect(new Set(ro.resolvedOrder!).size).toBe(3);
  });
});

// ── B. Trade flow after counter-offer removal ─────────────────────────────────

describe("Trade flow smoke", () => {
  // Build a state where p0 has a property and a pending trade to p1
  function stateWithTrade() {
    const base = makeGameState(2);
    const p0 = base.players[0];
    const p1 = base.players[1];
    // Give p0 property at index 1 (Brown group city)
    const withProp = withOwnership(base, 1, p0.id);

    const state = gameReducer(withProp, {
      type: "PROPOSE_TRADE",
      actorPlayerId: p0.id,
      initiatorId: p0.id,
      recipientId: p1.id,
      offerFromInitiator: { cash: 0, propertySpaceIndices: [1], getOutOfJailFreeCards: 0 },
      offerFromRecipient: { cash: 100, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
    });
    expect(state.trade).not.toBeNull();
    return { state, p0Id: p0.id, p1Id: p1.id };
  }

  it("PROPOSE_TRADE → ACCEPT_TRADE transfers cash and property", () => {
    const { state, p0Id: pid0, p1Id: pid1 } = stateWithTrade();
    const p0Before = state.players.find((p) => p.id === pid0)!;
    const p1Before = state.players.find((p) => p.id === pid1)!;

    const after = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: pid1 });

    expect(after.trade).toBeNull();
    const np0 = after.players.find((p) => p.id === pid0)!;
    const np1 = after.players.find((p) => p.id === pid1)!;
    expect(np0.cash).toBe(p0Before.cash + 100);
    expect(np0.ownedCityIds).not.toContain(1);
    expect(np1.cash).toBe(p1Before.cash - 100);
    expect(np1.ownedCityIds).toContain(1);
    expect(after.ownerships.find((o) => o.spaceIndex === 1)?.ownerId).toBe(pid1);
  });

  it("PROPOSE_TRADE → DECLINE_TRADE clears offer, no asset change", () => {
    const { state, p0Id: pid0, p1Id: pid1 } = stateWithTrade();
    const p0Before = state.players.find((p) => p.id === pid0)!;
    const p1Before = state.players.find((p) => p.id === pid1)!;

    const after = gameReducer(state, { type: "DECLINE_TRADE", actorPlayerId: pid1 });

    expect(after.trade).toBeNull();
    expect(after.players.find((p) => p.id === pid0)!.cash).toBe(p0Before.cash);
    expect(after.players.find((p) => p.id === pid1)!.cash).toBe(p1Before.cash);
    expect(after.ownerships.find((o) => o.spaceIndex === 1)?.ownerId).toBe(pid0);
  });

  it("PROPOSE_TRADE → CANCEL_TRADE clears offer, no asset change", () => {
    const { state, p0Id: pid0 } = stateWithTrade();
    const p0Before = state.players.find((p) => p.id === pid0)!;

    const after = gameReducer(state, { type: "CANCEL_TRADE", actorPlayerId: pid0 });

    expect(after.trade).toBeNull();
    expect(after.players.find((p) => p.id === pid0)!.cash).toBe(p0Before.cash);
    expect(after.ownerships.find((o) => o.spaceIndex === 1)?.ownerId).toBe(pid0);
  });

  it("proposer cannot accept own trade", () => {
    const { state, p0Id: pid0 } = stateWithTrade();
    const after = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: pid0 });
    expect(after.trade).not.toBeNull();
  });

  it("recipient cannot cancel trade", () => {
    const { state, p1Id: pid1 } = stateWithTrade();
    const after = gameReducer(state, { type: "CANCEL_TRADE", actorPlayerId: pid1 });
    expect(after.trade).not.toBeNull();
  });

  it("ACCEPT_TRADE log message starts with 'Trade accepted'", () => {
    const { state, p1Id: pid1 } = stateWithTrade();
    const after = gameReducer(state, { type: "ACCEPT_TRADE", actorPlayerId: pid1 });
    // gameLog is newest-first (addLogEntry prepends): [0] is the most recent entry
    const newestLog = after.gameLog[0]?.message ?? "";
    expect(newestLog.startsWith("Trade accepted")).toBe(true);
  });

  it("DECLINE_TRADE log message includes 'declined the trade'", () => {
    const { state, p1Id: pid1 } = stateWithTrade();
    const after = gameReducer(state, { type: "DECLINE_TRADE", actorPlayerId: pid1 });
    const newestLog = after.gameLog[0]?.message ?? "";
    expect(newestLog.includes("declined the trade")).toBe(true);
  });

  it("CANCEL_TRADE log message includes 'cancelled the trade'", () => {
    const { state, p0Id: pid0 } = stateWithTrade();
    const after = gameReducer(state, { type: "CANCEL_TRADE", actorPlayerId: pid0 });
    const newestLog = after.gameLog[0]?.message ?? "";
    expect(newestLog.includes("cancelled the trade")).toBe(true);
  });
});

// ── C. No-negative-cash invariant ────────────────────────────────────────────

describe("No-negative-cash invariant", () => {
  it("rent with insufficient cash does not produce negative cash", () => {
    let state = makeGameState(2);
    const p0 = state.players[0];
    const p1 = state.players[1];

    // Give p1 full brown group (indices 1 and 3) for double rent
    state = withOwnership(state, 1, p1.id);
    state = withOwnership(state, 3, p1.id);
    // p0 has only $1
    state = withPlayer(state, 0, { cash: 1 });
    // Position p0 just before Baltic (index 3), roll to land on it
    state = withPosition(state, 0);
    state = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 2, die2: 1, total: 3, isDouble: false },
    });

    const np0 = state.players.find((p) => p.id === p0.id)!;
    expect(np0.cash).toBeGreaterThanOrEqual(0);
  });

  it("luxury tax with insufficient cash does not produce negative cash", () => {
    let state = makeGameState(2);
    const p0 = state.players[0];
    state = withPlayer(state, 0, { cash: 50 });
    // Luxury Tax at index 38; position player at 35 and roll 3
    state = withPosition(state, 35);
    const after = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 2, die2: 1, total: 3, isDouble: false },
    });
    const np0 = after.players.find((p) => p.id === p0.id)!;
    expect(np0.cash).toBeGreaterThanOrEqual(0);
  });
});

// ── D. Dice → movement → landing smoke ───────────────────────────────────────

describe("Dice → movement → landing smoke", () => {
  it("ROLL_DICE sets diceRoll with correct total", () => {
    const state = makeGameState(2);
    const p0 = state.players[0];

    const after = gameReducer(state, {
      type: "ROLL_DICE",
      dice: dice(3, 4),
    });

    expect(after.diceRoll).not.toBeNull();
    expect(after.diceRoll?.total).toBe(7);
  });

  it("player position advances by dice total (landing on a safe city space)", () => {
    // Use dice that land on index 6 (city), not index 7 (Chance — random card draw)
    const state = makeGameState(2);
    const p0 = state.players[0];

    const after = gameReducer(state, {
      type: "ROLL_DICE",
      dice: dice(4, 2), // total=6, isDouble=false → land at index 6 (city)
    });

    const np0 = after.players.find((p) => p.id === p0.id)!;
    expect(np0.position).toBe(6);
  });

  it("landing on Go To Jail (index 30) sends player to Jail (index 10)", () => {
    let state = makeGameState(2);
    const p0 = state.players[0];
    state = withPosition(state, 27);

    const after = gameReducer(state, {
      type: "ROLL_DICE",
      dice: dice(2, 1),
    });

    const np0 = after.players.find((p) => p.id === p0.id)!;
    expect(np0.position).toBe(10);
    expect(np0.isInJail).toBe(true);
  });

  it("passing GO grants $200 salary", () => {
    let state = makeGameState(2);
    const p0 = state.players[0];
    const cashBefore = p0.cash;
    state = withPosition(state, 38);

    const after = gameReducer(state, {
      type: "ROLL_DICE",
      dice: dice(2, 1),
    });

    const np0 = after.players.find((p) => p.id === p0.id)!;
    expect(np0.cash).toBe(cashBefore + 200);
  });
});

// ── E. Auction smoke ──────────────────────────────────────────────────────────

describe("Auction smoke", () => {
  function stateInAuction() {
    // Start at position 39, roll 2 → land on index 1 (city, unowned) → decline → auction
    let state = makeGameState(2);
    state = withPosition(state, 39);
    state = gameReducer(state, {
      type: "ROLL_DICE",
      dice: { die1: 2, die2: 0, total: 2, isDouble: false },
    });
    state = gameReducer(state, { type: "DECLINE_PROPERTY" });
    return state;
  }

  it("declining property starts auction when auctions enabled", () => {
    const state = stateInAuction();
    expect(state.phase).toBe("auction");
    expect(state.auction).not.toBeNull();
  });

  it("bid cannot exceed player cash", () => {
    const state = stateInAuction();
    const p0 = state.players[0];
    const tooMuch = p0.cash + 1000;

    const after = gameReducer(state, {
      type: "PLACE_BID",
      amount: tooMuch,
    });

    expect(after.auction?.currentBid).toBe(state.auction!.currentBid);
  });

  it("auction winner gets property when all others pass", () => {
    let state = stateInAuction();
    const p0 = state.players[0];
    const p1 = state.players[1];
    const auctionedIdx = state.auction!.propertySpaceIndex;
    const bidAmount = state.auction!.currentBid + 10;

    const p0CashBefore = p0.cash;
    // p0 bids first (auction is turn-based; currentBidderIndex=0 → activePlayerIds[0]=p0)
    state = gameReducer(state, { type: "PLACE_BID", amount: bidAmount });
    // p1 passes → p0 wins as highest bidder
    state = gameReducer(state, { type: "PASS_AUCTION" });

    // After auction resolves
    expect(state.phase).not.toBe("auction");
    const np0 = state.players.find((p) => p.id === p0.id)!;
    const ownership = state.ownerships.find((o) => o.spaceIndex === auctionedIdx);
    expect(ownership?.ownerId).toBe(p0.id);
    expect(np0.cash).toBe(p0CashBefore - bidAmount);
  });
});

// ── F. Counter-offer absence (regression guard) ───────────────────────────────

describe("Counter-offer regression guards", () => {
  const tradePanelSrc = readSrc("components/TradePanel.tsx");
  const serverSrc = readFileSync(join(process.cwd(), "server/index.ts"), "utf-8");
  const reducerSrc = readSrc("lib/game/gameReducer.ts");
  const factorySrc = readSrc("lib/game/createInitialGameState.ts");

  it("TradePanel has no 'Counter Offer' button text", () => {
    expect(tradePanelSrc).not.toMatch(/Counter Offer/);
  });

  it("TradePanel has no counterTrade state or prop", () => {
    expect(tradePanelSrc).not.toMatch(/counterTrade/);
  });

  it("server does not handle trade:counter socket event", () => {
    expect(serverSrc).not.toMatch(/trade:counter/);
  });

  it("COUNTER_TRADE is not a case in gameReducer", () => {
    expect(reducerSrc).not.toMatch(/case "COUNTER_TRADE"/);
  });

  it("counterTrade field absent from createInitialGameState", () => {
    expect(factorySrc).not.toMatch(/counterTrade/);
  });
});

// ── G. Server health and CORS ─────────────────────────────────────────────────

describe("Server health and CORS", () => {
  const serverSrc = readFileSync(join(process.cwd(), "server/index.ts"), "utf-8");

  it("server has /health endpoint", () => {
    expect(serverSrc).toMatch(/\/health/);
  });

  it("server uses parseAllowedOrigins from corsHelpers", () => {
    expect(serverSrc).toMatch(/parseAllowedOrigins/);
  });

  it("render.yaml has production Vercel domain in CLIENT_ORIGINS", () => {
    const yaml = readFileSync(join(process.cwd(), "render.yaml"), "utf-8");
    expect(yaml).toMatch(/monopoly-blue-eta\.vercel\.app/);
  });
});

// ── H. RollOffScreen Phase 4F.2D source assertions ───────────────────────────

describe("RollOffScreen Phase 4F.2D actor/observer regression", () => {
  const src = readSrc("components/multiplayer/RollOffScreen.tsx");

  it("uses allRolls[myPlayerId] (persists after round rolls reset)", () => {
    expect(src).toMatch(/allRolls\[myPlayerId\]/);
  });

  it("has pendingShowLastRoundRef for actor-path deferred reveal", () => {
    expect(src).toMatch(/pendingShowLastRoundRef/);
  });

  it("round-change effect checks myRollingRef before wiping animation state", () => {
    expect(src).toMatch(/myRollingRef\.current/);
  });

  it("displayRolls switches between lastRoundRolls and rolls", () => {
    expect(src).toMatch(/showingLastRound/);
    expect(src).toMatch(/lastRoundRolls/);
  });

  it("REVEAL_GATE_MS prevents premature final order display", () => {
    expect(src).toMatch(/REVEAL_GATE_MS/);
  });
});
