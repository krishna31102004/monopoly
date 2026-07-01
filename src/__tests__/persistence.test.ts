import { describe, it, expect, vi, afterEach } from "vitest";
import {
  SAVE_VERSION,
  SAVE_KEY,
  serializeGame,
  deserializeGame,
  exportGameJson,
  importGameJson,
  saveGame,
  loadGame,
  clearSave,
} from "@/lib/game/persistence";
import { makeGameState, withPlayer, withOwnership } from "@/__tests__/helpers/factory";
import type { GameState } from "@/types/game";

// ── localStorage mock ─────────────────────────────────────────────────────────

function makeMockStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── serializeGame / deserializeGame ───────────────────────────────────────────

describe("serializeGame / deserializeGame (pure functions)", () => {
  it("serializes a valid game state to JSON string", () => {
    const state = makeGameState(2);
    const json = serializeGame(state);
    expect(typeof json).toBe("string");
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(SAVE_VERSION);
    expect(typeof parsed.savedAt).toBe("string");
    expect(parsed.state).toBeDefined();
  });

  it("deserializes a valid serialized game state", () => {
    const state = makeGameState(3);
    const json = serializeGame(state);
    const loaded = deserializeGame(json);
    expect(loaded).not.toBeNull();
    expect(loaded!.players).toHaveLength(3);
    expect(loaded!.phase).toBe(state.phase);
  });

  it("preserves players, ownerships, chanceDeck, communityChestDeck", () => {
    let state = makeGameState(2);
    state = withOwnership(state, 1, state.players[0].id);
    const json = serializeGame(state);
    const loaded = deserializeGame(json)!;
    expect(loaded.players).toHaveLength(2);
    expect(loaded.ownerships.find((o) => o.spaceIndex === 1)?.ownerId).toBe(state.players[0].id);
    expect(loaded.chanceDeck).toEqual(state.chanceDeck);
    expect(loaded.communityChestDeck).toEqual(state.communityChestDeck);
  });

  it("preserves winnerId when set", () => {
    let state = makeGameState(2);
    const winnerId = state.players[1].id;
    state = { ...state, phase: "gameOver", winnerId };
    const loaded = deserializeGame(serializeGame(state))!;
    expect(loaded.winnerId).toBe(winnerId);
  });

  it("preserves drawnCard", () => {
    const state = makeGameState(2);
    const stateWithCard: GameState = {
      ...state,
      drawnCard: {
        card: { id: "chance-1", deck: "chance", category: "advance-go", text: "Advance to GO" },
        resolvedMessage: "Advance to GO",
      },
    };
    const loaded = deserializeGame(serializeGame(stateWithCard))!;
    expect(loaded.drawnCard?.card.id).toBe("chance-1");
  });

  it("preserves bankruptcy state", () => {
    const state = makeGameState(2);
    const p0 = state.players[0];
    const p1 = state.players[1];
    const stateWithBankruptcy: GameState = {
      ...state,
      phase: "bankruptcyPending",
      bankruptcy: {
        debtorPlayerId: p0.id,
        creditor: { type: "player", playerId: p1.id },
        amountOwed: 50,
        reason: "test",
        status: "pending",
        phaseBeforeBankruptcy: "turnComplete",
      },
    };
    const loaded = deserializeGame(serializeGame(stateWithBankruptcy))!;
    expect(loaded.bankruptcy?.debtorPlayerId).toBe(p0.id);
    expect(loaded.bankruptcy?.creditor.type).toBe("player");
  });

  it("preserves trade state", () => {
    const state = makeGameState(2);
    const p0 = state.players[0];
    const p1 = state.players[1];
    const stateWithTrade: GameState = {
      ...state,
      trade: {
        initiatorPlayerId: p0.id,
        recipientPlayerId: p1.id,
        offerFromInitiator: { cash: 100, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
        offerFromRecipient: { cash: 0, propertySpaceIndices: [1], getOutOfJailFreeCards: 0 },
      },
    };
    const loaded = deserializeGame(serializeGame(stateWithTrade))!;
    expect(loaded.trade?.initiatorPlayerId).toBe(p0.id);
    expect(loaded.trade?.offerFromRecipient.propertySpaceIndices).toContain(1);
  });

  it("returns null for invalid JSON", () => {
    expect(deserializeGame("not-json")).toBeNull();
    expect(deserializeGame("{broken")).toBeNull();
  });

  it("returns null for incompatible save version", () => {
    const state = makeGameState(2);
    const json = serializeGame(state);
    const withBadVersion = json.replace(`"version":${SAVE_VERSION}`, '"version":99');
    expect(deserializeGame(withBadVersion)).toBeNull();
  });

  it("returns null for missing state field", () => {
    const json = JSON.stringify({ version: SAVE_VERSION, savedAt: new Date().toISOString() });
    expect(deserializeGame(json)).toBeNull();
  });

  it("old save without exactGoBonus defaults to true (new default)", () => {
    const state = makeGameState(2);
    // Simulate a save that predates exactGoBonus by removing it from rules
    const { exactGoBonus: _removed, ...rulesWithout } = state.rules as typeof state.rules & { exactGoBonus: boolean };
    const oldState = { ...state, rules: rulesWithout };
    const json = JSON.stringify({ version: SAVE_VERSION, savedAt: new Date().toISOString(), state: oldState });
    const loaded = deserializeGame(json);
    expect(loaded).not.toBeNull();
    expect(loaded!.rules.exactGoBonus).toBe(true);
  });

  it("save with exactGoBonus: true preserves it after roundtrip", () => {
    const state = makeGameState(2);
    const stateWithBonus = { ...state, rules: { ...state.rules, exactGoBonus: true } };
    const loaded = deserializeGame(serializeGame(stateWithBonus));
    expect(loaded).not.toBeNull();
    expect(loaded!.rules.exactGoBonus).toBe(true);
  });
});

// ── importGameJson ─────────────────────────────────────────────────────────────

describe("importGameJson", () => {
  it("successfully imports valid JSON", () => {
    const state = makeGameState(2);
    const json = exportGameJson(state);
    const result = importGameJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players).toHaveLength(2);
    }
  });

  it("returns error for invalid JSON", () => {
    const result = importGameJson("not json at all");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid json/i);
  });

  it("returns error for incompatible save version", () => {
    const state = makeGameState(2);
    const json = exportGameJson(state).replace(`"version": ${SAVE_VERSION}`, '"version": 99');
    const result = importGameJson(json);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/version/i);
  });

  it("returns error for corrupted player references in state", () => {
    const state = makeGameState(2);
    const json = exportGameJson(state);
    // Corrupt a player ID so ownerships reference a non-existent player
    const envelope = JSON.parse(json);
    envelope.state.ownerships[0].ownerId = "ghost-player-id";
    const result = importGameJson(JSON.stringify(envelope));
    expect(result.ok).toBe(false);
  });

  it("does not throw on empty string", () => {
    expect(() => importGameJson("")).not.toThrow();
    const result = importGameJson("");
    expect(result.ok).toBe(false);
  });

  it("does not throw on null-ish values", () => {
    expect(() => importGameJson("null")).not.toThrow();
    expect(() => importGameJson("42")).not.toThrow();
  });
});

