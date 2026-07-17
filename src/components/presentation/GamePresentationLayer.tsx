"use client";

import { useEffect, useRef, useState } from "react";
import { UiIcon } from "@/components/ui/UiIcon";
import { deriveGamePresentationEvents, getEndGameFacts, type PresentationEvent } from "@/lib/ui/gamePresentationEvents";
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

function SoundControl() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(readSoundEnabled(window.localStorage)), []);
  useEffect(() => {
    const listener = (event: Event) => { if (enabled) playSoftCue((event as CustomEvent<PresentationEvent>).detail.kind); };
    window.addEventListener("world-cities-presentation", listener);
    return () => window.removeEventListener("world-cities-presentation", listener);
  }, [enabled]);
  return <button type="button" className="wc-icon-button wc-button-secondary rounded-full" aria-label={enabled ? "Mute game sounds" : "Enable game sounds"} aria-pressed={enabled} onClick={() => { const next = !enabled; setEnabled(next); writeSoundEnabled(window.localStorage, next); }}><UiIcon name={enabled ? "volume" : "volumeOff"} aria-hidden="true" /></button>;
}

export function GamePresentationLayer({ state, showStart = false, onStartShown }: { state: GameState; showStart?: boolean; onStartShown?: () => void }) {
  const previous = useRef<GameState | null>(null);
  const seen = useRef(new Set<string>());
  const [event, setEvent] = useState<PresentationEvent | null>(null);
  useEffect(() => {
    if (!previous.current) { previous.current = state; return; }
    const next = deriveGamePresentationEvents(previous.current, state).find((candidate) => !seen.current.has(candidate.key));
    previous.current = state;
    if (!next) return;
    seen.current.add(next.key);
    setEvent(next);
    window.dispatchEvent(new CustomEvent("world-cities-presentation", { detail: next }));
    const timeout = window.setTimeout(() => setEvent((current) => current?.key === next.key ? null : current), 2800);
    return () => window.clearTimeout(timeout);
  }, [state]);
  useEffect(() => {
    if (!showStart || !onStartShown) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(onStartShown, reduced ? 0 : 1800);
    return () => window.clearTimeout(timeout);
  }, [showStart, onStartShown]);

  const winner = state.winnerId ? state.players.find((player) => player.id === state.winnerId) : null;
  const facts = winner ? getEndGameFacts(state, winner.id) : null;
  return <>
    <div className="fixed right-3 top-[max(0.5rem,env(safe-area-inset-top))] z-40 xl:right-5"><SoundControl /></div>
    {showStart ? <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--wc-overlay)] p-5" role="dialog" aria-modal="true" aria-labelledby="journey-start-title"><div className="wc-panel max-w-sm text-center"><p className="wc-section-label text-amber-200">Private departure lounge</p><h2 id="journey-start-title" className="mt-2 text-3xl font-black text-white">World Cities</h2><p className="mt-2 text-sm text-slate-300">Players are ready. Begin your journey.</p><button type="button" className="wc-button wc-button-primary mt-5" onClick={onStartShown}>Begin journey</button></div></div> : null}
    {event ? <div className="pointer-events-none fixed inset-x-3 bottom-[calc(var(--wc-safe-bottom)+7.5rem)] z-40 mx-auto max-w-md xl:bottom-5 xl:right-5 xl:left-auto" aria-live="polite"><div className={`wc-presentation-event wc-card border-l-4 ${event.kind === "country-set-completed" ? "wc-passport-stamp" : ""} ${event.kind === "bankruptcy" ? "border-rose-400" : "border-[var(--wc-gold)]"}`}><p className="wc-section-label">{event.kind === "country-set-completed" ? "Passport stamp" : "Travel ledger"}</p><p className="mt-1 font-black text-white">{event.title}</p><p className="mt-1 text-xs text-slate-300">{event.detail}</p></div></div> : null}
    {state.phase === "gameOver" && winner && facts ? <section className="mx-auto mb-4 max-w-[1560px] rounded-[var(--wc-radius-large)] border border-[var(--wc-gold-border)] bg-[var(--wc-navy)] p-5 text-slate-100 shadow-[var(--wc-shadow-panel)]" aria-labelledby="world-empire-title"><p className="wc-section-label text-amber-200">World empire ledger</p><h1 id="world-empire-title" className="mt-1 text-2xl font-black">{winner.name} wins</h1><p className="mt-1 text-sm text-slate-300">Final cash <span className="wc-numeric font-black text-white">${winner.cash.toLocaleString()}</span> · {facts.properties} properties · {facts.completedGroups.join(", ") || "No completed country sets"}</p><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">{[["Airports", facts.airports], ["Utilities", facts.utilities], ["Houses", facts.houses], ["Hotels", facts.hotels], ["Mortgaged", facts.mortgaged], ["Sets", facts.completedGroups.length]].map(([label, value]) => <div key={String(label)} className="rounded-md bg-[var(--wc-navy-raised)] p-2"><p className="wc-numeric font-black text-white">{value}</p><p className="text-slate-400">{label}</p></div>)}</div></section> : null}
  </>;
}

declare global { interface Window { webkitAudioContext?: typeof AudioContext; } }
