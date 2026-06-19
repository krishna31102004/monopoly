"use client";

import { useEffect, useRef, useState } from "react";
import { DiceFace } from "@/components/DiceFace";
import { ordinalLabel } from "@/lib/game/rollOff";
import type { RollOffPublicView, RoomPlayer } from "@/types/multiplayer";

const ANIMATION_MS = 1200;
const RESULT_LINGER_MS = 1800;

type Props = {
  rollOff: RollOffPublicView;
  players: RoomPlayer[];
  myPlayerId: string;
  isHost: boolean;
  onRoll: () => void;
  onBeginGame: () => void;
};

type AnimState = {
  phase: "idle" | "rolling" | "showing";
  die1: number;
  die2: number;
};

function useRollingAnimation(
  isRolling: boolean,
  finalDie1: number,
  finalDie2: number,
  onDone: () => void,
) {
  const [anim, setAnim] = useState<AnimState>({ phase: "idle", die1: 1, die2: 6 });
  const frameRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevIsRolling = useRef(false);

  useEffect(() => {
    if (isRolling && !prevIsRolling.current) {
      // New roll started
      setAnim({ phase: "rolling", die1: 1, die2: 6 });
      let t = 1;
      frameRef.current = setInterval(() => {
        t = (t % 6) + 1;
        setAnim((a) => ({ ...a, die1: t, die2: ((t + 2) % 6) + 1 }));
      }, 90);
      const timer = setTimeout(() => {
        if (frameRef.current) clearInterval(frameRef.current);
        setAnim({ phase: "showing", die1: finalDie1, die2: finalDie2 });
        onDone();
      }, ANIMATION_MS);
      prevIsRolling.current = true;
      return () => {
        clearInterval(frameRef.current!);
        clearTimeout(timer);
      };
    } else if (!isRolling) {
      prevIsRolling.current = false;
    }
  }, [isRolling]); // finalDie1/finalDie2/onDone are stable per render cycle

  return anim;
}

