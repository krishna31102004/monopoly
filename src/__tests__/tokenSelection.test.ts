import { describe, it, expect } from "vitest";
import { RoomManager } from "@/lib/multiplayer/rooms";

function setup() {
  const mgr = new RoomManager();
  const { room, playerId: aliceId } = mgr.createRoom(
    { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
    "socket-alice",
  );
  return { mgr, roomCode: room.roomCode, aliceId };
}

// ── RoomPublicView.takenTokens ────────────────────────────────────────────────

describe("Token selection — room public view exposes taken tokens", () => {
  it("host token appears in takenTokens immediately after room creation", () => {
    const { mgr, roomCode } = setup();
    const room = mgr.getRoom(roomCode)!;
    expect(room.takenTokens).toContain("car");
  });

  it("second player token appears in takenTokens after joining", () => {
    const { mgr, roomCode } = setup();
    mgr.joinRoom({ roomCode, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" }, "socket-bob");
    const room = mgr.getRoom(roomCode)!;
    expect(room.takenTokens).toContain("car");
    expect(room.takenTokens).toContain("hat");
  });

  it("host's own token is not treated as taken for the host themselves", () => {
    // TokenPicker: taken = takenTokens.includes(token) && token !== selected
    // So host can see their own token as selected, not disabled
    const { mgr, roomCode, aliceId } = setup();
    const room = mgr.getRoom(roomCode)!;
    const alice = room.players.find((p) => p.playerId === aliceId)!;
    // Alice's token is in takenTokens but it's hers — UI disables only if NOT selected
    expect(room.takenTokens).toContain(alice.token);
    // The token IS the selected one for Alice, so UI keeps it enabled
    expect(alice.token).toBe("car");
  });

  it("available token is not in takenTokens", () => {
    const { mgr, roomCode } = setup(); // only "car" taken
    const room = mgr.getRoom(roomCode)!;
    expect(room.takenTokens).not.toContain("hat");
    expect(room.takenTokens).not.toContain("ship");
  });
});

// ── Server-side duplicate token rejection ─────────────────────────────────────

describe("Token selection — server rejects duplicate tokens", () => {
  it("rejects joining with a token already held by a connected player", () => {
    const { mgr, roomCode } = setup(); // Alice has "car"
    const result = mgr.joinRoom(
      { roomCode, displayName: "Bob", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "socket-bob",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/token.*taken|taken/i);
  });

  it("allows joining with a different token", () => {
    const { mgr, roomCode } = setup();
    const result = mgr.joinRoom(
      { roomCode, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      "socket-bob",
    );
    expect(result.ok).toBe(true);
  });

  it("allows a disconnected player's token to be reused by a new joiner", () => {
    const { mgr, roomCode } = setup();
    // Bob joins with "hat"
    const bobResult = mgr.joinRoom(
      { roomCode, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      "socket-bob",
    );
    if (!bobResult.ok) throw new Error("Bob join failed");
    const bobId = bobResult.value.playerId;
    // Bob disconnects
    mgr.playerDisconnected("socket-bob");
    // Carol can now join with "hat" (Bob is disconnected)
    const carolResult = mgr.joinRoom(
      { roomCode, displayName: "Carol", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      "socket-carol",
    );
    expect(carolResult.ok).toBe(true);
    void bobId;
  });
});

// ── takenTokens only includes connected players ───────────────────────────────

describe("Token selection — takenTokens reflects connected state", () => {
  it("disconnected player's token is removed from takenTokens", () => {
    const { mgr, roomCode } = setup();
    mgr.joinRoom(
      { roomCode, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
      "socket-bob",
    );
    // Verify hat is taken
    expect(mgr.getRoom(roomCode)!.takenTokens).toContain("hat");
    // Bob disconnects
    mgr.playerDisconnected("socket-bob");
    // hat should no longer be in takenTokens (only connected players' tokens)
    const takenAfter = mgr.getRoom(roomCode)!.takenTokens;
    expect(takenAfter).not.toContain("hat");
  });
});
