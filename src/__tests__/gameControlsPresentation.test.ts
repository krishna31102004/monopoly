import { describe, expect, it } from "vitest";
import { getTurnStatus } from "@/lib/ui/gameControlsPresentation";
import { makeGameState } from "./helpers/factory";

describe("responsive turn-status presentation", () => {
  it("uses semantic dark-on-paper and light-on-navy colors for every game status", () => {
    const base = makeGameState();
    const cases = [
      [{ ...base, phase: "gameOver" as const }, "text-emerald-800"],
      [{ ...base, phase: "bankruptcyPending" as const }, "text-rose-800"],
      [{ ...base, phase: "awaitingJailDecision" as const }, "text-amber-800"],
      [{ ...base, phase: "awaitingPurchaseDecision" as const }, "text-amber-800"],
      [{ ...base, phase: "auction" as const }, "text-amber-800"],
      [{ ...base, phase: "turnComplete" as const }, "text-emerald-800"],
      [{ ...base, phase: "readyToRoll" as const, doublesCount: 1 }, "text-sky-800"],
      [{ ...base, phase: "readyToRoll" as const, doublesCount: 0 }, "text-slate-700"],
    ] as const;

    for (const [state, color] of cases) {
      expect(getTurnStatus(state).color).toBe(color);
    }
  });
});
