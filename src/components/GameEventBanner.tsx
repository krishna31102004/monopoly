"use client";

import { useEffect, useRef, useState } from "react";
import { getGameEventBannerFromLogEntry, type GameEventBanner as GameEventBannerData } from "@/lib/ui/gameEventPresentation";
import type { GameLogEntry } from "@/types/game";

const TONE_STYLES: Record<GameEventBannerData["tone"], string> = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  danger: "border-red-300 bg-red-50 text-red-800",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  info: "border-sky-300 bg-sky-50 text-sky-800",
  neutral: "border-slate-300 bg-slate-50 text-slate-700",
};

type GameEventBannerProps = {
  latestLogEntry: GameLogEntry | null | undefined;
};

/** Cinematic, transient banner for major game events — purely presentational, driven by gameLog. */
export function GameEventBanner({ latestLogEntry }: GameEventBannerProps) {
  const [visibleBanner, setVisibleBanner] = useState<GameEventBannerData | null>(null);
  const lastSeenIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!latestLogEntry || latestLogEntry.id === lastSeenIdRef.current) return;
    lastSeenIdRef.current = latestLogEntry.id;

    const banner = getGameEventBannerFromLogEntry(latestLogEntry);
    if (!banner) return;

    setVisibleBanner(banner);
    const id = setTimeout(() => setVisibleBanner(null), 2200);
    return () => clearTimeout(id);
  }, [latestLogEntry]);

  if (!visibleBanner) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-2 sm:top-3"
      aria-live="polite"
    >
      <div
        className={`game-event-banner pointer-events-auto max-w-[min(92vw,420px)] rounded-full border px-4 py-2 text-center text-xs font-black shadow-lg backdrop-blur-sm sm:text-sm ${TONE_STYLES[visibleBanner.tone]}`}
        role="status"
      >
        <span className="mr-1.5" aria-hidden="true">{visibleBanner.icon}</span>
        {visibleBanner.text}
      </div>
    </div>
  );
}
