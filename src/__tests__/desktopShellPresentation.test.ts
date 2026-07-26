// The project intentionally runs Vitest in Node without a component renderer. These focused
// safeguards lock the desktop-shell wiring and semantic presentation contracts while reducer
// and multiplayer suites continue to exercise the behavior behind these controls.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getContrastRatio, getDesignReadableTextColor } from "@/lib/ui/designTokens";
import { CITY_COLOR_HEX } from "@/lib/ui/propertyColors";

function read(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf-8");
}

const localLayout = read("../components/GameLayout.tsx");
const multiplayerLayout = read("../components/multiplayer/GameLayoutMultiplayer.tsx");
const controls = read("../components/GameControls.tsx");
const turnStatusPresentation = read("../lib/ui/gameControlsPresentation.ts");
const landingPanel = read("../components/LandingActionPanel.tsx");
const logDrawer = read("../components/GameLogDrawer.tsx");
const playerPanel = read("../components/PlayerPanel.tsx");
const cardPanel = read("../components/CardPanel.tsx");
const saveControls = read("../components/GameSaveControls.tsx");
const statusStrip = read("../components/GameStatusStrip.tsx");

describe("Phase 3 desktop shell layout safeguards", () => {
  it("keeps one board and one mobile action bar in each game layout", () => {
    expect((localLayout.match(/<GameBoard\b/g) ?? [])).toHaveLength(1);
    expect((localLayout.match(/<MobileActionBar\b/g) ?? [])).toHaveLength(1);
    expect((multiplayerLayout.match(/<GameBoard\b/g) ?? [])).toHaveLength(1);
    expect((multiplayerLayout.match(/<MobileActionBar\b/g) ?? [])).toHaveLength(1);
  });

  it("preserves local save controls and all conditional gameplay panels", () => {
    expect(localLayout).toContain("<GameSaveControls");
    expect(localLayout).toContain('state.phase === "auction"');
    expect(localLayout).toContain('state.phase === "awaitingJailDecision"');
    expect(localLayout).toContain("state.drawnCard && showCardPanel");
    expect(localLayout).toContain("<LandingActionPanel");
    expect(localLayout).toContain("<BankruptcyPanel");
    expect(localLayout).toContain("<TradePanel");
    expect(localLayout).toContain("<PropertyCardModal");
  });

  it("preserves multiplayer sync, connection controls, and server-authoritative auction wiring", () => {
    expect(multiplayerLayout).toContain("onRequestSync");
    expect(multiplayerLayout).toContain('connectionStatus === "reconnecting"');
    expect(multiplayerLayout).toContain('connectionStatus === "disconnected"');
    expect(multiplayerLayout).toContain("serverAuthoritative");
    expect(multiplayerLayout).toContain("function getActorId");
    expect(multiplayerLayout).toContain('action.type === "ROLL_DICE"');
    expect(multiplayerLayout).toContain('sendAction({ type: "ROLL_DICE" })');
  });
});

