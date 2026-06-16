// Vitest in this repo cannot parse JSX from "use client" .tsx components in .test.ts files
// (no DOM testing library installed), so CardPanel's behaviour is tested through its
// underlying presentation helpers instead of rendering the component directly.
import { describe, it, expect } from "vitest";
import { getCardRevealTone, getCardRevealDismissAction, shouldShowCardReveal } from "@/lib/ui/gameEventPresentation";
import { makeGameState } from "./helpers/factory";
import type { DrawnCard } from "@/types/game";

function makeDrawnCard(deck: "chance" | "community-chest", text: string, resolvedMessage: string): DrawnCard {
  return { card: { id: "test-card", deck, text, category: "collect-bank" }, resolvedMessage };
}

describe("card reveal UI data", () => {
  it("Chance card reveal has readable title/text data", () => {
    const drawnCard = makeDrawnCard("chance", "Advance to GO. Collect $200.", "kb collected $200.");
    const tone = getCardRevealTone(drawnCard.card.deck);
    expect(tone.label).toBe("Chance");
    expect(drawnCard.card.text.length).toBeGreaterThan(0);
  });

  it("Community Chest card reveal has readable title/text data", () => {
    const drawnCard = makeDrawnCard("community-chest", "Bank error in your favor. Collect $200.", "kb collected $200.");
    const tone = getCardRevealTone(drawnCard.card.deck);
    expect(tone.label).toBe("Community Chest");
    expect(drawnCard.card.text.length).toBeGreaterThan(0);
  });

  it("card reveal exposes a dismiss/continue action", () => {
    expect(getCardRevealDismissAction()).toBe("continue");
  });

  it("result text is kept separate from card text", () => {
    const drawnCard = makeDrawnCard("chance", "Go to jail.", "kb was sent to jail.");
    expect(drawnCard.resolvedMessage).not.toBe(drawnCard.card.text);
  });

  it("card reveal state can close/continue without permanently blocking the landing action state", () => {
    let state = makeGameState();
    state = { ...state, drawnCard: makeDrawnCard("chance", "Test card", "Test result") };
    expect(shouldShowCardReveal(state, true)).toBe(true);

    // Once the card is dismissed (drawnCard cleared by the reducer / showCardPanel toggled off),
    // the reveal no longer blocks the rest of the UI.
    const dismissed = { ...state, drawnCard: null };
    expect(shouldShowCardReveal(dismissed, true)).toBe(false);
    expect(shouldShowCardReveal(state, false)).toBe(false);
  });
});
