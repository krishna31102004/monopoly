/**
 * payment.ts — Central helper for applying mandatory payments.
 *
 * The no-negative-cash rule: if a debtor cannot afford a payment, we do NOT
 * deduct anything. Instead we create a bankruptcyPending state so the player
 * can raise cash (sell/mortgage) or declare bankruptcy.
 */

import { addLogEntry } from "@/lib/game/createInitialGameState";
import type { BankruptcyCreditor, GamePhase, GameState } from "@/types/game";

function creditorName(state: GameState, creditor: BankruptcyCreditor): string {
  if (creditor.type === "bank") return "the Bank";
  const p = state.players.find(
    (pl) => pl.id === (creditor as { type: "player"; playerId: string }).playerId,
  );
  return p?.name ?? "another player";
}

/**
 * Apply a mandatory payment from `debtorPlayerId` to `creditor`.
 *
 * • If the debtor has enough cash: deduct from debtor, credit creditor (or pot),
 *   and return the updated state unchanged in phase.
 *
 * • If the debtor does NOT have enough cash: do NOT touch cash. Enter
 *   `bankruptcyPending` with the full `amountOwed` recorded.
 *
 * @param potEligible  When true and creditor is "bank", add amount to
 *                     freeParkingPot (freeParkingCash rule must also be ON).
 */
export function applyPayment(
  state: GameState,
  debtorPlayerId: string,
  creditor: BankruptcyCreditor,
  amount: number,
  reason: string,
  options?: { potEligible?: boolean; phaseAfter?: GamePhase },
): GameState {
  if (amount <= 0) return state;

  const debtor = state.players.find((p) => p.id === debtorPlayerId);
  if (!debtor) return state;

  // Player can afford it — transfer money
  if (debtor.cash >= amount) {
    let nextPlayers = state.players.map((p) => {
      if (p.id === debtorPlayerId) return { ...p, cash: p.cash - amount };
      if (
        creditor.type === "player" &&
        p.id === (creditor as { type: "player"; playerId: string }).playerId
      ) {
        return { ...p, cash: p.cash + amount };
      }
      return p;
    });

    let newPot = state.freeParkingPot;
    if (
      creditor.type === "bank" &&
      options?.potEligible &&
      state.rules.freeParkingCash
    ) {
      newPot += amount;
    }

    return {
      ...state,
      players: nextPlayers,
      freeParkingPot: newPot,
      phase: options?.phaseAfter ?? state.phase,
    };
  }

  // Debtor cannot afford it — enter bankruptcyPending WITHOUT modifying cash
  const cName = creditorName(state, creditor);
  const bankruptcyReason = `${debtor.name} owes $${amount} to ${cName}. ${reason}`;
  const log = addLogEntry(
    state.gameLog,
    `${debtor.name} cannot pay $${amount} to ${cName} and must resolve the debt.`,
  );

  return {
    ...state,
    phase: "bankruptcyPending",
    gameLog: log,
    bankruptcy: {
      debtorPlayerId: debtor.id,
      creditor,
      amountOwed: amount,
      reason: bankruptcyReason,
      status: "pending",
      phaseBeforeBankruptcy: options?.phaseAfter ?? state.phase,
    },
  };
}
