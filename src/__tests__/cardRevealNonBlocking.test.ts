// Vitest in this repo cannot parse JSX from "use client" .tsx components in .test.ts files
// (no DOM testing library installed). CardPanel's non-blocking markup is verified against its
// source text; the "can't get stuck" guarantee is verified against the presentation helpers
// that drive its visibility (there is no longer a manual dismiss/Continue step to get stuck on).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getCardRevealTone, shouldShowCardReveal } from "@/lib/ui/gameEventPresentation";
import { makeGameState } from "./helpers/factory";
import type { DrawnCard } from "@/types/game";

const cardPanelSource = readFileSync(
  fileURLToPath(new URL("../components/CardPanel.tsx", import.meta.url)),
  "utf-8",
);

function chanceCard(text: string, resolvedMessage: string): DrawnCard {
  return { card: { id: "chance-1", deck: "chance", text, category: "collect-bank" }, resolvedMessage };
}

function chestCard(text: string, resolvedMessage: string): DrawnCard {
  return { card: { id: "chest-1", deck: "community-chest", text, category: "collect-bank" }, resolvedMessage };
}

describe("card modal removal / non-blocking behavior", () => {
  it("Chance card does not render a blocking modal requiring Continue", () => {
    expect(cardPanelSource).not.toContain("fixed inset-0");
    expect(cardPanelSource).not.toContain("Continue");
    const tone = getCardRevealTone("chance");
    expect(tone.label).toBe("Chance");
  });

  it("Community Chest card does not render a blocking modal requiring Continue", () => {
    expect(cardPanelSource).not.toContain("fixed inset-0");
    expect(cardPanelSource).not.toContain("Continue");
    const tone = getCardRevealTone("community-chest");
    expect(tone.label).toBe("Community Chest");
  });

  it("no Continue button is required for the Chance card workflow", () => {
    let state = makeGameState();
    state = { ...state, drawnCard: chanceCard("Advance to GO.", "kb collected $200.") };
    // Visibility is driven purely by showCardPanel (presentation timing), never by a
    // dismiss/continue click.
    expect(shouldShowCardReveal(state, true)).toBe(true);
    expect(cardPanelSource).not.toContain("onContinue");
  });

  it("no Continue button is required for the Community Chest workflow", () => {
    let state = makeGameState();
    state = { ...state, drawnCard: chestCard("Bank error in your favor. Collect $200.", "kb collected $200.") };
    expect(shouldShowCardReveal(state, true)).toBe(true);
    expect(cardPanelSource).not.toContain("onContinue");
  });

  it("card info still renders in a non-blocking panel/helper", () => {
    const drawnCard = chanceCard("Advance to nearest Airport.", "kb advanced to JFK Airport and paid $400 to ansh.");
    expect(drawnCard.card.text.length).toBeGreaterThan(0);
    expect(drawnCard.resolvedMessage.length).toBeGreaterThan(0);
    expect(drawnCard.resolvedMessage).not.toBe(drawnCard.card.text);
  });

  it("card effect still resolves (resolvedMessage reflects the outcome, untouched by display logic)", () => {
    const drawnCard = chestCard("Pay school fees of $150.", "kb paid $150.");
    expect(drawnCard.resolvedMessage).toBe("kb paid $150.");
  });

  it("card display does not block buy/decline — landingAction is independent of drawnCard display", () => {
    let state = makeGameState();
    state = {
      ...state,
      drawnCard: chanceCard("Advance to nearest Airport.", "kb advanced to JFK Airport."),
      landingAction: { spaceIndex: 5, kind: "purchaseDecision", message: "JFK Airport is unowned." },
    };
    expect(state.landingAction).not.toBeNull();
    expect(shouldShowCardReveal(state, true)).toBe(true);
  });

  it("card display does not block End Turn when End Turn is valid", () => {
    let state = makeGameState();
    state = {
      ...state,
      drawnCard: chestCard("Collect $200.", "kb collected $200."),
      landingAction: null,
      currentPlayerHasRolled: true,
    };
    // No landingAction pending means End Turn should be reachable regardless of the card display.
    expect(state.landingAction).toBeNull();
    expect(shouldShowCardReveal(state, true)).toBe(true);
  });

  it("card display does not block the debt/payment panel", () => {
    let state = makeGameState();
    state = {
      ...state,
      drawnCard: chanceCard("Pay luxury tax of $200.", "kb cannot pay and must resolve bankruptcy."),
      bankruptcy: {
        debtorPlayerId: state.players[0].id,
        creditor: { type: "bank" },
        amountOwed: 200,
        reason: "tax",
        status: "pending",
        phaseBeforeBankruptcy: "turnComplete",
      },
    };
    expect(state.bankruptcy).not.toBeNull();
    expect(shouldShowCardReveal(state, true)).toBe(true);
  });
});

describe("regression: drawing a card cannot leave the UI permanently stuck", () => {
  it("drawing a Chance card does not block via a manual dismiss requirement", () => {
    expect(cardPanelSource).not.toContain("role=\"dialog\"");
    expect(cardPanelSource).not.toContain("aria-modal");
  });

  it("drawing a Community Chest card does not block via a manual dismiss requirement", () => {
    expect(cardPanelSource).not.toContain("role=\"presentation\"");
  });

  it("repeated card draws do not stack stuck overlays — visibility is keyed off drawnCard/showCardPanel only", () => {
    let state = makeGameState();
    state = { ...state, drawnCard: chanceCard("First card.", "First result.") };
    expect(shouldShowCardReveal(state, true)).toBe(true);

    // A second draw replaces drawnCard outright (reducer clears/overwrites it); there is no
    // independent "dismissed" flag left behind to desync from the new card.
    state = { ...state, drawnCard: chestCard("Second card.", "Second result.") };
    expect(shouldShowCardReveal(state, true)).toBe(true);
    expect(state.drawnCard?.card.text).toBe("Second card.");
  });
});
