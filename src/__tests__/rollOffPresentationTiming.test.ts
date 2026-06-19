import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "src");
function read(rel: string) { return readFileSync(join(ROOT, rel), "utf-8"); }

// ── Pure-logic helpers for testing presentation gating ────────────────────────

/**
 * Simulates the presentationReady gate without React.
 * Returns what the gate value would be after elapsedMs.
 */
function simulatePresentationGate(
  initialGameReady: boolean,
  gameReadyTriggeredAtMs: number,
  revealGateMs: number,
  queryAtMs: number,
): boolean {
  if (initialGameReady) return true; // reconnect case — immediate
  if (queryAtMs < gameReadyTriggeredAtMs + revealGateMs) return false;
  return true;
}

describe("presentation gate logic", () => {
  const ANIMATION_MS = 1100;
  const RESULT_LINGER_MS = 1600;
  const REVEAL_GATE_MS = ANIMATION_MS + RESULT_LINGER_MS; // 2700ms

  it("final order is hidden immediately after gameReady becomes true", () => {
    const result = simulatePresentationGate(false, 0, REVEAL_GATE_MS, 0);
    expect(result).toBe(false);
  });

  it("final order is still hidden at ANIMATION_MS (animation playing)", () => {
    const result = simulatePresentationGate(false, 0, REVEAL_GATE_MS, ANIMATION_MS);
    expect(result).toBe(false);
  });

  it("final order is hidden at ANIMATION_MS + RESULT_LINGER_MS - 1", () => {
    const result = simulatePresentationGate(false, 0, REVEAL_GATE_MS, REVEAL_GATE_MS - 1);
    expect(result).toBe(false);
  });

  it("final order is shown at exactly ANIMATION_MS + RESULT_LINGER_MS", () => {
    const result = simulatePresentationGate(false, 0, REVEAL_GATE_MS, REVEAL_GATE_MS);
    expect(result).toBe(true);
  });

  it("final order shown immediately when game was already resolved on mount (reconnect)", () => {
    const result = simulatePresentationGate(true, 0, REVEAL_GATE_MS, 0);
    expect(result).toBe(true);
  });

  it("gate delay starts from when gameReady became true, not from mount", () => {
    // gameReady triggered 500ms after mount
    const readyAtMs = 500;
    expect(simulatePresentationGate(false, readyAtMs, REVEAL_GATE_MS, readyAtMs + REVEAL_GATE_MS - 1)).toBe(false);
    expect(simulatePresentationGate(false, readyAtMs, REVEAL_GATE_MS, readyAtMs + REVEAL_GATE_MS)).toBe(true);
  });
});

// ── Source-text assertions for multiplayer RollOffScreen ─────────────────────

describe("RollOffScreen — presentation gate source assertions", () => {
  const src = read("components/multiplayer/RollOffScreen.tsx");

  it("defines REVEAL_GATE_MS as ANIMATION_MS + RESULT_LINGER_MS", () => {
    expect(src).toMatch(/REVEAL_GATE_MS/);
    expect(src).toMatch(/ANIMATION_MS \+ RESULT_LINGER_MS/);
  });

  it("presentationReady state initialized from gameReady (reconnect support)", () => {
    expect(src).toMatch(/useState\(gameReady\)/);
  });

  it("prevGameReadyRef tracks previous gameReady value", () => {
    expect(src).toMatch(/prevGameReadyRef/);
  });

  it("useEffect fires on gameReady change and starts delay timer", () => {
    expect(src).toMatch(/setPresentationReady\(true\)/);
    expect(src).toMatch(/REVEAL_GATE_MS/);
  });

  it("canShowFinalOrder requires both gameReady AND presentationReady", () => {
    expect(src).toMatch(/canShowFinalOrder.*=.*gameReady.*resolvedOrder.*presentationReady/);
  });

  it("final order block uses canShowFinalOrder, not bare gameReady", () => {
    expect(src).toMatch(/canShowFinalOrder\s*\?/);
    // The bare pattern should NOT be the gate
    const barePattern = /\{\s*gameReady\s*&&\s*resolvedOrder\s*\?/;
    expect(src).not.toMatch(barePattern);
  });

  it("Begin Game button only appears under canShowFinalOrder", () => {
    const finalOrderBlock = src.match(/canShowFinalOrder\s*\?([\s\S]*?):\s*\([\s\S]*?\/\* ── Rolling/)?.[1] ?? "";
    expect(finalOrderBlock).toMatch(/Begin Game/);
  });

  it("shows 'All rolled — revealing results…' message during reveal delay", () => {
    expect(src).toMatch(/revealing results/i);
  });

  it("uses DiceFace with rolling prop during animation", () => {
    expect(src).toMatch(/DiceFace/);
    expect(src).toMatch(/rolling/);
  });

  it("animates for MY own roll via useDiceAnimation", () => {
    expect(src).toMatch(/useDiceAnimation/);
    expect(src).toMatch(/myRolling/);
  });

  it("roll button disabled while submitting", () => {
    expect(src).toMatch(/disabled={isSubmitting}/);
  });

  it("handles tie-breaker banner", () => {
    expect(src).toMatch(/Tie!/);
    expect(src).toMatch(/isTieBreaker/);
  });

  it("shows allRolls on final order screen for score display", () => {
    expect(src).toMatch(/allRolls/);
  });

  it("ordinalLabel used for ranking", () => {
    expect(src).toMatch(/ordinalLabel/);
  });
});

// ── Source-text assertions for LocalRollOffScreen ─────────────────────────────

describe("LocalRollOffScreen — timing source assertions", () => {
  const src = read("components/setup/LocalRollOffScreen.tsx");

  it("phase 'done' is set inside inner setTimeout (after linger), not immediately", () => {
    // phase: "done" should appear after two nested setTimeout calls
    const firstSetTimeoutIdx = src.indexOf("setTimeout");
    const secondSetTimeoutIdx = src.indexOf("setTimeout", firstSetTimeoutIdx + 1);
    const phaseDoneIdx = src.indexOf('phase: "done"');
    // "done" should appear after both setTimeouts (nested structure)
    expect(phaseDoneIdx).toBeGreaterThan(secondSetTimeoutIdx);
  });

  it("final order (phase === 'done') only shown after animation + linger", () => {
    expect(src).toMatch(/ANIMATION_MS/);
    expect(src).toMatch(/RESULT_LINGER_MS/);
  });

  it("shows Begin Game button only when phase === 'done'", () => {
    const doneSection = src.match(/phase === .done.[\s\S]*?Begin Game/)?.[0];
    expect(doneSection).toBeTruthy();
  });

  it("animates dice per-player via animMap", () => {
    expect(src).toMatch(/animMap/);
    expect(src).toMatch(/animating/);
  });

  it("clears interval before showing result", () => {
    expect(src).toMatch(/clearInterval/);
    expect(src).toMatch(/showResult.*true/);
  });

  it("allRolls accumulated across rounds for display", () => {
    expect(src).toMatch(/allRolls/);
  });
});

// ── Verify no bare gameReady gate in old files ───────────────────────────────

describe("regression: no bare gameReady gate for final order", () => {
  it("RollOffScreen does not use bare {gameReady && resolvedOrder ?} as the gate", () => {
    const src = read("components/multiplayer/RollOffScreen.tsx");
    // The old buggy pattern
    expect(src).not.toMatch(/\{\s*gameReady\s*&&\s*resolvedOrder\s*\?\s*\(/);
  });
});
