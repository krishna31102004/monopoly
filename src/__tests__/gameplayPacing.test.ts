import { describe, it, expect } from "vitest";
import {
  DICE_ROLL_MS,
  DICE_RESULT_HOLD_MS,
  TOKEN_STEP_MS,
  TOKEN_LAND_MS,
  LANDING_REVEAL_DELAY_MS,
  CARD_REVEAL_MIN_MS,
} from "@/lib/animation/timing";
import {
  shouldHideLandingPanelDuringPresentation,
  shouldHideCardResolvedDuringPresentation,
  estimatePresentationDuration,
} from "@/lib/animation/presentationHelpers";
import type { GameplayPresentationPhase } from "@/hooks/useGameplayPresentation";

// ── Timing constants ─────────────────────────────────────────────────────────

describe("Animation timing constants", () => {
  it("DICE_ROLL_MS is at least 600ms", () => expect(DICE_ROLL_MS).toBeGreaterThanOrEqual(600));
  it("DICE_RESULT_HOLD_MS is at least 400ms", () => expect(DICE_RESULT_HOLD_MS).toBeGreaterThanOrEqual(400));
  it("TOKEN_STEP_MS is at least 300ms", () => expect(TOKEN_STEP_MS).toBeGreaterThanOrEqual(300));
  it("TOKEN_LAND_MS is positive", () => expect(TOKEN_LAND_MS).toBeGreaterThan(0));
  it("LANDING_REVEAL_DELAY_MS is at least 400ms", () => expect(LANDING_REVEAL_DELAY_MS).toBeGreaterThanOrEqual(400));
  it("CARD_REVEAL_MIN_MS is at least 800ms", () => expect(CARD_REVEAL_MIN_MS).toBeGreaterThanOrEqual(800));
});

// ── shouldHideLandingPanelDuringPresentation ─────────────────────────────────

describe("shouldHideLandingPanelDuringPresentation", () => {
  const hiddenPhases: GameplayPresentationPhase[] = [
    "rollingDice",
    "showingDiceResult",
    "movingToken",
    "landing",
    "revealingCard",
  ];
  const visiblePhases: GameplayPresentationPhase[] = ["idle", "showingOutcome"];

  for (const phase of hiddenPhases) {
    it(`hides landing panel during "${phase}"`, () => {
      expect(shouldHideLandingPanelDuringPresentation(phase)).toBe(true);
    });
  }

  for (const phase of visiblePhases) {
    it(`shows landing panel during "${phase}"`, () => {
      expect(shouldHideLandingPanelDuringPresentation(phase)).toBe(false);
    });
  }
});

// ── shouldHideCardResolvedDuringPresentation ──────────────────────────────────

describe("shouldHideCardResolvedDuringPresentation", () => {
  it("hides card resolved during rollingDice", () =>
    expect(shouldHideCardResolvedDuringPresentation("rollingDice")).toBe(true));
  it("hides card resolved during revealingCard (card shown, effect not yet)", () =>
    expect(shouldHideCardResolvedDuringPresentation("revealingCard")).toBe(true));
  it("shows card resolved during showingOutcome", () =>
    expect(shouldHideCardResolvedDuringPresentation("showingOutcome")).toBe(false));
  it("shows card resolved during idle", () =>
    expect(shouldHideCardResolvedDuringPresentation("idle")).toBe(false));
});

// ── Sequence order assertions ─────────────────────────────────────────────────

describe("Presentation sequence ordering", () => {
  it("dice roll phase happens before movement phase", () => {
    const sequence: GameplayPresentationPhase[] = [
      "rollingDice", "showingDiceResult", "movingToken", "landing", "showingOutcome",
    ];
    const diceIdx = sequence.indexOf("rollingDice");
    const moveIdx = sequence.indexOf("movingToken");
    expect(diceIdx).toBeLessThan(moveIdx);
  });

  it("dice result hold phase happens before movement phase", () => {
    const sequence: GameplayPresentationPhase[] = [
      "rollingDice", "showingDiceResult", "movingToken", "landing", "showingOutcome",
    ];
    const holdIdx = sequence.indexOf("showingDiceResult");
    const moveIdx = sequence.indexOf("movingToken");
    expect(holdIdx).toBeLessThan(moveIdx);
  });

  it("movement phase happens before landing outcome reveal", () => {
    const sequence: GameplayPresentationPhase[] = [
      "rollingDice", "showingDiceResult", "movingToken", "landing", "showingOutcome",
    ];
    const moveIdx = sequence.indexOf("movingToken");
    const outcomeIdx = sequence.indexOf("showingOutcome");
    expect(moveIdx).toBeLessThan(outcomeIdx);
  });

  it("revealingCard phase happens before showingOutcome", () => {
    const sequence: GameplayPresentationPhase[] = [
      "rollingDice", "showingDiceResult", "movingToken", "landing", "revealingCard", "showingOutcome",
    ];
    const cardIdx = sequence.indexOf("revealingCard");
    const outcomeIdx = sequence.indexOf("showingOutcome");
    expect(cardIdx).toBeLessThan(outcomeIdx);
  });

  it("landing panel hidden during every pre-outcome phase", () => {
    const preOutcomePhases: GameplayPresentationPhase[] = [
      "rollingDice", "showingDiceResult", "movingToken", "landing", "revealingCard",
    ];
    for (const phase of preOutcomePhases) {
      expect(shouldHideLandingPanelDuringPresentation(phase)).toBe(true);
    }
  });
});

// ── estimatePresentationDuration ─────────────────────────────────────────────

describe("estimatePresentationDuration", () => {
  it("increases with more steps", () => {
    expect(estimatePresentationDuration(6)).toBeGreaterThan(estimatePresentationDuration(1));
    expect(estimatePresentationDuration(12)).toBeGreaterThan(estimatePresentationDuration(6));
  });

  it("includes at minimum dice roll + hold + reveal delay for 0 steps", () => {
    const minExpected = DICE_ROLL_MS + DICE_RESULT_HOLD_MS + LANDING_REVEAL_DELAY_MS;
    expect(estimatePresentationDuration(0)).toBeGreaterThanOrEqual(minExpected);
  });

  it("6 steps is at least 3.5 seconds total", () => {
    expect(estimatePresentationDuration(6)).toBeGreaterThanOrEqual(3500);
  });
});
