"use client";

import { useEffect, useRef, useState } from "react";
import { getBoardMovementPath } from "@/lib/animation/movementPath";
import type { Player } from "@/types/player";

const STEP_MS = 130; // ms per board space during animation

function positionsFromPlayers(players: Player[]): Record<string, number> {
  const pos: Record<string, number> = {};
  for (const p of players) pos[p.id] = p.position;
  return pos;
}

/**
 * Animates player tokens step-by-step when game state positions change.
 * Returns `displayPositions` (animated) and `isAnimating` flag.
 * Respects prefers-reduced-motion: skips to final position immediately.
 */
export function usePlayerMovementAnimation(players: Player[]): {
  displayPositions: Record<string, number>;
  isAnimating: boolean;
} {
  const prevPositionsRef = useRef<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>(() =>
    positionsFromPlayers(players),
  );
  const [isAnimating, setIsAnimating] = useState(false);

  // Stable key that only changes when any player's position changes
  const posKey = players.map((p) => `${p.id}:${p.position}`).join("|");

  useEffect(() => {
    const prevPositions = prevPositionsRef.current;
    const newPositions = positionsFromPlayers(players);

    // Find players whose positions changed (skip first render / brand new players)
    const movers: { id: string; path: number[] }[] = [];
    for (const player of players) {
      const prev = prevPositions[player.id];
      if (prev !== undefined && prev !== player.position) {
        movers.push({
          id: player.id,
          path: getBoardMovementPath(prev, player.position),
        });
      }
    }

    // Commit prev positions now so next change is diffed against these finals
    prevPositionsRef.current = newPositions;

    // No movement — just set immediately
    if (movers.length === 0) {
      setDisplayPositions(newPositions);
      return;
    }

    // Check reduced-motion preference
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setDisplayPositions(newPositions);
      return;
    }

    // Clear any in-progress animation
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const maxSteps = Math.max(...movers.map((m) => m.path.length));

    // Snap all non-movers to their final positions; movers start at path step 0
    setDisplayPositions(() => {
      const next = { ...newPositions };
      for (const mover of movers) next[mover.id] = mover.path[0];
      return next;
    });
    setIsAnimating(true);

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
        // Guarantee final positions are exactly what the server said
        setDisplayPositions(newPositions);
      }
    }, STEP_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [posKey]); // posKey is a stable string derived from players positions

  return { displayPositions, isAnimating };
}
