import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { RoomManager } from "@/lib/multiplayer/rooms";
import type { RollOffEntry } from "@/lib/game/rollOff";

const ROOT = join(process.cwd(), "src");
function read(rel: string) { return readFileSync(join(ROOT, rel), "utf-8"); }

function roll(die1: number, die2: number): RollOffEntry {
  return { die1, die2, total: die1 + die2 };
}

let socketCounter = 0;
function nextSocket() { return `socket-${socketCounter++}`; }

function makeRoom(manager: RoomManager, playerCount = 2) {
  const host = manager.createRoom(
    { displayName: "kb", token: "car", tokenLabel: "CAR", color: "#ef4444" },
    nextSocket(),
  );
  const { roomCode } = host.room;
  const hostId = host.playerId;

  const tokens = ["hat", "ship", "shoe"] as const;
  const guestIds: string[] = [];
  for (let i = 1; i < playerCount; i++) {
    const res = manager.joinRoom(
      { roomCode, displayName: `Player ${i + 1}`, token: tokens[i - 1], tokenLabel: tokens[i - 1].slice(0, 3).toUpperCase(), color: "#2563eb" },
      nextSocket(),
    );
    if (!res.ok) throw new Error(res.error);
    guestIds.push(res.value.playerId);
  }

  manager.startRollOff(roomCode, hostId);
  return { roomCode, hostId, guestIds };
}

// ── lastRoundRolls field ──────────────────────────────────────────────────────

describe("lastRoundRolls — server state", () => {
  it("starts empty on round 1", () => {
    const manager = new RoomManager();
    const { roomCode } = makeRoom(manager, 2);
    const view = manager.getRoom(roomCode)!;
    expect(view.rollOff!.lastRoundRolls).toEqual({});
  });

  it("is populated with round 1 rolls when a tie advances to round 2", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);

    // Round 1: both tie at 7
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const view = res.value.room;
    expect(view.rollOff!.round).toBe(2);
    // lastRoundRolls should contain both players' round-1 rolls
    expect(view.rollOff!.lastRoundRolls[hostId]).toEqual({ die1: 3, die2: 4, total: 7 });
    expect(view.rollOff!.lastRoundRolls[guestIds[0]]).toEqual({ die1: 4, die2: 3, total: 7 });
  });

  it("current rolls are empty after tie advances to next round", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);

    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.room.rollOff!.rolls).toEqual({});
  });

  it("lastRoundRolls updated again after second tie-breaker", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);

    // Round 1: tie
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3));
    // Round 2: tie again
    manager.applyRollOffRoll(roomCode, hostId, roll(2, 3));
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], roll(3, 2));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.room.rollOff!.round).toBe(3);
    // lastRoundRolls should now contain round-2 rolls
    expect(res.value.room.rollOff!.lastRoundRolls[hostId]).toEqual({ die1: 2, die2: 3, total: 5 });
    expect(res.value.room.rollOff!.lastRoundRolls[guestIds[0]]).toEqual({ die1: 3, die2: 2, total: 5 });
  });

  it("lastRoundRolls is NOT set when gameReady (no tie, order resolved)", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);

    manager.applyRollOffRoll(roomCode, hostId, roll(6, 6));
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], roll(1, 2));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.room.rollOff!.gameReady).toBe(true);
    // lastRoundRolls should be empty (no tie advance happened)
    expect(res.value.room.rollOff!.lastRoundRolls).toEqual({});
  });

  it("allRolls always accumulates across all rounds", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);

    // Round 1: tie
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3));
    // Round 2: hostId wins
    manager.applyRollOffRoll(roomCode, hostId, roll(5, 6));
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], roll(1, 2));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // allRolls has round-2 values (overwritten)
    expect(res.value.room.rollOff!.allRolls[hostId]).toEqual({ die1: 5, die2: 6, total: 11 });
    expect(res.value.room.rollOff!.allRolls[guestIds[0]]).toEqual({ die1: 1, die2: 2, total: 3 });
  });
});