// ── localStorage-backed functions ─────────────────────────────────────────────

describe("saveGame / loadGame / clearSave", () => {
  it("saves and loads game state round-trip", () => {
    const mockStorage = makeMockStorage();
    vi.stubGlobal("localStorage", mockStorage);

    const state = makeGameState(2);
    saveGame(state);

    expect(mockStorage.getItem(SAVE_KEY)).not.toBeNull();

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.players).toHaveLength(2);
    expect(loaded!.phase).toBe(state.phase);
  });

  it("clearSave removes saved state", () => {
    const mockStorage = makeMockStorage();
    vi.stubGlobal("localStorage", mockStorage);

    const state = makeGameState(2);
    saveGame(state);
    expect(loadGame()).not.toBeNull();

    clearSave();
    expect(loadGame()).toBeNull();
    expect(mockStorage.getItem(SAVE_KEY)).toBeNull();
  });

  it("loadGame returns null when nothing is saved", () => {
    const mockStorage = makeMockStorage();
    vi.stubGlobal("localStorage", mockStorage);
    expect(loadGame()).toBeNull();
  });

  it("loadGame returns null for corrupted saved data", () => {
    const mockStorage = makeMockStorage();
    vi.stubGlobal("localStorage", mockStorage);
    mockStorage.setItem(SAVE_KEY, "{ this is not valid JSON }");
    expect(loadGame()).toBeNull();
  });

  it("saveGame does not throw when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => { throw new Error("localStorage unavailable"); },
      getItem: () => null,
      removeItem: () => {},
    });
    const state = makeGameState(2);
    expect(() => saveGame(state)).not.toThrow();
  });

  it("loadGame does not throw when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("localStorage unavailable"); },
      setItem: () => {},
      removeItem: () => {},
    });
    expect(() => loadGame()).not.toThrow();
    expect(loadGame()).toBeNull();
  });
});
