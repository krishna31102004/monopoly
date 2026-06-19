import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "src");
function read(rel: string) { return readFileSync(join(ROOT, rel), "utf-8"); }

// ── Pure gate logic helpers ───────────────────────────────────────────────────

/**
 * Simulates movement gate: returns true when movement may proceed.
 * The gate opens after DICE_ROLL_MS + DICE_RESULT_HOLD_MS from when the
 * dice key changed.
 */
function isMovementAllowed(
  diceKeyChangedAtMs: number,
  movementGateMs: number,
  queryAtMs: number,
): boolean {
  return queryAtMs >= diceKeyChangedAtMs + movementGateMs;
}

describe("movement gate logic", () => {
  const DICE_ROLL_MS = 700;
  const DICE_RESULT_HOLD_MS = 500;
  const MOVEMENT_GATE_MS = DICE_ROLL_MS + DICE_RESULT_HOLD_MS; // 1200ms

  it("movement is blocked immediately after a dice roll", () => {
    expect(isMovementAllowed(0, MOVEMENT_GATE_MS, 0)).toBe(false);
  });

  it("movement is blocked at DICE_ROLL_MS (dice still animating)", () => {
    expect(isMovementAllowed(0, MOVEMENT_GATE_MS, DICE_ROLL_MS)).toBe(false);
  });

  it("movement is blocked just before gate opens", () => {
    expect(isMovementAllowed(0, MOVEMENT_GATE_MS, MOVEMENT_GATE_MS - 1)).toBe(false);
  });

  it("movement is allowed exactly when gate opens", () => {
    expect(isMovementAllowed(0, MOVEMENT_GATE_MS, MOVEMENT_GATE_MS)).toBe(true);
  });

  it("movement is allowed after gate opens", () => {
    expect(isMovementAllowed(0, MOVEMENT_GATE_MS, MOVEMENT_GATE_MS + 500)).toBe(true);
  });

  it("gate is relative to when diceKey changed, not time 0", () => {
    const changeAt = 3000;
    expect(isMovementAllowed(changeAt, MOVEMENT_GATE_MS, changeAt + MOVEMENT_GATE_MS - 1)).toBe(false);
    expect(isMovementAllowed(changeAt, MOVEMENT_GATE_MS, changeAt + MOVEMENT_GATE_MS)).toBe(true);
  });

  it("no dice key change means no gate — movement always allowed", () => {
    // Represented by gatedUntilRef = 0 (past epoch)
    expect(isMovementAllowed(0, 0, 1)).toBe(true);
  });
});

// ── Source-text assertions for usePlayerMovementAnimation ────────────────────

describe("usePlayerMovementAnimation — gating source assertions", () => {
  const src = read("hooks/usePlayerMovementAnimation.ts");

  it("accepts diceKey parameter", () => {
    expect(src).toMatch(/diceKey.*string.*null/);
  });

  it("defines MOVEMENT_GATE_MS as DICE_ROLL_MS + DICE_RESULT_HOLD_MS", () => {
    expect(src).toMatch(/MOVEMENT_GATE_MS/);
    expect(src).toMatch(/DICE_ROLL_MS.*\+.*DICE_RESULT_HOLD_MS|DICE_RESULT_HOLD_MS.*\+.*DICE_ROLL_MS/);
  });

  it("uses gatedUntilRef to track gate expiry timestamp", () => {
    expect(src).toMatch(/gatedUntilRef/);
  });

  it("queues positions into pendingPositionsRef when gated", () => {
    expect(src).toMatch(/pendingPositionsRef/);
    expect(src).toMatch(/isGated/);
  });

  it("schedules self-ungate via ungateTimerRef", () => {
    expect(src).toMatch(/ungateTimerRef/);
    expect(src).toMatch(/setUngateTick/);
  });

  it("uses ungateTick as effect dependency to re-run when gate opens", () => {
    expect(src).toMatch(/ungateTick/);
  });

  it("diceKey effect defined before movement effect (fires first)", () => {
    const diceKeyEffectIdx = src.indexOf("prevDiceKeyRef");
    const movementEffectIdx = src.indexOf("isGated");
    expect(diceKeyEffectIdx).toBeLessThan(movementEffectIdx);
  });

  it("applies pending positions when ungate fires", () => {
    expect(src).toMatch(/pendingPositionsRef\.current.*null|pendingPositionsRef\.current \?\?/);
  });
});

// ── Source-text assertions for useGameplayPresentation ───────────────────────

describe("useGameplayPresentation — sequencing source assertions", () => {
  const src = read("hooks/useGameplayPresentation.ts");

  it("does NOT export movementGated (self-gating moved to movement hook)", () => {
    // movementGated should not be in the return statement
    const returnBlock = src.match(/return \{[\s\S]*?\};/)?.[0] ?? "";
    expect(returnBlock).not.toMatch(/movementGated/);
  });

  it("transitions to rollingDice phase on new dice key", () => {
    expect(src).toMatch(/rollingDice/);
  });

  it("transitions to showingDiceResult after DICE_ROLL_MS", () => {
    expect(src).toMatch(/showingDiceResult/);
    expect(src).toMatch(/DICE_ROLL_MS/);
  });

  it("fallback timer fires after DICE_ROLL_MS + DICE_RESULT_HOLD_MS + buffer", () => {
    // Fallback must be after the movement gate to avoid premature reveal
    expect(src).toMatch(/DICE_RESULT_HOLD_MS/);
    expect(src).toMatch(/LANDING_REVEAL_DELAY_MS/);
  });

  it("cancels fallback when movement starts (isAnimating goes true)", () => {
    expect(src).toMatch(/clearTimers/);
    expect(src).toMatch(/movingToken/);
  });

  it("reveals panels after movement ends (isAnimating goes false)", () => {
    expect(src).toMatch(/landing/);
    expect(src).toMatch(/LANDING_REVEAL_DELAY_MS/);
  });
});

// ── Source-text assertions for GameLayout wiring ─────────────────────────────

describe("GameLayout — diceKey wiring source assertions", () => {
  const src = read("components/GameLayout.tsx");

  it("computes diceKey from state", () => {
    expect(src).toMatch(/diceKey/);
    expect(src).toMatch(/currentPlayerIndex.*doublesCount.*die1.*die2|die1.*die2.*currentPlayerIndex/);
  });

  it("passes diceKey to usePlayerMovementAnimation", () => {
    expect(src).toMatch(/usePlayerMovementAnimation.*diceKey|usePlayerMovementAnimation\(.*players.*diceKey/);
  });

  it("calls usePlayerMovementAnimation before useGameplayPresentation", () => {
    const movIdx = src.indexOf("usePlayerMovementAnimation");
    const presIdx = src.indexOf("useGameplayPresentation");
    expect(movIdx).toBeLessThan(presIdx);
  });
});

describe("GameLayoutMultiplayer — diceKey wiring source assertions", () => {
  const src = read("components/multiplayer/GameLayoutMultiplayer.tsx");

  it("computes diceKey from gameState", () => {
    expect(src).toMatch(/diceKey/);
    expect(src).toMatch(/gameState\.diceRoll/);
  });

  it("passes diceKey to usePlayerMovementAnimation", () => {
    expect(src).toMatch(/usePlayerMovementAnimation.*diceKey|usePlayerMovementAnimation\(.*players.*diceKey/);
  });
});
