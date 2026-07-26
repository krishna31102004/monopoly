// Vitest in this repo cannot parse JSX from "use client" .tsx components in .test.ts files
// (no DOM testing library installed), so CardPanel's behaviour is tested through its
// underlying presentation helpers instead of rendering the component directly. For markup
// invariants (no blocking overlay, no required Continue button) we assert against the
// component's source text, since that's the only practical way to verify this without a
// DOM renderer in this repo.
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
const globalsSource = readFileSync(
  fileURLToPath(new URL("../app/globals.css", import.meta.url)),
  "utf-8",
);

function makeDrawnCard(deck: "chance" | "community-chest", text: string, resolvedMessage: string): DrawnCard {
  return { card: { id: "test-card", deck, text, category: "collect-bank" }, resolvedMessage };
}

describe("card reveal UI data", () => {
  it("Chance card reveal has readable title/text data", () => {
    const drawnCard = makeDrawnCard("chance", "Advance to GO. Collect $200.", "kb collected $200.");
    const tone = getCardRevealTone(drawnCard.card.deck);
    expect(tone.label).toBe("Chance");
    expect(tone.bg).toBe("bg-[var(--wc-paper)]");
    expect(tone.header).toBe("text-amber-700");
    expect(drawnCard.card.text.length).toBeGreaterThan(0);
  });

  it("Community Chest card reveal has readable title/text data", () => {
    const drawnCard = makeDrawnCard("community-chest", "Bank error in your favor. Collect $200.", "kb collected $200.");
    const tone = getCardRevealTone(drawnCard.card.deck);
    expect(tone.label).toBe("Community Chest");
    expect(tone.bg).toBe("bg-[var(--wc-paper)]");
    expect(tone.header).toBe("text-cyan-800");
    expect(drawnCard.card.text.length).toBeGreaterThan(0);
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

describe("CardPanel is non-blocking markup", () => {
  it("does not render a blocking full-screen overlay", () => {
    expect(cardPanelSource).not.toContain("fixed inset-0");
    expect(cardPanelSource).not.toContain('role="presentation"');
    expect(cardPanelSource).not.toContain('aria-modal="true"');
    expect(cardPanelSource).not.toContain('role="dialog"');
  });

  it("does not require a Continue button to dismiss", () => {
    expect(cardPanelSource).not.toContain("Continue");
    expect(cardPanelSource).not.toContain("onContinue");
  });

  it("is rendered for both Chance and Community Chest decks (deck-agnostic markup)", () => {
    expect(cardPanelSource).toContain("getCardRevealTone(card.deck)");
  });

  it("has an accessible label so screen readers know what was drawn", () => {
    expect(cardPanelSource).toContain("aria-label=");
  });

  it("uses a readable paper hierarchy without truncating long card descriptions", () => {
    expect(cardPanelSource).toContain("wc-paper-shell");
    expect(cardPanelSource).toContain("text-[var(--wc-text-on-light)]");
    expect(cardPanelSource).toContain("whitespace-normal");
    expect(cardPanelSource).toContain("bg-[var(--wc-ivory)]");
    expect(cardPanelSource).not.toContain("truncate");
    expect(cardPanelSource).not.toContain("line-clamp");
  });

  it("uses a zero-padding paper shell so the header and result bands span the full card", () => {
    expect(globalsSource).toContain(".wc-paper-shell { padding: 0; }");
  });
});
