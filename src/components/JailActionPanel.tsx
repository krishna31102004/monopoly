"use client";

import { rollDice } from "@/lib/game/dice";
import type { GameAction, GameState } from "@/types/game";

type JailActionPanelProps = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isMyTurn?: boolean;
};

export function JailActionPanel({ state, dispatch, isMyTurn = true }: JailActionPanelProps) {
  if (state.phase !== "awaitingJailDecision") return null;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer.isInJail) return null;

  const hasCard = currentPlayer.getOutOfJailFreeCards > 0;
  const attemptsLeft = 3 - currentPlayer.jailTurns;

  return (
    <section className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
      <div className="border-b border-amber-200 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">
          Jail Options
        </p>
        <h2 className="mt-0.5 text-lg font-black text-slate-950">
          🔒 {currentPlayer.name} is in Jail
        </h2>
      </div>

      <div className="p-4">
        <p className="mb-3 text-xs font-semibold text-slate-600">
          Doubles attempt{currentPlayer.jailTurns > 0 ? `s: ${currentPlayer.jailTurns}/3` : "s remaining: 3"}.
          {attemptsLeft <= 1 ? " Third attempt — must pay $50 if not doubles." : ""}
        </p>

        <div className="grid gap-2">
          <button
            type="button"
            disabled={currentPlayer.cash < 50 || !isMyTurn}
            onClick={() => dispatch({ type: "PAY_JAIL_FEE" })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition-all duration-100 hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Pay $50 to Leave Jail
          </button>

          {hasCard ? (
            <button
              type="button"
              disabled={!isMyTurn}
              onClick={() => dispatch({ type: "USE_JAIL_CARD" })}
              className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-800 transition-all duration-100 hover:bg-emerald-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Use Get Out of Jail Free Card ({currentPlayer.getOutOfJailFreeCards})
            </button>
          ) : null}

          <button
            type="button"
            disabled={!isMyTurn}
            onClick={() => dispatch({ type: "ROLL_IN_JAIL", dice: rollDice() })}
            className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-black tracking-wide text-white transition-all duration-100 hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            Roll for Doubles
          </button>
        </div>
      </div>
    </section>
  );
}
