"use client";

import { useEffect, useState } from "react";
import { useRoom } from "@/hooks/useRoom";
import { TokenPicker } from "@/components/multiplayer/TokenPicker";
import { RoomLobby } from "@/components/multiplayer/RoomLobby";
import { RollOffScreen } from "@/components/multiplayer/RollOffScreen";
import { GameLayoutMultiplayer } from "@/components/multiplayer/GameLayoutMultiplayer";
import { EntryShell } from "@/components/entry/EntryShell";
import { TokenMedallion } from "@/components/entry/TokenMedallion";
import { UiIcon } from "@/components/ui/UiIcon";
import type { PlayerToken } from "@/types/player";
import type { GameRules } from "@/types/game";

export function CreateRoom() {
  const roomState = useRoom();
  const { status, connected, connecting, room, myPlayerId, gameState, rollOff, error, createRoom, startGame, rollForOrder, beginRollOffGame, leaveRoom, forfeitGame, clearError, sendAction, requestGameSync, tradeDraft, startTradeDraft, updateTradeDraft, cancelTradeDraft, submitTradeDraft } = roomState;
  const [name, setName] = useState(""); const [token, setToken] = useState<PlayerToken | null>(null); const [tokenLabel, setTokenLabel] = useState(""); const [tokenColor, setTokenColor] = useState(""); const [nameError, setNameError] = useState(""); const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (error) setSubmitting(false); }, [error]);
  function handleCreate() { const trimmed = name.trim(); if (!trimmed) { setNameError("Enter your display name."); return; } if (!token) { setNameError("Choose a token."); return; } if (submitting || !connected) return; setNameError(""); clearError(); setSubmitting(true); createRoom({ displayName: trimmed, token, tokenLabel, color: tokenColor }); }
  if (room && myPlayerId && room.status === "rollOff" && rollOff) return <RollOffScreen rollOff={rollOff} players={room.players} myPlayerId={myPlayerId} isHost={room.players.find((p) => p.playerId === myPlayerId)?.isHost ?? false} onRoll={rollForOrder} onBeginGame={beginRollOffGame} />;
  if (room && myPlayerId && gameState && room.status === "inGame") return <GameLayoutMultiplayer gameState={gameState} myPlayerId={myPlayerId} room={room} sendAction={sendAction} error={error} connectionStatus={status} onLeave={leaveRoom} onForfeit={forfeitGame} onRequestSync={requestGameSync} tradeDraft={tradeDraft} startTradeDraft={startTradeDraft} updateTradeDraft={updateTradeDraft} cancelTradeDraft={cancelTradeDraft} submitTradeDraft={submitTradeDraft} />;
  if (room && myPlayerId) return <RoomLobby room={room} myPlayerId={myPlayerId} onStartGame={(rules: GameRules) => startGame(rules)} onLeave={leaveRoom} error={error} connectionStatus={status} />;
  return <EntryShell backHref="/"><section className="mx-auto max-w-4xl"><div className="mb-6"><p className="wc-section-label text-[var(--wc-gold)]">Private departure</p><h1 className="wc-heading mt-2 text-white">Create Private Room</h1><p className="mt-2 text-slate-300">Choose your travel token, then share a private room code with friends.</p></div><div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><form className="wc-panel space-y-6" onSubmit={(event) => { event.preventDefault(); handleCreate(); }}><section><p className="wc-section-label">1. Your identity</p><label className="mt-2 grid gap-2 text-sm font-bold text-slate-100" htmlFor="create-player-name">Player name<input id="create-player-name" value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }} maxLength={30} placeholder="e.g. Alice" className="wc-input" /></label></section><TokenPicker selected={token} takenTokens={[]} onChange={(nextToken, label, color) => { setToken(nextToken); setTokenLabel(label); setTokenColor(color); setNameError(""); }} />{(nameError || error) && <p aria-live="polite" className="wc-validation wc-validation-danger">{nameError || error}</p>}<button className="wc-button wc-button-primary w-full" disabled={!connected || submitting} type="submit"><UiIcon name="players" size={18} />{connected ? submitting ? "Creating room…" : "Create Private Room" : "Server unavailable"}</button></form><aside className="space-y-4"><div className="wc-paper-card"><p className="wc-section-label text-slate-600">Your boarding summary</p><div className="mt-4 flex items-center gap-3">{token ? <TokenMedallion token={token} compact /> : <span className="h-10 w-10 rounded-full border border-dashed border-slate-400" />}<div><p className="font-bold">{name.trim() || "Your name"}</p><p className="wc-caption text-slate-600">Up to 6 players · $1,500 starting cash</p></div></div></div>{connecting && <p className="wc-validation wc-validation-info">Connecting to multiplayer server…</p>}{!connecting && !connected && <p className="wc-validation wc-validation-danger">Cannot reach multiplayer server. Try again when it is available.</p>}</aside></div></section></EntryShell>;
}
