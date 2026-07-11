"use client";

import { useState } from "react";
import { DiceFace } from "@/components/DiceFace";
import { rollDice } from "@/lib/game/dice";
import { DICE_ROLL_MS } from "@/lib/animation/timing";
import type { GameAction, GameState } from "@/types/game";

type MobileActionBarProps = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isMyTurn?: boolean;
  isAnimating?: boolean;
  presentationStatus?: string | null;
};

function shortPhaseLabel(state: GameState, isMyTurn: boolean): string {
  switch (state.phase) {
    case "readyToRoll":       return isMyTurn ? "Your turn — roll!" : `${state.players[state.currentPlayerIndex]?.name ?? ""}…`;
    case "turnComplete":      return isMyTurn ? "End your turn" : "Waiting…";
    case "awaitingPurchaseDecision": return "Buy or decline?";
    case "awaitingJailDecision":     return "Choose jail option below";
    case "auction":           return "Auction in progress";
    case "bankruptcyPending": return "Resolve payment below";
    case "gameOver":          return "Game over";
    default:                  return "";
  }
}

export function MobileActionBar({
  state,
  dispatch,
  isMyTurn = true,
  isAnimating = false,
  presentationStatus,
}: MobileActionBarProps) {
  const [localRolling, setLocalRolling] = useState(false);

  if (state.phase === "gameOver") return null;
  // AuctionPanel renders its own full-screen overlay with sticky bid controls —
  // hiding the bottom bar prevents it from overlapping auction content on mobile.
  if (state.phase === "auction") return null;

  const currentPlayer = state.players[state.currentPlayerIndex];
  const canRoll =
    state.phase === "readyToRoll" &&
    isMyTurn &&
    !isAnimating &&
    !localRolling &&
    !presentationStatus;
  const canEndTurn =
    state.phase === "turnComplete" &&
    state.currentPlayerHasRolled &&
    isMyTurn &&
    !isAnimating &&
    !presentationStatus;

  function handleRoll() {
    if (!canRoll) return;
    setLocalRolling(true);
    setTimeout(() => setLocalRolling(false), DICE_ROLL_MS);
    dispatch({ type: "ROLL_DICE", dice: rollDice() });
  }

  const actionLabel =
    localRolling || presentationStatus === "Rolling dice…"
      ? "Rolling…"
      : isAnimating || presentationStatus
        ? presentationStatus ?? "Moving…"
        : canEndTurn
          ? "End Turn"
          : "Roll Dice";

  const actionDisabled = (!canRoll && !canEndTurn) || !!presentationStatus || localRolling;

  return (
    /* Hidden on sm+ — desktop uses the sidebar GameControls instead */
    <div
      className="fixed bottom-0 left-0 right-0 z-50 sm:hidden border-t-2 border-slate-200 bg-white/95 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.12)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderLeftWidth: 4, borderLeftColor: currentPlayer?.color ?? "#94a3b8" }}
      >
        {/* Dice faces */}
        <div className="flex shrink-0 items-center gap-1">
          {localRolling ? (
            <>
              <DiceFace value={3} size={28} rolling />
              <DiceFace value={5} size={28} rolling />
            </>
          ) : state.diceRoll ? (
            <>
              <DiceFace value={state.diceRoll.die1} size={28} />
              <DiceFace value={state.diceRoll.die2} size={28} />
            </>
          ) : (
            <>
              <DiceFace value={1} size={28} className="opacity-20" />
              <DiceFace value={1} size={28} className="opacity-20" />
            </>
          )}
        </div>

        {/* Player info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black leading-tight text-slate-950">
            {currentPlayer?.name ?? ""}
          </p>
          <p className="truncate text-[10px] font-semibold text-slate-500">
            {presentationStatus ?? shortPhaseLabel(state, isMyTurn)}
          </p>
        </div>

        {/* Cash */}
        <span className="shrink-0 text-sm font-black text-slate-700">
          ${(currentPlayer?.cash ?? 0).toLocaleString()}
        </span>

        {/* Primary action button */}
        <button
          type="button"
          onClick={canEndTurn ? () => dispatch({ type: "END_TURN" }) : handleRoll}
          disabled={actionDisabled}
          className="mobile-action-btn shrink-0 rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition-all active:scale-[0.97] disabled:bg-slate-300 disabled:text-slate-400 whitespace-nowrap"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
