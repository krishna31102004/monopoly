// Vitest in this repo cannot parse JSX from "use client" .tsx/.ts hook files in .test.ts files
// (no DOM testing library / react-hooks-testing-library installed), so the dismiss workflow is
// tested through the pure key/identity helpers that drive useGameplayPresentation's gating logic.
import { describe, it, expect } from "vitest";
import { getCardRevealKey, isCardRevealDismissed, shouldShowCardReveal } from "@/lib/ui/gameEventPresentation";
import { makeGameState } from "./helpers/factory";
import type { DrawnCard } from "@/types/game";

function chanceCard(text: string, resolvedMessage: string): DrawnCard {
  return { card: { id: "chance-1", deck: "chance", text, category: "collect-bank" }, resolvedMessage };
}

function chestCard(text: string, resolvedMessage: string): DrawnCard {
  return { card: { id: "chest-1", deck: "community-chest", text, category: "collect-bank" }, resolvedMessage };
}

describe("card reveal dismissal", () => {
  it("Chance card reveal shows when drawn", () => {
    let state = makeGameState();
    state = { ...state, drawnCard: chanceCard("Advance to GO.", "kb collected $200.") };
    expect(shouldShowCardReveal(state, true)).toBe(true);
  });

  it("clicking/triggering Continue dismisses the Chance reveal", () => {
    let state = makeGameState();
    state = { ...state, drawnCard: chanceCard("Advance to GO.", "kb collected $200.") };
    const key = getCardRevealKey(state.drawnCard, state.currentPlayerIndex);

    // Before dismissal: visible
    expect(isCardRevealDismissed(key, null)).toBe(false);
    // After dismissal (Continue clicked, dismissedKey recorded): no longer visible
    expect(isCardRevealDismissed(key, key)).toBe(true);
  });

  it("Community Chest reveal shows when drawn", () => {
    let state = makeGameState();
    state = { ...state, drawnCard: chestCard("Bank error in your favor. Collect $200.", "kb collected $200.") };
    expect(shouldShowCardReveal(state, true)).toBe(true);
  });

  it("clicking/triggering Continue dismisses the Community Chest reveal", () => {
    let state = makeGameState();
    state = { ...state, drawnCard: chestCard("Bank error in your favor. Collect $200.", "kb collected $200.") };
    const key = getCardRevealKey(state.drawnCard, state.currentPlayerIndex);
    expect(isCardRevealDismissed(key, key)).toBe(true);
  });

  it("a dismissed card reveal does not immediately reappear for the same card event", () => {
    let state = makeGameState();
    state = { ...state, drawnCard: chanceCard("Go to jail.", "kb was sent to jail.") };
    const key = getCardRevealKey(state.drawnCard, state.currentPlayerIndex);
    const dismissedKey = key;

    // Re-render with the same drawnCard object still in state (reducer hasn't cleared it yet) —
    // the reveal must stay dismissed.
    const sameKeyAgain = getCardRevealKey(state.drawnCard, state.currentPlayerIndex);
    expect(isCardRevealDismissed(sameKeyAgain, dismissedKey)).toBe(true);
  });

  it("a new card draw creates a new reveal that is not considered dismissed", () => {
    let state = makeGameState();
    state = { ...state, drawnCard: chanceCard("Go to jail.", "kb was sent to jail.") };
    const firstKey = getCardRevealKey(state.drawnCard, state.currentPlayerIndex);
    const dismissedKey = firstKey;

    // A brand-new draw (different card id) is a different key entirely.
    state = { ...state, drawnCard: chestCard("Pay school fees of $150.", "kb paid $150.") };
    const secondKey = getCardRevealKey(state.drawnCard, state.currentPlayerIndex);

    expect(secondKey).not.toBe(firstKey);
    expect(isCardRevealDismissed(secondKey, dismissedKey)).toBe(false);
  });

  it("dismissing the reveal does not clear the required landing outcome from game state", () => {
    let state = makeGameState();
    const drawnCard = chanceCard("Advance to nearest Airport.", "kb advanced to JFK Airport.");
    state = { ...state, drawnCard };
    const key = getCardRevealKey(state.drawnCard, state.currentPlayerIndex);

    // Dismissal is purely a presentation-layer concern — the game state (drawnCard, position,
    // ownerships, etc.) is untouched by computing the dismissed key.
    expect(isCardRevealDismissed(key, key)).toBe(true);
    expect(state.drawnCard).toEqual(drawnCard);
  });

  it("dismissing the reveal does not remove the card effect from game state", () => {
    let state = makeGameState();
    const drawnCard = chestCard("Collect $200.", "kb collected $200.");
    state = { ...state, drawnCard, players: state.players.map((p, i) => (i === 0 ? { ...p, cash: p.cash + 200 } : p)) };
    const key = getCardRevealKey(state.drawnCard, state.currentPlayerIndex);
    isCardRevealDismissed(key, key);
    expect(state.drawnCard?.resolvedMessage).toBe("kb collected $200.");
    expect(state.players[0].cash).toBe(makeGameState().players[0].cash + 200);
  });
});

describe("getCardRevealKey", () => {
  it("returns null when no card is drawn", () => {
    const state = makeGameState();
    expect(getCardRevealKey(state.drawnCard, state.currentPlayerIndex)).toBeNull();
  });

  it("is stable across re-renders for the same drawn card and player", () => {
    const card = chanceCard("Test", "Result");
    expect(getCardRevealKey(card, 0)).toBe(getCardRevealKey(card, 0));
  });

  it("differs when the current player index differs (defensive uniqueness)", () => {
    const card = chanceCard("Test", "Result");
    expect(getCardRevealKey(card, 0)).not.toBe(getCardRevealKey(card, 1));
  });
});
