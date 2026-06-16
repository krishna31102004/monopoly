"use client";

import { useEffect, useRef, useState } from "react";
import {
  DICE_ROLL_MS,
  LANDING_REVEAL_DELAY_MS,
} from "@/lib/animation/timing";
import { shouldShowEventBannerNow } from "@/lib/ui/gameEventPresentation";
import type { GameState } from "@/types/game";

export type GameplayPresentationPhase =
  | "idle"
  | "rollingDice"
  | "showingDiceResult"
  | "movingToken"
  | "landing"
  | "revealingCard"
  | "showingOutcome";

/**
 * Sequences the UI reveal of landing outcomes so they appear only after
 * the token visibly reaches its destination.
 *
 * Returns:
 *   showLandingPanel  — gate for LandingActionPanel / BankruptcyPanel outcome
 *   showCardPanel     — gate for the non-blocking CardPanel display
 *   showCardResolved  — gate for the resolvedMessage inside CardPanel
 *   showEventBanner   — gate for the cinematic event banner; false until movement/bounce settles
 *   diceRolling       — true while the local dice animation should play
 *   presentationPhase — current phase, useful for status messages
 */
export function useGameplayPresentation(state: GameState, isAnimating: boolean): {
  showLandingPanel: boolean;
  showCardPanel: boolean;
  showCardResolved: boolean;
  showEventBanner: boolean;
  diceRolling: boolean;
  presentationPhase: GameplayPresentationPhase;
} {
  // Derive a stable key that changes exactly once per new dice roll
  const diceKey =
    state.diceRoll && state.currentPlayerHasRolled
      ? `${state.currentPlayerIndex}:${state.doublesCount}:${state.diceRoll.die1}:${state.diceRoll.die2}`
      : null;

  // Initialize refs to current values so we don't trigger sequence on first render
  const prevDiceKeyRef = useRef<string | null>(diceKey);
  const prevIsAnimatingRef = useRef<boolean>(isAnimating);
  const sequenceActiveRef = useRef<boolean>(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [showLandingPanel, setShowLandingPanel] = useState(true);
  const [showCardPanel, setShowCardPanel] = useState(true);
  const [showCardResolved, setShowCardResolved] = useState(true);
  const [diceRolling, setDiceRolling] = useState(false);
  const [presentationPhase, setPresentationPhase] = useState<GameplayPresentationPhase>("idle");

  function clearTimers() {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }

  function addTimer(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }

  function revealAll() {
    setShowLandingPanel(true);
    setShowCardPanel(true);
    setShowCardResolved(true);
    setPresentationPhase("showingOutcome");
    sequenceActiveRef.current = false;
  }

  // Detect new dice roll
  useEffect(() => {
    const prevKey = prevDiceKeyRef.current;
    prevDiceKeyRef.current = diceKey;

    if (diceKey !== null && diceKey !== prevKey) {
      clearTimers();
      sequenceActiveRef.current = true;

      setShowLandingPanel(false);
      setShowCardPanel(false);
      setShowCardResolved(false);
      setDiceRolling(true);
      setPresentationPhase("rollingDice");

      // Stop dice rolling, enter "result hold" phase
      addTimer(() => {
        setDiceRolling(false);
        setPresentationPhase("showingDiceResult");
      }, DICE_ROLL_MS);

      // Fallback: reveal panels if token never moves (no position change)
      // e.g. jail turn, staying on same space
      addTimer(() => {
        if (sequenceActiveRef.current) revealAll();
      }, DICE_ROLL_MS + LANDING_REVEAL_DELAY_MS * 2);
    }
    // diceKey is a stable derived string; clearTimers/addTimer use refs only
  }, [diceKey]);

  // Track isAnimating transitions
  useEffect(() => {
    const wasAnimating = prevIsAnimatingRef.current;
    prevIsAnimatingRef.current = isAnimating;

    if (!wasAnimating && isAnimating && sequenceActiveRef.current) {
      // Movement started — cancel fallback, enter moving phase
      clearTimers();
      setPresentationPhase("movingToken");
    }

    if (wasAnimating && !isAnimating && sequenceActiveRef.current) {
      // Movement ended (token reached its space and the landing bounce settled) —
      // start the reveal sequence. Card display and the event banner are both
      // non-blocking, so they can appear together once movement is done.
      clearTimers();
      setPresentationPhase("landing");

      addTimer(() => revealAll(), LANDING_REVEAL_DELAY_MS);
    }
    // isAnimating is the only reactive input; state.drawnCard is read by ref via closure
  }, [isAnimating]);

  useEffect(() => {
    return () => clearTimers();
    // clearTimers only uses timersRef, no reactive deps needed
  }, []);

  // The event banner must never appear while dice are rolling or the token is still moving —
  // it's only safe once movement/bounce has settled (or there was no movement to begin with).
  const showEventBanner = shouldShowEventBannerNow({ presentationPhase });

  return {
    showLandingPanel,
    showCardPanel,
    showCardResolved,
    showEventBanner,
    diceRolling,
    presentationPhase,
  };
}
