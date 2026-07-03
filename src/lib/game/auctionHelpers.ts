import { addLogEntry } from "@/lib/game/createInitialGameState";
import { getBoardSpaceByIndex } from "@/data/board";
import { AUCTION_TURN_MS } from "@/lib/animation/timing";
import type { AuctionState, GameState } from "@/types/game";

/** Start an immediate property auction. Used by Auction Game mode on unowned ownable landings. */
export function startPropertyAuction(state: GameState, spaceIndex: number, logMessage: string): GameState {
  const activePlayerIds = state.players.filter((p) => !p.isBankrupt).map((p) => p.id);
  const now = Date.now();
  const auction: AuctionState = {
    propertySpaceIndex: spaceIndex,
    activePlayerIds,
    passedPlayerIds: [],
    currentBid: 0,
    highestBidderId: null,
    currentBidderIndex: 0,
    turnStartedAt: now,
    turnDeadlineAt: now + AUCTION_TURN_MS,
    status: "active",
  };
  return {
    ...state,
    phase: "auction",
    auction,
    landingAction: { kind: "message", spaceIndex, message: logMessage },
    landingMessage: logMessage,
    gameLog: addLogEntry(state.gameLog, logMessage),
  };
}

/**
 * After resolving a landing via resolveLanding, check if Auction Game requires an immediate
 * auction. If so, start it; otherwise return the state unchanged.
 */
export function applyAuctionGameIntercept(
  base: GameState,
  resolvedPhase: string,
  spaceIndex: number | undefined,
): GameState | null {
  if (
    base.rules.gameMode !== "auction" ||
    resolvedPhase !== "awaitingPurchaseDecision" ||
    spaceIndex == null
  ) {
    return null; // no intercept needed
  }
  const currentPlayer = base.players[base.currentPlayerIndex];
  const space = getBoardSpaceByIndex(spaceIndex);
  const msg = `${currentPlayer.name} landed on ${space.name}. Auction started immediately (Auction Game).`;
  return startPropertyAuction(base, spaceIndex, msg);
}
