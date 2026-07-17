import { describe, expect, it } from "vitest";
import { deriveGamePresentationEvents, enqueuePresentationEvents, getEndGameFacts, type PresentationEvent } from "@/lib/ui/gamePresentationEvents";
import { classifyTradeResultFromLogMessage } from "@/lib/game/tradeHelpers";
import { readSoundEnabled, SOUND_PREFERENCE_KEY, writeSoundEnabled } from "@/lib/ui/soundPreferences";
import { makeGameState, withOwnership } from "./helpers/factory";

describe("game presentation event derivation", () => {
  it("derives a property purchase once from factual ownership", () => {
    const before = makeGameState();
    const after = withOwnership(before, 1, before.players[0].id);
    expect(deriveGamePresentationEvents(before, after).filter((event) => event.kind === "property-purchased")).toHaveLength(1);
    expect(deriveGamePresentationEvents(after, after)).toEqual([]);
  });

  it("derives rent, jail, bankruptcy, auction, trade and game-over transitions without mutating state", () => {
    const before = makeGameState();
    const rent = { ...before, landingAction: { kind: "rentPayment" as const, spaceIndex: 1, message: "rent", payerId: before.players[0].id, ownerId: before.players[1].id, rentAmount: 20, payerCashAfter: 1480, ownerCashAfter: 1520, bankruptcyDeferred: false } };
    expect(deriveGamePresentationEvents(before, rent).some((event) => event.kind === "rent-paid")).toBe(true);
    const jailed = { ...before, players: before.players.map((player, index) => index === 0 ? { ...player, isInJail: true } : player) };
    expect(deriveGamePresentationEvents(before, jailed).some((event) => event.kind === "sent-to-jail")).toBe(true);
    const bankrupt = { ...before, players: before.players.map((player, index) => index === 0 ? { ...player, isBankrupt: true } : player) };
    expect(deriveGamePresentationEvents(before, bankrupt).some((event) => event.kind === "bankruptcy")).toBe(true);
    const won = { ...before, phase: "gameOver" as const, winnerId: before.players[0].id };
    expect(deriveGamePresentationEvents(before, won).some((event) => event.kind === "game-won")).toBe(true);
  });

  it("derives a country stamp and factual end-game counts from ownership", () => {
    const before = makeGameState();
    const mexico = withOwnership(withOwnership(before, 1, before.players[0].id), 3, before.players[0].id);
    expect(deriveGamePresentationEvents(before, mexico).some((event) => event.kind === "country-set-completed")).toBe(true);
    const facts = getEndGameFacts(mexico, mexico.players[0].id);
    expect(facts.properties).toBe(2);
    expect(facts.completedGroups).toContain("Mexico");
  });

  it("queues simultaneous events in order and does not replay seen keys", () => {
    const purchase: PresentationEvent = { key: "purchase", kind: "property-purchased", title: "Purchase", detail: "A" };
    const stamp: PresentationEvent = { key: "stamp", kind: "country-set-completed", title: "Stamp", detail: "B" };
    expect(enqueuePresentationEvents([], [purchase, stamp], new Set())).toEqual([purchase, stamp]);
    expect(enqueuePresentationEvents([purchase], [purchase, stamp], new Set(["purchase"]))).toEqual([purchase, stamp]);
  });

  it("uses the previous auction bid and exact reducer trade-result messages", () => {
    const before = { ...makeGameState(), auction: { propertySpaceIndex: 1, activePlayerIds: [], passedPlayerIds: [], currentBid: 137, highestBidderId: null, currentBidderIndex: 0, turnStartedAt: 0, turnDeadlineAt: 0, status: "active" as const } };
    const after = withOwnership({ ...before, auction: null }, 1, before.players[0].id);
    expect(deriveGamePresentationEvents(before, after).find((event) => event.kind === "auction-won")?.detail).toContain("$137");
    expect(classifyTradeResultFromLogMessage("Trade accepted: A gave $1 to B in exchange for nothing.")).toBe("accepted");
    expect(classifyTradeResultFromLogMessage("B declined the trade.")).toBe("declined");
    expect(classifyTradeResultFromLogMessage("A cancelled the trade.")).toBe("cancelled");
    expect(classifyTradeResultFromLogMessage("Trade changed.")).toBeNull();
  });
});

describe("sound preference", () => {
  it("defaults to muted and only uses supplied local storage", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    expect(readSoundEnabled(storage)).toBe(false);
    writeSoundEnabled(storage, true);
    expect(values.get(SOUND_PREFERENCE_KEY)).toBe("true");
    expect(readSoundEnabled(storage)).toBe(true);
  });
});
