"use client";

import { useState, useEffect } from "react";
import { getGameStatusStripInfo, type GameStatusStripParams } from "@/lib/ui/gameStatusStrip";

type GameStatusStripProps = GameStatusStripParams & {
  onSync?: () => void;
  onLeave?: () => void;
  /** Called when the player chooses to forfeit (declare bankruptcy + leave). */
  onForfeit?: () => void;
};

const CONNECTION_LABEL: Record<string, string> = {
  connected: "Connected",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
};

const CONNECTION_CLASS: Record<string, string> = {
  connected: "text-emerald-600",
  reconnecting: "text-amber-600",
  disconnected: "text-red-600",
};

function useTurnCountdown(deadlineAt: number | null): string | null {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadlineAt) { setSecsLeft(null); return; }
    function tick() {
      const s = Math.max(0, Math.ceil((deadlineAt! - Date.now()) / 1000));
      setSecsLeft(s);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineAt]);

  if (secsLeft === null) return null;
  const m = Math.floor(secsLeft / 60);
  const s = secsLeft % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Slim status strip — sticky on mobile, compact inline on desktop. Shows room code + identity
 *  (multiplayer only), current turn player, and phase, without duplicating per-player card info. */
export function GameStatusStrip({ onSync, onLeave, onForfeit, ...params }: GameStatusStripProps) {
  const info = getGameStatusStripInfo(params);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const countdown = useTurnCountdown(params.state.turnDeadlineAt ?? null);
  const countdownWarning = countdown !== null && params.state.turnDeadlineAt !== null && (params.state.turnDeadlineAt - Date.now()) < 60_000;

  return (
    <>
      <div className="game-status-strip mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm sm:rounded-lg">
        <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
          {info.phaseLabel}
        </span>
        <span className="font-bold text-slate-900">{info.currentPlayerName}&rsquo;s turn</span>

        {info.isMultiplayer && info.roomCode ? (
          <span className="text-slate-400">Room {info.roomCode}</span>
        ) : null}
        {info.isMultiplayer && info.myName ? (
          <span className="text-slate-400">You: {info.myName}</span>
        ) : null}
        {info.connectionStatus && info.connectionStatus !== "connected" ? (
          <span className={CONNECTION_CLASS[info.connectionStatus]}>
            {CONNECTION_LABEL[info.connectionStatus]}
          </span>
        ) : null}

        {countdown !== null && params.state.phase !== "gameOver" && params.state.phase !== "setup" ? (
          <span className={`font-mono text-xs font-bold tabular-nums ${countdownWarning ? "text-red-600" : "text-slate-400"}`}>
            {countdown}
          </span>
        ) : null}

        {info.isMultiplayer && onSync ? (
          <button
            type="button"
            onClick={onSync}
            className="ml-auto rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100"
          >
            Sync
          </button>
        ) : null}
        {info.isMultiplayer && (onLeave || onForfeit) ? (
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="text-[11px] text-slate-400 underline hover:text-slate-600"
          >
            Leave
          </button>
        ) : null}
      </div>

      {showLeaveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-base font-bold text-slate-900">Leave Game?</h2>
            <p className="mb-4 text-sm text-slate-500">
              Choose how you want to leave. You can rejoin temporarily, or forfeit to remove yourself and auction your properties.
            </p>
            <div className="flex flex-col gap-2">
              {onLeave ? (
                <button
                  type="button"
                  onClick={() => { setShowLeaveModal(false); onLeave(); }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Leave Temporarily
                  <span className="ml-1 text-xs font-normal text-slate-400">(rejoin anytime)</span>
                </button>
              ) : null}
              {onForfeit ? (
                <button
                  type="button"
                  onClick={() => { setShowLeaveModal(false); onForfeit(); }}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Forfeit / Declare Bankruptcy
                  <span className="ml-1 text-xs font-normal text-red-200">(auctions your properties)</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="mt-1 text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
