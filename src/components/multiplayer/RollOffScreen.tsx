"use client";

import { useEffect, useRef, useState } from "react";
import { DiceFace } from "@/components/DiceFace";
import { ordinalLabel } from "@/lib/game/rollOff";
import type { RollOffPublicView, RoomPlayer } from "@/types/multiplayer";

const ANIMATION_MS = 1100;
const RESULT_LINGER_MS = 1600;
// Total reveal window before final order screen appears (animation + result display)
const REVEAL_GATE_MS = ANIMATION_MS + RESULT_LINGER_MS;

type Props = {
  rollOff: RollOffPublicView;
  players: RoomPlayer[];
  myPlayerId: string;
  isHost: boolean;
  onRoll: () => void;
  onBeginGame: () => void;
};

// ── Animation helpers ────────────────────────────────────────────────────────

let rollingTick = 1;
function nextTick() {
  rollingTick = (rollingTick % 6) + 1;
  return rollingTick;
}

/**
 * Dice animation hook. Starts shuffling immediately when `active` becomes true.
 * Snaps to `finalDie1/finalDie2` after ANIMATION_MS.
 *
 * IMPORTANT: `active` must stay true for the full ANIMATION_MS or the cleanup
 * function will fire (clearInterval + clearTimeout), cancelling the animation.
 * Callers must NOT flip `active` back to false during the animation window.
 */
