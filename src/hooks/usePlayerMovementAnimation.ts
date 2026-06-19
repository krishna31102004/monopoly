"use client";

import { useEffect, useRef, useState } from "react";
import { getBoardMovementPath } from "@/lib/animation/movementPath";
import {
  TOKEN_STEP_MS as _TOKEN_STEP_MS,
  TOKEN_LAND_MS as _TOKEN_LAND_MS,
  DICE_ROLL_MS,
  DICE_RESULT_HOLD_MS,
} from "@/lib/animation/timing";
import type { Player } from "@/types/player";

// Re-export so existing imports from this module continue to work
export const TOKEN_STEP_MS = _TOKEN_STEP_MS;
export const TOKEN_LAND_MS = _TOKEN_LAND_MS;

/** Total ms to hold movement back after dice roll (dice anim + result reveal) */
const MOVEMENT_GATE_MS = DICE_ROLL_MS + DICE_RESULT_HOLD_MS;

function positionsFromPlayers(players: Player[]): Record<string, number> {
  const pos: Record<string, number> = {};
  for (const p of players) pos[p.id] = p.position;
  return pos;
}

/**
 * Animates player tokens step-by-step when game state positions change.
 *
 * @param players  Current authoritative player list (with final positions).
 * @param diceKey  Optional opaque string that changes exactly once per new
 *                 dice roll. When provided, token movement is gated for
 *                 MOVEMENT_GATE_MS (dice roll + result reveal) so the dice
 *                 finish animating before the token starts moving.
 *
 * Returns `displayPositions` (animated), `isAnimating` flag, and
 * `landingPlayerIds` — the set of player IDs currently in landing-bounce.
 * Respects prefers-reduced-motion: skips to final position immediately.
 */
export function usePlayerMovementAnimation(
  players: Player[],
  diceKey: string | null = null,
): {
  displayPositions: Record<string, number>;
  isAnimating: boolean;
  landingPlayerIds: Set<string>;
} {
  const prevPositionsRef = useRef<Record<string, number>>({});
  // Pending target positions queued while the dice gate is active
  const pendingPositionsRef = useRef<Record<string, number> | null>(null);
  // Timestamp (ms) until which movement is gated after a roll
  const gatedUntilRef = useRef<number>(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const landingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ungateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>(() =>
    positionsFromPlayers(players),
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const [landingPlayerIds, setLandingPlayerIds] = useState<Set<string>>(new Set());
  // Incrementing this value causes the movement effect to re-run when the gate opens
  const [ungateTick, setUngateTick] = useState(0);

  const posKey = players.map((p) => `${p.id}:${p.position}`).join("|");

  // ── Effect 1: track dice key changes to set the movement gate ────────────
  // Must be defined BEFORE the movement effect so it fires first when both
  // diceKey and posKey change in the same render (React fires effects in order).
  const prevDiceKeyRef = useRef<string | null>(diceKey);
  useEffect(() => {
    if (diceKey !== null && diceKey !== prevDiceKeyRef.current) {
      prevDiceKeyRef.current = diceKey;
      gatedUntilRef.current = Date.now() + MOVEMENT_GATE_MS;
      // Schedule a re-run of the movement effect when the gate opens
      if (ungateTimerRef.current) clearTimeout(ungateTimerRef.current);
      ungateTimerRef.current = setTimeout(() => {
        setUngateTick((t) => t + 1);
      }, MOVEMENT_GATE_MS);
    }
    // Intentional: diceKey is the only dep; gatedUntilRef is a ref (stable)
  }, [diceKey]);

  // ── Effect 2: apply position changes and run animation ───────────────────
  useEffect(() => {
    const isGated = Date.now() < gatedUntilRef.current;
    const prevPositions = prevPositionsRef.current;

    if (isGated) {
      // Dice are still rolling / result being shown — queue but do not animate
      pendingPositionsRef.current = positionsFromPlayers(players);
      // Do NOT update prevPositionsRef here; we need old positions as anim start
      return;
    }

    // Use queued positions (from the gated window) or the current player positions
    const targetPositions = pendingPositionsRef.current ?? positionsFromPlayers(players);
    pendingPositionsRef.current = null;

    const movers: { id: string; path: number[] }[] = [];
    for (const player of players) {
      const prev = prevPositions[player.id];
      const target = targetPositions[player.id] ?? player.position;
      if (prev !== undefined && prev !== target) {
        movers.push({ id: player.id, path: getBoardMovementPath(prev, target) });
      }
    }

    prevPositionsRef.current = targetPositions;

    if (movers.length === 0) {
      setDisplayPositions(targetPositions);
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setDisplayPositions(targetPositions);
      return;
    }

    // Clear any in-progress animation
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (landingTimerRef.current) { clearTimeout(landingTimerRef.current); landingTimerRef.current = null; }

    const maxSteps = Math.max(...movers.map((m) => m.path.length));

    setDisplayPositions(() => {
      const next = { ...targetPositions };
      for (const mover of movers) next[mover.id] = mover.path[0];
      return next;
    });
    setIsAnimating(true);
    setLandingPlayerIds(new Set());

    let step = 0;
    timerRef.current = setInterval(() => {
      step++;
      setDisplayPositions((prev) => {
        const next = { ...prev };
        for (const mover of movers) {
          next[mover.id] = mover.path[Math.min(step, mover.path.length - 1)];
        }
        return next;
      });

      if (step >= maxSteps - 1) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setIsAnimating(false);
        setDisplayPositions(targetPositions);

        const moverIds = new Set(movers.map((m) => m.id));
        setLandingPlayerIds(moverIds);
        landingTimerRef.current = setTimeout(() => {
          setLandingPlayerIds(new Set());
          landingTimerRef.current = null;
        }, TOKEN_LAND_MS);
      }
    }, TOKEN_STEP_MS);

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (landingTimerRef.current) { clearTimeout(landingTimerRef.current); landingTimerRef.current = null; }
    };
  }, [posKey, ungateTick]); // ungateTick triggers re-run when gate opens

  return { displayPositions, isAnimating, landingPlayerIds };
}
