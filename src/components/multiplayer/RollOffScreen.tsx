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

/** Shuffles die faces for animation, then snaps to final values after ANIMATION_MS. */
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
  const { round, rollingThisRound, pendingPlayerIds, rolls, allRolls, resolvedOrder, gameReady } =
    rollOff;

  const isTieBreaker = round > 1;
  const myIsRolling = rollingThisRound.includes(myPlayerId);
  const myHasRolled = myPlayerId in rolls;
  const canRoll = myIsRolling && !myHasRolled;
  const myResult = rolls[myPlayerId];

  const playerMap = new Map(players.map((p) => [p.playerId, p]));

  // ── Local animation for MY own roll ──────────────────────────────────────
  const [myRolling, setMyRolling] = useState(false);
  const [lingerActive, setLingerActive] = useState(false);
  const isSubmitting = myRolling || lingerActive;

  function handleRoll() {
    if (!canRoll || isSubmitting) return;
    setMyRolling(true);
    onRoll();
  }

  // When my result arrives from server, stop rolling anim and start linger
  const prevMyResult = useRef<typeof myResult>(undefined);
  useEffect(() => {
    if (myResult && myResult !== prevMyResult.current) {
      prevMyResult.current = myResult;
      const t = setTimeout(() => {
        setMyRolling(false);
        setLingerActive(true);
        const t2 = setTimeout(() => setLingerActive(false), RESULT_LINGER_MS);
        return () => clearTimeout(t2);
      }, ANIMATION_MS);
      return () => clearTimeout(t);
    }
  }, [myResult]);

  const { animDie1, animDie2, phase: animPhase } = useDiceAnimation(
    myRolling && !!myResult,
    myResult?.die1 ?? 1,
    myResult?.die2 ?? 1,
  );

  // ── Presentation gate: delay final order until reveal completes ───────────
  //
  // Problem: when gameReady becomes true (server resolved the order), React
  // renders the final order screen immediately — skipping the animation and
  // result reveal for the final player (and observers).
  //
  // Fix: presentationReady starts as `gameReady` (so reconnect into an already-
  // resolved room shows immediately). When gameReady transitions false→true,
  // wait REVEAL_GATE_MS before setting presentationReady=true.
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
              {/* Tie banner */}
              {isTieBreaker && (
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
                    rollEntry={rolls[id]}
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
                {canRoll && !gameReady ? (
                  <button
                    type="button"
                    onClick={handleRoll}
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-amber-500 px-6 py-4 text-base font-black text-slate-950 shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all hover:bg-amber-400 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
                  >
                    {isSubmitting ? "Rolling…" : "🎲 Roll for Order"}
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
                ) : canRoll && gameReady ? (
                  /* Edge case: my turn to roll but it's already resolved (shouldn't happen) */
                  <button
                    type="button"
                    onClick={handleRoll}
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-amber-500 px-6 py-4 text-base font-black text-slate-950 shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all hover:bg-amber-400 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
                  >
                    {isSubmitting ? "Rolling…" : "🎲 Roll for Order"}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
