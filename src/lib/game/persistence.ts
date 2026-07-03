import type { GameState, GamePhase } from "@/types/game";
import { DEFAULT_RULES } from "@/types/game";

export const SAVE_KEY = "worldcities_monopoly_v1";
export const SAVE_VERSION = 1;

type SaveEnvelope = {
  version: number;
  savedAt: string;
  state: GameState;
};

const VALID_PHASES = new Set<string>([
  "setup",
  "readyToRoll",
  "awaitingJailDecision",
  "awaitingPurchaseDecision",
  "auction",
  "turnComplete",
  "bankruptcyPending",
  "gameOver",
]);

// ── Pure functions (testable without DOM) ─────────────────────────────────────

export function serializeGame(state: GameState): string {
  const envelope: SaveEnvelope = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(envelope);
}

export function validateGameShape(data: unknown): data is GameState {
  if (typeof data !== "object" || data === null) return false;
  const s = data as Record<string, unknown>;

  if (typeof s.phase !== "string" || !VALID_PHASES.has(s.phase)) return false;
  if (!Array.isArray(s.players)) return false;
  if (!Array.isArray(s.ownerships)) return false;
  if (!Array.isArray(s.chanceDeck)) return false;
  if (!Array.isArray(s.communityChestDeck)) return false;
  if (typeof s.currentPlayerIndex !== "number") return false;
  if (typeof s.currentPlayerHasRolled !== "boolean") return false;
  if (typeof s.doublesCount !== "number") return false;

  const players = s.players as Record<string, unknown>[];

  if (s.currentPlayerIndex < 0 || s.currentPlayerIndex >= players.length) return false;

  // Validate each player
  for (const p of players) {
    if (typeof p !== "object" || p === null) return false;
    if (typeof p.id !== "string") return false;
    if (typeof p.position !== "number" || p.position < 0 || p.position > 39) return false;
    if (typeof p.cash !== "number") return false;
    if (typeof p.isBankrupt !== "boolean") return false;
    if (typeof p.isInJail !== "boolean") return false;
  }

  const playerIds = new Set(players.map((p) => p.id as string));

  // winnerId must be null or a known player
  if (s.winnerId !== null && s.winnerId !== undefined) {
    if (typeof s.winnerId !== "string" || !playerIds.has(s.winnerId)) return false;
  }

  // Validate ownerships — ownerId must be null or known player
  const ownerships = s.ownerships as Record<string, unknown>[];
  for (const o of ownerships) {
    if (typeof o !== "object" || o === null) return false;
    if (o.ownerId !== null && o.ownerId !== undefined) {
      if (typeof o.ownerId !== "string" || !playerIds.has(o.ownerId)) return false;
    }
  }

  // Validate auction references
  if (s.auction !== null && s.auction !== undefined) {
    const a = s.auction as Record<string, unknown>;
    if (Array.isArray(a.activePlayerIds)) {
      for (const id of a.activePlayerIds) {
        if (typeof id !== "string" || !playerIds.has(id)) return false;
      }
    }
    if (a.highestBidderId !== null && typeof a.highestBidderId === "string") {
      if (!playerIds.has(a.highestBidderId)) return false;
    }
  }

  // Validate trade references
  if (s.trade !== null && s.trade !== undefined) {
    const t = s.trade as Record<string, unknown>;
    if (typeof t.initiatorPlayerId !== "string" || !playerIds.has(t.initiatorPlayerId))
      return false;
    if (typeof t.recipientPlayerId !== "string" || !playerIds.has(t.recipientPlayerId))
      return false;
  }

  // Validate bankruptcy reference
  if (s.bankruptcy !== null && s.bankruptcy !== undefined) {
    const b = s.bankruptcy as Record<string, unknown>;
    if (typeof b.debtorPlayerId !== "string" || !playerIds.has(b.debtorPlayerId)) return false;
    if (typeof b.phaseBeforeBankruptcy !== "string" || !VALID_PHASES.has(b.phaseBeforeBankruptcy))
      return false;
  }

  return true;
}

export function deserializeGame(json: string): GameState | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const envelope = parsed as Record<string, unknown>;
    if (typeof envelope.version !== "number") return null;
    if (envelope.version !== SAVE_VERSION) return null;
    if (!validateGameShape(envelope.state)) return null;
    const state = envelope.state as GameState;
    // Back-fill new fields for saves that predate rules/freeParkingPot
    if (!state.rules) {
      (state as GameState).rules = DEFAULT_RULES;
    }
    if (typeof state.freeParkingPot !== "number") {
      (state as GameState).freeParkingPot = 0;
    }
    // exactGoBonus added later — default ON for new games
    if (typeof state.rules.exactGoBonus !== "boolean") {
      (state as GameState).rules = { ...state.rules, exactGoBonus: true };
    }
    // forfeitAuctionQueue and turnDeadlineAt added later
    if (!Array.isArray((state as GameState).forfeitAuctionQueue)) {
      (state as GameState).forfeitAuctionQueue = [];
    }
    if (!("turnDeadlineAt" in (state as GameState))) {
      (state as GameState).turnDeadlineAt = null;
    }
    // consecutiveTurnTimeouts added later — default 0 per player
    for (const p of (state as GameState).players) {
      if (typeof (p as Record<string, unknown>).consecutiveTurnTimeouts !== "number") {
        (p as Record<string, unknown>).consecutiveTurnTimeouts = 0;
      }
    }
    // bankHouses / bankHotels added in Phase 4H — infer from existing buildings
    if (typeof (state as GameState).bankHouses !== "number" || typeof (state as GameState).bankHotels !== "number") {
      const ownerships = (state as GameState).ownerships;
      const totalHouses = ownerships.reduce((sum, o) => sum + (o.houses ?? 0), 0);
      const totalHotels = ownerships.reduce((sum, o) => (o.hasHotel ? sum + 1 : sum), 0);
      (state as GameState).bankHouses = Math.max(0, 32 - totalHouses);
      (state as GameState).bankHotels = Math.max(0, 12 - totalHotels);
    }
    return state;
  } catch {
    return null;
  }
}

// ── Storage I/O (side-effectful, safe on SSR) ─────────────────────────────────

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serializeGame(state));
  } catch {
    // localStorage unavailable (SSR, quota exceeded, private browsing)
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return deserializeGame(raw);
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (_) {
    // localStorage unavailable
  }
}

// ── Export/Import helpers ─────────────────────────────────────────────────────

export function exportGameJson(state: GameState): string {
  const envelope: SaveEnvelope = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(envelope, null, 2);
}

export function importGameJson(
  json: string,
): { ok: true; state: GameState } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return { ok: false, error: "Invalid save format." };
    }
    const envelope = parsed as Record<string, unknown>;
    if (typeof envelope.version !== "number") {
      return { ok: false, error: "Missing version field." };
    }
    if (envelope.version !== SAVE_VERSION) {
      return {
        ok: false,
        error: `Incompatible save version ${envelope.version}. Expected ${SAVE_VERSION}.`,
      };
    }
    if (!validateGameShape(envelope.state)) {
      return { ok: false, error: "Save data is corrupted or has invalid player references." };
    }
    return { ok: true, state: envelope.state as GameState };
  } catch {
    return { ok: false, error: "Invalid JSON. Please paste a valid save file." };
  }
}
