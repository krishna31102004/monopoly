import type { GameState } from "@/types/game";

/** Stable DOM id for a board space, used as a scroll/pan anchor on mobile. */
export function getBoardSpaceAnchorId(spaceIndex: number): string {
  return `board-space-${spaceIndex}`;
}

/** The board space index the current player occupies — used by "Find Current Player". */
export function getCurrentPlayerSpaceIndex(state: GameState): number {
  return state.players[state.currentPlayerIndex]?.position ?? 0;
}
