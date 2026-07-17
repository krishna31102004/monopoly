import type { GameState } from "@/types/game";

/** Responsive semantic presentation for the current-turn status line. */
export function getTurnStatus(state: GameState) {
  if (state.phase === "gameOver") {
    return { label: "Game over", color: "text-emerald-800 xl:text-emerald-200" };
  }
  if (state.phase === "bankruptcyPending") {
    const debtorName =
      state.players.find((p) => p.id === state.bankruptcy?.debtorPlayerId)?.name ?? "Player";
    return {
      label: `${debtorName} is resolving bankruptcy — see panel below`,
      color: "text-rose-800 xl:text-rose-200",
    };
  }
  if (state.phase === "awaitingJailDecision") {
    return { label: "In Jail — choose an option below", color: "text-amber-800 xl:text-amber-200" };
  }
  if (state.phase === "awaitingPurchaseDecision") {
    return { label: "Make a decision below", color: "text-amber-800 xl:text-amber-200" };
  }
  if (state.phase === "auction") {
    return { label: "Auction in progress", color: "text-amber-800 xl:text-amber-200" };
  }
  if (state.phase === "turnComplete") {
    return { label: "Ready to end turn", color: "text-emerald-800 xl:text-emerald-200" };
  }
  if (state.doublesCount > 0) {
    return {
      label: `${state.doublesCount} double${state.doublesCount === 1 ? "" : "s"} — roll again`,
      color: "text-sky-800 xl:text-sky-200",
    };
  }
  return { label: "Roll the dice to move", color: "text-slate-700 xl:text-slate-300" };
}
