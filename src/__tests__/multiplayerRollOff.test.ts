import { describe, it, expect } from "vitest";
import { RoomManager } from "@/lib/multiplayer/rooms";
import type { RollOffEntry } from "@/lib/game/rollOff";

function roll(die1: number, die2: number): RollOffEntry {
  return { die1, die2, total: die1 + die2 };
}

let socketCounter = 0;
function nextSocket() {
  return `socket-${socketCounter++}`;
}

function makeRoom(manager: RoomManager, playerCount = 2) {
  const host = manager.createRoom(
    { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
    nextSocket(),
  );
  const { roomCode } = host.room;
  const hostId = host.playerId;

  const guestTokens = ["hat", "ship", "shoe"] as const;
  const guestIds: string[] = [];
  for (let i = 1; i < playerCount; i++) {
    const res = manager.joinRoom(
      {
        roomCode,
        displayName: `Player ${i + 1}`,
        token: guestTokens[i - 1],
        tokenLabel: guestTokens[i - 1].toUpperCase().slice(0, 3),
        color: "#2563eb",
      },
      nextSocket(),
    );
    if (!res.ok) throw new Error(`joinRoom failed: ${res.error}`);
    guestIds.push(res.value.playerId);
  }

  return { roomCode, hostId, guestIds };
}

describe("startRollOff", () => {
  it("transitions room to rollOff status", () => {
    const manager = new RoomManager();
    const { roomCode, hostId } = makeRoom(manager, 2);
    const result = manager.startRollOff(roomCode, hostId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("rollOff");
  });

  it("exposes rollOff public view with round=1 and both players pending", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);
    const result = manager.startRollOff(roomCode, hostId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ro = result.value.rollOff;
    expect(ro).not.toBeNull();
    expect(ro!.round).toBe(1);
    expect(ro!.pendingPlayerIds).toContain(hostId);
    expect(ro!.pendingPlayerIds).toContain(guestIds[0]);
    expect(ro!.resolvedOrder).toBeNull();
  });

  it("rejects if called by non-host", () => {
    const manager = new RoomManager();
    const { roomCode, guestIds } = makeRoom(manager, 2);
    const result = manager.startRollOff(roomCode, guestIds[0]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/host/i);
  });

  it("rejects if room has fewer than 2 connected players", () => {
    const manager = new RoomManager();
    const host = manager.createRoom(
      { displayName: "Lonely", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      nextSocket(),
    );
    const { roomCode } = host.room;
    const hostId = host.playerId;
    const result = manager.startRollOff(roomCode, hostId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/2 player/i);
  });
});

describe("applyRollOffRoll", () => {
  it("returns gameState=null until all players have rolled", () => {
    const manager = new RoomManager();
    const { roomCode, hostId } = makeRoom(manager, 2);
    manager.startRollOff(roomCode, hostId);
    const res = manager.applyRollOffRoll(roomCode, hostId, roll(4, 5));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.gameState).toBeNull();
  });

  it("rejects duplicate roll from same player in same round", () => {
    const manager = new RoomManager();
    const { roomCode, hostId } = makeRoom(manager, 2);
    manager.startRollOff(roomCode, hostId);
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    const res = manager.applyRollOffRoll(roomCode, hostId, roll(2, 2));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/already rolled/i);
  });

  it("rejects player not in current rolling group", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 3);
    manager.startRollOff(roomCode, hostId);

    // Round 1: hostId and guestIds[0] tie (both total 7), guestIds[1] gets 5
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3));
    manager.applyRollOffRoll(roomCode, guestIds[1], roll(2, 3));
    // Now in round 2, only hostId and guestIds[0] are rolling
    const res = manager.applyRollOffRoll(roomCode, guestIds[1], roll(5, 4));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not in the current/i);
  });

  it("resolves to gameReady=true but NOT inGame after all rolls — host must beginGame", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);
    manager.startRollOff(roomCode, hostId);
    manager.applyRollOffRoll(roomCode, hostId, roll(6, 6));
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], roll(1, 2));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Game NOT started yet
    expect(res.value.gameState).toBeNull();
    expect(res.value.room.status).toBe("rollOff");
    expect(res.value.room.rollOff?.gameReady).toBe(true);
  });

  it("first player in game matches highest roller (after beginGame)", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);
    manager.startRollOff(roomCode, hostId);
    manager.applyRollOffRoll(roomCode, guestIds[0], roll(6, 6));
    manager.applyRollOffRoll(roomCode, hostId, roll(1, 2));

    const res = manager.beginRollOffGame(roomCode, hostId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.gameState!.players[0].id).toBe(guestIds[0]);
  });

  it("re-roll round resolves ties correctly; game starts after beginGame", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);
    manager.startRollOff(roomCode, hostId);

    // Round 1: both tie at 7
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    const afterTie = manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3));
    expect(afterTie.ok).toBe(true);
    if (!afterTie.ok) return;
    expect(afterTie.value.gameState).toBeNull();
    expect(afterTie.value.room.status).toBe("rollOff");
    expect(afterTie.value.room.rollOff!.round).toBe(2);

    // Round 2: guest wins
    manager.applyRollOffRoll(roomCode, hostId, roll(2, 2));
    const final = manager.applyRollOffRoll(roomCode, guestIds[0], roll(5, 5));
    expect(final.ok).toBe(true);
    if (!final.ok) return;
    // Still not started — waiting for host
    expect(final.value.gameState).toBeNull();
    expect(final.value.room.rollOff?.gameReady).toBe(true);

    // Host begins game
    const begun = manager.beginRollOffGame(roomCode, hostId);
    expect(begun.ok).toBe(true);
    if (!begun.ok) return;
    expect(begun.value.gameState!.players[0].id).toBe(guestIds[0]);
  });

  it("pending list shrinks as players roll", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 3);
    manager.startRollOff(roomCode, hostId);

    // Before any rolls: all 3 pending
    const view0 = manager.getRoom(roomCode)!;
    expect(view0.rollOff!.pendingPlayerIds).toHaveLength(3);

    // After one roll: 2 pending
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    const view1 = manager.getRoom(roomCode)!;
    expect(view1.rollOff!.pendingPlayerIds).toHaveLength(2);
    expect(view1.rollOff!.pendingPlayerIds).not.toContain(hostId);
    expect(view1.rollOff!.pendingPlayerIds).toContain(guestIds[0]);
    expect(view1.rollOff!.pendingPlayerIds).toContain(guestIds[1]);
  });
});
