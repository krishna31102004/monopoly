import type { GamePhase, GameState } from "@/types/game";

export type PreconditionResult = { ok: true } | { ok: false; reason: string };

const TRADE_REASON = "Trades are available before rolling or during debt recovery.";
const PURCHASE_REASON = "Resolve this property purchase first.";
const AUCTION_REASON = "Auction in progress.";

function isDebtor(state: GameState, playerId: string): boolean {
  return state.phase === "bankruptcyPending" && state.bankruptcy?.debtorPlayerId === playerId;
}

/** Mortgage/unmortgage/house/hotel management is allowed before rolling, or by the debtor during bankruptcy recovery. */
export function canMortgageNow(state: GameState, playerId: string): PreconditionResult {
  if (state.phase === "gameOver") return { ok: false, reason: "The game has ended." };
  if (state.phase === "awaitingPurchaseDecision") return { ok: false, reason: PURCHASE_REASON };
  if (state.phase === "auction") return { ok: false, reason: AUCTION_REASON };
  if (state.phase === "bankruptcyPending") {
    return isDebtor(state, playerId)
      ? { ok: true }
      : { ok: false, reason: TRADE_REASON };
  }
  return { ok: true };
}

/** Trades may be opened before rolling, or by the debtor during bankruptcy recovery. */
export function canOpenTradeNow(state: GameState, playerId: string): PreconditionResult {
  if (state.phase === "gameOver") return { ok: false, reason: "The game has ended." };
  if (state.phase === "awaitingPurchaseDecision") return { ok: false, reason: PURCHASE_REASON };
  if (state.phase === "auction") return { ok: false, reason: AUCTION_REASON };
  if (state.phase === "bankruptcyPending") {
    const debt = state.bankruptcy;
    const debtor = debt ? state.players.find((player) => player.id === debt.debtorPlayerId) : undefined;
    if (debt && debtor && debtor.cash >= debt.amountOwed) {
      return { ok: false, reason: "Pay the outstanding debt before trading again." };
    }
    return isDebtor(state, playerId)
      ? { ok: true }
      : { ok: false, reason: TRADE_REASON };
  }
  return { ok: true };
}

export const canTradeNow = canOpenTradeNow;

/** Buying the just-landed-on property is only valid during the purchase decision phase, with sufficient cash. */
export function canBuyLandedPropertyNow(state: GameState, playerId: string, price: number): PreconditionResult {
  if (state.phase !== "awaitingPurchaseDecision") {
    return { ok: false, reason: "There is no pending property purchase." };
  }
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, reason: "Player not found." };
  if (player.cash < price) {
    return {
      ok: false,
      reason: "You do not have enough cash to buy this property. Decline to send it to auction.",
    };
  }
  return { ok: true };
}

export type AllowedActions = {
  canRoll: boolean;
  canEndTurn: boolean;
  canTrade: boolean;
  canMortgage: boolean;
  canBuyOrDecline: boolean;
};

export function getAllowedActionsForPhase(phase: GamePhase): AllowedActions {
  return {
    canRoll: phase === "readyToRoll",
    canEndTurn: phase === "turnComplete",
    canTrade: phase === "readyToRoll" || phase === "bankruptcyPending",
    canMortgage: phase === "readyToRoll" || phase === "turnComplete" || phase === "bankruptcyPending",
    canBuyOrDecline: phase === "awaitingPurchaseDecision",
  };
}
