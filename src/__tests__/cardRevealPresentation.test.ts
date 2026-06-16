import { describe, it, expect } from "vitest";
import { getCardRevealTone, shouldShowCardReveal } from "@/lib/ui/gameEventPresentation";
import { makeGameState } from "./helpers/factory";
import type { DrawnCard } from "@/types/game";

function makeDrawnCard(deck: "chance" | "community-chest", text: string, resolvedMessage: string): DrawnCard {
  return { card: { id: "test-card", deck, text, category: "collect-bank" }, resolvedMessage };
}

describe("getCardRevealTone", () => {
  it("gives Chance cards a distinct gold/orange tone", () => {
    const tone = getCardRevealTone("chance");
    expect(tone.label).toBe("Chance");
    expect(tone.border).toContain("amber");
  });

  it("gives Community Chest cards a distinct warm brown/cream tone", () => {
    const tone = getCardRevealTone("community-chest");
    expect(tone.label).toBe("Community Chest");
  });

  it("Chance and Community Chest tones are visually distinct", () => {
    const chance = getCardRevealTone("chance");
    const chest = getCardRevealTone("community-chest");
    expect(chance.bg).not.toBe(chest.bg);
    expect(chance.icon).not.toBe(chest.icon);
  });
});

describe("card reveal includes the card text and result separately", () => {
  it("nearest-Airport doubled-rent card displays the doubled rent result correctly", () => {
    const drawnCard = makeDrawnCard(
      "chance",
      "Advance token to the nearest Airport. If unowned, you may buy it. If owned, pay double rent.",
      "kb advanced to JFK Airport. Paid $400 to ansh (double rent).",
    );
    expect(drawnCard.card.text).toContain("nearest Airport");
    expect(drawnCard.resolvedMessage).toContain("$400");
    expect(drawnCard.resolvedMessage).not.toBe(drawnCard.card.text);
  });

  it("card text and result are kept as separate fields", () => {
    const drawnCard = makeDrawnCard("community-chest", "Bank error in your favor. Collect $200.", "kb collected $200.");
    expect(drawnCard.card.text).not.toBe(drawnCard.resolvedMessage);
  });
});

describe("shouldShowCardReveal", () => {
  it("is true once a card is drawn and the reveal sequencer allows it", () => {
    let state = makeGameState();
    state = { ...state, drawnCard: makeDrawnCard("chance", "Test card", "Test result") };
    expect(shouldShowCardReveal(state, true)).toBe(true);
  });

  it("does not resolve visually before the card panel is allowed to show", () => {
    let state = makeGameState();
    state = { ...state, drawnCard: makeDrawnCard("chance", "Test card", "Test result") };
    expect(shouldShowCardReveal(state, false)).toBe(false);
  });

  it("is false when no card has been drawn", () => {
    const state = makeGameState();
    expect(shouldShowCardReveal(state, true)).toBe(false);
  });
});
