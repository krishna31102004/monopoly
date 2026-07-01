"use client";

import { useState } from "react";
import Link from "next/link";
import { useRoom } from "@/hooks/useRoom";
import { TokenPicker } from "@/components/multiplayer/TokenPicker";
import { RoomLobby } from "@/components/multiplayer/RoomLobby";
import { RollOffScreen } from "@/components/multiplayer/RollOffScreen";
import { GameLayoutMultiplayer } from "@/components/multiplayer/GameLayoutMultiplayer";
import type { PlayerToken } from "@/types/player";
import type { GameRules } from "@/types/game";

export function CreateRoom() {
  const {
    status,
    connected,
    connecting,
    room,
    myPlayerId,
    gameState,
    rollOff,
    error,
    createRoom,
    startGame,
    rollForOrder,
    beginRollOffGame,
    leaveRoom,
    forfeitGame,
    clearError,
    sendAction,
    requestGameSync,
    tradeDraft,
    startTradeDraft,
    updateTradeDraft,
    cancelTradeDraft,
    submitTradeDraft,
  } = useRoom();

  const [name, setName] = useState("");
  const [token, setToken] = useState<PlayerToken | null>(null);
  const [tokenLabel, setTokenLabel] = useState("");
  const [tokenColor, setTokenColor] = useState("");
  const [nameError, setNameError] = useState("");

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) { setNameError("Enter your display name."); return; }
    if (!token) { setNameError("Choose a token."); return; }
    setNameError("");
    clearError();
    createRoom({ displayName: trimmed, token, tokenLabel, color: tokenColor });
  }

  // Show roll-off screen during roll-off phase
  if (room && myPlayerId && room.status === "rollOff" && rollOff) {
    return (
      <RollOffScreen
        rollOff={rollOff}
        players={room.players}
        myPlayerId={myPlayerId}
        isHost={room.players.find((p) => p.playerId === myPlayerId)?.isHost ?? false}
        onRoll={rollForOrder}
        onBeginGame={beginRollOffGame}
      />
    );
  }

  // Show game board once game is in progress
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
        onForfeit={forfeitGame}
        onRequestSync={requestGameSync}
        tradeDraft={tradeDraft}
        startTradeDraft={startTradeDraft}
        updateTradeDraft={updateTradeDraft}
        cancelTradeDraft={cancelTradeDraft}
        submitTradeDraft={submitTradeDraft}
      />
    );
  }

  // Show lobby while waiting
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

        <h1 className="mb-1 text-2xl font-black text-white">Create Private Room</h1>
        <p className="mb-6 text-sm text-slate-400">
          Enter your details, then share the room code with friends.
        </p>

        {/* Server connection status */}
        {connecting && (
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-400">
            Connecting to server…
          </div>
        )}
        {!connecting && !connected && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm font-bold text-red-300">
            Cannot reach multiplayer server. Make sure it is running.
            {error && <p className="mt-1 font-normal">{error}</p>}
          </div>
        )}

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              placeholder="e.g. Alice"
              maxLength={30}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-600 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Token */}
          <TokenPicker
            selected={token}
            takenTokens={[]}
            onChange={(t, label, color) => { setToken(t); setTokenLabel(label); setTokenColor(color); setNameError(""); }}
          />

          {nameError && (
            <p className="text-sm font-bold text-red-400">{nameError}</p>
          )}
          {error && !nameError && (
            <p className="text-sm font-bold text-red-400">{error}</p>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={!connected}
            className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-base font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {connected ? "Create Room" : "Server unavailable"}
          </button>
        </div>
      </div>
    </div>
  );
}
