"use client";

import { useState, useEffect } from "react";
import { rollDice } from "@/lib/game/dice";
import { TokenIcon } from "@/components/board/TokenIcon";
import { DiceFace } from "@/components/DiceFace";
import { DICE_ROLL_MS } from "@/lib/animation/timing";
import type { GameAction, GameState } from "@/types/game";

type GameControlsProps = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isMyTurn?: boolean;
  isAnimating?: boolean;
  /** Presentation phase string shown as status during animation (e.g. "Moving…") */
  presentationStatus?: string | null;
  /** When false, the landing message is hidden until the reveal sequence completes */
  showLandingMessage?: boolean;
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

// Dummy die values shown while rolling animation plays
let rollingTick = 1;
function nextRollingValue() {
  rollingTick = (rollingTick % 6) + 1;
  return rollingTick;
}

export function GameControls({ state, dispatch, isMyTurn = true, isAnimating = false, presentationStatus, showLandingMessage = true }: GameControlsProps) {
  const [diceRolling, setDiceRolling] = useState(false);
  const [rollingDie1, setRollingDie1] = useState(3);
  const [rollingDie2, setRollingDie2] = useState(5);
  const [endTurnReminder, setEndTurnReminder] = useState(false);
  const currentPlayer = state.players[state.currentPlayerIndex];
  const canRoll = state.phase === "readyToRoll" && isMyTurn && !isAnimating;
  const canEndTurn = state.phase === "turnComplete" && state.currentPlayerHasRolled && isMyTurn && !isAnimating;
  const isGameOver = state.phase === "gameOver";
  const status = getTurnStatus(state);

  // Show non-annoying reminder after 30s in turnComplete
  useEffect(() => {
    if (!canEndTurn) { setEndTurnReminder(false); return; }
    const t = setTimeout(() => setEndTurnReminder(true), 30_000);
    return () => clearTimeout(t);
  }, [canEndTurn]);

  function handleRoll() {
    setDiceRolling(true);
    // Animate rolling dice faces while waiting for server/reducer
    const shuffleInterval = setInterval(() => {
      setRollingDie1(nextRollingValue());
      setRollingDie2(nextRollingValue());
    }, 80);
    setTimeout(() => {
      clearInterval(shuffleInterval);
      setDiceRolling(false);
    }, DICE_ROLL_MS);
    dispatch({ type: "ROLL_DICE", dice: rollDice() });
  }

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
        <p className={`text-xs font-bold ${presentationStatus ? "text-slate-500" : status.color}`}>
          {presentationStatus ?? status.label}
        </p>

        {/* Dice display */}
        <div className="mt-3 flex items-center gap-3">
          {diceRolling ? (
            <>
              <DiceFace value={rollingDie1} size={44} rolling />
              <DiceFace value={rollingDie2} size={44} rolling />
              <p className="text-sm font-bold text-slate-400">Rolling…</p>
            </>
          ) : state.diceRoll ? (
            <>
              <DiceFace value={state.diceRoll.die1} size={44} />
              <DiceFace value={state.diceRoll.die2} size={44} />
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
            </>
          ) : (
            <>
              <DiceFace value={1} size={44} className="opacity-25" />
              <DiceFace value={1} size={44} className="opacity-25" />
            </>
          )}
        </div>

        {/* Landing message — gated on presentation reveal */}
        {state.landingMessage && showLandingMessage && state.phase !== "auction" && state.phase !== "awaitingJailDecision" ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold leading-5 text-emerald-900">
            {state.landingMessage}
          </div>
        ) : null}

        {/* Free Parking pot */}
        {state.rules?.freeParkingCash && (state.freeParkingPot ?? 0) > 0 ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
            <span>🅿️</span>
            <span>Free Parking pot:</span>
            <span className="font-black text-slate-900">${(state.freeParkingPot ?? 0).toLocaleString()}</span>
          </div>
        ) : null}

        {/* Buttons — hidden during jail decision (jail panel has its own buttons) */}
        {state.phase !== "awaitingJailDecision" ? (
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              disabled={!canRoll || isGameOver || diceRolling || !!presentationStatus}
              onClick={handleRoll}
              className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-black tracking-wide text-white transition-all duration-100 hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {diceRolling ? "Rolling…" : isAnimating ? "Moving…" : "Roll Dice"}
            </button>
            <button
              type="button"
              disabled={!canEndTurn || isGameOver || !!presentationStatus}
              onClick={() => { setEndTurnReminder(false); dispatch({ type: "END_TURN" }); }}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm font-bold transition-all duration-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30 ${
                endTurnReminder
                  ? "animate-pulse border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:border-slate-300"
              }`}
            >
              End Turn{endTurnReminder ? " ↩" : ""}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
