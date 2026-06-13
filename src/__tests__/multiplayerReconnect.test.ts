import { describe, it, expect, beforeEach } from "vitest";
import { RoomManager } from "@/lib/multiplayer/rooms";
import type { DiceRoll } from "@/types/game";

const NON_DOUBLE: DiceRoll = { die1: 3, die2: 4, total: 7, isDouble: false };

function makeTwoPlayerRoom() {
  const mgr = new RoomManager();
  const { room, playerId: hostId } = mgr.createRoom(
    { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
    "socket-alice",
  );
  const roomCode = room.roomCode;
  const joinRes = mgr.joinRoom(
    { roomCode, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
    "socket-bob",
  );
  if (!joinRes.ok) throw new Error("join failed");
  const bobId = joinRes.value.playerId;
  return { mgr, roomCode, hostId, bobId };
}

// ── Lobby reconnect ───────────────────────────────────────────────────────────

describe("RoomManager — reconnect in lobby", () => {
  it("disconnected player can reconnect with saved playerId", () => {
    const { mgr, roomCode, hostId } = makeTwoPlayerRoom();
    mgr.playerDisconnected("socket-alice");
    const room = mgr.getRoom(roomCode)!;
    expect(room.players.find((p) => p.playerId === hostId)?.connected).toBe(false);

    const result = mgr.joinRoom(
      { roomCode, displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444", playerId: hostId },
      "socket-alice-2",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.playerId).toBe(hostId);
      const player = result.value.room.players.find((p) => p.playerId === hostId);
      expect(player?.connected).toBe(true);
    }
  });

  it("reconnect restores correct player identity", () => {
    const { mgr, roomCode, bobId } = makeTwoPlayerRoom();
    mgr.playerDisconnected("socket-bob");

    const result = mgr.joinRoom(
      { roomCode, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb", playerId: bobId },
      "socket-bob-new",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.playerId).toBe(bobId);
    }
  });

  it("reconnect with unknown playerId falls through to normal join", () => {
    const { mgr, roomCode } = makeTwoPlayerRoom();
    // Use a playerId that doesn't exist in the room — should try new join
    const result = mgr.joinRoom(
      { roomCode, displayName: "Charlie", token: "ship", tokenLabel: "SHP", color: "#16a34a", playerId: "p-unknown-xxx" },
      "socket-charlie",
    );
    // Room has 2/6 players and ship is available — should succeed as new player
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should get a NEW playerId, not the unknown one
      expect(result.value.playerId).not.toBe("p-unknown-xxx");
    }
  });

  it("reconnect fails when room does not exist", () => {
    const mgr = new RoomManager();
    const result = mgr.joinRoom(
      { roomCode: "GHOST-9999", displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444", playerId: "p-xxx" },
      "socket-alice",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/room not found/i);
  });

  it("reconnect after room cleanup fails safely", () => {
    const mgr = new RoomManager();
    const { room, playerId } = mgr.createRoom(
      { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-alice",
    );
    const roomCode = room.roomCode;
    // Backdate to trigger cleanup
    mgr.setLastActivityAt(roomCode, Date.now() - 3 * 60 * 60 * 1000);
    mgr.cleanupInactive();
    expect(mgr.getRoom(roomCode)).toBeNull();

    const result = mgr.joinRoom(
      { roomCode, displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444", playerId },
      "socket-alice-2",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/room not found/i);
  });
});

// ── In-game reconnect ─────────────────────────────────────────────────────────

describe("RoomManager — reconnect during active game", () => {
  it("disconnected player can rejoin a game in progress", () => {
    const { mgr, roomCode, hostId, bobId } = makeTwoPlayerRoom();
    mgr.startGame(roomCode, hostId);
    mgr.playerDisconnected("socket-bob");

    const result = mgr.joinRoom(
      { roomCode, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb", playerId: bobId },
      "socket-bob-new",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.playerId).toBe(bobId);
      const bob = result.value.room.players.find((p) => p.playerId === bobId);
      expect(bob?.connected).toBe(true);
    }
  });

  it("game state is still accessible after reconnect", () => {
    const { mgr, roomCode, hostId, bobId } = makeTwoPlayerRoom();
    mgr.startGame(roomCode, hostId);
    mgr.playerDisconnected("socket-bob");
    mgr.joinRoom(
      { roomCode, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb", playerId: bobId },
      "socket-bob-new",
    );
    expect(mgr.getGameState(roomCode)).not.toBeNull();
  });

  it("new player cannot join an in-progress game", () => {
    const { mgr, roomCode, hostId } = makeTwoPlayerRoom();
    mgr.startGame(roomCode, hostId);

    const result = mgr.joinRoom(
      { roomCode, displayName: "Charlie", token: "ship", tokenLabel: "SHP", color: "#16a34a" },
      "socket-charlie",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/in progress/i);
  });
});

// ── Request sync ──────────────────────────────────────────────────────────────

describe("RoomManager — state consistency after actions", () => {
  it("game state reflects latest action after apply", () => {
    const { mgr, roomCode, hostId } = makeTwoPlayerRoom();
    const startRes = mgr.startGame(roomCode, hostId);
    if (!startRes.ok) throw new Error("start failed");

    const gs0 = mgr.getGameState(roomCode)!;
    const currentId = gs0.players[gs0.currentPlayerIndex].id;

    mgr.applyGameAction(roomCode, currentId, { type: "ROLL_DICE" }, NON_DOUBLE);
    const gs1 = mgr.getGameState(roomCode)!;
    expect(gs1.diceRoll?.total).toBe(7);
    expect(gs1.currentPlayerHasRolled).toBe(true);
  });

  it("invalid action does not mutate game state", () => {
    const { mgr, roomCode, hostId } = makeTwoPlayerRoom();
    mgr.startGame(roomCode, hostId);
    const gs0 = mgr.getGameState(roomCode)!;

    // Wrong player tries to act
    const wrongId = gs0.players.find((_, i) => i !== gs0.currentPlayerIndex)!.id;
    mgr.applyGameAction(roomCode, wrongId, { type: "ROLL_DICE" }, NON_DOUBLE);

    const gs1 = mgr.getGameState(roomCode)!;
    expect(gs1.currentPlayerHasRolled).toBe(false); // unchanged
  });

  it("reconnected player can still act on their turn", () => {
    const { mgr, roomCode, hostId, bobId } = makeTwoPlayerRoom();
    const startRes = mgr.startGame(roomCode, hostId);
    if (!startRes.ok) throw new Error("start failed");

    const gs = mgr.getGameState(roomCode)!;
    const currentPlayer = gs.players[gs.currentPlayerIndex];

    // Disconnect and reconnect the current player
    const currentSocketId = currentPlayer.name === "Alice" ? "socket-alice" : "socket-bob";
    mgr.playerDisconnected(currentSocketId);

    const reconnectId = currentPlayer.name === "Alice" ? hostId : bobId;
    mgr.joinRoom(
      {
        roomCode,
        displayName: currentPlayer.name,
        token: currentPlayer.name === "Alice" ? "car" : "hat",
        tokenLabel: currentPlayer.name === "Alice" ? "CAR" : "HAT",
        color: currentPlayer.name === "Alice" ? "#ef4444" : "#2563eb",
        playerId: reconnectId,
      },
      "socket-reconnected",
    );

    // Player should be able to act after reconnect
    const result = mgr.applyGameAction(roomCode, currentPlayer.id, { type: "ROLL_DICE" }, NON_DOUBLE);
    expect(result.ok).toBe(true);
  });
});

// ── Room public view integrity ────────────────────────────────────────────────

describe("RoomPublicView — connection status and structure", () => {
  it("room public view includes connected status per player", () => {
    const { mgr, roomCode, bobId } = makeTwoPlayerRoom();
    mgr.playerDisconnected("socket-bob");

    const room = mgr.getRoom(roomCode)!;
    const bob = room.players.find((p) => p.playerId === bobId);
    expect(bob?.connected).toBe(false);
  });

  it("room public view maxPlayers is 6", () => {
    const mgr = new RoomManager();
    const { room } = mgr.createRoom(
      { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "s1",
    );
    expect(room.maxPlayers).toBe(6);
  });

  it("invite link can be constructed from roomCode", () => {
    const { mgr } = makeTwoPlayerRoom();
    const { room } = mgr.createRoom(
      { displayName: "Test", token: "ship", tokenLabel: "SHP", color: "#16a34a" },
      "s-test",
    );
    const inviteLink = `/join/${room.roomCode}`;
    expect(inviteLink).toMatch(/^\/join\/[A-Z]+-\d{4}$/);
  });

  it("takenTokens is updated after each player joins", () => {
    const { mgr, roomCode } = makeTwoPlayerRoom();
    const room = mgr.getRoom(roomCode)!;
    expect(room.takenTokens).toContain("car");
    expect(room.takenTokens).toContain("hat");
    expect(room.takenTokens).not.toContain("ship");
  });
});

// ── Duplicate identity prevention ─────────────────────────────────────────────

describe("RoomManager — duplicate identity handling", () => {
  it("second socket with same playerId replaces old socket (reconnect)", () => {
    const { mgr, roomCode, hostId } = makeTwoPlayerRoom();

    // First reconnect
    const r1 = mgr.joinRoom(
      { roomCode, displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444", playerId: hostId },
      "socket-alice-new-1",
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    // Player should be connected
    expect(r1.value.room.players.find((p) => p.playerId === hostId)?.connected).toBe(true);

    // Same playerId reconnects again from yet another socket
    const r2 = mgr.joinRoom(
      { roomCode, displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444", playerId: hostId },
      "socket-alice-new-2",
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    // Player should still be connected — old socket replaced
    expect(r2.value.room.players.find((p) => p.playerId === hostId)?.connected).toBe(true);
  });
});
