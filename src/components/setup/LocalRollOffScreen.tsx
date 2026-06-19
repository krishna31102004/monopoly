"use client";

import { useState } from "react";
import { rollDice } from "@/lib/game/dice";
import { buildInitialAgenda, advanceRollOffAgenda, isAgendaResolved, flattenAgenda, getCurrentRollingGroup, ordinalLabel } from "@/lib/game/rollOff";
import type { RollOffAgendaItem, RollOffEntry } from "@/lib/game/rollOff";
import type { StartGamePlayer } from "@/types/game";

type LocalRollState = {
  agenda: RollOffAgendaItem[];
  round: number;
  rollingGroup: string[];
  roundRolls: Record<string, RollOffEntry>;
  resolvedOrder: string[] | null;
  phase: "rolling" | "done";
};

type Props = {
  players: StartGamePlayer[];
  onComplete: (sortedPlayers: StartGamePlayer[]) => void;
};

function DieFace({ value }: { value: number }) {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-400 bg-slate-700 text-sm font-black text-white shadow">
      {value}
    </span>
  );
}

export function LocalRollOffScreen({ players, onComplete }: Props) {
  const playerIds = players.map((_, i) => `local-${i}`);
  const playerById = new Map(players.map((p, i) => [`local-${i}`, p]));

  const [rollState, setRollState] = useState<LocalRollState>({
    agenda: [{ kind: "tied", playerIds }],
    round: 1,
    rollingGroup: playerIds,
    roundRolls: {},
    resolvedOrder: null,
    phase: "rolling",
  });

  function handleRoll(playerId: string) {
    const dice = rollDice();
    const entry: RollOffEntry = { die1: dice.die1, die2: dice.die2, total: dice.total };

    setRollState((prev) => {
      const newRolls = { ...prev.roundRolls, [playerId]: entry };

      // Check if all current group has rolled
      const allRolled = prev.rollingGroup.every((id) => id in newRolls);
      if (!allRolled) {
        return { ...prev, roundRolls: newRolls };
      }

      // Advance agenda
      const isFirst = prev.round === 1;
      const newAgenda = isFirst
        ? buildInitialAgenda(prev.rollingGroup, newRolls)
        : advanceRollOffAgenda(prev.agenda, newRolls);

      if (isAgendaResolved(newAgenda)) {
        const resolvedOrder = flattenAgenda(newAgenda);
        return {
          ...prev,
          agenda: newAgenda,
          roundRolls: newRolls,
          resolvedOrder,
          phase: "done",
        };
      }

      // Ties remain
      const nextGroup = getCurrentRollingGroup(newAgenda);
      return {
        agenda: newAgenda,
        round: prev.round + 1,
        rollingGroup: nextGroup,
        roundRolls: {},
        resolvedOrder: null,
        phase: "rolling",
      };
    });
  }

  function handleStart() {
    if (!rollState.resolvedOrder) return;
    const sorted = rollState.resolvedOrder
      .map((id) => playerById.get(id))
      .filter(Boolean) as StartGamePlayer[];
    onComplete(sorted);
  }

  const { round, rollingGroup, roundRolls, resolvedOrder, phase } = rollState;
  const isTieBreaker = round > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
      <section className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-white shadow-[0_32px_100px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="border-b border-amber-100 bg-amber-50 px-6 py-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
            {isTieBreaker ? `Tie Breaker — Round ${round}` : "Pre-Game Roll"}
          </p>
          <h2 className="mt-0.5 text-lg font-black text-slate-950">Roll for Turn Order</h2>
          <p className="text-xs text-slate-500">
            {isTieBreaker ? "Tied players re-roll to decide position." : "Highest roll goes first."}
          </p>
        </div>

        <div className="p-5">
          {phase === "done" && resolvedOrder ? (
            <div className="space-y-2">
              <p className="mb-2 text-center text-[10px] font-black uppercase tracking-widest text-emerald-600">
                Turn Order Decided!
              </p>
              {resolvedOrder.map((id, idx) => {
                const player = playerById.get(id);
                if (!player) return null;
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                      idx === 0 ? "border border-amber-300 bg-amber-50" : "bg-slate-50"
                    }`}
                  >
                    <span className="w-8 text-center text-sm font-black text-amber-600">
                      {ordinalLabel(idx + 1)}
                    </span>
                    <span className="flex-1 text-sm font-bold text-slate-900">{player.name}</span>
                    {idx === 0 && (
                      <span className="text-xs font-black text-amber-600">Goes first!</span>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handleStart}
                className="mt-4 w-full rounded-xl bg-slate-950 px-6 py-3 text-base font-black text-white hover:bg-slate-800 active:scale-[0.98]"
              >
                Start Game →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {rollingGroup.map((id) => {
                const player = playerById.get(id);
                if (!player) return null;
                const roll = roundRolls[id];
                const hasRolled = !!roll;

                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
                  >
                    <span className="flex-1 text-sm font-bold text-slate-900">{player.name}</span>
                    {hasRolled ? (
                      <div className="flex items-center gap-1.5">
                        <DieFace value={roll.die1} />
                        <DieFace value={roll.die2} />
                        <span className="ml-1 text-sm font-black text-slate-700">={roll.total}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRoll(id)}
                        className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-700 active:scale-95"
                      >
                        🎲 Roll
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Players not in current group (resolved) */}
              {playerIds
                .filter((id) => !rollingGroup.includes(id))
                .map((id) => {
                  const player = playerById.get(id);
                  if (!player) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 opacity-50"
                    >
                      <span className="flex-1 text-sm text-slate-500">{player.name}</span>
                      <span className="text-xs text-slate-400">Position decided</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
