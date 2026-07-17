"use client";

import { useState } from "react";
import { useIsBelowXl } from "@/hooks/useIsBelowXl";
import { UiIcon } from "@/components/ui/UiIcon";
import { getGroupedGameLogEntries, type GameLogTone } from "@/lib/ui/gameLogTimeline";
import type { GameLogEntry } from "@/types/game";

type GameLogDrawerProps = {
  entries: GameLogEntry[];
  /** Opens the timeline directly in the mobile LOG destination without affecting desktop. */
  forceOpen?: boolean;
};

const TONE_DOT_CLASS: Record<GameLogTone, string> = {
  success: "bg-emerald-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  neutral: "bg-slate-400",
};

export function GameLogDrawer({ entries, forceOpen = false }: GameLogDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isBelowXl = useIsBelowXl();
  const grouped = getGroupedGameLogEntries(entries);
  const isTimelineOpen = isOpen || (forceOpen && isBelowXl);

  return (
    <section className="overflow-hidden rounded-[var(--wc-radius-medium)] border border-[var(--wc-paper-border)] bg-[var(--wc-paper)] text-[var(--wc-text-on-light)] shadow-[var(--wc-shadow-card)] xl:border-[var(--wc-border)] xl:bg-[var(--wc-navy-raised)] xl:text-slate-100">
      <button
        type="button"
        className={`min-h-12 w-full items-center justify-between border-b border-[var(--wc-paper-border)] px-4 py-3 text-left hover:bg-[var(--wc-ivory)] xl:border-[var(--wc-border-subtle)] xl:hover:bg-[var(--wc-navy-hover)] ${forceOpen && isBelowXl ? "hidden xl:flex" : "flex"}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <div className="flex min-w-0 items-center gap-2">
          <UiIcon name="log" size={18} className="shrink-0 text-amber-700 xl:text-amber-200" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 xl:text-slate-400">
              Game Log
            </p>
            <h2 className="text-base font-black text-[var(--wc-text-on-light)] xl:text-white">Recent Actions</h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="wc-numeric rounded-full border border-[var(--wc-paper-border)] bg-[var(--wc-ivory)] px-2.5 py-1 text-[10px] font-black text-slate-700 xl:border-[var(--wc-border-subtle)] xl:bg-[var(--wc-navy)] xl:text-slate-300">
            {entries.length}
          </span>
          <span className="text-sm font-bold text-amber-700 xl:text-amber-200" aria-hidden="true">
            {isOpen ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {isTimelineOpen && (
        <ol className={`relative divide-y divide-[var(--wc-paper-border)] before:absolute before:bottom-0 before:left-6 before:top-0 before:w-px before:bg-[var(--wc-paper-border)] xl:divide-[var(--wc-border-subtle)] xl:before:bg-[var(--wc-border-subtle)] ${forceOpen && isBelowXl ? "pb-[calc(var(--wc-safe-bottom)+1rem)]" : "max-h-64 overflow-y-auto"}`}>
          {grouped.map(({ entry, tone }, index) => (
            <li
              key={entry.id}
              className={`flex items-start gap-2.5 px-4 py-2.5 ${
                index === 0 ? "bg-[var(--wc-ivory)] xl:bg-[var(--wc-navy-elevated)]" : ""
              }`}
            >
              <span
                className={`z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] text-[var(--wc-navy)] ${TONE_DOT_CLASS[tone]} ${
                  index === 0 ? "" : "opacity-70"
                }`}
                aria-hidden="true"
              >
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs leading-5 ${index === 0 ? "font-bold text-[var(--wc-text-on-light)] xl:text-white" : "font-semibold text-slate-700 xl:text-slate-300"}`}>
                  {entry.message}
                </p>
                <time className="text-[9px] font-medium text-slate-500">
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
            <li className="px-4 py-3 text-xs text-slate-600 xl:text-slate-400">No actions yet.</li>
          )}
        </ol>
      )}
    </section>
  );
}
