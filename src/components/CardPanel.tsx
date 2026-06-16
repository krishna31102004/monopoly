"use client";

import { getCardRevealTone } from "@/lib/ui/gameEventPresentation";
import type { DrawnCard } from "@/types/game";

type CardPanelProps = {
  drawnCard: DrawnCard;
  /** When false, the resolvedMessage is hidden (card is revealed but effect is not yet shown). Default: true */
  showResolved?: boolean;
};

export function CardPanel({ drawnCard, showResolved = true }: CardPanelProps) {
  const { card } = drawnCard;
  const tone = getCardRevealTone(card.deck);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-[2px] sm:items-center"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-reveal-title"
        className={`card-reveal-flip max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border-2 ${tone.border} ${tone.bg} shadow-[0_32px_100px_rgba(15,23,42,0.4)]`}
      >
        <div className={`flex items-center gap-2 border-b ${tone.border} px-5 py-4`}>
          <span className={`flex h-9 w-9 items-center justify-center rounded-full text-lg text-white ${tone.accent}`} aria-hidden="true">
            {tone.icon}
          </span>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${tone.header}`}>
              {tone.label} Card
            </p>
            <h2 id="card-reveal-title" className="text-base font-black leading-snug text-slate-950 sm:text-lg">
              {card.text}
            </h2>
          </div>
        </div>

        <div className="p-5">
          {drawnCard.resolvedMessage && showResolved ? (
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Result</p>
              <p className="mt-1 text-sm font-bold leading-5 text-slate-800">{drawnCard.resolvedMessage}</p>
            </div>
          ) : (
            <p className="text-center text-xs font-semibold text-slate-500">Revealing outcome…</p>
          )}
        </div>
      </section>
    </div>
  );
}
