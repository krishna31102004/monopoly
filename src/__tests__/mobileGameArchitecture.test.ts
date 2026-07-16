// Node-only component safeguards for the responsive presentation layer. Reducer, socket,
// multiplayer authorization, and action behavior remain covered by their existing pure suites.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function read(path: string) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

const localLayout = read("../components/GameLayout.tsx");
const multiplayerLayout = read("../components/multiplayer/GameLayoutMultiplayer.tsx");
const dock = read("../components/MobileActionBar.tsx");
const playerPanel = read("../components/PlayerPanel.tsx");
const propertyModal = read("../components/PropertyCardModal.tsx");
const tradePanel = read("../components/TradePanel.tsx");
const statusStrip = read("../components/GameStatusStrip.tsx");
const logDrawer = read("../components/GameLogDrawer.tsx");
const globals = read("../app/globals.css");

describe("Phase 4 responsive layout safeguards", () => {
  it("keeps one instance of key gameplay components in each layout", () => {
    for (const source of [localLayout, multiplayerLayout]) {
      expect((source.match(/<GameBoard\b/g) ?? [])).toHaveLength(1);
      expect((source.match(/<MobileActionBar\b/g) ?? [])).toHaveLength(1);
      expect((source.match(/<GameControls\b/g) ?? [])).toHaveLength(1);
      expect((source.match(/<GameLogDrawer\b/g) ?? [])).toHaveLength(1);
      expect((source.match(/<PropertyCardModal\b/g) ?? [])).toHaveLength(1);
      expect((source.match(/<AuctionPanel\b/g) ?? [])).toHaveLength(1);
      expect((source.match(/<TradePanel\b/g) ?? [])).toHaveLength(1);
      expect((source.match(/<BankruptcyPanel\b/g) ?? [])).toHaveLength(1);
      expect((source.match(/<JailActionPanel\b/g) ?? [])).toHaveLength(1);
      expect((source.match(/<CardPanel\b/g) ?? [])).toHaveLength(1);
    }
  });

  it("keeps responsive tab destinations while preserving existing conditional panels", () => {
    expect(localLayout).toContain('useState<MobileGameTab>("board")');
    expect(localLayout).toContain('mobileTab === "actions"');
    expect(localLayout).toContain('mobileTab === "players"');
    expect(localLayout).toContain('mobileTab === "log"');
    expect(localLayout).toContain('state.phase === "auction" && showLandingPanel');
    expect(localLayout).toContain('state.phase === "awaitingJailDecision"');
    expect(localLayout).toContain("<GameSaveControls");
    expect(multiplayerLayout).toContain("function getActorId");
    expect(multiplayerLayout).toContain("serverAuthoritative");
    expect(multiplayerLayout).toContain('sendAction({ type: "ROLL_DICE" })');
  });

  it("keeps the dock beneath xl, exposes labelled tabs, and hides during auction", () => {
    expect(dock).toContain("xl:hidden");
    expect(dock).toContain('if (state.phase === "auction") return null');
    expect(dock).toContain('aria-label="Game sections"');
    expect(dock).toContain("aria-current={selected ? \"page\" : undefined}");
    expect(dock).toContain("min-h-11");
    expect(dock).toContain("env(safe-area-inset-bottom");
  });

  it("uses accessible mobile player and property sheets with reachable controls", () => {
    expect(playerPanel).toContain('role="dialog"');
    expect(playerPanel).toContain("aria-modal=\"true\"");
    expect(playerPanel).toContain("onMobileDetailsOpen");
    expect(playerPanel).toContain("min-h-11");
    expect(playerPanel).toContain("aria-expanded={isBelowXl ? mobileSheetOpen : expanded}");
    expect(playerPanel).toContain("aria-controls={isBelowXl ? `player-sheet-${player.id}` : `player-details-${player.id}`}");
    expect(playerPanel).toContain("id={`player-details-${player.id}`}");
    expect(playerPanel).toContain("id={`player-sheet-${player.id}`}");
    expect(propertyModal).toContain('role="dialog"');
    expect(propertyModal).toContain("xl:items-center");
    expect(propertyModal).toContain("wc-icon-button");
    expect(propertyModal).toContain("sticky top-0 z-10 shrink-0");
    expect(propertyModal).toContain("min-h-0 overflow-y-auto");
  });

  it("keeps trade mobile-first and desktop two-column without changing trade actions", () => {
    expect(tradePanel).toContain("xl:grid-cols-2");
    expect(tradePanel).toContain("wc-sticky-footer");
    expect(tradePanel).toContain("Send Offer");
    expect(tradePanel).toContain("Accept Trade");
    expect(tradePanel).toContain("Decline");
    expect(tradePanel).toContain("Cancel Offer");
    expect(tradePanel).toContain("RAISE CASH");
    expect(tradePanel).toContain("SWAP ASSETS");
    expect(tradePanel).not.toContain("COUNTER_OFFER");
  });

  it("keeps compact mobile trade controls reachable without changing desktop density", () => {
    expect(tradePanel).toContain("min-h-11 w-full");
    expect(tradePanel).toContain("xl:min-h-0 xl:w-auto");
    expect(tradePanel).toContain("Mortgaged");
    expect(tradePanel).toContain("house{card.houses === 1 ? \"\" : \"s\"}");
    expect(tradePanel).toContain("Hotel");
    expect(tradePanel).toContain("min-h-11 items-center");
    expect(tradePanel).toContain("min-h-11 min-w-0 flex-1");
    expect(tradePanel).toContain("min-h-11 w-full rounded-lg");
    expect(tradePanel).toContain("grid gap-2 xl:flex");
    expect(tradePanel).toContain('aria-label="Close trade"');
    expect(tradePanel).toContain("wc-icon-button");
  });

  it("keeps mobile-only touch targets and scrolling ownership with their responsive owners", () => {
    expect(dock).toContain("mobile-action-btn wc-button wc-button-primary min-h-11");
    expect(dock).toContain("xl:min-h-0");
    expect(statusStrip).toContain("min-h-11 px-2");
    expect(statusStrip).toContain("xl:min-h-[32px]");
    expect(statusStrip).toContain("xl:min-h-0");
    expect(multiplayerLayout).toContain("min-h-11 px-3");
    expect(multiplayerLayout).toContain("xl:min-h-9");
    expect(logDrawer).toContain('forceOpen && isBelowXl ? "pb-[calc(var(--wc-safe-bottom)+1rem)]" : "max-h-64 overflow-y-auto"');
    expect(globals).toContain(".mobile-game-content");
    expect(globals).toContain("padding-bottom: calc(7.25rem + env(safe-area-inset-bottom, 0px));");
    expect(globals.match(/padding-bottom: calc\(7\.25rem/g) ?? []).toHaveLength(1);
    expect(localLayout).not.toContain("pb-28");
    expect(multiplayerLayout).not.toContain("pb-28");
  });
});