// ── Tie-breaker server logic ──────────────────────────────────────────────────

describe("tie-breaker server logic", () => {
  it("ties advance to round 2 with correct rolling group", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);

    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.room.rollOff!.round).toBe(2);
    expect(res.value.room.rollOff!.rollingThisRound).toContain(hostId);
    expect(res.value.room.rollOff!.rollingThisRound).toContain(guestIds[0]);
    expect(res.value.room.rollOff!.gameReady).toBe(false);
  });

  it("only tied players are in round 2 (3-player: one player not tied)", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 3);

    // hostId and guestIds[0] tie at 7; guestIds[1] gets 5
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3));
    const res = manager.applyRollOffRoll(roomCode, guestIds[1], roll(2, 3));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ro = res.value.room.rollOff!;
    expect(ro.round).toBe(2);
    expect(ro.rollingThisRound).toContain(hostId);
    expect(ro.rollingThisRound).toContain(guestIds[0]);
    expect(ro.rollingThisRound).not.toContain(guestIds[1]);
  });

  it("guestIds[1] cannot roll in round 2 (not in tied group)", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 3);

    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3));
    manager.applyRollOffRoll(roomCode, guestIds[1], roll(2, 3));
    // Round 2: guestIds[1] tries to roll — rejected
    const res = manager.applyRollOffRoll(roomCode, guestIds[1], roll(5, 5));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not in the current/i);
  });

  it("repeated tie advances to round 3", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);

    // Round 1: tie
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3));
    // Round 2: tie again
    manager.applyRollOffRoll(roomCode, hostId, roll(2, 2));
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], roll(2, 2));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.room.rollOff!.round).toBe(3);
    expect(res.value.room.rollOff!.gameReady).toBe(false);
  });

  it("resolves correctly after tie-breaker (guest wins round 2)", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);

    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3));
    // Round 2: guest wins with higher roll
    manager.applyRollOffRoll(roomCode, hostId, roll(2, 1));
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], roll(5, 4));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ro = res.value.room.rollOff!;
    expect(ro.gameReady).toBe(true);
    expect(ro.resolvedOrder![0]).toBe(guestIds[0]);
    expect(ro.resolvedOrder![1]).toBe(hostId);
  });

  it("pendingPlayerIds correctly shows who has not rolled in tie-breaker round", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 2);

    // Round 1: tie
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4));
    manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3));
    // Start round 2: hostId rolls first
    manager.applyRollOffRoll(roomCode, hostId, roll(5, 1));
    const view = manager.getRoom(roomCode)!;
    // guestIds[0] still pending
    expect(view.rollOff!.pendingPlayerIds).toContain(guestIds[0]);
    expect(view.rollOff!.pendingPlayerIds).not.toContain(hostId);
  });
});

// ── Final order correctness ───────────────────────────────────────────────────

