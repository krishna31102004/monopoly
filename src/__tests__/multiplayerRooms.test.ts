import { describe, it, expect, beforeEach } from "vitest";
import { RoomManager, MAX_PLAYERS } from "@/lib/multiplayer/rooms";
import { generateRoomCode, isValidRoomCodeFormat } from "@/lib/multiplayer/roomCode";

// ── Room code helpers ─────────────────────────────────────────────────────────

describe("Room code generation", () => {
  it("generates a valid room code format", () => {
    const code = generateRoomCode();
    expect(isValidRoomCodeFormat(code)).toBe(true);
  });

  it("generated code matches WORD-NNNN pattern", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z]+-\d{4}$/);
  });

  it("isValidRoomCodeFormat accepts valid codes", () => {
    expect(isValidRoomCodeFormat("LONDON-4821")).toBe(true);
    expect(isValidRoomCodeFormat("DUBAI-1234")).toBe(true);
  });

  it("isValidRoomCodeFormat rejects invalid codes", () => {
    expect(isValidRoomCodeFormat("INVALID")).toBe(false);
    expect(isValidRoomCodeFormat("AB-12")).toBe(false);
    expect(isValidRoomCodeFormat("")).toBe(false);
    expect(isValidRoomCodeFormat("1234-ABCD")).toBe(false);
  });
});

// ── Room manager ──────────────────────────────────────────────────────────────

