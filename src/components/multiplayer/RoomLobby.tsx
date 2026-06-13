"use client";

import { useState } from "react";
import type { RoomPublicView } from "@/types/multiplayer";

type Props = {
  room: RoomPublicView;
  myPlayerId: string;
  onStartGame: () => void;
  onLeave: () => void;
  error: string | null;
};

export function RoomLobby({ room, myPlayerId, onStartGame, onLeave, error }: Props) {
  const [copied, setCopied] = useState(false);
  const myPlayer = room.players.find((p) => p.playerId === myPlayerId);
  const isHost = myPlayer?.isHost ?? false;
  const canStart = isHost && room.players.filter((p) => p.connected).length >= 2;

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${room.roomCode}`
      : `/join/${room.roomCode}`;

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-md">
        {/* Room code */}
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Room Code
          </p>
          <p className="mt-1 font-mono text-4xl font-black tracking-wider text-white">
            {room.roomCode}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
          >
            {copied ? "✓ Copied!" : "Copy Invite Link"}
          </button>
          <p className="mt-2 break-all text-[10px] text-slate-600">{inviteUrl}</p>
        </div>

        {/* Player list */}
        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Players ({room.players.filter((p) => p.connected).length} / {room.maxPlayers})
          </p>
          <div className="space-y-2">
            {room.players.map((p) => (
              <div
                key={p.playerId}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2",
                  p.playerId === myPlayerId
                    ? "border border-slate-600 bg-slate-800"
                    : "bg-slate-800/50",
                  !p.connected ? "opacity-50" : "",
                ].join(" ")}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                  style={{ backgroundColor: p.color }}
                >
                  {p.tokenLabel.slice(0, 3)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">
                    {p.displayName}
                    {p.playerId === myPlayerId && (
                      <span className="ml-1.5 text-[10px] font-normal text-slate-400">(you)</span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {p.isHost ? "Host" : "Player"}
                    {!p.connected && " · Disconnected"}
                  </p>
                </div>
                {p.connected ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-slate-600" />
                )}
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({
              length: room.maxPlayers - room.players.length,
            }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 rounded-lg bg-slate-800/20 px-3 py-2"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-700 text-[10px] font-black text-slate-600">
                  ?
                </span>
                <p className="text-xs text-slate-600">Waiting for player…</p>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm font-semibold text-red-300">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="grid gap-3">
          {isHost ? (
            <>
              <button
                type="button"
                onClick={onStartGame}
                disabled={!canStart}
                className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-base font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {canStart ? "Start Game" : "Waiting for players… (need ≥2)"}
              </button>
              <p className="text-center text-xs text-slate-600">
                Share the room code with friends before starting.
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-4 text-center">
              <p className="text-sm font-bold text-slate-300">
                Waiting for host to start the game…
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onLeave}
            className="w-full rounded-xl border border-slate-700 py-3 text-sm font-bold text-slate-400 hover:text-slate-200"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