describe("responsive command-dock presentation safeguards", () => {
  it("keeps dice status readable and preserves the original dispatch action types", () => {
    expect(controls).toContain("getTurnStatus");
    expect(turnStatusPresentation).toContain("text-amber-800");
    expect(turnStatusPresentation).toContain("text-emerald-800");
    expect(turnStatusPresentation).toContain("text-sky-800");
    expect(controls).toContain('presentationStatus ? "text-slate-700" : status.color');
    expect(controls).toContain("text-amber-800 hover:bg-amber-500/20");
    expect(controls).toContain('dispatch({ type: "ROLL_DICE", dice: rollDice() })');
    expect(controls).toContain('dispatch({ type: "END_TURN" })');
    expect(controls).toContain('state.phase === "readyToRoll" && isMyTurn && !isAnimating');
    expect(controls).toContain('state.phase === "turnComplete" && state.currentPlayerHasRolled');
  });

  it("keeps the complete command column on light paper surfaces", () => {
    expect(controls).toContain("bg-[var(--wc-paper)]");
    expect(controls).not.toContain("xl:bg-[var(--wc-navy)]");
    expect(landingPanel).toContain("bg-[var(--wc-paper)]");
    expect(landingPanel).not.toContain("xl:bg-[var(--wc-navy)]");
    expect(landingPanel).toContain("wc-button-primary");
    expect(logDrawer).toContain("bg-[var(--wc-paper)]");
    expect(logDrawer).not.toContain("xl:bg-[var(--wc-navy-raised)]");
    expect(logDrawer).toContain('<UiIcon name="log"');
    expect(playerPanel).toContain("bg-white");
    expect(playerPanel).not.toContain("xl:bg-[var(--wc-navy-raised)]");
    expect(playerPanel).toContain("linear-gradient(155deg");
    expect(playerPanel).toContain("borderLeftColor: player.color");
    expect(playerPanel).not.toContain("getWealthBarPercent");
    expect(playerPanel).toContain("getDesignReadableTextColor");
    expect(playerPanel).toContain("min-h-11");
    const cityChipBlock = playerPanel.slice(
      playerPanel.indexOf("cityGroups.map"),
      playerPanel.indexOf("airports.map"),
    );
    expect(cityChipBlock).not.toContain("text-white");
    expect(logDrawer).toContain("TONE_DOT_CLASS[tone]");
    expect(logDrawer).not.toContain("{icon}");
    expect(statusStrip).toContain('role="dialog"');
    expect(statusStrip).toContain('aria-labelledby="leave-game-title"');
    expect(statusStrip).toContain("bg-[var(--wc-navy)]");
  });

  it("keeps save utilities compact and preserves their three stateful actions", () => {
    expect(saveControls).toContain("bg-[var(--wc-paper)]");
    expect(saveControls).toContain("Export Save");
    expect(saveControls).toContain("Import Save");
    expect(saveControls).toContain("New Game");
    expect(saveControls).toContain("min-h-11");
  });
});

describe("crisp player-card presentation safeguards", () => {
  it("uses a clean white and cool-slate PlayerPanel without changing warm card surfaces", () => {
    expect(playerPanel).toContain("border border-slate-200 bg-white");
    expect(playerPanel).toContain("bg-slate-50");
    expect(playerPanel).toContain("text-slate-950");
    expect(playerPanel).not.toContain("bg-[var(--wc-paper)]");
    expect(playerPanel).not.toContain("bg-[var(--wc-ivory)]");
    expect(cardPanel).toContain("wc-paper-shell");
  });

  it("keeps player identity, a white-resolving current gradient, and compact asset chips", () => {
    expect(playerPanel).toContain("borderLeftColor: player.color");
    expect(playerPanel).toContain("backgroundColor: player.color");
    expect(playerPanel).toContain("linear-gradient(155deg, ${player.color}14, #ffffff 55%)");
    expect(playerPanel).toContain("getDesignReadableTextColor(player.color)");

    const chipBlock = playerPanel.slice(
      playerPanel.indexOf("cityGroups.map"),
      playerPanel.indexOf("{/* Explicit expand/collapse affordance"),
    );
    expect(chipBlock).toContain("px-1.5 py-0.5 text-[9px]");
    expect(chipBlock).toContain('<UiIcon name="airport" size={11}');
    expect(chipBlock).toContain('<UiIcon name="utility" size={11}');
    expect(chipBlock).not.toContain("truncate");
  });

  it("preserves the mobile Details target while allowing a compact desktop details row", () => {
    expect(playerPanel).toContain("min-h-11");
    expect(playerPanel).toContain("xl:min-h-0 xl:py-1");
    expect(playerPanel).toContain("aria-controls={isBelowXl ? `player-sheet-${player.id}`");
    expect(playerPanel).toContain("aria-expanded={isBelowXl ? mobileSheetOpen : expanded}");
  });
});

describe("Phase 3 city property-chip contrast", () => {
  it("uses the higher-contrast WCAG foreground for every shared city color", () => {
    for (const [group, background] of Object.entries(CITY_COLOR_HEX)) {
      const foreground = getDesignReadableTextColor(background);
      const selectedContrast = getContrastRatio(background, foreground);
      const alternative = foreground === "#0F172A" ? "#FFFFFF" : "#0F172A";
      const alternativeContrast = getContrastRatio(background, alternative);

      expect(selectedContrast, group).not.toBeNull();
      expect(alternativeContrast, group).not.toBeNull();
      expect(selectedContrast!, group).toBeGreaterThanOrEqual(alternativeContrast!);
      expect(selectedContrast!, group).toBeGreaterThanOrEqual(4.5);
    }
  });
});
