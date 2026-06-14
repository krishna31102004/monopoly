"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRoom } from "@/hooks/useRoom";
import { TokenPicker } from "@/components/multiplayer/TokenPicker";
import { RoomLobby } from "@/components/multiplayer/RoomLobby";
import { GameLayoutMultiplayer } from "@/components/multiplayer/GameLayoutMultiplayer";
import type { PlayerToken } from "@/types/player";
import type { GameRules } from "@/types/game";

type Props = {
  initialCode?: string;
};

export function JoinRoom({ initialCode = "" }: Props) {
  const {
    status,
    connected,
    connecting,
    room,
    myPlayerId,
    gameState,
    error,
    joinRoom,
    startGame,
    leaveRoom,
    clearError,
    sendAction,
    requestGameSync,
  } = useRoom();

  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [token, setToken] = useState<PlayerToken | null>(null);
  const [tokenLabel, setTokenLabel] = useState("");
  const [tokenColor, setTokenColor] = useState("");
  const [formError, setFormError] = useState("");
  const [previewTokens, setPreviewTokens] = useState<import("@/types/player").PlayerToken[]>([]);

  useEffect(() => {
    if (initialCode) setCode(initialCode.toUpperCase());
  }, [initialCode]);

  // Fetch taken tokens for the room so the TokenPicker can show them as disabled pre-join
  useEffect(() => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { setPreviewTokens([]); return; }
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
    fetch(`${socketUrl}/room/${trimmed}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok && Array.isArray(d.takenTokens)) setPreviewTokens(d.takenTokens); })
      .catch(() => setPreviewTokens([]));
  }, [code]);

  function handleJoin() {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedName) { setFormError("Enter your display name."); return; }
    if (!trimmedCode) { setFormError("Enter the room code."); return; }
    if (!token) { setFormError("Choose a token."); return; }
    setFormError("");
    clearError();
    joinRoom({
      displayName: trimmedName,
      roomCode: trimmedCode,
      token,
      tokenLabel,
      color: tokenColor,
    });
  }

  const takenTokens = room?.takenTokens ?? previewTokens;

  if (room && myPlayerId && gameState && room.status === "inGame") {
    return (
      <GameLayoutMultiplayer
        gameState={gameState}
        myPlayerId={myPlayerId}
        room={room}
        sendAction={sendAction}
        error={error}
        connectionStatus={status}
        onLeave={leaveRoom}
        onRequestSync={requestGameSync}
      />
    );
  }

  if (room && myPlayerId) {
    return (
      <RoomLobby
        room={room}
        myPlayerId={myPlayerId}
        onStartGame={(rules: GameRules) => startGame(rules)}
        onLeave={leaveRoom}
        error={error}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-300"
        >
          ← Back
        </Link>

        <h1 className="mb-1 text-2xl font-black text-white">Join a Room</h1>
        <p className="mb-6 text-sm text-slate-400">
          Enter the room code shared by your host.
        </p>

        {connecting && (
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-400">
            Connecting to server…
          </div>
        )}
        {!connecting && !connected && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm font-bold text-red-300">
            Cannot reach multiplayer server.
            {error && <p className="mt-1 font-normal">{error}</p>}
          </div>
        )}

        <div className="space-y-5">
          {/* Room code */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Room Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setFormError(""); }}
              placeholder="e.g. LONDON-4821"
              maxLength={20}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-white placeholder-slate-600 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setFormError(""); }}
              placeholder="e.g. Bob"
              maxLength={30}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-600 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Token */}
          <TokenPicker
            selected={token}
            takenTokens={takenTokens}
            onChange={(t, label, color) => { setToken(t); setTokenLabel(label); setTokenColor(color); setFormError(""); }}
          />

          {formError && <p className="text-sm font-bold text-red-400">{formError}</p>}
          {error && !formError && <p className="text-sm font-bold text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleJoin}
            disabled={!connected}
            className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-base font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {connected ? "Join Room" : "Server unavailable"}
          </button>
        </div>
      </div>
    </div>
  );
}
