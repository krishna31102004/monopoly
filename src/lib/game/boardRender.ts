import type { Player } from "@/types/player";

/** Players that should render a token on the board for a given space — bankrupt players are filtered out. */
export function getRenderablePlayersForSpace(players: Player[], spaceIndex: number): Player[] {
  return players.filter((player) => !player.isBankrupt && player.position === spaceIndex);
}
