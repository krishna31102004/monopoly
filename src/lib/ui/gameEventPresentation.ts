import { getBoardSpaceByIndex } from "@/data/board";
import type { GameLogEntry, GameState } from "@/types/game";
import type { TradeDraftState } from "@/types/multiplayer";

export type GameEventKind =
  | "purchase"
  | "rent"
  | "tax"
  | "freeParkingCollect"
  | "auctionStart"
  | "auctionWin"
  | "auctionNoBid"
  | "tradeAccepted"
  | "tradeDeclined"
  | "tradeCancelled"
  | "debtPending"
  | "bankruptcyResolved";

export type GameEventTone = "success" | "danger" | "warning" | "info" | "neutral";

export type GameEventBanner = {
  kind: GameEventKind;
  text: string;
  tone: GameEventTone;
  icon: string;
};

const EVENT_PATTERNS: Array<{
  kind: GameEventKind;
  tone: GameEventTone;
  icon: string;
  test: RegExp;
}> = [
  { kind: "purchase", tone: "success", icon: "🏙️", test: /^(.+) bought (.+) for \$\d+\.$/ },
  { kind: "rent", tone: "warning", icon: "💸", test: /^(.+) paid (.+) \$\d+ rent for (.+)\.( \(.+\))?$/ },
  { kind: "tax", tone: "warning", icon: "🏛️", test: /^(.+) paid \$\d+ for (Income Tax|Luxury Tax)\.$/ },
  {
    kind: "freeParkingCollect",
    tone: "success",
    icon: "🎉",
    test: /^(.+) landed on Free Parking and collected the pot of \$\d+!$/,
  },
  { kind: "auctionStart", tone: "info", icon: "🔨", test: /^(.+) declined to buy (.+)\. Auction started\.$/ },
  { kind: "auctionWin", tone: "success", icon: "🏆", test: /^(.+) won (.+) at auction for \$\d+\.$/ },
  { kind: "auctionNoBid", tone: "neutral", icon: "🔨", test: /^No one bid on (.+)\. It remains unowned\.$/ },
  { kind: "tradeAccepted", tone: "success", icon: "🤝", test: /^Trade accepted: / },
  { kind: "tradeDeclined", tone: "danger", icon: "✋", test: /declined the trade\.$/ },
  { kind: "tradeCancelled", tone: "neutral", icon: "✋", test: /cancelled the trade\.$/ },
  {
    kind: "debtPending",
    tone: "danger",
    icon: "⚠️",
    test: /cannot pay and must resolve bankruptcy\.$/,
  },
  {
    kind: "bankruptcyResolved",
    tone: "success",
    icon: "✅",
    test: /paid \$\d+ and resolved the debt\.$/,
  },
];

/** Classifies a raw gameLog message into a known event kind, or null if it's not a "major" event worth a banner. */
export function classifyGameEvent(message: string | undefined | null): GameEventKind | null {
  if (!message) return null;
  for (const pattern of EVENT_PATTERNS) {
    if (pattern.test.test(message)) return pattern.kind;
  }
  return null;
}

/** Builds a cinematic banner from the most recent gameLog entry, or null for irrelevant/noisy log lines. */
export function getGameEventBannerFromLogEntry(
  logEntry: GameLogEntry | null | undefined,
): GameEventBanner | null {
  if (!logEntry) return null;
  const kind = classifyGameEvent(logEntry.message);
  if (!kind) return null;
  const pattern = EVENT_PATTERNS.find((p) => p.kind === kind)!;
  return { kind, text: logEntry.message, tone: pattern.tone, icon: pattern.icon };
}

export type MoneyMovementFeedback =
  | { kind: "transfer"; payerName: string; payeeName: string; amount: number }
  | { kind: "bankPayment"; payerName: string; amount: number; reason: string }
  | { kind: "potCollect"; playerName: string; amount: number }
  | { kind: "debtPending"; debtorName: string };

/** Extracts a small money-movement summary from the most recent log entry. Returns null when the log
 *  entry doesn't represent a completed/pending money movement (e.g. unrelated log lines). */
