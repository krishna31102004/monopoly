import { describe, expect, it } from "vitest";
import {
  MOBILE_GAME_TABS,
  getMobilePhaseLabel,
  getMobilePrimaryAction,
  getMobileTabAttention,
} from "@/lib/ui/mobileGameNavigation";
import { makeGameState } from "./helpers/factory";

describe("mobile game navigation helpers", () => {
  it("uses Board as the first destination in the stable navigation order", () => {
    expect(MOBILE_GAME_TABS).toEqual(["board", "actions", "players", "log"]);
  });

  it("keeps roll and end-turn as the only direct primary gameplay actions", () => {
    const ready = makeGameState(2);
    expect(getMobilePrimaryAction(ready, true)).toMatchObject({ kind: "roll", label: "Roll Dice", disabled: false });
    const complete = { ...ready, phase: "turnComplete" as const, currentPlayerHasRolled: true };
    expect(getMobilePrimaryAction(complete, true)).toMatchObject({ kind: "end-turn", label: "End Turn", disabled: false });
  });

  it("routes mandatory decision phases to Actions without dispatching a new action", () => {
    const state = makeGameState(2);
    expect(getMobilePrimaryAction({ ...state, phase: "awaitingPurchaseDecision" }, true).kind).toBe("open-actions");
    expect(getMobilePrimaryAction({ ...state, phase: "awaitingJailDecision" }, true).kind).toBe("open-actions");
    expect(getMobilePrimaryAction({ ...state, phase: "bankruptcyPending" }, true).kind).toBe("open-actions");
  });

  it("keeps non-actors in a factual disabled waiting state", () => {
    expect(getMobilePrimaryAction(makeGameState(2), false)).toEqual({ label: "Waiting", kind: "waiting", disabled: true });
  });

  it("marks urgent action states without changing tabs automatically", () => {
    const state = makeGameState(2);
    expect(getMobileTabAttention({ ...state, phase: "awaitingPurchaseDecision" })).toBe("Purchase decision required");
    expect(getMobileTabAttention({ ...state, phase: "awaitingJailDecision" })).toBe("Jail decision required");
    expect(getMobileTabAttention({ ...state, phase: "bankruptcyPending" })).toBe("Payment resolution required");
  });

  it("provides factual compact phase labels", () => {
    expect(getMobilePhaseLabel(makeGameState(2))).toBe("Ready to roll");
    expect(getMobilePhaseLabel({ ...makeGameState(2), phase: "auction" })).toBe("Auction");
  });
});
