"use client";

import { getCardRevealTone } from "@/lib/ui/gameEventPresentation";
import type { DrawnCard } from "@/types/game";

type CardPanelProps = {
  drawnCard: DrawnCard;
  /** When false, the resolvedMessage is hidden (card is revealed but effect is not yet shown). Default: true */
  showResolved?: boolean;
  /** Called when the user dismisses the reveal and wants the game to proceed. */
  onContinue?: () => void;
};

export function CardPanel({ drawnCard, showResolved = true, onContinue }: CardPanelProps) {
  const { card } = drawnCard;
  const tone = getCardRevealTone(card.deck);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-reveal-title"
        className={`card-reveal-flip max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border-4 ${tone.border} ${tone.bg} shadow-[0_40px_120px_rgba(15,23,42,0.5)]`}
      >
        <div className={`flex items-center gap-3 border-b-2 ${tone.border} px-6 py-5`}>
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl text-white shadow-md ${tone.accent}`} aria-hidden="true">
            {tone.icon}
          </span>
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.25em] ${tone.header}`}>
              {tone.label} Card
            </p>
            <h2 id="card-reveal-title" className="mt-0.5 text-xl font-black leading-snug text-slate-950 sm:text-2xl">
              {card.text}
            </h2>
          </div>
        </div>

        <div className="px-6 py-5">
          {drawnCard.resolvedMessage && showResolved ? (
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Result</p>
              <p className="mt-1.5 text-base font-bold leading-6 text-slate-900">{drawnCard.resolvedMessage}</p>
            </div>
          ) : (
            <p className="text-center text-sm font-semibold text-slate-500">Revealing outcome…</p>
          )}

          <button
            type="button"
            onClick={onContinue}
            autoFocus
            className={`mt-5 flex min-h-[44px] w-full items-center justify-center rounded-xl text-base font-black text-white shadow-md transition active:scale-[0.98] ${tone.accent}`}
          >
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}
