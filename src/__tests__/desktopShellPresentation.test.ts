// The project intentionally runs Vitest in Node without a component renderer. These focused
// safeguards lock the desktop-shell wiring and semantic presentation contracts while reducer
// and multiplayer suites continue to exercise the behavior behind these controls.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function read(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf-8");
}

const localLayout = read("../components/GameLayout.tsx");
const multiplayerLayout = read("../components/multiplayer/GameLayoutMultiplayer.tsx");
const controls = read("../components/GameControls.tsx");
const landingPanel = read("../components/LandingActionPanel.tsx");
const logDrawer = read("../components/GameLogDrawer.tsx");
const playerPanel = read("../components/PlayerPanel.tsx");
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
    expect(localLayout).toContain('state.phase === "auction" && showLandingPanel');
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

describe("Phase 3 dark command-dock presentation safeguards", () => {
  it("keeps dice status readable and preserves the original dispatch action types", () => {
    expect(controls).toContain("text-white");
    expect(controls).toContain("text-amber-200");
    expect(controls).toContain("text-emerald-200");
    expect(controls).toContain('dispatch({ type: "ROLL_DICE", dice: rollDice() })');
    expect(controls).toContain('dispatch({ type: "END_TURN" })');
    expect(controls).toContain('state.phase === "readyToRoll" && isMyTurn && !isAnimating');
    expect(controls).toContain('state.phase === "turnComplete" && state.currentPlayerHasRolled');
  });

  it("uses dark premium surfaces for landing, log, roster, and leave UI", () => {
    expect(landingPanel).toContain("bg-[var(--wc-navy)]");
    expect(landingPanel).toContain("wc-button-primary");
    expect(logDrawer).toContain("bg-[var(--wc-navy-raised)]");
    expect(logDrawer).toContain('<UiIcon name="log"');
    expect(playerPanel).toContain("bg-[var(--wc-navy-raised)]");
    expect(playerPanel).not.toContain("getWealthBarPercent");
    expect(statusStrip).toContain('role="dialog"');
    expect(statusStrip).toContain('aria-labelledby="leave-game-title"');
    expect(statusStrip).toContain("bg-[var(--wc-navy)]");
  });
});
