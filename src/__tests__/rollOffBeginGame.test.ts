import { describe, it, expect } from "vitest";
import { RoomManager } from "@/lib/multiplayer/rooms";
import type { RollOffEntry } from "@/lib/game/rollOff";

function roll(die1: number, die2: number): RollOffEntry {
  return { die1, die2, total: die1 + die2 };
}

let sc = 0;
function sock() { return `s-${sc++}`; }

function twoPlayerRoom(manager: RoomManager) {
  const host = manager.createRoom(
    { displayName: "Host", token: "car", tokenLabel: "CAR", color: "#ef4444" },
    sock(),
  );
  const { roomCode } = host.room;
  const hostId = host.playerId;
  const guest = manager.joinRoom(
    { roomCode, displayName: "Guest", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
    sock(),
  );
  if (!guest.ok) throw new Error("join failed");
  return { roomCode, hostId, guestId: guest.value.playerId };
}

describe("beginRollOffGame", () => {
  it("server does NOT create game after final roll — stays in rollOff with gameReady=true", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestId } = twoPlayerRoom(manager);
    manager.startRollOff(roomCode, hostId);

    manager.applyRollOffRoll(roomCode, hostId, roll(6, 6));
    const last = manager.applyRollOffRoll(roomCode, guestId, roll(1, 2));
    expect(last.ok).toBe(true);
    if (!last.ok) return;
    // Game should NOT be started
    expect(last.value.gameState).toBeNull();
    expect(last.value.room.status).toBe("rollOff");
    expect(last.value.room.rollOff?.gameReady).toBe(true);
    expect(last.value.room.rollOff?.resolvedOrder).not.toBeNull();
  });

  it("host can begin game after roll-off resolved", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestId } = twoPlayerRoom(manager);
    manager.startRollOff(roomCode, hostId);
    manager.applyRollOffRoll(roomCode, hostId, roll(5, 5));
    manager.applyRollOffRoll(roomCode, guestId, roll(1, 2));

    const result = manager.beginRollOffGame(roomCode, hostId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.gameState).not.toBeNull();
    expect(result.value.room.status).toBe("inGame");
  });

  it("non-host cannot begin game", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestId } = twoPlayerRoom(manager);
    manager.startRollOff(roomCode, hostId);
    manager.applyRollOffRoll(roomCode, hostId, roll(5, 5));
    manager.applyRollOffRoll(roomCode, guestId, roll(1, 2));

    const result = manager.beginRollOffGame(roomCode, guestId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/host/i);
  });

  it("cannot begin game before all rolls resolved", () => {
    const manager = new RoomManager();
    const { roomCode, hostId } = twoPlayerRoom(manager);
    manager.startRollOff(roomCode, hostId);
    // Only host rolls; guest hasn't
    manager.applyRollOffRoll(roomCode, hostId, roll(5, 5));

    const result = manager.beginRollOffGame(roomCode, hostId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not resolved/i);
  });

  it("cannot begin game before roll-off starts", () => {
    const manager = new RoomManager();
    const { roomCode, hostId } = twoPlayerRoom(manager);
    // Don't start roll-off
    const result = manager.beginRollOffGame(roomCode, hostId);
    expect(result.ok).toBe(false);
  });

  it("game starts with resolved order — winner of roll-off goes first", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestId } = twoPlayerRoom(manager);
    manager.startRollOff(roomCode, hostId);
    // Guest rolls higher
    manager.applyRollOffRoll(roomCode, guestId, roll(6, 6));
    manager.applyRollOffRoll(roomCode, hostId, roll(1, 1));

    const result = manager.beginRollOffGame(roomCode, hostId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.gameState!.players[0].id).toBe(guestId);
  });

  it("game starts with correct player count", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestId } = twoPlayerRoom(manager);
    manager.startRollOff(roomCode, hostId);
    manager.applyRollOffRoll(roomCode, hostId, roll(4, 4));
    manager.applyRollOffRoll(roomCode, guestId, roll(2, 2));
    const result = manager.beginRollOffGame(roomCode, hostId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.gameState!.players).toHaveLength(2);
  });

  it("allRolls accumulated and visible in public view", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestId } = twoPlayerRoom(manager);
    manager.startRollOff(roomCode, hostId);
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    manager.applyRollOffRoll(roomCode, guestId, roll(5, 6));
    const view = manager.getRoom(roomCode)!;
    expect(view.rollOff!.allRolls).toHaveProperty(hostId);
    expect(view.rollOff!.allRolls).toHaveProperty(guestId);
    expect(view.rollOff!.allRolls[hostId].total).toBe(7);
    expect(view.rollOff!.allRolls[guestId].total).toBe(11);
  });

  it("allRolls from previous rounds are preserved after re-roll", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestId } = twoPlayerRoom(manager);
    manager.startRollOff(roomCode, hostId);
    // Round 1: tie (both 7)
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    manager.applyRollOffRoll(roomCode, guestId, roll(4, 3));

    // Round 2: host wins
    manager.applyRollOffRoll(roomCode, hostId, roll(6, 5));
    manager.applyRollOffRoll(roomCode, guestId, roll(2, 2));

    const view = manager.getRoom(roomCode)!;
    // allRolls should have round 2 results (overwritten)
    expect(view.rollOff!.allRolls[hostId].total).toBe(11);
    expect(view.rollOff!.allRolls[guestId].total).toBe(4);
  });
});

describe("server source assertions", () => {
  const src = require("fs").readFileSync(require("path").join(process.cwd(), "server/index.ts"), "utf-8") as string;

  it("has rolloff:beginGame socket handler", () => {
    expect(src).toMatch(/rolloff:beginGame/);
  });

  it("rolloff:roll no longer emits game:state directly on completion", () => {
    // After our change, game:state is only emitted from beginGame handler
    const rollHandler = src.match(/socket\.on\("rolloff:roll"[\s\S]*?^\s*\}\);/m)?.[0] ?? "";
    expect(rollHandler).not.toMatch(/game:state/);
  });

  it("beginGame handler emits game:state", () => {
    const beginHandler = src.match(/socket\.on\("rolloff:beginGame"[\s\S]*?^\s*\}\);/m)?.[0] ?? "";
    expect(beginHandler).toMatch(/game:state/);
  });

  it("beginGame handler calls rooms.beginRollOffGame", () => {
    const beginHandler = src.match(/socket\.on\("rolloff:beginGame"[\s\S]*?^\s*\}\);/m)?.[0] ?? "";
    expect(beginHandler).toMatch(/beginRollOffGame/);
  });
});
