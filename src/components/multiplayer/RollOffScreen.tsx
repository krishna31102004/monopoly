"use client";

import { ordinalLabel } from "@/lib/game/rollOff";
import type { RollOffPublicView, RoomPlayer } from "@/types/multiplayer";

type Props = {
  rollOff: RollOffPublicView;
  players: RoomPlayer[];
  myPlayerId: string;
  onRoll: () => void;
};

function DieFace({ value }: { value: number }) {
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-white/30 bg-white/10 text-base font-black text-white shadow"
      aria-label={`Die: ${value}`}
    >
      {value}
    </span>
  );
}

export function RollOffScreen({ rollOff, players, myPlayerId, onRoll }: Props) {
  const { round, rollingThisRound, pendingPlayerIds, rolls, resolvedOrder } = rollOff;

  const myIsRolling = rollingThisRound.includes(myPlayerId);
  const myHasRolled = myPlayerId in rolls;
  const canRoll = myIsRolling && !myHasRolled;

  const isTieBreaker = round > 1;

  // Map playerId → player
  const playerMap = new Map(players.map((p) => [p.playerId, p]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4">
      <section
        className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-slate-900 shadow-[0_32px_100px_rgba(0,0,0,0.6)]"
        aria-labelledby="rolloff-title"
      >
        {/* Header */}
        <div className="border-b border-amber-400/20 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 px-6 py-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">
            {isTieBreaker ? `Tie Breaker — Round ${round}` : "Round 1"}
          </p>
          <h2 id="rolloff-title" className="mt-1 text-xl font-black text-white">
            Roll for Turn Order
          </h2>
          <p className="mt-1 text-xs text-amber-100/70">
            {isTieBreaker
              ? "Tied players roll again to decide their position."
              : "Highest roll goes first. Roll to decide who starts!"}
          </p>
        </div>

        <div className="p-5">
          {/* If resolved, show final order */}
          {resolvedOrder ? (
            <div className="space-y-2">
              <p className="mb-3 text-center text-[10px] font-black uppercase tracking-widest text-emerald-400">
                Turn Order Decided!
              </p>
              {resolvedOrder.map((id, idx) => {
                const player = playerMap.get(id);
                if (!player) return null;
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                      idx === 0 ? "border border-amber-400/50 bg-amber-900/40" : "bg-slate-800"
                    }`}
                  >
                    <span className="w-8 text-center text-sm font-black text-amber-300">
                      {ordinalLabel(idx + 1)}
                    </span>
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.tokenLabel.slice(0, 3)}
                    </span>
                    <span className="flex-1 text-sm font-bold text-white">{player.displayName}</span>
                    {idx === 0 && (
                      <span className="text-xs font-black text-amber-300">Goes first!</span>
                    )}
                  </div>
                );
              })}
              <p className="mt-4 text-center text-xs text-slate-500">Starting game…</p>
            </div>
          ) : (
            /* Show rolling state */
            <div className="space-y-2">
              {/* Players in current rolling group */}
              {rollingThisRound.map((id) => {
                const player = playerMap.get(id);
                if (!player) return null;
                const roll = rolls[id];
                const isMe = id === myPlayerId;
                const hasPendingRoll = pendingPlayerIds.includes(id);

                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                      isMe
                        ? "border border-amber-400/50 bg-amber-900/30"
                        : "bg-slate-800"
                    }`}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.tokenLabel.slice(0, 3)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">
                        {player.displayName}
                        {isMe && <span className="ml-1.5 text-[10px] text-slate-400">(you)</span>}
                      </p>
                    </div>
                    {roll ? (
                      <div className="flex items-center gap-1.5">
                        <DieFace value={roll.die1} />
                        <DieFace value={roll.die2} />
                        <span className="ml-1 text-sm font-black text-amber-300">={roll.total}</span>
                      </div>
                    ) : hasPendingRoll ? (
                      <span className="text-[10px] font-semibold text-slate-500">Waiting…</span>
                    ) : null}
                  </div>
                );
              })}

              {/* Players outside the current rolling group (spectators this round) */}
              {players
                .filter((p) => !rollingThisRound.includes(p.playerId))
                .map((player) => (
                  <div
                    key={player.playerId}
                    className="flex items-center gap-3 rounded-lg bg-slate-800/40 px-3 py-2.5 opacity-50"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.tokenLabel.slice(0, 3)}
                    </span>
                    <p className="flex-1 text-sm font-bold text-slate-400">{player.displayName}</p>
                    <span className="text-[10px] text-slate-600">Position decided</span>
                  </div>
                ))}

              {/* Roll button for my turn */}
              <div className="mt-4">
                {canRoll ? (
                  <button
                    type="button"
                    onClick={onRoll}
                    className="w-full rounded-xl bg-amber-500 px-6 py-4 text-base font-black text-slate-950 shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all hover:bg-amber-400 active:translate-y-0.5 active:shadow-none"
                  >
                    🎲 Roll for Order
                  </button>
                ) : myIsRolling && myHasRolled ? (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-4 text-center text-sm font-semibold text-slate-400">
                    {pendingPlayerIds.length > 0
                      ? `Waiting for ${pendingPlayerIds.length} more player${pendingPlayerIds.length > 1 ? "s" : ""} to roll…`
                      : "All rolled — resolving…"}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-6 py-4 text-center text-sm font-semibold text-slate-400">
                    {isTieBreaker ? "Waiting for tied players to re-roll…" : "Waiting for others to roll…"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
