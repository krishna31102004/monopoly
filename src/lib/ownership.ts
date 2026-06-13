import type { OwnableSpace } from "@/types/board";
import type { Player } from "@/types/player";

export function getOwner(space: OwnableSpace, players: Player[]): Player | undefined {
  return players.find((player) => {
    if (space.kind === "city") {
      return player.ownedCityIds.includes(space.index);
    }

    if (space.kind === "airport") {
      return player.ownedAirportIds.includes(space.index);
    }

    return player.ownedUtilityIds.includes(space.index);
  });
}