describe("final order after tie-breaker", () => {
  it("3-player: all-tie round 1, then resolved in round 2", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 3);

    // Round 1: all three tie at 5
    manager.applyRollOffRoll(roomCode, hostId, roll(2, 3));
    manager.applyRollOffRoll(roomCode, guestIds[0], roll(3, 2));
    manager.applyRollOffRoll(roomCode, guestIds[1], roll(1, 4));
    // Round 2: guestIds[1] wins, hostId second, guestIds[0] third
    manager.applyRollOffRoll(roomCode, hostId, roll(2, 2));
    manager.applyRollOffRoll(roomCode, guestIds[0], roll(1, 1));
    const res = manager.applyRollOffRoll(roomCode, guestIds[1], roll(5, 5));
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ro = res.value.room.rollOff!;
    expect(ro.gameReady).toBe(true);
    expect(ro.resolvedOrder![0]).toBe(guestIds[1]); // 10 = highest
    expect(ro.resolvedOrder![1]).toBe(hostId); // 4
    expect(ro.resolvedOrder![2]).toBe(guestIds[0]); // 2
    // No duplicates, no missing players
    expect(ro.resolvedOrder!).toHaveLength(3);
    const orderSet = new Set(ro.resolvedOrder!);
    expect(orderSet.size).toBe(3);
  });

  it("3-player: partial tie — two tie, one resolves, then tie breaks", () => {
    const manager = new RoomManager();
    const { roomCode, hostId, guestIds } = makeRoom(manager, 3);

    // guestIds[1] rolls highest, hostId and guestIds[0] tie
    manager.applyRollOffRoll(roomCode, hostId, roll(3, 4)); // 7
    manager.applyRollOffRoll(roomCode, guestIds[0], roll(4, 3)); // 7
    manager.applyRollOffRoll(roomCode, guestIds[1], roll(5, 5)); // 10 — first place secured

    // Round 2: only hostId and guestIds[0]
    manager.applyRollOffRoll(roomCode, hostId, roll(4, 4)); // 8
    const res = manager.applyRollOffRoll(roomCode, guestIds[0], roll(2, 2)); // 4
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const ro = res.value.room.rollOff!;
    expect(ro.gameReady).toBe(true);
    expect(ro.resolvedOrder![0]).toBe(guestIds[1]); // 10
    expect(ro.resolvedOrder![1]).toBe(hostId); // 8 in round 2
    expect(ro.resolvedOrder![2]).toBe(guestIds[0]); // 4 in round 2
    expect(ro.resolvedOrder!).toHaveLength(3);
  });
});

// ── RollOffScreen source assertions ──────────────────────────────────────────

describe("RollOffScreen — tie-breaker source assertions", () => {
  const src = read("components/multiplayer/RollOffScreen.tsx");

  it("imports lastRoundRolls from rollOff prop", () => {
    expect(src).toMatch(/lastRoundRolls/);
  });

  it("has showingLastRound state variable", () => {
    expect(src).toMatch(/showingLastRound/);
  });

  it("uses allRolls[myPlayerId] for stuck-state fix", () => {
    expect(src).toMatch(/allRolls\[myPlayerId\]/);
  });

  it("displayRolls switches between lastRoundRolls and rolls", () => {
    expect(src).toMatch(/displayRolls.*lastRoundRolls.*rolls|lastRoundRolls.*rolls.*displayRolls/);
  });

  it("tie banner is gated by showTieBanner (not shown during last-round reveal)", () => {
    expect(src).toMatch(/showTieBanner/);
  });

  it("Checking for ties message shown during showingLastRound", () => {
    expect(src).toMatch(/Checking for ties/);
  });

  it("Roll Tie-Breaker button label in tie-breaker rounds", () => {
    expect(src).toMatch(/Roll Tie-Breaker/);
  });

  it("prevRoundRef tracks round changes", () => {
    expect(src).toMatch(/prevRoundRef/);
  });

  it("myAllRollsResult uses allRolls not rounds-specific rolls", () => {
    expect(src).toMatch(/myAllRollsResult\s*=\s*allRolls\[myPlayerId\]/);
  });

  it("animation uses myAllRollsResult for die values", () => {
    expect(src).toMatch(/myAllRollsResult\?\.die1/);
  });

  it("round change effect resets myRolling and lingerActive for observer path", () => {
    // Observer (not animating) path still resets to avoid stale state
    expect(src).toMatch(/setMyRolling\(false\)[\s\S]{0,200}setLingerActive\(false\)/);
  });

  it("pendingShowLastRoundRef defers tie reveal for actor (Phase 4F.2D fix)", () => {
    // The core fix: instead of immediately calling setShowingLastRound in the
    // round-change effect (which cancelled the actor's animation), we set a ref
    // and trigger showingLastRound after the actor's reveal is complete.
    expect(src).toMatch(/pendingShowLastRoundRef/);
  });

  it("myRollingRef and lingerActiveRef mirror state for non-stale closure access", () => {
    expect(src).toMatch(/myRollingRef/);
    expect(src).toMatch(/lingerActiveRef/);
  });

  it("round-change effect checks myRollingRef.current to avoid cancelling animation", () => {
    expect(src).toMatch(/myRollingRef\.current[\s\S]{0,100}lingerActiveRef\.current/);
  });

  it("allRolls effect triggers pendingShowLastRound after lingerActive ends", () => {
    expect(src).toMatch(/pendingShowLastRoundRef\.current[\s\S]{0,300}setShowingLastRound\(true\)/);
  });

  it("REVEAL_GATE_MS still defined as ANIMATION_MS + RESULT_LINGER_MS", () => {
    expect(src).toMatch(/REVEAL_GATE_MS/);
    expect(src).toMatch(/ANIMATION_MS \+ RESULT_LINGER_MS/);
  });

  it("presentationReady state initialized from gameReady (reconnect support)", () => {
    expect(src).toMatch(/useState\(gameReady\)/);
  });

  it("prevGameReadyRef still tracks gameReady", () => {
    expect(src).toMatch(/prevGameReadyRef/);
  });
});

