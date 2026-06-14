"use client";

import { useMemo, useState } from "react";
import type { GameRules, StartGamePlayer } from "@/types/game";
import { DEFAULT_RULES } from "@/types/game";
import { GameRulesPanel } from "@/components/setup/GameRulesPanel";
import type { PlayerToken } from "@/types/player";

const tokenOptions: Array<{
  token: PlayerToken;
  tokenLabel: string;
  label: string;
  color: string;
}> = [
  { token: "car", tokenLabel: "CAR", label: "🚗 Car", color: "#ef4444" },
  { token: "hat", tokenLabel: "HAT", label: "🎩 Hat", color: "#2563eb" },
  { token: "ship", tokenLabel: "SHIP", label: "🚢 Ship", color: "#16a34a" },
  { token: "shoe", tokenLabel: "SHOE", label: "👟 Shoe", color: "#ca8a04" },
  { token: "dog", tokenLabel: "DOG", label: "🐕 Dog", color: "#7c3aed" },
  { token: "cat", tokenLabel: "CAT", label: "🐈 Cat", color: "#0891b2" },
];

type DraftPlayer = {
  id: string;
  name: string;
  token: PlayerToken;
};

type GameSetupProps = {
  onStartGame: (players: StartGamePlayer[], rules: GameRules) => void;
};

function createDraftPlayer(index: number, token: PlayerToken): DraftPlayer {
  return {
    id: `setup-player-${index + 1}`,
    name: index === 0 ? "Player 1" : index === 1 ? "Player 2" : "",
    token,
  };
}

export function GameSetup({ onStartGame }: GameSetupProps) {
  const [draftPlayers, setDraftPlayers] = useState<DraftPlayer[]>([
    createDraftPlayer(0, "car"),
    createDraftPlayer(1, "hat"),
  ]);
  const [rules, setRules] = useState<GameRules>(DEFAULT_RULES);

  const selectedTokens = useMemo(
    () => new Set(draftPlayers.map((p) => p.token)),
    [draftPlayers],
  );
  const hasValidNames = draftPlayers.every((p) => p.name.trim().length > 0);
  const canStart = draftPlayers.length >= 2 && draftPlayers.length <= 6 && hasValidNames;

  function addPlayer() {
    const nextToken = tokenOptions.find((o) => !selectedTokens.has(o.token));
    if (!nextToken || draftPlayers.length >= 6) return;
    setDraftPlayers((prev) => [...prev, createDraftPlayer(prev.length, nextToken.token)]);
  }

  function removePlayer(id: string) {
    setDraftPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePlayer(id: string, updates: Partial<DraftPlayer>) {
    setDraftPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }

  function startGame() {
    if (!canStart) return;
    onStartGame(
      draftPlayers.map((player) => {
        const token = tokenOptions.find((o) => o.token === player.token);
        if (!token) throw new Error(`Missing token config for ${player.token}.`);
        return {
          name: player.name.trim(),
          token: token.token,
          tokenLabel: token.tokenLabel,
          color: token.color,
        };
      }),
      rules,
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-3 py-8">
      <div className="w-full max-w-lg">
        {/* Logo area */}
        <div className="mb-8 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
            Private Board Game
          </p>
          <h1 className="mt-2 text-4xl font-black leading-none tracking-tight text-slate-950 sm:text-5xl">
            World Cities
          </h1>
          <div className="mt-3 flex justify-center gap-1">
            {["🇲🇽","🇮🇳","🇩🇪","🇦🇪","🇮🇹","🇦🇺","🇬🇧","🇺🇸"].map((flag) => (
              <span key={flag} className="text-lg">{flag}</span>
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">
            2–6 players · Local pass-and-play · $1,500 starting cash
          </p>
        </div>

        <div className="mb-4">
          <GameRulesPanel rules={rules} onChange={setRules} />
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-black text-slate-950">Add Players</h2>
            <p className="text-sm font-semibold text-slate-500">
              Enter names and choose tokens.
            </p>
          </div>

          <div className="p-5 space-y-2.5">
            {draftPlayers.map((player, index) => {
              const tokenConfig = tokenOptions.find((o) => o.token === player.token);
              return (
                <div
                  key={player.id}
                  className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: tokenConfig?.color ?? "#94a3b8",
                  }}
                >
                  <label className="flex-1 min-w-0">
                    <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Player {index + 1}
                    </span>
                    <input
                      value={player.name}
                      onChange={(e) => updatePlayer(player.id, { name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      maxLength={24}
                      placeholder={`Player ${index + 1}`}
                    />
                  </label>

                  <label className="w-36 shrink-0">
                    <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400">
                      Token
                    </span>
                    <select
                      value={player.token}
                      onChange={(e) =>
                        updatePlayer(player.id, { token: e.target.value as PlayerToken })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      {tokenOptions.map((option) => (
                        <option
                          key={option.token}
                          value={option.token}
                          disabled={option.token !== player.token && selectedTokens.has(option.token)}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => removePlayer(player.id)}
                    disabled={draftPlayers.length <= 2}
                    className="shrink-0 self-end rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-bold text-slate-500 transition hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Remove Player ${index + 1}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 gap-3">
            <button
              type="button"
              onClick={addPlayer}
              disabled={draftPlayers.length >= 6}
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-white hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-30"
            >
              + Add Player
            </button>
            <button
              type="button"
              onClick={startGame}
              disabled={!canStart}
              className="rounded-lg bg-slate-950 px-6 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              Start Game →
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
