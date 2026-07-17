"use client";

import { useEffect, useRef, useState } from "react";
import { UiIcon } from "@/components/ui/UiIcon";
import { deriveGamePresentationEvents, enqueuePresentationEvents, getEndGameFacts, type PresentationEvent } from "@/lib/ui/gamePresentationEvents";
import { readSoundEnabled, writeSoundEnabled } from "@/lib/ui/soundPreferences";
import type { GameState } from "@/types/game";

function playSoftCue(kind: PresentationEvent["kind"]) {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = kind === "bankruptcy" ? 196 : kind === "country-set-completed" ? 659 : 440;
    gain.gain.setValueAtTime(0.025, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
  } catch { /* Audio is optional and must never affect play. */ }
}

export function SoundControl() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(readSoundEnabled(window.localStorage)), []);
  useEffect(() => {
    const listener = (event: Event) => { if (enabled) playSoftCue((event as CustomEvent<PresentationEvent>).detail.kind); };
    window.addEventListener("world-cities-presentation", listener);
    return () => window.removeEventListener("world-cities-presentation", listener);
  }, [enabled]);
  return <button type="button" className="wc-icon-button wc-sound-control wc-button-secondary rounded-full" aria-label={enabled ? "Mute game sounds" : "Enable game sounds"} aria-pressed={enabled} onClick={() => { const next = !enabled; setEnabled(next); writeSoundEnabled(window.localStorage, next); }}><UiIcon name={enabled ? "volume" : "volumeOff"} aria-hidden="true" /></button>;
}

type PresentationTab = "board" | "players" | "log";

export function GamePresentationLayer({ state, showStart = false, onStartShown, onNavigate }: { state: GameState; showStart?: boolean; onStartShown?: () => void; onNavigate?: (tab: PresentationTab) => void }) {
  const previous = useRef<GameState | null>(null);
  const seen = useRef(new Set<string>());
  const [queue, setQueue] = useState<PresentationEvent[]>([]);
  const activeEvent = queue[0] ?? null;
  useEffect(() => {
    if (!previous.current) { previous.current = state; return; }
    const incoming = deriveGamePresentationEvents(previous.current, state);
    previous.current = state;
    const seenBeforeTransition = new Set(seen.current);
    const unseen = incoming.filter((event) => !seenBeforeTransition.has(event.key));
    if (!unseen.length) return;
    unseen.forEach((event) => seen.current.add(event.key));
    setQueue((current) => enqueuePresentationEvents(current, incoming, seenBeforeTransition));
  }, [state]);
  useEffect(() => {
    if (!activeEvent) return;
    window.dispatchEvent(new CustomEvent("world-cities-presentation", { detail: activeEvent }));
    const timeout = window.setTimeout(() => setQueue((current) => current[0]?.key === activeEvent.key ? current.slice(1) : current), 2800);
    return () => window.clearTimeout(timeout);
  }, [activeEvent?.key]);
  useEffect(() => {
    if (!showStart || !onStartShown) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const timeout = window.setTimeout(onStartShown, 1800);
    return () => window.clearTimeout(timeout);
  }, [showStart, onStartShown]);

  const winner = state.winnerId ? state.players.find((player) => player.id === state.winnerId) : null;
  const facts = winner ? getEndGameFacts(state, winner.id) : null;
  return <>
    {showStart ? <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--wc-overlay)] p-5" role="dialog" aria-modal="true" aria-labelledby="journey-start-title"><div className="wc-panel max-w-sm text-center"><p className="wc-section-label text-amber-200">Private departure lounge</p><h2 id="journey-start-title" className="mt-2 text-3xl font-black text-white">World Cities</h2><p className="mt-2 text-sm text-slate-300">Players are ready. Begin your journey.</p><button type="button" className="wc-button wc-button-primary mt-5" onClick={onStartShown}>Begin journey</button><button type="button" className="wc-button wc-button-ghost mt-2" onClick={onStartShown}>Skip</button></div></div> : null}
    {activeEvent ? <div className="pointer-events-none fixed inset-x-3 bottom-[calc(var(--wc-safe-bottom)+7.5rem)] z-40 mx-auto max-w-md xl:bottom-5 xl:right-5 xl:left-auto" aria-live="polite"><div className={`wc-presentation-event wc-card border-l-4 ${activeEvent.kind === "country-set-completed" ? "wc-passport-stamp" : ""} ${activeEvent.kind === "bankruptcy" ? "border-rose-400" : "border-[var(--wc-gold)]"}`}><p className="wc-section-label">{activeEvent.kind === "country-set-completed" ? "Passport stamp" : "Travel ledger"}</p><p className="mt-1 font-black text-white">{activeEvent.title}</p><p className="mt-1 text-xs text-slate-300">{activeEvent.detail}</p></div></div> : null}
    {state.phase === "gameOver" && winner && facts ? <section className="mx-auto mb-4 max-w-[1560px] rounded-[var(--wc-radius-large)] border border-[var(--wc-gold-border)] bg-[var(--wc-navy)] p-5 text-slate-100 shadow-[var(--wc-shadow-panel)]" aria-labelledby="world-empire-title"><p className="wc-section-label text-amber-200">World empire ledger</p><h1 id="world-empire-title" className="mt-1 text-2xl font-black">{winner.name} wins</h1><p className="mt-1 text-sm text-slate-300">Final cash <span className="wc-numeric font-black text-white">${winner.cash.toLocaleString()}</span> · {facts.properties} properties · {facts.completedGroups.join(", ") || "No completed country sets"}</p><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">{[["Airports", facts.airports], ["Utilities", facts.utilities], ["Houses", facts.houses], ["Hotels", facts.hotels], ["Mortgaged", facts.mortgaged], ["Sets", facts.completedGroups.length]].map(([label, value]) => <div key={String(label)} className="rounded-md bg-[var(--wc-navy-raised)] p-2"><p className="wc-numeric font-black text-white">{value}</p><p className="text-slate-400">{label}</p></div>)}</div><div className="mt-4 grid gap-2 sm:grid-cols-3">{state.players.map((player) => <div key={player.id} className="rounded-md border border-[var(--wc-border-subtle)] bg-[var(--wc-navy-raised)] px-3 py-2 text-sm"><span className="font-bold text-white">{player.name}</span><span className="wc-numeric ml-2 text-slate-300">${player.cash.toLocaleString()}</span><span className={`ml-2 text-xs ${player.id === winner.id ? "text-amber-200" : player.isBankrupt ? "text-rose-200" : "text-slate-400"}`}>{player.id === winner.id ? "Winner" : player.isBankrupt ? "Bankrupt" : "Active"}</span></div>)}</div>{onNavigate ? <div className="mt-4 flex flex-wrap gap-2"><button className="wc-button wc-button-secondary" type="button" onClick={() => onNavigate("board")}>Review Board</button><button className="wc-button wc-button-secondary" type="button" onClick={() => onNavigate("players")}>View Players</button><button className="wc-button wc-button-secondary" type="button" onClick={() => onNavigate("log")}>View Log</button></div> : null}</section> : null}
  </>;
}

declare global { interface Window { webkitAudioContext?: typeof AudioContext; } }
