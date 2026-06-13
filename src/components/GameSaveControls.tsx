"use client";

import { useRef, useState } from "react";
import { clearSave, exportGameJson, importGameJson } from "@/lib/game/persistence";
import type { GameAction, GameState } from "@/types/game";

type Props = {
  state: GameState;
  dispatch: (action: GameAction) => void;
};

export function GameSaveControls({ state, dispatch }: Props) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const json = exportGameJson(state);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worldcities-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setImportText(text);
        setImportError(null);
      }
    };
    reader.readAsText(file);
  }

  function handleImport() {
    const result = importGameJson(importText);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    dispatch({ type: "LOAD_GAME", state: result.state });
    setShowImport(false);
    setImportText("");
    setImportError(null);
  }

  function handleReset() {
    clearSave();
    dispatch({ type: "RESET_GAME" });
    setShowResetConfirm(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        Game Controls
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white hover:border-slate-300"
        >
          Export Save
        </button>
        <button
          type="button"
          onClick={() => {
            setShowImport((v) => !v);
            setImportError(null);
            setImportText("");
          }}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white hover:border-slate-300"
        >
          Import Save
        </button>
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
        >
          New Game
        </button>
      </div>

      {/* Import panel */}
      {showImport ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-500">
            Paste save JSON below, or select a .json file.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white"
          >
            Choose File…
          </button>
          <textarea
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setImportError(null);
            }}
            rows={4}
            placeholder='{"version":1,"state":...}'
            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
          />
          {importError ? (
            <p className="text-xs font-bold text-red-600">{importError}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={!importText.trim()}
              className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Load
            </button>
            <button
              type="button"
              onClick={() => {
                setShowImport(false);
                setImportText("");
                setImportError(null);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Reset confirmation */}
      {showResetConfirm ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-900">
            Start a new game? This will end the current game and cannot be undone.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
            >
              Yes, New Game
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
