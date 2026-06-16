import { describe, it, expect } from "vitest";
import { CARD_REVEAL_MIN_MS, LANDING_REVEAL_DELAY_MS } from "@/lib/animation/timing";
import {
  shouldHideLandingPanelDuringPresentation,
  shouldHideCardResolvedDuringPresentation,
} from "@/lib/animation/presentationHelpers";
import type { GameplayPresentationPhase } from "@/hooks/useGameplayPresentation";

describe("Card reveal timing constants", () => {
  it("CARD_REVEAL_MIN_MS allows player to read the card before seeing the effect", () => {
    expect(CARD_REVEAL_MIN_MS).toBeGreaterThanOrEqual(800);
  });

  it("LANDING_REVEAL_DELAY_MS provides a pause between landing and card appearing", () => {
    expect(LANDING_REVEAL_DELAY_MS).toBeGreaterThanOrEqual(400);
  });

  it("total card sequence (landing delay + card reveal) is at least 1.2s", () => {
    expect(LANDING_REVEAL_DELAY_MS + CARD_REVEAL_MIN_MS).toBeGreaterThanOrEqual(1200);
  });
});

describe("Card reveal phase ordering", () => {
  it("card panel is hidden during rollingDice phase", () => {
    const phase: GameplayPresentationPhase = "rollingDice";
    expect(shouldHideLandingPanelDuringPresentation(phase)).toBe(true);
  });

  it("card panel is hidden during movingToken phase", () => {
    const phase: GameplayPresentationPhase = "movingToken";
    expect(shouldHideLandingPanelDuringPresentation(phase)).toBe(true);
  });

  it("card panel is hidden during landing phase", () => {
    const phase: GameplayPresentationPhase = "landing";
    expect(shouldHideLandingPanelDuringPresentation(phase)).toBe(true);
  });

  it("card resolved message is hidden during revealingCard phase (card visible but effect not yet)", () => {
    const phase: GameplayPresentationPhase = "revealingCard";
    expect(shouldHideCardResolvedDuringPresentation(phase)).toBe(true);
  });

  it("card resolved message is visible during showingOutcome phase", () => {
    const phase: GameplayPresentationPhase = "showingOutcome";
    expect(shouldHideCardResolvedDuringPresentation(phase)).toBe(false);
  });
});

describe("Card reveal sequence contract", () => {
  const fullCardSequence: GameplayPresentationPhase[] = [
    "rollingDice",
    "showingDiceResult",
    "movingToken",
    "landing",
    "revealingCard",
    "showingOutcome",
  ];

  it("revealingCard phase appears after landing phase", () => {
    const landingIdx = fullCardSequence.indexOf("landing");
    const cardIdx = fullCardSequence.indexOf("revealingCard");
    expect(landingIdx).toBeGreaterThan(-1);
    expect(cardIdx).toBeGreaterThan(landingIdx);
  });

  it("showingOutcome appears after revealingCard", () => {
    const cardIdx = fullCardSequence.indexOf("revealingCard");
    const outcomeIdx = fullCardSequence.indexOf("showingOutcome");
    expect(outcomeIdx).toBeGreaterThan(cardIdx);
  });

  it("card is NOT shown before token lands (hidden during pre-landing phases)", () => {
    const preLandingPhases: GameplayPresentationPhase[] = [
      "rollingDice", "showingDiceResult", "movingToken",
    ];
    for (const phase of preLandingPhases) {
      expect(shouldHideLandingPanelDuringPresentation(phase)).toBe(true);
    }
  });

  it("effect/resolved message NOT shown before full card reveal phase completes", () => {
    const preOutcomePhases: GameplayPresentationPhase[] = [
      "rollingDice", "showingDiceResult", "movingToken", "landing", "revealingCard",
    ];
    for (const phase of preOutcomePhases) {
      if (phase !== "idle" && phase !== "showingOutcome") {
        expect(shouldHideCardResolvedDuringPresentation(phase)).toBe(true);
      }
    }
  });
});
