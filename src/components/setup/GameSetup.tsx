"use client";

import { useMemo, useState } from "react";
import { EntryShell } from "@/components/entry/EntryShell";
import { UiIcon } from "@/components/ui/UiIcon";
import { TokenPicker } from "@/components/multiplayer/TokenPicker";
import { GameRulesPanel } from "@/components/setup/GameRulesPanel";
import { TOKEN_PRESENTATION } from "@/lib/ui/tokenPresentation";
import { DEFAULT_RULES, type GameRules, type StartGamePlayer } from "@/types/game";
import type { PlayerToken } from "@/types/player";

type DraftPlayer = { id: string; name: string; token: PlayerToken };
type Props = { onStartGame: (players: StartGamePlayer[], rules: GameRules) => void };
const makePlayer = (index: number, token: PlayerToken): DraftPlayer => ({ id: `setup-player-${index + 1}`, name: index < 2 ? `Player ${index + 1}` : "", token });

export function GameSetup({ onStartGame }: Props) {
  const [players, setPlayers] = useState<DraftPlayer[]>([makePlayer(0, "car"), makePlayer(1, "hat")]);
  const [rules, setRules] = useState<GameRules>(DEFAULT_RULES);
  const selected = useMemo(() => new Set(players.map((player) => player.token)), [players]);
  const valid = players.length >= 2 && players.length <= 6 && players.every((player) => player.name.trim());
  const update = (id: string, patch: Partial<DraftPlayer>) => setPlayers((current) => current.map((player) => player.id === id ? { ...player, ...patch } : player));
  const add = () => { const next = TOKEN_PRESENTATION.find((entry) => !selected.has(entry.token)); if (next && players.length < 6) setPlayers((current) => [...current, makePlayer(current.length, next.token)]); };
  const remove = (id: string) => setPlayers((current) => current.length <= 2 ? current : current.filter((player) => player.id !== id));
  const start = () => { if (!valid) return; onStartGame(players.map((player) => { const token = TOKEN_PRESENTATION.find((entry) => entry.token === player.token)!; return { name: player.name.trim(), token: token.token, tokenLabel: token.tokenLabel, color: token.color }; }), rules); };
  return <EntryShell backHref="/"><section className="mx-auto max-w-6xl"><header className="mb-6"><p className="wc-section-label text-[var(--wc-gold)]">Local departure</p><h1 className="wc-heading mt-2 text-white">Local Game</h1><p className="mt-2 text-slate-300">Set up 2–6 players for pass-and-play on this device.</p></header><div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><section className="wc-panel"><div className="flex items-center justify-between"><div><p className="wc-section-label">Passengers</p><h2 className="wc-panel-heading mt-1 text-white">Players</h2></div><span className="wc-badge wc-badge-gold">{players.length}/6</span></div><div className="mt-4 space-y-3">{players.map((player, index) => <article className="wc-card" key={player.id}><div className="flex items-center justify-between gap-3"><label className="flex-1 text-sm font-bold text-white">Player {index + 1}<input className="wc-input mt-2 w-full" maxLength={24} onChange={(event) => update(player.id, { name: event.target.value })} placeholder={`Player ${index + 1}`} value={player.name} /></label><button aria-label={`Remove Player ${index + 1}`} className="wc-button wc-button-danger wc-icon-button" disabled={players.length <= 2} onClick={() => remove(player.id)} type="button"><UiIcon name="close" size={16} /></button></div><div className="mt-4"><TokenPicker name={`local-token-${player.id}`} onChange={(token) => update(player.id, { token })} selected={player.token} takenTokens={players.filter((other) => other.id !== player.id).map((other) => other.token)} /></div></article>)}</div><div className="mt-4 flex flex-wrap justify-between gap-3"><button className="wc-button wc-button-secondary" disabled={players.length >= 6} onClick={add} type="button"><UiIcon name="players" size={16} />Add Player</button><button className="wc-button wc-button-primary" disabled={!valid} onClick={start} type="button"><UiIcon name="play" size={16} />Start Local Game</button></div></section><GameRulesPanel onChange={setRules} rules={rules} /></div></section></EntryShell>;
}
