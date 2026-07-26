// MobileActionBar is a "use client" component without a DOM renderer in this repo's test setup,
// so its behavior is verified via source text plus the GameControls component it must not duplicate.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getMobilePrimaryAction, MOBILE_GAME_TABS } from "@/lib/ui/mobileGameNavigation";
import { makeGameState } from "./helpers/factory";

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

  it("is hidden at the shared xl desktop breakpoint so it never duplicates GameControls", () => {
    expect(mobileActionBarSource).toContain("xl:hidden");
  });

  it("roll action retains the ready-to-roll gate shared with GameControls", () => {
    const state = makeGameState(2);
    expect(getMobilePrimaryAction(state, true)).toMatchObject({ kind: "roll", disabled: false });
    expect(gameControlsSource).toContain('state.phase === "readyToRoll"');
  });

  it("End Turn action retains the completed-turn gate shared with GameControls", () => {
    const state = { ...makeGameState(2), phase: "turnComplete" as const, currentPlayerHasRolled: true };
    expect(getMobilePrimaryAction(state, true)).toMatchObject({ kind: "end-turn", disabled: false });
    expect(gameControlsSource).toContain('state.phase === "turnComplete"');
  });

  it("non-current player cannot act", () => {
    expect(getMobilePrimaryAction(makeGameState(2), false)).toMatchObject({ kind: "waiting", disabled: true });
  });

  it("opens Actions for mandatory decisions without inventing an action", () => {
    const state = { ...makeGameState(2), phase: "awaitingPurchaseDecision" as const };
    expect(getMobilePrimaryAction(state, true)).toMatchObject({ kind: "open-actions", label: "Review Purchase" });
    expect(mobileActionBarSource).toContain('onTabChange("actions")');
  });

  it("uses a single contextual action plus the four visible navigation destinations", () => {
    expect(MOBILE_GAME_TABS).toEqual(["board", "actions", "players", "log"]);
    expect(mobileActionBarSource).toContain("MOBILE_GAME_TABS.map");
  });

  it("uses tap-friendly sizing via the shared mobile-action-btn class", () => {
    expect(mobileActionBarSource).toContain("mobile-action-btn");
  });
});