function PlayerCard({
  player,
  isMe,
  rollEntry,
  isPending,
  myAnimState,
  isCurrentRoller,
}: {
  player: RoomPlayer;
  isMe: boolean;
  rollEntry?: { die1: number; die2: number; total: number };
  isPending: boolean;
  myAnimState: AnimState;
  isCurrentRoller: boolean;
}) {
  const showAnim = isMe && myAnimState.phase === "rolling";
  const showResult = rollEntry && (!isMe || myAnimState.phase === "showing" || myAnimState.phase === "idle");

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
        isMe ? "border border-amber-400/60 bg-amber-900/30" : "bg-slate-800/80"
      }`}
    >
      {/* Token badge */}
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white shadow"
        style={{ backgroundColor: player.color }}
      >
        {player.tokenLabel.slice(0, 3)}
      </span>

      {/* Name */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">
          {player.displayName}
          {isMe && <span className="ml-1.5 text-[10px] font-normal text-slate-400">(you)</span>}
        </p>
        {showAnim && (
          <p className="text-[10px] text-amber-300 animate-pulse">Rolling…</p>
        )}
        {!showAnim && isPending && isCurrentRoller && (
          <p className="text-[10px] text-slate-500">Waiting to roll…</p>
        )}
        {!showAnim && !isCurrentRoller && isPending && (
          <p className="text-[10px] text-slate-600">Position decided</p>
        )}
      </div>

      {/* Dice / result */}
      {showAnim ? (
        <div className="flex items-center gap-1.5">
          <DiceFace value={myAnimState.die1} size={34} rolling />
          <DiceFace value={myAnimState.die2} size={34} rolling />
        </div>
      ) : showResult ? (
        <div className="flex items-center gap-1.5">
          <DiceFace value={rollEntry.die1} size={34} />
          <DiceFace value={rollEntry.die2} size={34} />
          <span className="ml-1 text-sm font-black text-amber-300">={rollEntry.total}</span>
        </div>
      ) : null}
    </div>
  );
}

export function RollOffScreen({ rollOff, players, myPlayerId, isHost, onRoll, onBeginGame }: Props) {
  const { round, rollingThisRound, pendingPlayerIds, rolls, allRolls, resolvedOrder, gameReady } = rollOff;
  const isTieBreaker = round > 1;

  const myIsRolling = rollingThisRound.includes(myPlayerId);
  const myHasRolled = myPlayerId in rolls;
  const canRoll = myIsRolling && !myHasRolled;

  const playerMap = new Map(players.map((p) => [p.playerId, p]));

  // Local animation state for MY own roll
  const [myRolling, setMyRolling] = useState(false);
  const [lingerActive, setLingerActive] = useState(false);

  function handleRoll() {
    if (!canRoll || myRolling || lingerActive) return;
    setMyRolling(true);
    onRoll();
  }

  // When server sends back MY roll result, start linger
  const myResult = rolls[myPlayerId];
  const prevMyResult = useRef<typeof myResult>(undefined);
  useEffect(() => {
    if (myResult && myResult !== prevMyResult.current) {
      prevMyResult.current = myResult;
      // Stop rolling after animation reveals result, then linger
      const t = setTimeout(() => {
        setMyRolling(false);
        setLingerActive(true);
        const t2 = setTimeout(() => setLingerActive(false), RESULT_LINGER_MS);
        return () => clearTimeout(t2);
      }, ANIMATION_MS);
      return () => clearTimeout(t);
    }
  }, [myResult]);

  const myAnimState = useRollingAnimation(
    myRolling && !!myResult,
    myResult?.die1 ?? 1,
    myResult?.die2 ?? 1,
    () => {
      setMyRolling(false);
    },
  );

  // Determine button state
  const isSubmitting = myRolling || lingerActive;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4">
      <section
        className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-slate-900 shadow-[0_32px_100px_rgba(0,0,0,0.6)]"
        aria-labelledby="rolloff-title"
      >
        {/* Header */}
        <div className="border-b border-amber-400/20 bg-gradient-to-r from-amber-900 via-amber-700 to-amber-900 px-6 py-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">
            {isTieBreaker ? `Tie Breaker — Round ${round}` : "Pre-Game"}
          </p>
          <h2 id="rolloff-title" className="mt-1 text-xl font-black text-white">
            Roll for Turn Order
          </h2>
          <p className="mt-1 text-xs text-amber-100/70">
            {isTieBreaker
              ? "Tied players roll again to break the tie."
              : "Highest total goes first. Roll your dice!"}
          </p>
        </div>

        <div className="p-5 space-y-3">
          {/* ── Resolved: show final order + Begin Game ── */}
          {gameReady && resolvedOrder ? (
            <>
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">
                Turn Order Decided!
              </p>
              {resolvedOrder.map((id, idx) => {
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
            /* ── Rolling phase ── */
            <>
              {/* Show tie banner if this is a re-roll */}
              {isTieBreaker && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 px-3 py-2 text-center text-xs font-bold text-amber-300">
                  Tie! {rollingThisRound.map((id) => playerMap.get(id)?.displayName ?? id).join(" and ")} must roll again.
                </div>
              )}

              {/* Rolling group */}
              {rollingThisRound.map((id) => {
                const player = playerMap.get(id);
                if (!player) return null;
                const isMe = id === myPlayerId;
                const rollEntry = rolls[id];
                const isPending = pendingPlayerIds.includes(id);

                return (
                  <PlayerCard
                    key={id}
                    player={player}
                    isMe={isMe}
                    rollEntry={rollEntry}
                    isPending={isPending}
                    myAnimState={isMe ? (myRolling ? { phase: "rolling", die1: myAnimState.die1, die2: myAnimState.die2 } : myAnimState) : { phase: "idle", die1: 1, die2: 1 }}
                    isCurrentRoller
                  />
                );
              })}

              {/* Players not in current rolling group */}
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
                        <span className="text-xs font-bold text-slate-500">{r.die1}+{r.die2}={r.total}</span>
                      ) : (
                        <span className="text-[10px] text-slate-600">Position decided</span>
                      )}
                    </div>
                  );
                })}

              {/* CTA */}
              <div className="mt-1">
                {canRoll ? (
                  <button
                    type="button"
                    onClick={handleRoll}
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-amber-500 px-6 py-4 text-base font-black text-slate-950 shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all hover:bg-amber-400 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
                  >
                    {isSubmitting ? "Rolling…" : "🎲 Roll for Order"}
                  </button>
                ) : myIsRolling && myHasRolled ? (
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
