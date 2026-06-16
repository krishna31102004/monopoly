// The floating/cinematic event banner was removed entirely (Phase 4E.4E) — it kept revealing
// outcomes before the token finished moving, even after dedicated timing fixes. The game log,
// landing panel, and card panel already surface every outcome, so shouldShowEventBannerNow is
// now permanently disabled. Vitest in this repo cannot parse JSX from "use client" components,
// so this is verified through the pure helper plus a source-text check that no component
// imports/renders the (now-deleted) GameEventBanner.
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { shouldShowEventBannerNow, getGameEventBannerFromLogEntry, type PresentationPhase } from "@/lib/ui/gameEventPresentation";
import type { GameLogEntry } from "@/types/game";

function entry(message: string): GameLogEntry {
  return { id: "log-1", message, createdAt: new Date().toISOString() };
}

const ALL_PHASES: PresentationPhase[] = [
  "idle",
  "rollingDice",
  "showingDiceResult",
  "movingToken",
  "landing",
  "revealingCard",
  "showingOutcome",
];

describe("shouldShowEventBannerNow (floating banner permanently disabled)", () => {
  it("is false in every presentation phase", () => {
    for (const phase of ALL_PHASES) {
      expect(shouldShowEventBannerNow({ presentationPhase: phase })).toBe(false);
    }
  });

  it("stays false even for events that would otherwise classify as major (purchase/rent/tax/card)", () => {
    const purchase = getGameEventBannerFromLogEntry(entry("kb bought Bengaluru for $120."));
    const rent = getGameEventBannerFromLogEntry(entry("ansh paid kb $400 rent for JFK Airport."));
    const tax = getGameEventBannerFromLogEntry(entry("kb paid $200 for Income Tax."));
    const card = getGameEventBannerFromLogEntry(entry("kb cannot pay and must resolve bankruptcy."));
    expect(purchase).not.toBeNull();
    expect(rent).not.toBeNull();
    expect(tax).not.toBeNull();
    expect(card).not.toBeNull();

    for (const phase of ALL_PHASES) {
      expect(shouldShowEventBannerNow({ presentationPhase: phase })).toBe(false);
    }
  });
});

describe("GameEventBanner component removal", () => {
  const componentPath = fileURLToPath(new URL("../components/GameEventBanner.tsx", import.meta.url));

  it("the GameEventBanner component file no longer exists", () => {
    expect(existsSync(componentPath)).toBe(false);
  });

  it("GameBoard no longer imports or renders GameEventBanner", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../components/board/GameBoard.tsx", import.meta.url)),
      "utf-8",
    );
    expect(source).not.toContain("GameEventBanner");
    expect(source).not.toContain("latestLogEntry");
  });

  it("GameLayout no longer wires latestLogEntry/showEventBanner into GameBoard", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../components/GameLayout.tsx", import.meta.url)),
      "utf-8",
    );
    expect(source).not.toContain("latestLogEntry");
    expect(source).not.toContain("showEventBanner");
  });

  it("GameLayoutMultiplayer no longer wires latestLogEntry/showEventBanner into GameBoard", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../components/multiplayer/GameLayoutMultiplayer.tsx", import.meta.url)),
      "utf-8",
    );
    expect(source).not.toContain("latestLogEntry");
    expect(source).not.toContain("showEventBanner");
  });
});

describe("outcomes remain visible through other UI even though the floating banner is gone", () => {
  it("game log entries still classify purchase/rent/tax/card events for the log/landing panel", () => {
    expect(getGameEventBannerFromLogEntry(entry("kb bought Bengaluru for $120."))?.kind).toBe("purchase");
    expect(getGameEventBannerFromLogEntry(entry("ansh paid kb $400 rent for JFK Airport."))?.kind).toBe("rent");
    expect(getGameEventBannerFromLogEntry(entry("kb paid $200 for Income Tax."))?.kind).toBe("tax");
    expect(getGameEventBannerFromLogEntry(entry("kb cannot pay and must resolve bankruptcy."))?.kind).toBe("debtPending");
  });
});
