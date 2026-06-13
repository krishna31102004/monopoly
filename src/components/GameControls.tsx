"use client";

import { useState } from "react";
import { rollDice } from "@/lib/game/dice";
import { TokenIcon } from "@/components/board/TokenIcon";
import type { GameAction, GameState } from "@/types/game";

type GameControlsProps = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isMyTurn?: boolean;
  isAnimating?: boolean;
};

function getTurnStatus(state: GameState) {
  if (state.phase === "gameOver") {
    return { label: "Game over", color: "text-emerald-700" };
  }
  if (state.phase === "bankruptcyPending") {
    const debtorName =
      state.players.find((p) => p.id === state.bankruptcy?.debtorPlayerId)?.name ?? "Player";
    return {
      label: `${debtorName} is resolving bankruptcy — see panel below`,
      color: "text-red-700",
    };
  }
  if (state.phase === "awaitingJailDecision") {
    return { label: "In Jail — choose an option below", color: "text-amber-700" };
  }
  if (state.phase === "awaitingPurchaseDecision") {
    return { label: "Make a decision below", color: "text-amber-700" };
  }
  if (state.phase === "auction") {
    return { label: "Auction in progress", color: "text-amber-700" };
  }
  if (state.phase === "turnComplete") {
    return { label: "Ready to end turn", color: "text-emerald-700" };
  }
  if (state.doublesCount > 0) {
    return {
      label: `${state.doublesCount} double${state.doublesCount === 1 ? "" : "s"} — roll again`,
      color: "text-blue-700",
    };
  }
  return { label: "Roll the dice to move", color: "text-slate-500" };
}

export function GameControls({ state, dispatch, isMyTurn = true, isAnimating = false }: GameControlsProps) {
  const [diceRolling, setDiceRolling] = useState(false);
  const currentPlayer = state.players[state.currentPlayerIndex];
  const canRoll = state.phase === "readyToRoll" && isMyTurn && !isAnimating;
  const canEndTurn = state.phase === "turnComplete" && state.currentPlayerHasRolled && isMyTurn && !isAnimating;
  const isGameOver = state.phase === "gameOver";
  const status = getTurnStatus(state);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header strip */}
      <div
        className="flex items-center gap-3 border-b border-slate-100 px-4 py-3"
        style={{ borderLeftWidth: 4, borderLeftColor: currentPlayer.color }}
      >
        <TokenIcon token={currentPlayer.token} color={currentPlayer.color} size={36} label={currentPlayer.tokenLabel} badge />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            {isGameOver ? "Winner" : "Current Turn"}
          </p>
          <h2 className="truncate text-lg font-black leading-tight text-slate-950">
            {currentPlayer.name}
          </h2>
        </div>
        <span className="shrink-0 text-sm font-black text-slate-400">
          ${currentPlayer.cash.toLocaleString()}
        </span>
      </div>

      <div className="p-4">
        <p className={`text-xs font-bold ${status.color}`}>{status.label}</p>

        {/* Dice result */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {diceRolling
              ? [1, 2].map((i) => (
                  <span
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-300 bg-slate-100 text-lg font-black text-slate-400 shadow-inner"
                    style={{ animation: "spin 0.3s linear infinite" }}
                    aria-hidden="true"
                  >
                    🎲
                  </span>
                ))
              : state.diceRoll
              ? [state.diceRoll.die1, state.diceRoll.die2].map((die, i) => (
                  <span
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-lg font-black text-slate-950 shadow-sm"
                  >
                    {die}
                  </span>
                ))
              : [1, 2].map((i) => (
                  <span
                    key={i}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 text-lg font-black text-slate-400 opacity-40"
                  >
                    —
                  </span>
                ))}
          </div>
          {state.diceRoll && !diceRolling ? (
            <div className="min-w-0">
              <p className="text-xl font-black leading-none text-slate-950">
                = {state.diceRoll.total}
              </p>
              {state.diceRoll.isDouble ? (
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-blue-600">
                  Doubles!
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Landing message */}
        {state.landingMessage && state.phase !== "auction" && state.phase !== "awaitingJailDecision" ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold leading-5 text-emerald-900">
            {state.landingMessage}
          </div>
        ) : null}

        {/* Buttons — hidden during jail decision (jail panel has its own buttons) */}
        {state.phase !== "awaitingJailDecision" ? (
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              disabled={!canRoll || isGameOver || diceRolling}
              onClick={() => {
                setDiceRolling(true);
                setTimeout(() => setDiceRolling(false), 350);
                dispatch({ type: "ROLL_DICE", dice: rollDice() });
              }}
              className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-black tracking-wide text-white transition-all duration-100 hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {diceRolling ? "Rolling…" : isAnimating ? "Moving…" : "Roll Dice"}
            </button>
            <button
              type="button"
              disabled={!canEndTurn || isGameOver}
              onClick={() => dispatch({ type: "END_TURN" })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition-all duration-100 hover:bg-white hover:border-slate-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
            >
              End Turn
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
