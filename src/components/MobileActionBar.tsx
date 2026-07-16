"use client";

import { useState } from "react";
import { DiceFace } from "@/components/DiceFace";
import { UiIcon, type UiIconName } from "@/components/ui/UiIcon";
import { rollDice } from "@/lib/game/dice";
import { DICE_ROLL_MS } from "@/lib/animation/timing";
import {
  MOBILE_GAME_TABS,
  getMobilePhaseLabel,
  getMobilePrimaryAction,
  type MobileGameTab,
} from "@/lib/ui/mobileGameNavigation";
import type { GameAction, GameState } from "@/types/game";

type MobileActionBarProps = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isMyTurn?: boolean;
  isAnimating?: boolean;
  presentationStatus?: string | null;
  activeTab: MobileGameTab;
  onTabChange: (tab: MobileGameTab) => void;
  actionAttention?: string | null;
};

const TAB_CONFIG: Record<MobileGameTab, { label: string; icon: UiIconName }> = {
  board: { label: "Board", icon: "board" },
  actions: { label: "Actions", icon: "dice" },
  players: { label: "Players", icon: "players" },
  log: { label: "Log", icon: "log" },
};

export function MobileActionBar({
  state,
  dispatch,
  isMyTurn = true,
  isAnimating = false,
  presentationStatus,
  activeTab,
  onTabChange,
  actionAttention,
}: MobileActionBarProps) {
  const [localRolling, setLocalRolling] = useState(false);

  if (state.phase === "gameOver") return null;
  // AuctionPanel renders its own full-screen overlay with sticky bid controls —
  // hiding the bottom bar prevents it from overlapping auction content on mobile.
  if (state.phase === "auction") return null;

  const currentPlayer = state.players[state.currentPlayerIndex];
  const primaryAction = getMobilePrimaryAction(
    state,
    isMyTurn,
    isAnimating || localRolling || !!presentationStatus,
  );
  const canRoll = primaryAction.kind === "roll" && !primaryAction.disabled;
  const canEndTurn = primaryAction.kind === "end-turn" && !primaryAction.disabled;

  function handleRoll() {
    if (!canRoll) return;
    setLocalRolling(true);
    setTimeout(() => setLocalRolling(false), DICE_ROLL_MS);
    dispatch({ type: "ROLL_DICE", dice: rollDice() });
  }

  const actionLabel = localRolling || presentationStatus === "Rolling dice…"
    ? "Rolling…"
    : presentationStatus ?? primaryAction.label;

  function handlePrimaryAction() {
    if (primaryAction.kind === "roll") handleRoll();
    if (primaryAction.kind === "end-turn") dispatch({ type: "END_TURN" });
    if (primaryAction.kind === "open-actions") onTabChange("actions");
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--wc-border)] bg-[var(--wc-navy)] text-slate-100 shadow-[0_-10px_28px_rgba(7,16,31,.28)] xl:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className="flex min-h-14 items-center gap-2 px-3 py-2"
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
          <p className="truncate text-sm font-black leading-tight text-white">
            {currentPlayer?.name ?? ""}
          </p>
          <p className="truncate text-[10px] font-semibold text-slate-400">
            {presentationStatus ?? getMobilePhaseLabel(state)}
          </p>
        </div>

        {/* Cash */}
        <span className="wc-numeric shrink-0 text-sm font-black text-white">
          ${(currentPlayer?.cash ?? 0).toLocaleString()}
        </span>

        {/* Primary action button */}
        <button
          type="button"
          onClick={handlePrimaryAction}
          disabled={primaryAction.disabled}
          className="mobile-action-btn wc-button wc-button-primary shrink-0 whitespace-nowrap px-3 text-xs"
        >
          {actionLabel}
        </button>
      </div>
      <nav aria-label="Game sections" className="grid grid-cols-4 border-t border-[var(--wc-border-subtle)]">
        {MOBILE_GAME_TABS.map((tab) => {
          const config = TAB_CONFIG[tab];
          const selected = activeTab === tab;
          const hasAttention = tab === "actions" && !!actionAttention;
          return (
            <button
              key={tab}
              type="button"
              aria-current={selected ? "page" : undefined}
              aria-label={hasAttention ? `${config.label}: ${actionAttention}` : config.label}
              onClick={() => onTabChange(tab)}
              className={`relative flex min-h-11 flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${selected ? "bg-[var(--wc-navy-elevated)] text-amber-100" : "text-slate-400 hover:bg-[var(--wc-navy-raised)] hover:text-white"}`}
            >
              <UiIcon name={config.icon} size={17} aria-hidden="true" />
              <span>{config.label}</span>
              {hasAttention ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
