"use client";

import { useEffect, useRef, useState } from "react";
import { getBoardMovementPath } from "@/lib/animation/movementPath";
import { TOKEN_STEP_MS as _TOKEN_STEP_MS, TOKEN_LAND_MS as _TOKEN_LAND_MS } from "@/lib/animation/timing";
import type { Player } from "@/types/player";

// Re-export so existing imports from this module continue to work
export const TOKEN_STEP_MS = _TOKEN_STEP_MS;
export const TOKEN_LAND_MS = _TOKEN_LAND_MS;

function positionsFromPlayers(players: Player[]): Record<string, number> {
  const pos: Record<string, number> = {};
  for (const p of players) pos[p.id] = p.position;
  return pos;
}

/**
 * Animates player tokens step-by-step when game state positions change.
 * Returns `displayPositions` (animated), `isAnimating` flag, and
 * `landingPlayerIds` — the set of player IDs currently in landing-bounce state.
 * Respects prefers-reduced-motion: skips to final position immediately.
 */
export function usePlayerMovementAnimation(players: Player[]): {
  displayPositions: Record<string, number>;
  isAnimating: boolean;
  landingPlayerIds: Set<string>;
} {
  const prevPositionsRef = useRef<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const landingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>(() =>
    positionsFromPlayers(players),
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const [landingPlayerIds, setLandingPlayerIds] = useState<Set<string>>(new Set());

  // Stable key that only changes when any player's position changes
  const posKey = players.map((p) => `${p.id}:${p.position}`).join("|");

  useEffect(() => {
    const prevPositions = prevPositionsRef.current;
    const newPositions = positionsFromPlayers(players);

    const movers: { id: string; path: number[] }[] = [];
    for (const player of players) {
      const prev = prevPositions[player.id];
      if (prev !== undefined && prev !== player.position) {
        movers.push({ id: player.id, path: getBoardMovementPath(prev, player.position) });
      }
    }

    prevPositionsRef.current = newPositions;

    if (movers.length === 0) {
      setDisplayPositions(newPositions);
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setDisplayPositions(newPositions);
      return;
    }

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (landingTimerRef.current) { clearTimeout(landingTimerRef.current); landingTimerRef.current = null; }

    const maxSteps = Math.max(...movers.map((m) => m.path.length));

    setDisplayPositions(() => {
      const next = { ...newPositions };
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
        setDisplayPositions(newPositions);

        // Trigger landing bounce
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
  }, [posKey]); // posKey is a stable string derived from players positions

  return { displayPositions, isAnimating, landingPlayerIds };
}
