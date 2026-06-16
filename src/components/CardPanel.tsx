"use client";

import { getCardRevealTone } from "@/lib/ui/gameEventPresentation";
import type { DrawnCard } from "@/types/game";

type CardPanelProps = {
  drawnCard: DrawnCard;
  /** When false, the resolvedMessage is hidden (card is revealed but effect is not yet shown). Default: true */
  showResolved?: boolean;
};

/**
 * Non-blocking card display. Renders inline alongside the other action panels —
 * no overlay, no required dismissal. It disappears naturally once the reducer
 * clears drawnCard (next roll/turn), so the player is never trapped behind it.
 */
export function CardPanel({ drawnCard, showResolved = true }: CardPanelProps) {
  const { card } = drawnCard;
  const tone = getCardRevealTone(card.deck);

  return (
    <section
      aria-label={`${tone.label} card drawn`}
      className={`card-reveal-flip rounded-2xl border-2 ${tone.border} ${tone.bg} shadow-sm`}
    >
      <div className={`flex items-center gap-2 border-b ${tone.border} px-4 py-3`}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base text-white shadow-sm ${tone.accent}`} aria-hidden="true">
          {tone.icon}
        </span>
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${tone.header}`}>
            {tone.label} Card
          </p>
          <p className="text-sm font-black leading-snug text-slate-950">{card.text}</p>
        </div>
      </div>

      {drawnCard.resolvedMessage && showResolved ? (
        <div className="px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Result</p>
          <p className="mt-1 text-sm font-bold leading-5 text-slate-800">{drawnCard.resolvedMessage}</p>
        </div>
      ) : null}
    </section>
  );
}