export function getMoneyMovementFeedback(
  logEntry: GameLogEntry | null | undefined,
): MoneyMovementFeedback | null {
  if (!logEntry) return null;
  const { message } = logEntry;

  const rentMatch = message.match(/^(.+) paid (.+) \$(\d+) rent for (.+)\./);
  if (rentMatch) {
    return { kind: "transfer", payerName: rentMatch[1], payeeName: rentMatch[2], amount: Number(rentMatch[3]) };
  }

  const taxMatch = message.match(/^(.+) paid \$(\d+) for (Income Tax|Luxury Tax)\.$/);
  if (taxMatch) {
    return { kind: "bankPayment", payerName: taxMatch[1], amount: Number(taxMatch[2]), reason: taxMatch[3] };
  }

  const potMatch = message.match(/^(.+) landed on Free Parking and collected the pot of \$(\d+)!$/);
  if (potMatch) {
    return { kind: "potCollect", playerName: potMatch[1], amount: Number(potMatch[2]) };
  }

  const debtMatch = message.match(/^(.+) cannot pay and must resolve bankruptcy\.$/);
  if (debtMatch) {
    return { kind: "debtPending", debtorName: debtMatch[1] };
  }

  return null;
}

export type CardRevealTone = {
  label: string;
  border: string;
  bg: string;
  header: string;
  accent: string;
  icon: string;
};

/** Visual tone for the card reveal modal, distinct per deck. */
export function getCardRevealTone(deck: "chance" | "community-chest" | string): CardRevealTone {
  if (deck === "chance") {
    return {
      label: "Chance",
      border: "border-amber-400",
      bg: "bg-gradient-to-br from-amber-50 to-orange-100",
      header: "text-amber-700",
      accent: "bg-amber-500",
      icon: "❓",
    };
  }
  return {
    label: "Community Chest",
    border: "border-amber-800/40",
    bg: "bg-gradient-to-br from-amber-100 to-yellow-50",
    header: "text-amber-900",
    accent: "bg-amber-800",
    icon: "📦",
  };
}

/** True once a drawn card should be visually presented (gated by the existing reveal sequencer). */
export function shouldShowCardReveal(state: GameState, showCardPanel: boolean): boolean {
  return state.drawnCard !== null && showCardPanel;
}

/** True while an auction-related banner should be considered (start/win/no-bid moment is in the log). */
export function shouldShowAuctionBanner(logEntry: GameLogEntry | null | undefined): boolean {
  const kind = classifyGameEvent(logEntry?.message);
  return kind === "auctionStart" || kind === "auctionWin" || kind === "auctionNoBid";
}

export type BoardCenterStatus = {
  title: string;
  subtitle?: string;
};

/** Computes what the board's center hero area should show right now, in priority order:
 *  card reveal > auction > trade negotiation > debt pending > dice roll > free parking pot > idle turn. */
export function getBoardCenterStatus(
  state: GameState,
  options?: { tradeDraft?: TradeDraftState | null },
): BoardCenterStatus {
  if (state.phase === "gameOver") {
    const winner = state.players.find((p) => p.id === state.winnerId);
    return { title: "Game Over", subtitle: winner ? `${winner.name} wins!` : undefined };
  }

  if (state.drawnCard) {
    const deckLabel = state.drawnCard.card.deck === "chance" ? "Chance" : "Community Chest";
    return { title: `${deckLabel} Card Drawn` };
  }

  if (state.phase === "auction" && state.auction) {
    const space = getBoardSpaceByIndex(state.auction.propertySpaceIndex);
    return { title: `Auction: ${space.name}` };
  }

  if (state.trade || options?.tradeDraft) {
    return { title: "Trade Negotiation Active" };
  }

  if (state.bankruptcy) {
    const debtor = state.players.find((p) => p.id === state.bankruptcy!.debtorPlayerId);
    return { title: "Payment Required", subtitle: debtor ? `${debtor.name} owes $${state.bankruptcy!.amountOwed}` : undefined };
  }

  if (state.diceRoll && state.currentPlayerHasRolled) {
    const { die1, die2, total } = state.diceRoll;
    return { title: `Rolled ${die1} + ${die2} = ${total}` };
  }

  if (state.rules.freeParkingCash && state.freeParkingPot > 0) {
    const currentPlayer = state.players[state.currentPlayerIndex];
    return {
      title: `Current Turn: ${currentPlayer?.name ?? "—"}`,
      subtitle: `Free Parking Pot: $${state.freeParkingPot}`,
    };
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  return { title: `Current Turn: ${currentPlayer?.name ?? "—"}` };
}
