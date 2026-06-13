import { boardSpaces } from "@/data/board";
import type { OwnableSpace } from "@/types/board";
import type { PropertyOwnership } from "@/types/game";
import type { Player } from "@/types/player";

export function isOwnableSpace(space: { kind: string }): space is OwnableSpace {
  return space.kind === "city" || space.kind === "airport" || space.kind === "utility";
}

export function createInitialOwnerships(): PropertyOwnership[] {
  return boardSpaces.filter(isOwnableSpace).map((space) => ({
    spaceIndex: space.index,
    ownerId: null,
    isMortgaged: false,
    houses: 0,
    hasHotel: false,
  }));
}

export function getOwnership(
  ownerships: PropertyOwnership[],
  spaceIndex: number,
): PropertyOwnership | undefined {
  return ownerships.find((ownership) => ownership.spaceIndex === spaceIndex);
}

export function getPropertyOwner(
  ownerships: PropertyOwnership[],
  players: Player[],
  spaceIndex: number,
): Player | undefined {
  const ownership = getOwnership(ownerships, spaceIndex);
  if (!ownership?.ownerId) {
    return undefined;
  }

  return players.find((player) => player.id === ownership.ownerId);
}

export function getOwnedSpaceIds(ownerships: PropertyOwnership[], playerId: string): number[] {
  return ownerships
    .filter((ownership) => ownership.ownerId === playerId)
    .map((ownership) => ownership.spaceIndex);
}