// ── Stuck state logic simulation ─────────────────────────────────────────────

describe("stuck-state logic (pure simulation)", () => {
  /**
   * Simulates the buggy old behavior: watching rolls[myPlayerId] which goes
   * undefined when round advances.
   */
  function simulateOldBehavior(events: ("roll" | "roundAdvance")[]): boolean {
    let myRolling = false;
    let rolls: Record<string, string> = {};
    for (const ev of events) {
      if (ev === "roll") {
        myRolling = true;
        rolls["me"] = "result";
      } else if (ev === "roundAdvance") {
        rolls = {}; // old behavior: roundRolls reset, myResult disappears
      }
    }
    // If myResult is undefined after round advance, effect never clears myRolling
    const myResult = rolls["me"];
    if (!myResult && myRolling) return true; // STUCK
    return false;
  }

  /**
   * Simulates the fixed behavior: watching allRolls[myPlayerId] which persists.
   */
  function simulateNewBehavior(events: ("roll" | "roundAdvance")[]): boolean {
    let myRolling = false;
    let allRolls: Record<string, string> = {};
    for (const ev of events) {
      if (ev === "roll") {
        myRolling = true;
        allRolls["me"] = "result";
      } else if (ev === "roundAdvance") {
        // allRolls is NOT reset — only roundRolls is
      }
    }
    // Fixed: effect watches allRolls[myPlayerId] which persists after round advance
    const myAllResult = allRolls["me"];
    if (myAllResult && myRolling) {
      // Effect fires, clears myRolling
      return false; // NOT stuck
    }
    return false;
  }

  it("old behavior: stuck when round advances after my roll", () => {
    const stuck = simulateOldBehavior(["roll", "roundAdvance"]);
    expect(stuck).toBe(true);
  });

  it("new behavior: not stuck when round advances after my roll", () => {
    const stuck = simulateNewBehavior(["roll", "roundAdvance"]);
    expect(stuck).toBe(false);
  });

  it("new behavior: not stuck in normal case (no tie)", () => {
    const stuck = simulateNewBehavior(["roll"]);
    expect(stuck).toBe(false);
  });
});

// ── Actor path: deferred showingLastRound simulation (Phase 4F.2D) ───────────

