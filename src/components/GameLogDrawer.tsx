"use client";

import { useState } from "react";
import { getGroupedGameLogEntries, type GameLogTone } from "@/lib/ui/gameLogTimeline";
import type { GameLogEntry } from "@/types/game";

type GameLogDrawerProps = {
  entries: GameLogEntry[];
};

const TONE_DOT_CLASS: Record<GameLogTone, string> = {
  success: "bg-emerald-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  neutral: "bg-slate-300",
};

export function GameLogDrawer({ entries }: GameLogDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const grouped = getGroupedGameLogEntries(entries);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Game Log
            </p>
            <h2 className="text-base font-black text-slate-950">Recent Actions</h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
            {entries.length}
          </span>
          <span className="text-slate-400 text-sm font-bold" aria-hidden="true">
            {isOpen ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {isOpen && (
        <ol className="max-h-64 overflow-y-auto divide-y divide-slate-100">
          {grouped.map(({ entry, icon, tone }, index) => (
            <li
              key={entry.id}
              className={`flex items-start gap-2.5 px-4 py-2.5 ${
                index === 0 ? "bg-slate-50" : ""
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${TONE_DOT_CLASS[tone]} ${
                  index === 0 ? "" : "opacity-70"
                }`}
                aria-hidden="true"
              >
                {icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs leading-5 ${index === 0 ? "font-bold text-slate-900" : "font-semibold text-slate-600"}`}>
                  {entry.message}
                </p>
                <time className="text-[9px] font-medium text-slate-400">
                  {new Date(entry.createdAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
              </div>
            </li>
          ))}
          {entries.length === 0 && (
            <li className="px-4 py-3 text-xs text-slate-400">No actions yet.</li>
          )}
        </ol>
      )}
    </section>
  );
}
