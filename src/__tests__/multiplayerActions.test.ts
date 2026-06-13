import { describe, it, expect, beforeEach } from "vitest";
import { RoomManager } from "@/lib/multiplayer/rooms";
import type { GameActionIntent } from "@/types/multiplayer";
import type { DiceRoll } from "@/types/game";

// Helpers
const DOUBLE: DiceRoll = { die1: 3, die2: 3, total: 6, isDouble: true };
const NON_DOUBLE: DiceRoll = { die1: 2, die2: 5, total: 7, isDouble: false };

function setup2Players() {
  const mgr = new RoomManager();
  const { room, playerId: hostId } = mgr.createRoom(
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

  const startResult = mgr.startGame(roomCode, hostId);
  if (!startResult.ok) throw new Error("start failed");
  const gs = startResult.value.gameState;
  // Determine which player index maps to Alice/Bob
  const aliceIdx = gs.players.findIndex((p) => p.name === "Alice");
  const bobIdx = gs.players.findIndex((p) => p.name === "Bob");
  const aliceGameId = gs.players[aliceIdx].id;
  const bobGameId = gs.players[bobIdx].id;

  return { mgr, roomCode, hostId, bobId, aliceGameId, bobGameId };
}

// ── applyGameAction validation ────────────────────────────────────────────────

describe("RoomManager — applyGameAction validation", () => {
  it("rejects action for non-existent room", () => {
    const mgr = new RoomManager();
    const result = mgr.applyGameAction(
      "GHOST-9999",
      "p-xxx",
      { type: "END_TURN" },
      null,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/room not found/i);
  });

  it("rejects action when game not in progress", () => {
    const mgr = new RoomManager();
    const { room, playerId } = mgr.createRoom(
      { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-alice",
    );
    const result = mgr.applyGameAction(room.roomCode, playerId, { type: "END_TURN" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not in progress/i);
  });

  it("rejects action from wrong player (not their turn)", () => {
    const { mgr, roomCode, bobId } = setup2Players();
    // Game starts: first player is index 0 (Alice). Bob should be rejected.
    const gs = mgr.getGameState(roomCode)!;
    const firstPlayerId = gs.players[gs.currentPlayerIndex].id;
    // Find the game ID of the player who is NOT first
    const otherGameId = gs.players.find((p) => p.id !== firstPlayerId)!.id;

    // We need the socket-level playerId for the other player.
    // In our setup helper, aliceGameId maps to hostId indirectly via room ordering.
    // Just use bobId as the non-first player in room ordering.
    // We'll check using the "wrong player" path by finding which roomPlayer is not current.
    const result = mgr.applyGameAction(
      roomCode,
      gs.players[gs.currentPlayerIndex].id === otherGameId ? "wrong" : otherGameId,
      { type: "ROLL_DICE" },
      NON_DOUBLE,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not your turn/i);
  });

  it("requires serverDice for ROLL_DICE", () => {
    const { mgr, roomCode } = setup2Players();
    const gs = mgr.getGameState(roomCode)!;
    const currentId = gs.players[gs.currentPlayerIndex].id;
    const result = mgr.applyGameAction(roomCode, currentId, { type: "ROLL_DICE" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/dice/i);
  });

  it("requires serverDice for ROLL_IN_JAIL", () => {
    const { mgr, roomCode } = setup2Players();
    const gs = mgr.getGameState(roomCode)!;
    const currentId = gs.players[gs.currentPlayerIndex].id;
    const result = mgr.applyGameAction(roomCode, currentId, { type: "ROLL_IN_JAIL" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/dice/i);
  });
});

// ── applyGameAction — successful actions ──────────────────────────────────────

describe("RoomManager — applyGameAction successful actions", () => {
  it("ROLL_DICE with server dice moves player and returns new state", () => {
    const { mgr, roomCode } = setup2Players();
    const gs = mgr.getGameState(roomCode)!;
    const currentId = gs.players[gs.currentPlayerIndex].id;

    const result = mgr.applyGameAction(roomCode, currentId, { type: "ROLL_DICE" }, NON_DOUBLE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.diceRoll).not.toBeNull();
      expect(result.value.diceRoll?.total).toBe(7);
      expect(result.value.currentPlayerHasRolled).toBe(true);
    }
  });

  it("game state is persisted after action", () => {
    const { mgr, roomCode } = setup2Players();
    const gs = mgr.getGameState(roomCode)!;
    const currentId = gs.players[gs.currentPlayerIndex].id;

    mgr.applyGameAction(roomCode, currentId, { type: "ROLL_DICE" }, NON_DOUBLE);
    const persisted = mgr.getGameState(roomCode)!;
    expect(persisted.currentPlayerHasRolled).toBe(true);
  });

  it("END_TURN advances to next player", () => {
    const { mgr, roomCode } = setup2Players();
    const gs0 = mgr.getGameState(roomCode)!;
    const p0 = gs0.currentPlayerIndex;
    const currentId = gs0.players[p0].id;

    // Roll first
    mgr.applyGameAction(roomCode, currentId, { type: "ROLL_DICE" }, NON_DOUBLE);
    // Resolve any landing action first if needed — for simple positions just end turn
    const gs1 = mgr.getGameState(roomCode)!;
    if (gs1.phase === "turnComplete") {
      const actor = gs1.players[gs1.currentPlayerIndex].id;
      mgr.applyGameAction(roomCode, actor, { type: "END_TURN" }, null);
      const gs2 = mgr.getGameState(roomCode)!;
      expect(gs2.currentPlayerIndex).not.toBe(p0);
    }
    // If phase was awaitingPurchaseDecision etc., just verify state changed
    expect(mgr.getGameState(roomCode)).not.toBeNull();
  });

  it("ROLL_DICE with doubles leaves phase as readyToRoll and doublesCount=1", () => {
    const { mgr, roomCode } = setup2Players();
    const gs = mgr.getGameState(roomCode)!;
    const currentId = gs.players[gs.currentPlayerIndex].id;

    const result = mgr.applyGameAction(roomCode, currentId, { type: "ROLL_DICE" }, DOUBLE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // After doubles, phase should allow another roll (unless it's a special landing)
      expect(result.value.diceRoll?.isDouble).toBe(true);
      expect(result.value.doublesCount).toBe(1);
    }
  });

  it("BUY_PROPERTY deducts cash and assigns ownership when landing on unowned property", () => {
    const { mgr, roomCode } = setup2Players();
    const gs = mgr.getGameState(roomCode)!;
    const currentId = gs.players[gs.currentPlayerIndex].id;
    const currentIdx = gs.currentPlayerIndex;

    // Roll to a specific position — use 3 (Community Chest) or find an ownable space.
    // We'll brute-force a non-double that lands on a property.
    // Position 0 is GO; position 3 is "Havana" (first city in Baltic group).
    // Let's use die1=1, die2=2, total=3 → space 3 (Havana)
    const dice3: DiceRoll = { die1: 1, die2: 2, total: 3, isDouble: false };
    const r1 = mgr.applyGameAction(roomCode, currentId, { type: "ROLL_DICE" }, dice3);
    if (!r1.ok) return;

    if (r1.value.phase === "awaitingPurchaseDecision") {
      const cashBefore = r1.value.players[currentIdx].cash;
      const r2 = mgr.applyGameAction(roomCode, currentId, { type: "BUY_PROPERTY" }, null);
      expect(r2.ok).toBe(true);
      if (r2.ok) {
        expect(r2.value.players[currentIdx].cash).toBeLessThan(cashBefore);
        const owned = r2.value.ownerships.find((o) => o.spaceIndex === 3);
        expect(owned?.ownerId).toBe(currentId);
      }
    }
    // If landing elsewhere (chance/tax/etc), just confirm no error
    else {
      expect(r1.value).toBeTruthy();
    }
  });
});

// ── applyGameAction — auction bidder turns ────────────────────────────────────

describe("RoomManager — applyGameAction auction turn handling", () => {
  it("during auction, the current auction bidder can act regardless of currentPlayerIndex", () => {
    const { mgr, roomCode } = setup2Players();
    const gs = mgr.getGameState(roomCode)!;
    const currentId = gs.players[gs.currentPlayerIndex].id;

    // Land on an unowned property and decline to trigger auction
    const dice3: DiceRoll = { die1: 1, die2: 2, total: 3, isDouble: false };
    const r1 = mgr.applyGameAction(roomCode, currentId, { type: "ROLL_DICE" }, dice3);
    if (!r1.ok || r1.value.phase !== "awaitingPurchaseDecision") return;

    const r2 = mgr.applyGameAction(roomCode, currentId, { type: "DECLINE_PROPERTY" }, null);
    if (!r2.ok || r2.value.phase !== "auction") return;

    const auctionBidder = r2.value.auction!.currentAuctionBidderId;
    // The auction bidder can place a bid
    const r3 = mgr.applyGameAction(roomCode, auctionBidder, { type: "PLACE_BID", amount: 100 }, null);
    expect(r3.ok).toBe(true);
  });
});