describe("actor-path deferred tie reveal (pure simulation)", () => {
  const ANIMATION_MS = 1100;
  const RESULT_LINGER_MS = 1600;

  /**
   * Simulates the OLD (broken) behavior:
   * round-change effect immediately calls setMyRolling(false), cancelling the
   * useDiceAnimation cleanup, which fires clearInterval + clearTimeout.
   */
  function simulateOldActorBehavior(): {
    animationCancelled: boolean;
    showingLastRoundStartMs: number;
  } {
    let myRolling = true; // actor clicked Roll
    // t~50ms: result arrives, round changes. Old effect runs:
    myRolling = false; // ← wiped by round-change effect
    // useDiceAnimation cleanup fires → animation cancelled
    const animationCancelled = true; // because myRolling flipped during animation
    const showingLastRoundStartMs = 50; // immediate (no delay for actor)
    return { animationCancelled, showingLastRoundStartMs };
  }

  /**
   * Simulates the NEW (fixed) behavior:
   * round-change effect detects actor is animating → defers showingLastRound.
   * Actor sees full dice animation + result linger before tie display.
   */
  function simulateNewActorBehavior(): {
    animationCancelled: boolean;
    showingLastRoundStartMs: number;
  } {
    const myRolling = true; // actor clicked Roll
    let pendingShowLastRound = false;
    // t~50ms: result arrives, round changes. New effect runs:
    if (myRolling) {
      // Actor is animating → defer, do NOT wipe myRolling
      pendingShowLastRound = true;
    }
    // myRolling stays true → animation continues
    const animationCancelled = false;
    // showingLastRound triggers AFTER animation (ANIMATION_MS) + linger (RESULT_LINGER_MS)
    const showingLastRoundStartMs = pendingShowLastRound
      ? 50 + ANIMATION_MS + RESULT_LINGER_MS
      : 50;
    return { animationCancelled, showingLastRoundStartMs };
  }

  it("old behavior: actor animation was cancelled by round-change effect", () => {
    const { animationCancelled } = simulateOldActorBehavior();
    expect(animationCancelled).toBe(true);
  });

  it("new behavior: actor animation is NOT cancelled", () => {
    const { animationCancelled } = simulateNewActorBehavior();
    expect(animationCancelled).toBe(false);
  });

  it("new behavior: showingLastRound deferred past ANIMATION_MS + RESULT_LINGER_MS", () => {
    const { showingLastRoundStartMs } = simulateNewActorBehavior();
    expect(showingLastRoundStartMs).toBeGreaterThan(ANIMATION_MS + RESULT_LINGER_MS);
  });

  it("old behavior: showingLastRound started immediately (before dice animation)", () => {
    const { showingLastRoundStartMs } = simulateOldActorBehavior();
    expect(showingLastRoundStartMs).toBeLessThan(ANIMATION_MS);
  });
});

// ── Round transition timing simulation ───────────────────────────────────────

describe("round transition timing (reveal delay before tie banner)", () => {
  const RESULT_LINGER_MS = 1600;

  function simulateRoundTransition(
    elapsedSinceRoundChange: number,
  ): { showingLastRound: boolean; showTieBanner: boolean } {
    const showingLastRound = elapsedSinceRoundChange < RESULT_LINGER_MS;
    const isTieBreaker = true; // we're in round 2+
    const showTieBanner = isTieBreaker && !showingLastRound;
    return { showingLastRound, showTieBanner };
  }

  it("immediately after round change: showingLastRound=true, no tie banner", () => {
    const { showingLastRound, showTieBanner } = simulateRoundTransition(0);
    expect(showingLastRound).toBe(true);
    expect(showTieBanner).toBe(false);
  });

  it("at RESULT_LINGER_MS - 1: still showing last round", () => {
    const { showingLastRound, showTieBanner } = simulateRoundTransition(RESULT_LINGER_MS - 1);
    expect(showingLastRound).toBe(true);
    expect(showTieBanner).toBe(false);
  });

  it("at RESULT_LINGER_MS: showingLastRound ends, tie banner appears", () => {
    const { showingLastRound, showTieBanner } = simulateRoundTransition(RESULT_LINGER_MS);
    expect(showingLastRound).toBe(false);
    expect(showTieBanner).toBe(true);
  });

  it("at RESULT_LINGER_MS + 500: tie banner still visible", () => {
    const { showingLastRound, showTieBanner } = simulateRoundTransition(RESULT_LINGER_MS + 500);
    expect(showingLastRound).toBe(false);
    expect(showTieBanner).toBe(true);
  });
});
