import type { GameState } from "@/types/game";

/** Stable DOM id for a board space, used as a scroll/pan anchor on mobile. */
export function getBoardSpaceAnchorId(spaceIndex: number): string {
  return `board-space-${spaceIndex}`;
}

/** The board space index the current player occupies — used by "Find Current Player". */
export function getCurrentPlayerSpaceIndex(state: GameState): number {
  return state.players[state.currentPlayerIndex]?.position ?? 0;
}

/**
 * Returns the board space index the mobile auto-follow system should center on.
 * During an auction, follows the auctioned property instead of the current player.
 */
export function getMobileBoardFocusTarget(
  state: GameState,
  displayPositions?: Record<string, number>,
): number {
  if (state.phase === "auction" && state.auction) {
    return state.auction.propertySpaceIndex;
  }
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return 0;
  return displayPositions?.[currentPlayer.id] ?? currentPlayer.position;
}
