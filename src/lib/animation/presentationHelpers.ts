import type { GameplayPresentationPhase } from "@/hooks/useGameplayPresentation";
import { DICE_ROLL_MS, TOKEN_STEP_MS, LANDING_REVEAL_DELAY_MS, DICE_RESULT_HOLD_MS } from "@/lib/animation/timing";

/** Returns true when landing/card/buy panels should be hidden. */
export function shouldHideLandingPanelDuringPresentation(
  phase: GameplayPresentationPhase
): boolean {
  return (
    phase === "rollingDice" ||
    phase === "showingDiceResult" ||
    phase === "movingToken" ||
    phase === "landing" ||
    phase === "revealingCard"
  );
}

/** Returns true when card resolved message should be hidden. */
export function shouldHideCardResolvedDuringPresentation(
  phase: GameplayPresentationPhase
): boolean {
  return phase !== "showingOutcome" && phase !== "idle";
}

/**
 * Approximate minimum total duration (ms) for a full dice→movement→reveal sequence,
 * given the number of board steps the token travels.
 */
export function estimatePresentationDuration(steps: number): number {
  return DICE_ROLL_MS + DICE_RESULT_HOLD_MS + steps * TOKEN_STEP_MS + LANDING_REVEAL_DELAY_MS;
}
