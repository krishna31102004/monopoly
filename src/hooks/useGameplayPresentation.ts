"use client";

import { useEffect, useRef, useState } from "react";
import {
  DICE_ROLL_MS,
  LANDING_REVEAL_DELAY_MS,
} from "@/lib/animation/timing";
import { getCardRevealKey, isCardRevealDismissed } from "@/lib/ui/gameEventPresentation";
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
 *   showCardPanel     — gate for CardPanel visibility
 *   showCardResolved  — gate for the resolvedMessage inside CardPanel
 *   diceRolling       — true while the local dice animation should play
 *   presentationPhase — current phase, useful for status messages
 *   dismissCard       — call when the user clicks Continue on the card reveal modal;
 *                        hides the card and reveals the landing/outcome panel immediately
 */
export function useGameplayPresentation(state: GameState, isAnimating: boolean): {
  showLandingPanel: boolean;
  showCardPanel: boolean;
  showCardResolved: boolean;
  diceRolling: boolean;
  presentationPhase: GameplayPresentationPhase;
  dismissCard: () => void;
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
  const dismissedCardKeyRef = useRef<string | null>(null);

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
      dismissedCardKeyRef.current = null;

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
      // Movement ended — start reveal sequence
      clearTimers();
      setPresentationPhase("landing");

      const hasCard = state.drawnCard !== null;

      if (hasCard) {
        addTimer(() => {
          // Show the full card (text + result) immediately; the user advances
          // via the Continue button (dismissCard) instead of an auto-timer,
          // so they're never left waiting or stuck on the reveal.
          setShowCardPanel(true);
          setShowCardResolved(true);
          setPresentationPhase("revealingCard");
        }, LANDING_REVEAL_DELAY_MS);
      } else {
        addTimer(() => revealAll(), LANDING_REVEAL_DELAY_MS);
      }
    }
    // isAnimating is the only reactive input; state.drawnCard is read by ref via closure
  }, [isAnimating]);

  useEffect(() => {
    return () => clearTimers();
    // clearTimers only uses timersRef, no reactive deps needed
  }, []);

  const currentCardRevealKey = getCardRevealKey(state.drawnCard, state.currentPlayerIndex);
  const cardDismissed = isCardRevealDismissed(currentCardRevealKey, dismissedCardKeyRef.current);

  function dismissCard() {
    dismissedCardKeyRef.current = currentCardRevealKey;
    clearTimers();
    // Reveal the rest of the outcome (landing panel) immediately — do NOT call
    // revealAll() here, since it also sets showCardPanel(true), which previously
    // re-opened the modal in the same render pass and left the user stuck.
    setShowLandingPanel(true);
    setShowCardResolved(true);
    setPresentationPhase("showingOutcome");
    sequenceActiveRef.current = false;
  }

  return {
    showLandingPanel,
    showCardPanel: showCardPanel && !cardDismissed,
    showCardResolved,
    diceRolling,
    presentationPhase,
    dismissCard,
  };
}
