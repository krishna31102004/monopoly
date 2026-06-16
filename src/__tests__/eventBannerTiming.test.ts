// Vitest in this repo cannot parse JSX from "use client" .tsx/hook files in .test.ts files,
// so the banner-timing gate is tested through the pure helper that drives
// useGameplayPresentation's showEventBanner output.
import { describe, it, expect } from "vitest";
import { shouldShowEventBannerNow, getGameEventBannerFromLogEntry, type PresentationPhase } from "@/lib/ui/gameEventPresentation";
import type { GameLogEntry } from "@/types/game";

function entry(message: string): GameLogEntry {
  return { id: "log-1", message, createdAt: new Date().toISOString() };
}

describe("shouldShowEventBannerNow", () => {
  it("is false while dice are rolling", () => {
    expect(shouldShowEventBannerNow({ presentationPhase: "rollingDice" })).toBe(false);
  });

  it("is false while showing the dice result (token hasn't moved yet)", () => {
    expect(shouldShowEventBannerNow({ presentationPhase: "showingDiceResult" })).toBe(false);
  });

  it("is false while the token is moving", () => {
    expect(shouldShowEventBannerNow({ presentationPhase: "movingToken" })).toBe(false);
  });

  it("is released (true) once movement/bounce has settled (landing phase)", () => {
    expect(shouldShowEventBannerNow({ presentationPhase: "landing" })).toBe(true);
  });

  it("is true while a non-blocking card is shown", () => {
    expect(shouldShowEventBannerNow({ presentationPhase: "revealingCard" })).toBe(true);
  });

  it("is true once the outcome is fully shown", () => {
    expect(shouldShowEventBannerNow({ presentationPhase: "showingOutcome" })).toBe(true);
  });

  it("is true when idle (no movement happened, e.g. between turns)", () => {
    expect(shouldShowEventBannerNow({ presentationPhase: "idle" })).toBe(true);
  });

  const blockedPhases: PresentationPhase[] = ["rollingDice", "showingDiceResult", "movingToken"];
  const releasedPhases: PresentationPhase[] = ["idle", "landing", "revealingCard", "showingOutcome"];

  it("blocks the banner for every pre-movement-complete phase", () => {
    for (const phase of blockedPhases) {
      expect(shouldShowEventBannerNow({ presentationPhase: phase })).toBe(false);
    }
  });

  it("releases the banner for every post-movement-complete phase", () => {
    for (const phase of releasedPhases) {
      expect(shouldShowEventBannerNow({ presentationPhase: phase })).toBe(true);
    }
  });
});

describe("event banner timing for specific event kinds (gate is event-kind agnostic)", () => {
  it("purchase event banner is held back during movement and released after", () => {
    const banner = getGameEventBannerFromLogEntry(entry("kb bought Bengaluru for $120."));
    expect(banner).not.toBeNull();
    expect(shouldShowEventBannerNow({ presentationPhase: "movingToken" })).toBe(false);
    expect(shouldShowEventBannerNow({ presentationPhase: "landing" })).toBe(true);
  });

  it("rent event banner is held back during movement and released after", () => {
    const banner = getGameEventBannerFromLogEntry(entry("ansh paid kb $400 rent for JFK Airport."));
    expect(banner).not.toBeNull();
    expect(shouldShowEventBannerNow({ presentationPhase: "movingToken" })).toBe(false);
    expect(shouldShowEventBannerNow({ presentationPhase: "landing" })).toBe(true);
  });

  it("tax event banner is held back during movement and released after", () => {
    const banner = getGameEventBannerFromLogEntry(entry("kb paid $200 for Income Tax."));
    expect(banner).not.toBeNull();
    expect(shouldShowEventBannerNow({ presentationPhase: "movingToken" })).toBe(false);
    expect(shouldShowEventBannerNow({ presentationPhase: "landing" })).toBe(true);
  });

  it("card-related event banner is held back during movement and released after", () => {
    const banner = getGameEventBannerFromLogEntry(entry("kb cannot pay and must resolve bankruptcy."));
    expect(banner).not.toBeNull();
    expect(shouldShowEventBannerNow({ presentationPhase: "movingToken" })).toBe(false);
    expect(shouldShowEventBannerNow({ presentationPhase: "revealingCard" })).toBe(true);
  });

  it("if there is no movement (idle), the event can appear normally", () => {
    expect(shouldShowEventBannerNow({ presentationPhase: "idle" })).toBe(true);
  });
});
