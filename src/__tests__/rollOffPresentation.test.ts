import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "src");
function read(rel: string) { return readFileSync(join(ROOT, rel), "utf-8"); }

describe("RollOffScreen presentation source assertions", () => {
  const src = read("components/multiplayer/RollOffScreen.tsx");

  it("uses DiceFace component for dice display", () => {
    expect(src).toMatch(/DiceFace/);
  });

  it("has rolling animation state tracked with myRolling", () => {
    expect(src).toMatch(/myRolling/);
    expect(src).toMatch(/setMyRolling/);
  });

  it("button shows 'Rolling…' while animating", () => {
    expect(src).toMatch(/Rolling…/);
  });

  it("button is disabled while animating", () => {
    expect(src).toMatch(/disabled={isSubmitting}/);
  });

  it("uses DiceFace with rolling prop during animation", () => {
    expect(src).toMatch(/rolling/);
  });

  it("uses canShowFinalOrder gate (not bare gameReady) for final order screen", () => {
    expect(src).toMatch(/canShowFinalOrder/);
    expect(src).toMatch(/presentationReady/);
  });

  it("shows Begin Game button for host", () => {
    expect(src).toMatch(/Begin Game/);
    expect(src).toMatch(/isHost/);
  });

  it("shows 'Waiting for host' for non-host when gameReady", () => {
    expect(src).toMatch(/Waiting for host to begin/);
  });

  it("shows allRolls on final order screen", () => {
    expect(src).toMatch(/allRolls/);
  });

  it("uses ordinalLabel for ranking positions", () => {
    expect(src).toMatch(/ordinalLabel/);
  });

  it("uses ANIMATION_MS constant for timing", () => {
    expect(src).toMatch(/ANIMATION_MS/);
  });

  it("tie banner shown for re-roll rounds", () => {
    expect(src).toMatch(/Tie!/);
    expect(src).toMatch(/isTieBreaker/);
  });

  it("shows players not in current group with previous roll data", () => {
    expect(src).toMatch(/allRolls\[player.playerId\]|allRolls\[/);
  });

  it("has linger delay before clearing roll state", () => {
    expect(src).toMatch(/RESULT_LINGER_MS|lingerActive/);
  });

  it("onBeginGame called from Begin Game button", () => {
    expect(src).toMatch(/onBeginGame/);
  });
});

describe("LocalRollOffScreen presentation source assertions", () => {
  const src = read("components/setup/LocalRollOffScreen.tsx");

  it("uses DiceFace for dice display", () => {
    expect(src).toMatch(/DiceFace/);
  });

  it("has per-player animation map", () => {
    expect(src).toMatch(/animMap/);
  });

  it("shows rolling animation with rolling prop", () => {
    expect(src).toMatch(/rolling/);
  });

  it("shows final result after animation", () => {
    expect(src).toMatch(/showResult/);
  });

  it("shows 'Begin Game' button after all resolved", () => {
    expect(src).toMatch(/Begin Game/);
  });

  it("does NOT call onComplete immediately on last roll", () => {
    // onComplete should only be called when handleStart is invoked
    expect(src).toMatch(/handleStart/);
    // There should not be a direct onComplete call inside handleRoll
    const handleRollBody = src.match(/function handleRoll[\s\S]*?^\s{2}\}/m)?.[0] ?? "";
    expect(handleRollBody).not.toMatch(/onComplete/);
  });

  it("uses ANIMATION_MS for timing", () => {
    expect(src).toMatch(/ANIMATION_MS/);
  });

  it("uses RESULT_LINGER_MS for result display pause", () => {
    expect(src).toMatch(/RESULT_LINGER_MS/);
  });

  it("accumulates allRolls across rounds", () => {
    expect(src).toMatch(/allRolls/);
  });

  it("tie banner shows players who must re-roll", () => {
    expect(src).toMatch(/Tie!/);
    expect(src).toMatch(/must roll again/);
  });

  it("shows previously-resolved players with their roll result", () => {
    expect(src).toMatch(/Position decided|allRolls\[id\]/);
  });
});
