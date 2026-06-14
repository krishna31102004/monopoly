"use client";

import { useState } from "react";
import type { GameLogEntry } from "@/types/game";

type GameLogDrawerProps = {
  entries: GameLogEntry[];
};

export function GameLogDrawer({ entries }: GameLogDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Game Log
            </p>
            <h2 className="text-base font-black text-slate-950">Recent Actions</h2>
          </div>
          {!isOpen && entries.length > 0 && (
            <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
              {entries.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOpen && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
              {entries.length}
            </span>
          )}
          <span className="text-slate-400 text-sm font-bold" aria-hidden="true">
            {isOpen ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {isOpen && (
        <ol className="max-h-52 overflow-y-auto divide-y divide-slate-100">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className={`flex items-start gap-2 px-4 py-2.5 ${
                index === 0 ? "bg-slate-50" : ""
              }`}
            >
              {index === 0 ? (
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
              ) : (
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-200" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-xs leading-5 ${index === 0 ? "font-bold text-slate-900" : "font-semibold text-slate-600"}`}>
                  {entry.message}
                </p>
                <time className="text-[9px] font-semibold text-slate-400">
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
