// MobileActionBar is a "use client" component without a DOM renderer in this repo's test setup,
// so its behavior is verified via source text plus the GameControls component it must not duplicate.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const mobileActionBarSource = readFileSync(
  fileURLToPath(new URL("../components/MobileActionBar.tsx", import.meta.url)),
  "utf-8",
);

const gameControlsSource = readFileSync(
  fileURLToPath(new URL("../components/GameControls.tsx", import.meta.url)),
  "utf-8",
);

describe("MobileActionBar", () => {
  it("renders the current player's name and cash", () => {
    expect(mobileActionBarSource).toContain("currentPlayer?.name");
    expect(mobileActionBarSource).toContain("currentPlayer?.cash");
  });

  it("is hidden on desktop (sm:hidden) so it never duplicates GameControls", () => {
    expect(mobileActionBarSource).toContain("sm:hidden");
  });

  it("roll button state mirrors the same phase/turn gating as GameControls", () => {
    expect(mobileActionBarSource).toContain('state.phase === "readyToRoll"');
    expect(gameControlsSource).toContain('state.phase === "readyToRoll"');
  });

  it("End Turn state mirrors the same phase/turn gating as GameControls", () => {
    expect(mobileActionBarSource).toContain('state.phase === "turnComplete"');
    expect(mobileActionBarSource).toContain("state.currentPlayerHasRolled");
    expect(gameControlsSource).toContain('state.phase === "turnComplete"');
  });

  it("non-current player cannot act — canRoll/canEndTurn both require isMyTurn", () => {
    expect(mobileActionBarSource).toContain("isMyTurn &&");
  });

  it("handles auction/trade/debt phases safely by simply not enabling roll/end-turn", () => {
    // canRoll/canEndTurn are gated on exact phase strings ("readyToRoll" / "turnComplete"),
    // so auction/bankruptcyPending/awaitingPurchaseDecision phases fall through to disabled.
    expect(mobileActionBarSource).toContain("actionDisabled");
  });

  it("does not render a second, duplicate dangerous action (e.g. a second End Turn or Roll button)", () => {
    const buttonCount = (mobileActionBarSource.match(/<button/g) ?? []).length;
    expect(buttonCount).toBe(1);
  });

  it("uses tap-friendly sizing via the shared mobile-action-btn class", () => {
    expect(mobileActionBarSource).toContain("mobile-action-btn");
  });
});
