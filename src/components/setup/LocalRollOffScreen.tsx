"use client";

import { useRef, useState } from "react";
import { DiceFace } from "@/components/DiceFace";
import { rollDice } from "@/lib/game/dice";
import {
  buildInitialAgenda,
  advanceRollOffAgenda,
  isAgendaResolved,
  flattenAgenda,
  getCurrentRollingGroup,
  ordinalLabel,
} from "@/lib/game/rollOff";
import type { RollOffAgendaItem, RollOffEntry } from "@/lib/game/rollOff";
import type { StartGamePlayer } from "@/types/game";

const ANIMATION_MS = 1200;
const RESULT_LINGER_MS = 1600;

type LocalRollState = {
  agenda: RollOffAgendaItem[];
  round: number;
  rollingGroup: string[];
  roundRolls: Record<string, RollOffEntry>;
  allRolls: Record<string, RollOffEntry>;
  resolvedOrder: string[] | null;
  phase: "rolling" | "done";
};

type PlayerAnimState = {
  animating: boolean;
  die1: number;
  die2: number;
  showResult: boolean;
};

type Props = {
  players: StartGamePlayer[];
  onComplete: (sortedPlayers: StartGamePlayer[]) => void;
};

export function LocalRollOffScreen({ players, onComplete }: Props) {
  const playerIds = players.map((_, i) => `local-${i}`);
  const playerById = new Map(players.map((p, i) => [`local-${i}`, p]));

  const [rollState, setRollState] = useState<LocalRollState>({
    agenda: [{ kind: "tied", playerIds }],
    round: 1,
    rollingGroup: playerIds,
    roundRolls: {},
    allRolls: {},
    resolvedOrder: null,
    phase: "rolling",
  });

  // Per-player animation state
  const [animMap, setAnimMap] = useState<Record<string, PlayerAnimState>>({});
  const intervalRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  function handleRoll(playerId: string) {
    if (animMap[playerId]?.animating) return;

    // Generate dice immediately (authoritative)
    const dice = rollDice();
    const entry: RollOffEntry = { die1: dice.die1, die2: dice.die2, total: dice.total };

    // Start animation
    let t = 1;
    setAnimMap((m) => ({ ...m, [playerId]: { animating: true, die1: 1, die2: 6, showResult: false } }));
    intervalRefs.current[playerId] = setInterval(() => {
      t = (t % 6) + 1;
      setAnimMap((m) => ({
        ...m,
        [playerId]: { ...m[playerId], die1: t, die2: ((t + 2) % 6) + 1 },
      }));
    }, 90);

    setTimeout(() => {
      clearInterval(intervalRefs.current[playerId]);
      // Show final result
      setAnimMap((m) => ({
        ...m,
        [playerId]: { animating: false, die1: entry.die1, die2: entry.die2, showResult: true },
      }));

      // Advance game state after linger
      setTimeout(() => {
        setRollState((prev) => {
          const newRolls = { ...prev.roundRolls, [playerId]: entry };
          const newAllRolls = { ...prev.allRolls, [playerId]: entry };

          const allRolled = prev.rollingGroup.every((id) => id in newRolls);
          if (!allRolled) {
            return { ...prev, roundRolls: newRolls, allRolls: newAllRolls };
          }

          const isFirst = prev.round === 1;
          const newAgenda = isFirst
            ? buildInitialAgenda(prev.rollingGroup, newRolls)
            : advanceRollOffAgenda(prev.agenda, newRolls);

          if (isAgendaResolved(newAgenda)) {
            return {
              ...prev,
              agenda: newAgenda,
              roundRolls: newRolls,
              allRolls: newAllRolls,
              resolvedOrder: flattenAgenda(newAgenda),
              phase: "done",
            };
          }

          const nextGroup = getCurrentRollingGroup(newAgenda);
          return {
            agenda: newAgenda,
            round: prev.round + 1,
            rollingGroup: nextGroup,
            roundRolls: {},
            allRolls: newAllRolls,
            resolvedOrder: null,
            phase: "rolling",
          };
        });
      }, RESULT_LINGER_MS);
    }, ANIMATION_MS);
  }

  function handleStart() {
    if (!rollState.resolvedOrder) return;
    const sorted = rollState.resolvedOrder
      .map((id) => playerById.get(id))
      .filter(Boolean) as StartGamePlayer[];
    onComplete(sorted);
  }

  const { round, rollingGroup, roundRolls, allRolls, resolvedOrder, phase } = rollState;
  const isTieBreaker = round > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
      <section className="w-full max-w-md rounded-2xl border border-amber-300/30 bg-white shadow-[0_32px_100px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="border-b border-amber-100 bg-amber-50 px-6 py-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
            {isTieBreaker ? `Tie Breaker — Round ${round}` : "Pre-Game"}
          </p>
          <h2 className="mt-0.5 text-lg font-black text-slate-950">Roll for Turn Order</h2>
          <p className="text-xs text-slate-500">
            {isTieBreaker ? "Tied players re-roll to decide position." : "Highest roll goes first."}
          </p>
        </div>

        <div className="p-5 space-y-2">
          {phase === "done" && resolvedOrder ? (
            /* Final order */
            <>
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">
                Turn Order Decided!
              </p>
              {resolvedOrder.map((id, idx) => {
                const player = playerById.get(id);
                if (!player) return null;
                const r = allRolls[id];
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                      idx === 0 ? "border border-amber-300 bg-amber-50" : "bg-slate-50"
                    }`}
                  >
                    <span className="w-8 shrink-0 text-center text-sm font-black text-amber-600">
                      {ordinalLabel(idx + 1)}
                    </span>
                    <span className="flex-1 text-sm font-bold text-slate-900">{player.name}</span>
                    {r && (
                      <span className="text-xs font-black text-amber-700 tabular-nums">
                        {r.die1}+{r.die2}={r.total}
                      </span>
                    )}
                    {idx === 0 && (
                      <span className="text-[10px] font-black text-amber-600">★ First</span>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handleStart}
                className="mt-3 w-full rounded-xl bg-slate-950 px-6 py-3 text-base font-black text-white hover:bg-slate-800 active:scale-[0.98]"
              >
                Begin Game →
              </button>
            </>
          ) : (
            /* Rolling phase */
            <>
              {isTieBreaker && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-bold text-amber-700">
                  Tie! {rollingGroup.map((id) => playerById.get(id)?.name ?? id).join(" and ")} must roll again.
                </div>
              )}

              {rollingGroup.map((id) => {
                const player = playerById.get(id);
                if (!player) return null;
                const anim = animMap[id];
                const hasRolled = id in roundRolls;
                const isAnimating = anim?.animating;

                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <span className="flex-1 text-sm font-bold text-slate-900">{player.name}</span>

                    {isAnimating ? (
                      <div className="flex items-center gap-1.5">
                        <DiceFace value={anim.die1} size={32} rolling />
                        <DiceFace value={anim.die2} size={32} rolling />
                      </div>
                    ) : anim?.showResult && hasRolled ? (
                      <div className="flex items-center gap-1.5">
                        <DiceFace value={roundRolls[id].die1} size={32} />
                        <DiceFace value={roundRolls[id].die2} size={32} />
                        <span className="ml-1 text-sm font-black text-slate-700">
                          ={roundRolls[id].total}
                        </span>
                      </div>
                    ) : !hasRolled ? (
                      <button
                        type="button"
                        onClick={() => handleRoll(id)}
                        className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-700 active:scale-95"
                      >
                        🎲 Roll
                      </button>
                    ) : null}
                  </div>
                );
              })}

              {/* Previously-resolved players */}
              {playerIds
                .filter((id) => !rollingGroup.includes(id))
                .map((id) => {
                  const player = playerById.get(id);
                  const r = allRolls[id];
                  if (!player) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 opacity-50"
                    >
                      <span className="flex-1 text-sm text-slate-500">{player.name}</span>
                      {r && (
                        <span className="text-xs text-slate-400">{r.die1}+{r.die2}={r.total}</span>
                      )}
                    </div>
                  );
                })}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
