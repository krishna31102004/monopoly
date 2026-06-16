"use client";

import { getGameStatusStripInfo, type GameStatusStripParams } from "@/lib/ui/gameStatusStrip";

type GameStatusStripProps = GameStatusStripParams & {
  onSync?: () => void;
  onLeave?: () => void;
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

/** Slim status strip — sticky on mobile, compact inline on desktop. Shows room code + identity
 *  (multiplayer only), current turn player, and phase, without duplicating per-player card info. */
export function GameStatusStrip({ onSync, onLeave, ...params }: GameStatusStripProps) {
  const info = getGameStatusStripInfo(params);

  return (
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

      {info.isMultiplayer && onSync ? (
        <button
          type="button"
          onClick={onSync}
          className="ml-auto rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100"
        >
          Sync
        </button>
      ) : null}
      {info.isMultiplayer && onLeave ? (
        <button type="button" onClick={onLeave} className="text-[11px] text-slate-400 underline hover:text-slate-600">
          Leave
        </button>
      ) : null}
    </div>
  );
}
