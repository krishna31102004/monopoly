import { describe, it, expect } from "vitest";
import { getMoneyMovementFeedback } from "@/lib/ui/gameEventPresentation";
import type { GameLogEntry } from "@/types/game";

function entry(message: string): GameLogEntry {
  return { id: "log-1", message, createdAt: new Date().toISOString() };
}

describe("getMoneyMovementFeedback", () => {
  it("returns payer/payee/amount for a rent payment", () => {
    const feedback = getMoneyMovementFeedback(entry("ansh paid kb $400 rent for JFK Airport."));
    expect(feedback).toEqual({ kind: "transfer", payerName: "ansh", payeeName: "kb", amount: 400 });
  });

  it("returns bank/tax feedback for a tax payment", () => {
    const feedback = getMoneyMovementFeedback(entry("kb paid $200 for Income Tax."));
    expect(feedback).toEqual({ kind: "bankPayment", payerName: "kb", amount: 200, reason: "Income Tax" });
  });

  it("returns pot-collection feedback for Free Parking", () => {
    const feedback = getMoneyMovementFeedback(entry("ansh landed on Free Parking and collected the pot of $500!"));
    expect(feedback).toEqual({ kind: "potCollect", playerName: "ansh", amount: 500 });
  });

  it("does not show a completed payment transfer when debt is only pending", () => {
    const feedback = getMoneyMovementFeedback(entry("kb cannot pay and must resolve bankruptcy."));
    expect(feedback).toEqual({ kind: "debtPending", debtorName: "kb" });
    expect(feedback?.kind).not.toBe("transfer");
  });

  it("never produces a negative amount in presentation assumptions", () => {
    const cases = [
      "ansh paid kb $400 rent for JFK Airport.",
      "kb paid $200 for Income Tax.",
      "ansh landed on Free Parking and collected the pot of $500!",
    ];
    for (const message of cases) {
      const feedback = getMoneyMovementFeedback(entry(message));
      if (feedback && "amount" in feedback) {
        expect(feedback.amount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("returns null for unrelated log entries", () => {
    expect(getMoneyMovementFeedback(entry("kb's turn begins."))).toBeNull();
    expect(getMoneyMovementFeedback(null)).toBeNull();
  });
});