describe("RoomManager — createRoom", () => {
  let mgr: RoomManager;
  beforeEach(() => { mgr = new RoomManager(); });

  it("returns a room code and playerId", () => {
    const { room, playerId } = mgr.createRoom(
      { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-1",
    );
    expect(typeof room.roomCode).toBe("string");
    expect(room.roomCode).toMatch(/^[A-Z]+-\d{4}$/);
    expect(typeof playerId).toBe("string");
  });

  it("room starts in lobby status", () => {
    const { room } = mgr.createRoom(
      { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-1",
    );
    expect(room.status).toBe("lobby");
  });

  it("host is the first player", () => {
    const { room, playerId } = mgr.createRoom(
      { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-1",
    );
    expect(room.players).toHaveLength(1);
    expect(room.players[0].playerId).toBe(playerId);
    expect(room.players[0].isHost).toBe(true);
    expect(room.players[0].displayName).toBe("Alice");
  });

  it("room is private — not listed (manager has no list endpoint)", () => {
    mgr.createRoom({ displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" }, "s1");
    mgr.createRoom({ displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" }, "s2");
    // roomCount tracks rooms but no public listing is exposed
    expect(mgr.roomCount).toBe(2);
  });

  it("two rooms get different codes", () => {
    const r1 = mgr.createRoom({ displayName: "A", token: "car", tokenLabel: "CAR", color: "#ef4444" }, "s1");
    const r2 = mgr.createRoom({ displayName: "B", token: "hat", tokenLabel: "HAT", color: "#2563eb" }, "s2");
    expect(r1.room.roomCode).not.toBe(r2.room.roomCode);
  });
});

// ── joinRoom ──────────────────────────────────────────────────────────────────

describe("RoomManager — joinRoom", () => {
  let mgr: RoomManager;
  let roomCode: string;

  beforeEach(() => {
    mgr = new RoomManager();
    const result = mgr.createRoom(
      { displayName: "Host", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-host",
    );
    roomCode = result.room.roomCode;
  });

  it("join with valid code succeeds", () => {
    const result = mgr.joinRoom(
      { roomCode, displayName: "Alice", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      "socket-alice",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.room.players).toHaveLength(2);
      expect(result.value.room.players[1].displayName).toBe("Alice");
    }
  });

  it("join with invalid room code fails", () => {
    const result = mgr.joinRoom(
      { roomCode: "GHOST-9999", displayName: "Alice", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      "socket-alice",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/room not found/i);
  });

  it("join with empty name fails", () => {
    const result = mgr.joinRoom(
      { roomCode, displayName: "   ", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      "socket-alice",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/name/i);
  });

  it("enforces max 6 players", () => {
    const tokens = ["hat", "ship", "shoe", "dog", "cat"] as const;
    const colors = ["#2563eb", "#16a34a", "#ca8a04", "#7c3aed", "#0891b2"];
    for (let i = 0; i < 5; i++) {
      const res = mgr.joinRoom(
        { roomCode, displayName: `P${i + 2}`, token: tokens[i], tokenLabel: tokens[i].toUpperCase(), color: colors[i] },
        `socket-${i + 2}`,
      );
      expect(res.ok).toBe(true);
    }
    // 7th player is rejected
    const overLimit = mgr.joinRoom(
      { roomCode, displayName: "Extra", token: "car", tokenLabel: "CAR", color: "#999" },
      "socket-extra",
    );
    expect(overLimit.ok).toBe(false);
    if (!overLimit.ok) expect(overLimit.error).toMatch(/full/i);
  });

  it("duplicate token is rejected", () => {
    // Host already has "car"
    const result = mgr.joinRoom(
      { roomCode, displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-alice",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/token/i);
  });

  it("different token is accepted", () => {
    const result = mgr.joinRoom(
      { roomCode, displayName: "Alice", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      "socket-alice",
    );
    expect(result.ok).toBe(true);
  });

  it("takenTokens reflects joined players", () => {
    mgr.joinRoom(
      { roomCode, displayName: "Alice", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      "socket-alice",
    );
    const room = mgr.getRoom(roomCode)!;
    expect(room.takenTokens).toContain("car"); // host
    expect(room.takenTokens).toContain("hat"); // alice
    expect(room.takenTokens).not.toContain("ship");
  });
});

// ── startGame ─────────────────────────────────────────────────────────────────

describe("RoomManager — startGame", () => {
  let mgr: RoomManager;
  let roomCode: string;
  let hostPlayerId: string;

  beforeEach(() => {
    mgr = new RoomManager();
    const result = mgr.createRoom(
      { displayName: "Host", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-host",
    );
    roomCode = result.room.roomCode;
    hostPlayerId = result.playerId;
    // Add a second player
    mgr.joinRoom(
      { roomCode, displayName: "Alice", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      "socket-alice",
    );
  });

  it("host can start game with 2 players", () => {
    const result = mgr.startGame(roomCode, hostPlayerId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.room.status).toBe("inGame");
      expect(result.value.gameState).not.toBeNull();
    }
  });

  it("start game creates valid initial game state", () => {
    const result = mgr.startGame(roomCode, hostPlayerId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const { gameState } = result.value;
      expect(gameState.players).toHaveLength(2);
      expect(gameState.phase).toBe("readyToRoll");
      expect(gameState.players[0].cash).toBe(1500);
      expect(gameState.players[1].cash).toBe(1500);
    }
  });

  it("non-host cannot start game", () => {
    const joinResult = mgr.joinRoom(
      { roomCode, displayName: "Bob", token: "ship", tokenLabel: "SHP", color: "#16a34a" },
      "socket-bob",
    );
    expect(joinResult.ok).toBe(true);
    if (joinResult.ok) {
      const nonHostId = joinResult.value.playerId;
      const result = mgr.startGame(roomCode, nonHostId);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/host/i);
    }
  });

  it("cannot start with fewer than 2 players", () => {
    // Create a fresh room with only host
    const soloResult = mgr.createRoom(
      { displayName: "Solo", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-solo",
    );
    const result = mgr.startGame(soloResult.room.roomCode, soloResult.playerId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/2 players/i);
  });

  it("cannot start game with invalid room code", () => {
    const result = mgr.startGame("GHOST-9999", hostPlayerId);
    expect(result.ok).toBe(false);
  });

  it("room update view contains expected lobby fields after start", () => {
    const result = mgr.startGame(roomCode, hostPlayerId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const room = result.value.room;
      expect(room).toHaveProperty("roomCode");
      expect(room).toHaveProperty("status", "inGame");
      expect(room).toHaveProperty("players");
      expect(room).toHaveProperty("maxPlayers", MAX_PLAYERS);
      expect(room).toHaveProperty("takenTokens");
    }
  });
});

// ── Disconnect / leave ────────────────────────────────────────────────────────

describe("RoomManager — disconnect and leave", () => {
  let mgr: RoomManager;
  let roomCode: string;

  beforeEach(() => {
    mgr = new RoomManager();
    const result = mgr.createRoom(
      { displayName: "Host", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-host",
    );
    roomCode = result.room.roomCode;
    mgr.joinRoom(
      { roomCode, displayName: "Alice", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      "socket-alice",
    );
  });

  it("playerDisconnected marks player as disconnected", () => {
    const info = mgr.playerDisconnected("socket-alice");
    expect(info).not.toBeNull();
    expect(info?.displayName).toBe("Alice");
    const room = mgr.getRoom(roomCode)!;
    const alice = room.players.find((p) => p.displayName === "Alice");
    expect(alice?.connected).toBe(false);
  });

  it("playerDisconnected returns null for unknown socket", () => {
    const info = mgr.playerDisconnected("socket-ghost");
    expect(info).toBeNull();
  });

  it("playerLeft marks player as disconnected", () => {
    const joinResult = mgr.joinRoom(
      { roomCode, displayName: "Bob", token: "ship", tokenLabel: "SHP", color: "#16a34a" },
      "socket-bob",
    );
    expect(joinResult.ok).toBe(true);
    if (joinResult.ok) {
      mgr.playerLeft(roomCode, joinResult.value.playerId);
      const room = mgr.getRoom(roomCode)!;
      const bob = room.players.find((p) => p.displayName === "Bob");
      expect(bob?.connected).toBe(false);
    }
  });
});

// ── Reconnect ─────────────────────────────────────────────────────────────────

describe("RoomManager — reconnect", () => {
  it("reconnect with known playerId succeeds", () => {
    const mgr = new RoomManager();
    const { room, playerId } = mgr.createRoom(
      { displayName: "Host", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-host",
    );
    const roomCode = room.roomCode;

    // Disconnect
    mgr.playerDisconnected("socket-host");

    // Reconnect with saved playerId
    const result = mgr.joinRoom(
      { roomCode, displayName: "Host", token: "car", tokenLabel: "CAR", color: "#ef4444", playerId },
      "socket-host-2",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.playerId).toBe(playerId);
      const hostPlayer = result.value.room.players.find((p) => p.playerId === playerId);
      expect(hostPlayer?.connected).toBe(true);
    }
  });
});

// ── Cleanup ───────────────────────────────────────────────────────────────────

describe("RoomManager — cleanup", () => {
  it("cleanupInactive does not remove recently-active rooms", () => {
    const mgr = new RoomManager();
    const { room } = mgr.createRoom(
      { displayName: "Host", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-host",
    );
    expect(mgr.roomCount).toBe(1);
    const removed = mgr.cleanupInactive();
    expect(removed).toBe(0);
    expect(mgr.roomCount).toBe(1);
    expect(mgr.getRoom(room.roomCode)).not.toBeNull();
  });

  it("cleanupInactive removes rooms with expired lastActivityAt", () => {
    const mgr = new RoomManager();
    const { room } = mgr.createRoom(
      { displayName: "Host", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-host",
    );
    // Manually backdate the room
    mgr.setLastActivityAt(room.roomCode, Date.now() - 3 * 60 * 60 * 1000);
    expect(mgr.roomCount).toBe(1);
    const removed = mgr.cleanupInactive();
    expect(removed).toBe(1);
    expect(mgr.roomCount).toBe(0);
  });
});