function useDiceAnimation(active: boolean, finalDie1: number, finalDie2: number) {
  const [animDie1, setAnimDie1] = useState(finalDie1);
  const [animDie2, setAnimDie2] = useState(finalDie2);
  const [phase, setPhase] = useState<"idle" | "rolling" | "showing">("idle");
  const prevActive = useRef(false);

  useEffect(() => {
    if (active && !prevActive.current) {
      prevActive.current = true;
      setPhase("rolling");
      const interval = setInterval(() => {
        setAnimDie1(nextTick());
        setAnimDie2(nextTick());
      }, 85);
      const timer = setTimeout(() => {
        clearInterval(interval);
        setAnimDie1(finalDie1);
        setAnimDie2(finalDie2);
        setPhase("showing");
      }, ANIMATION_MS);
      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    } else if (!active) {
      prevActive.current = false;
    }
  }, [active, finalDie1, finalDie2]);

  return { animDie1, animDie2, phase };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PlayerRow({
  player,
  rollEntry,
  isMe,
  animDie1,
  animDie2,
  animPhase,
}: {
  player: RoomPlayer;
  rollEntry: { die1: number; die2: number; total: number } | undefined;
  isMe: boolean;
  animDie1: number;
  animDie2: number;
  animPhase: "idle" | "rolling" | "showing";
}) {
  const isAnimating = isMe && animPhase === "rolling";
  const showMyResult = isMe && (animPhase === "showing" || animPhase === "idle");
  const showOtherResult = !isMe && !!rollEntry;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
        isMe ? "border border-amber-400/60 bg-amber-900/30" : "bg-slate-800/80"
      }`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white shadow"
        style={{ backgroundColor: player.color }}
      >
        {player.tokenLabel.slice(0, 3)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">
          {player.displayName}
          {isMe && <span className="ml-1.5 text-[10px] font-normal text-slate-400">(you)</span>}
        </p>
        {isAnimating && (
          <p className="text-[10px] text-amber-300 animate-pulse">Rolling…</p>
        )}
        {!isAnimating && !rollEntry && (
          <p className="text-[10px] text-slate-500">Waiting to roll…</p>
        )}
        {(showMyResult || showOtherResult) && rollEntry && (
          <p className="text-[10px] text-amber-200/70">
            {rollEntry.die1} + {rollEntry.die2} = {rollEntry.total}
          </p>
        )}
      </div>

      {isAnimating ? (
        <div className="flex items-center gap-1.5">
          <DiceFace value={animDie1} size={34} rolling />
          <DiceFace value={animDie2} size={34} rolling />
        </div>
      ) : (showMyResult || showOtherResult) && rollEntry ? (
        <div className="flex items-center gap-1.5">
          <DiceFace value={rollEntry.die1} size={34} />
          <DiceFace value={rollEntry.die2} size={34} />
          <span className="ml-1.5 text-sm font-black text-amber-300">={rollEntry.total}</span>
        </div>
      ) : null}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RollOffScreen({
  rollOff,
  players,
  myPlayerId,
  isHost,
  onRoll,
  onBeginGame,
}: Props) {
  const { round, rollingThisRound, pendingPlayerIds, rolls, lastRoundRolls, allRolls, resolvedOrder, gameReady } =
    rollOff;

  const isTieBreaker = round > 1;
  const myIsRolling = rollingThisRound.includes(myPlayerId);
  const myHasRolled = myPlayerId in rolls;
  const canRoll = myIsRolling && !myHasRolled;

  const playerMap = new Map(players.map((p) => [p.playerId, p]));

  // ── My own roll animation state ───────────────────────────────────────────
  const [myRolling, setMyRolling] = useState(false);
  const [lingerActive, setLingerActive] = useState(false);
  const isSubmitting = myRolling || lingerActive;

  // Refs that mirror myRolling/lingerActive — used inside effects to avoid stale
  // closures without needing to add them as effect dependencies.
  const myRollingRef = useRef(false);
  const lingerActiveRef = useRef(false);
  myRollingRef.current = myRolling;
  lingerActiveRef.current = lingerActive;

  // Flag: round advanced while we were animating — show lastRoundRolls banner
  // AFTER our own reveal instead of immediately.
  const pendingShowLastRoundRef = useRef(false);

  function handleRoll() {
    if (!canRoll || isSubmitting) return;
    setMyRolling(true);
    onRoll();
  }

  // ── Detect my result from server ──────────────────────────────────────────
  //
  // Watch `allRolls[myPlayerId]` (accumulates across rounds) rather than
  // `rolls[myPlayerId]` (resets to {} when round advances). This prevents a
  // stuck "Rolling..." state when ansh's roll is the one that creates a tie
  // and the server immediately resets `rolls`.
  //
  const myAllRollsResult = allRolls[myPlayerId];
  const prevMyAllRollsRef = useRef<typeof myAllRollsResult>(undefined);

  useEffect(() => {
    if (myAllRollsResult && myAllRollsResult !== prevMyAllRollsRef.current) {
      prevMyAllRollsRef.current = myAllRollsResult;
      // Wait for the dice animation to play out, then enter the result-reveal linger.
      const t = setTimeout(() => {
        setMyRolling(false);
        myRollingRef.current = false;
        setLingerActive(true);
        lingerActiveRef.current = true;
        const t2 = setTimeout(() => {
          setLingerActive(false);
          lingerActiveRef.current = false;
          // If the round advanced while we were revealing, trigger lastRound display NOW.
          if (pendingShowLastRoundRef.current) {
            pendingShowLastRoundRef.current = false;
            setShowingLastRound(true);
            setTimeout(() => setShowingLastRound(false), RESULT_LINGER_MS);
          }
        }, RESULT_LINGER_MS);
        return () => clearTimeout(t2);
      }, ANIMATION_MS);
      return () => clearTimeout(t);
    }
  }, [myAllRollsResult]);

  // ── Round-change: show previous round's results before tie banner ─────────
  //
  // Root-cause fix (Phase 4F.2D):
  //
  // Old code called setMyRolling(false) here immediately when the round advanced.
  // This caused React to re-run useDiceAnimation's effect with active=false, which
  // fired the cleanup function (clearInterval + clearTimeout), cancelling the
  // animation. The actor (last to roll in a tie) never saw their own dice roll.
  //
  // Fix: if the actor is currently in their own animation or linger phase, defer
  // the lastRound display until after the reveal completes (handled above in the
  // allRolls effect). Only immediately show lastRound for observers (myRolling=false).
  //
  const prevRoundRef = useRef(round);
  const [showingLastRound, setShowingLastRound] = useState(false);

  useEffect(() => {
    const prevRound = prevRoundRef.current;
    prevRoundRef.current = round;

    if (round !== prevRound && !gameReady) {
      if (myRollingRef.current || lingerActiveRef.current) {
        // Actor is in the middle of their own roll reveal.
        // Do NOT reset myRolling/lingerActive — that would cancel the dice animation.
        // Instead, set a flag so the allRolls effect triggers lastRound after reveal.
        pendingShowLastRoundRef.current = true;
      } else {
        // Observer path: not animating, immediately show previous round's results.
        setMyRolling(false);
        setLingerActive(false);
        setShowingLastRound(true);
        const t = setTimeout(() => setShowingLastRound(false), RESULT_LINGER_MS);
        return () => clearTimeout(t);
      }
    }
  }, [round, gameReady]);

  // ── useDiceAnimation: active only when both myRolling AND result are in ───
  //
  // `active = myRolling && !!myAllRollsResult` ensures the animation snap-to-final
  // values are ready when the animation starts (preventing a wrong dice snap if
  // the result arrives after ANIMATION_MS). In practice server results arrive in
  // <<ANIMATION_MS on any reasonable connection.
  //
  // CRITICAL: `active` must stay true for the full ANIMATION_MS. The round-change
  // fix above ensures we no longer flip myRolling=false during the animation.
  //
  const { animDie1, animDie2, phase: animPhase } = useDiceAnimation(
    myRolling && !!myAllRollsResult,
    myAllRollsResult?.die1 ?? 1,
    myAllRollsResult?.die2 ?? 1,
  );

  // ── Presentation gate: delay final order screen until reveal completes ────
  //
  // When gameReady becomes true, wait REVEAL_GATE_MS before showing the final
  // order so the last player's dice result is visible. Reconnecting into an
  // already-resolved room skips the delay.
  //
  const [presentationReady, setPresentationReady] = useState(gameReady);
  const prevGameReadyRef = useRef(gameReady);

  useEffect(() => {
    if (gameReady && !prevGameReadyRef.current) {
      prevGameReadyRef.current = true;
      const t = setTimeout(() => setPresentationReady(true), REVEAL_GATE_MS);
      return () => clearTimeout(t);
    }
  }, [gameReady]);

  const canShowFinalOrder = gameReady && resolvedOrder && presentationReady;

  // During showingLastRound: use previous round's preserved rolls for display.
  // This ensures all players see the result that caused the tie before the
  // "Tie Breaker — Round N" banner and fresh empty player rows appear.
  const displayRolls = showingLastRound ? lastRoundRolls : rolls;
  // Show tie banner only after the reveal delay (not while showing last round's result).
  const showTieBanner = isTieBreaker && !showingLastRound;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4">
      <section
        className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-slate-900 shadow-[0_32px_100px_rgba(0,0,0,0.6)]"
        aria-labelledby="rolloff-title"
      >
        {/* Header */}
        <div className="border-b border-amber-400/20 bg-gradient-to-r from-amber-900 via-amber-700 to-amber-900 px-6 py-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">
            {canShowFinalOrder
              ? "Results"
              : showingLastRound && round > 1
                ? `Tie Breaker — Round ${round - 1}`
                : showTieBanner
                  ? `Tie Breaker — Round ${round}`
                  : isTieBreaker
                    ? `Tie Breaker — Round ${round}`
                    : "Pre-Game"}
          </p>
          <h2 id="rolloff-title" className="mt-1 text-xl font-black text-white">
            {canShowFinalOrder ? "Turn Order Decided!" : "Roll for Turn Order"}
          </h2>
          <p className="mt-1 text-xs text-amber-100/70">
            {canShowFinalOrder
              ? "The dice have spoken."
              : showingLastRound && round > 1
                ? "All rolled — checking for ties…"
                : showTieBanner
                  ? "Tied players roll again to break the tie."
                  : isTieBreaker
                    ? "Tied players roll again to break the tie."
                    : "Highest total goes first. Roll your dice!"}
          </p>
        </div>

        <div className="p-5 space-y-3">
          {canShowFinalOrder ? (
            /* ── Final order screen ── */
            <>
              {resolvedOrder!.map((id, idx) => {
                const player = playerMap.get(id);
                if (!player) return null;
                const r = allRolls[id];
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${
                      idx === 0
                        ? "border border-amber-400/50 bg-amber-900/40"
                        : "bg-slate-800"
                    }`}
                  >
                    <span className="w-8 shrink-0 text-center text-sm font-black text-amber-300">
                      {ordinalLabel(idx + 1)}
                    </span>
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.tokenLabel.slice(0, 3)}
                    </span>
                    <span className="flex-1 text-sm font-bold text-white">{player.displayName}</span>
                    {r && (
                      <span className="text-xs font-black text-amber-300 tabular-nums">
                        {r.die1}+{r.die2}={r.total}
                      </span>
                    )}
                    {idx === 0 && (
                      <span className="ml-1 text-[10px] font-black text-amber-400">★ First</span>
                    )}
                  </div>
                );
              })}

              <div className="mt-2">
                {isHost ? (
                  <button
                    type="button"
                    onClick={onBeginGame}
                    className="w-full rounded-xl bg-emerald-500 px-6 py-4 text-base font-black text-white shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all hover:bg-emerald-400 active:translate-y-0.5 active:shadow-none"
                  >
                    Begin Game →
                  </button>
                ) : (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-4 text-center text-sm font-semibold text-slate-400">
                    Waiting for host to begin the game…
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── Rolling / reveal phase ── */
            <>
              {/* Tie banner — only after the result-reveal delay */}
              {showTieBanner && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 px-3 py-2 text-center text-xs font-bold text-amber-300">
                  Tie!{" "}
                  {rollingThisRound
                    .map((id) => playerMap.get(id)?.displayName ?? id)
                    .join(" and ")}{" "}
                  must roll again.
                </div>
              )}

              {/* Players in current rolling group */}
              {rollingThisRound.map((id) => {
                const player = playerMap.get(id);
                if (!player) return null;
                const isMe = id === myPlayerId;
                return (
                  <PlayerRow
                    key={id}
                    player={player}
                    rollEntry={isMe ? myAllRollsResult : displayRolls[id]}
                    isMe={isMe}
                    animDie1={animDie1}
                    animDie2={animDie2}
                    animPhase={isMe ? (myRolling ? "rolling" : animPhase) : "idle"}
                  />
                );
              })}

              {/* Players resolved in earlier rounds */}
              {players
                .filter((p) => !rollingThisRound.includes(p.playerId))
                .map((player) => {
                  const r = allRolls[player.playerId];
                  return (
                    <div
                      key={player.playerId}
                      className="flex items-center gap-3 rounded-xl bg-slate-800/40 px-4 py-2.5 opacity-50"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                        style={{ backgroundColor: player.color }}
                      >
                        {player.tokenLabel.slice(0, 3)}
                      </span>
                      <span className="flex-1 text-sm text-slate-400">{player.displayName}</span>
                      {r ? (
                        <span className="text-xs font-bold text-slate-500">
                          {r.die1}+{r.die2}={r.total}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">Position decided</span>
                      )}
                    </div>
                  );
                })}

              {/* CTA */}
              <div className="mt-1">
                {showingLastRound ? (
                  /* Revealing last round's results — no action yet */
                  <div className="rounded-xl border border-amber-700/30 bg-amber-900/10 px-6 py-3 text-center text-sm font-semibold text-amber-400">
                    Checking for ties…
                  </div>
                ) : canRoll && !gameReady ? (
                  <button
                    type="button"
                    onClick={handleRoll}
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-amber-500 px-6 py-4 text-base font-black text-slate-950 shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all hover:bg-amber-400 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
                  >
                    {isSubmitting ? "Rolling…" : isTieBreaker ? "🎲 Roll Tie-Breaker" : "🎲 Roll for Order"}
                  </button>
                ) : gameReady && !presentationReady ? (
                  /* Final roll revealed — showing results before order screen */
                  <div className="rounded-xl border border-emerald-700/30 bg-emerald-900/20 px-6 py-3 text-center text-sm font-semibold text-emerald-300">
                    All rolled — revealing results…
                  </div>
                ) : myIsRolling && myHasRolled && !gameReady ? (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-4 text-center text-sm font-semibold text-slate-400">
                    {pendingPlayerIds.length > 0
                      ? `Waiting for ${pendingPlayerIds.length} more player${pendingPlayerIds.length > 1 ? "s" : ""} to roll…`
                      : "Resolving order…"}
                  </div>
                ) : !myIsRolling ? (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-4 text-center text-sm font-semibold text-slate-400">
                    Waiting for others to roll…
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
