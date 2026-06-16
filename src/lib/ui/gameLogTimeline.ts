import type { GameLogEntry } from "@/types/game";

/** Broad category for a game log entry — drives the icon/tone shown in the premium timeline. */
export type GameLogCategory =
  | "diceRoll"
  | "movement"
  | "purchase"
  | "rent"
  | "tax"
  | "chance"
  | "communityChest"
  | "auction"
  | "trade"
  | "debt"
  | "bankruptcy"
  | "unknown";

export type GameLogTone = "success" | "danger" | "warning" | "info" | "neutral";

const CATEGORY_PATTERNS: Array<{ category: GameLogCategory; test: RegExp }> = [
  { category: "debt", test: /cannot pay|must resolve bankruptcy/i },
  { category: "bankruptcy", test: /bankrupt|is eliminated|resolved the debt/i },
  { category: "trade", test: /trade/i },
  { category: "auction", test: /auction|bid/i },
  { category: "communityChest", test: /community chest/i },
  { category: "chance", test: /chance card|drew a chance/i },
  { category: "tax", test: /income tax|luxury tax/i },
  { category: "rent", test: /rent/i },
  { category: "purchase", test: /bought|purchased|declined to buy/i },
  { category: "diceRoll", test: /rolled|rolls a/i },
  { category: "movement", test: /moved to|landed on|advance(d|s)? to|passed go/i },
];

/** Classifies a raw game log message into a broad category for icon/tone display.
 *  Falls back to "unknown" for anything that doesn't match a known pattern — callers must
 *  always handle "unknown" safely rather than throwing. */
export function classifyGameLogEntry(message: string | undefined | null): GameLogCategory {
  if (!message) return "unknown";
  for (const { category, test } of CATEGORY_PATTERNS) {
    if (test.test(message)) return category;
  }
  return "unknown";
}

const ICONS: Record<GameLogCategory, string> = {
  diceRoll: "🎲",
  movement: "🚶",
  purchase: "🏙️",
  rent: "💸",
  tax: "🏛️",
  chance: "❓",
  communityChest: "📦",
  auction: "🔨",
  trade: "🤝",
  debt: "⚠️",
  bankruptcy: "💀",
  unknown: "•",
};

const TONES: Record<GameLogCategory, GameLogTone> = {
  diceRoll: "neutral",
  movement: "neutral",
  purchase: "success",
  rent: "warning",
  tax: "warning",
  chance: "info",
  communityChest: "info",
  auction: "info",
  trade: "success",
  debt: "danger",
  bankruptcy: "danger",
  unknown: "neutral",
};

/** Icon for a given log entry (or category string), used in the timeline UI. */
export function getGameLogIcon(entry: GameLogEntry | GameLogCategory | string): string {
  const category = resolveCategory(entry);
  return ICONS[category];
}

/** Visual tone for a given log entry (or category string), used for color accents. */
export function getGameLogTone(entry: GameLogEntry | GameLogCategory | string): GameLogTone {
  const category = resolveCategory(entry);
  return TONES[category];
}

function resolveCategory(entry: GameLogEntry | GameLogCategory | string): GameLogCategory {
  if (typeof entry === "object" && entry !== null && "message" in entry) {
    return classifyGameLogEntry(entry.message);
  }
  if (typeof entry === "string" && entry in ICONS) {
    return entry as GameLogCategory;
  }
  return classifyGameLogEntry(entry as string);
}

export type GroupedGameLogEntry = {
  entry: GameLogEntry;
  category: GameLogCategory;
  icon: string;
  tone: GameLogTone;
};

/** Annotates each log entry with its classification, icon, and tone — newest entry first is
 *  preserved as-is (callers control ordering); this just enriches each entry for display. */
export function getGroupedGameLogEntries(entries: GameLogEntry[]): GroupedGameLogEntry[] {
  return entries.map((entry) => ({
    entry,
    category: classifyGameLogEntry(entry.message),
    icon: getGameLogIcon(entry),
    tone: getGameLogTone(entry),
  }));
}
