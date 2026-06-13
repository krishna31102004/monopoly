"use client";

import type { DrawnCard } from "@/types/game";

type CardPanelProps = {
  drawnCard: DrawnCard;
};

const deckLabel: Record<string, string> = {
  chance: "Chance",
  "community-chest": "Community Chest",
};

const deckBorder: Record<string, string> = {
  chance: "border-orange-200",
  "community-chest": "border-sky-200",
};

const deckBg: Record<string, string> = {
  chance: "bg-orange-50",
  "community-chest": "bg-sky-50",
};

const deckHeader: Record<string, string> = {
  chance: "text-orange-600",
  "community-chest": "text-sky-600",
};

const deckEmoji: Record<string, string> = {
  chance: "?",
  "community-chest": "📦",
};

export function CardPanel({ drawnCard }: CardPanelProps) {
  const { card } = drawnCard;
  const deck = card.deck;

  return (
    <section
      className={`overflow-hidden rounded-xl border ${deckBorder[deck] ?? "border-slate-200"} ${deckBg[deck] ?? "bg-white"} shadow-sm`}
    >
      <div className={`border-b ${deckBorder[deck] ?? "border-slate-200"} px-4 py-3`}>
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${deckHeader[deck] ?? "text-slate-500"}`}>
          {deckEmoji[deck]} {deckLabel[deck] ?? deck} Card
        </p>
        <h2 className="mt-0.5 text-base font-black leading-snug text-slate-950">{card.text}</h2>
      </div>
      {drawnCard.resolvedMessage ? (
        <div className="p-4">
          <p className="text-sm font-semibold text-slate-700">{drawnCard.resolvedMessage}</p>
        </div>
      ) : null}
    </section>
  );
}
