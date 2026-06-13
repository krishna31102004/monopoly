import { addLogEntry } from "@/lib/game/createInitialGameState";
import type { BankruptcyCreditor, GameState } from "@/types/game";

export function checkBankruptcy(
  state: GameState,
  creditor: BankruptcyCreditor = { type: "bank" },
): GameState {
  // Don't stack bankruptcy states or interfere with gameOver
  if (state.phase === "bankruptcyPending" || state.phase === "gameOver") return state;

  // Winner check: if already-declared bankruptcies leave only 1 active player
  const activePlayers = state.players.filter((p) => !p.isBankrupt);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    const winMsg = `${winner.name} wins the game!`;
    const log = addLogEntry(state.gameLog, winMsg);
    return { ...state, phase: "gameOver", winnerId: winner.id, gameLog: log };
  }
  if (activePlayers.length === 0) return state;

  // Find the first non-bankrupt player with negative cash
  const debtor = activePlayers.find((p) => p.cash < 0);
  if (!debtor) return state;

  const amountOwed = -debtor.cash;
  const creditorName =
    creditor.type === "bank"
      ? "the Bank"
      : (state.players.find(
          (p) => p.id === (creditor as { type: "player"; playerId: string }).playerId,
        )?.name ?? "another player");

  const reason = `${debtor.name} owes $${amountOwed} to ${creditorName}.`;
  const log = addLogEntry(state.gameLog, `${debtor.name} cannot pay and must resolve bankruptcy.`);

  return {
    ...state,
    phase: "bankruptcyPending",
    gameLog: log,
    bankruptcy: {
      debtorPlayerId: debtor.id,
      creditor,
      amountOwed,
      reason,
      status: "pending",
      phaseBeforeBankruptcy: state.phase,
    },
  };
}
