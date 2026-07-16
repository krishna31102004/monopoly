import type { GameState } from "@/types/game";

export const MOBILE_GAME_TABS = ["board", "actions", "players", "log"] as const;

export type MobileGameTab = (typeof MOBILE_GAME_TABS)[number];

export type MobilePrimaryAction = {
  label: string;
  kind: "roll" | "end-turn" | "open-actions" | "waiting";
  disabled: boolean;
};

/** Pure mobile-dock presentation state. It never changes gameplay actions or turn authority. */
export function getMobilePrimaryAction(
  state: GameState,
  isMyTurn: boolean,
  isBusy = false,
): MobilePrimaryAction {
  if (!isMyTurn) return { label: "Waiting", kind: "waiting", disabled: true };
  if (isBusy) return { label: "Resolving…", kind: "waiting", disabled: true };
  if (state.phase === "readyToRoll") return { label: "Roll Dice", kind: "roll", disabled: false };
  if (state.phase === "turnComplete" && state.currentPlayerHasRolled) {
    return { label: "End Turn", kind: "end-turn", disabled: false };
  }
  if (state.phase === "awaitingPurchaseDecision") {
    return { label: "Review Purchase", kind: "open-actions", disabled: false };
  }
  if (state.phase === "awaitingJailDecision") {
    return { label: "Choose Jail Option", kind: "open-actions", disabled: false };
  }
  if (state.phase === "bankruptcyPending") {
    return { label: "Resolve Payment", kind: "open-actions", disabled: false };
  }
  return { label: "Open Actions", kind: "open-actions", disabled: false };
}

/** Returns a factual, non-pulsing attention marker for the Actions tab. */
export function getMobileTabAttention(state: GameState, playerId?: string): string | null {
  if (state.phase === "awaitingPurchaseDecision") return "Purchase decision required";
  if (state.phase === "awaitingJailDecision") return "Jail decision required";
  if (state.phase === "bankruptcyPending") return "Payment resolution required";
  if (state.drawnCard) return "Card result available";
  if (state.trade && (!playerId || state.trade.recipientPlayerId === playerId)) return "Trade response available";
  return null;
}

export function getMobilePhaseLabel(state: GameState): string {
  switch (state.phase) {
    case "readyToRoll": return "Ready to roll";
    case "turnComplete": return "Turn complete";
    case "awaitingPurchaseDecision": return "Purchase decision";
    case "awaitingJailDecision": return "Jail decision";
    case "bankruptcyPending": return "Payment required";
    case "auction": return "Auction";
    case "gameOver": return "Game over";
    default: return "In progress";
  }
}
