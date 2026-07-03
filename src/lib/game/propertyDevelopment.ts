import { boardSpaces } from "@/data/board";
import { getOwnership } from "@/lib/game/ownership";
import type { CityProperty, OwnableSpace } from "@/types/board";
import type { PropertyOwnership } from "@/types/game";
import type { Player } from "@/types/player";

/** Get all city spaces in the same color group as the given city */
export function getColorGroupSpaces(city: CityProperty): CityProperty[] {
  return boardSpaces.filter(
    (s): s is CityProperty => s.kind === "city" && s.colorGroup === city.colorGroup,
  );
}

/** Check if a player owns all cities in the color group */
export function ownsFullColorGroup(
  city: CityProperty,
  ownerships: PropertyOwnership[],
  playerId: string,
): boolean {
  return getColorGroupSpaces(city).every((s) => {
    const o = getOwnership(ownerships, s.index);
    return o?.ownerId === playerId;
  });
}

/** Check if any property in the color group is mortgaged */
export function groupHasMortgage(
  city: CityProperty,
  ownerships: PropertyOwnership[],
): boolean {
  return getColorGroupSpaces(city).some((s) => {
    const o = getOwnership(ownerships, s.index);
    return o?.isMortgaged === true;
  });
}

/** Check if any property in the color group has any improvement */
export function groupHasImprovements(
  city: CityProperty,
  ownerships: PropertyOwnership[],
): boolean {
  return getColorGroupSpaces(city).some((s) => {
    const o = getOwnership(ownerships, s.index);
    return (o?.houses ?? 0) > 0 || o?.hasHotel === true;
  });
}

export type PreconditionResult =
  | { ok: true }
  | { ok: false; reason: string };

export function canBuyHouse(
  state: { ownerships: PropertyOwnership[]; rules?: { evenBuild: boolean }; bankHouses?: number },
  spaceIndex: number,
  player: Player,
): PreconditionResult {
  const space = boardSpaces[spaceIndex];
  if (!space || space.kind !== "city") return { ok: false, reason: "Not a city" };

  const ownership = getOwnership(state.ownerships, spaceIndex);
  if (!ownership || ownership.ownerId !== player.id) return { ok: false, reason: "You don't own this property" };

  if (!ownsFullColorGroup(space, state.ownerships, player.id))
    return { ok: false, reason: "You don't own the full color group" };

  if (groupHasMortgage(space, state.ownerships))
    return { ok: false, reason: "A property in this group is mortgaged" };

  if (ownership.hasHotel) return { ok: false, reason: "Property already has a hotel" };
  if (ownership.houses >= 4) return { ok: false, reason: "Property already has 4 houses" };

  if ((state.bankHouses ?? 32) <= 0) return { ok: false, reason: "No houses available in the bank" };

  // Even-building rule: cannot have more than 1 more house than any other in group
  const evenBuild = state.rules?.evenBuild ?? true;
  if (evenBuild) {
    const groupSpaces = getColorGroupSpaces(space);
    const minHouses = Math.min(
      ...groupSpaces.map((s) => {
        if (s.index === spaceIndex) return ownership.houses;
        const o = getOwnership(state.ownerships, s.index);
        return o?.houses ?? 0;
      }),
    );
    if (ownership.houses > minHouses)
      return { ok: false, reason: "Must build evenly across the color group" };
  }

  if (player.cash < space.houseCost) return { ok: false, reason: "Insufficient funds" };

  return { ok: true };
}

export function canSellHouse(
  state: { ownerships: PropertyOwnership[]; rules?: { evenBuild: boolean } },
  spaceIndex: number,
  player: Player,
): PreconditionResult {
  const space = boardSpaces[spaceIndex];
  if (!space || space.kind !== "city") return { ok: false, reason: "Not a city" };

  const ownership = getOwnership(state.ownerships, spaceIndex);
  if (!ownership || ownership.ownerId !== player.id) return { ok: false, reason: "You don't own this property" };
  if (ownership.hasHotel) return { ok: false, reason: "Sell hotel first" };
  if (ownership.houses < 1) return { ok: false, reason: "No houses to sell" };

  // Even-selling rule: can only sell from the property with the most houses
  const evenBuildSell = state.rules?.evenBuild ?? true;
  if (evenBuildSell) {
    const groupSpaces = getColorGroupSpaces(space);
    const maxSiblingHouses = Math.max(
      ...groupSpaces
        .filter((s) => s.index !== spaceIndex)
        .map((s) => {
          const o = getOwnership(state.ownerships, s.index);
          return o?.houses ?? 0;
        }),
    );
    if (ownership.houses < maxSiblingHouses)
      return { ok: false, reason: "Must sell evenly across the color group" };
  }

  return { ok: true };
}

export function canBuyHotel(
  state: { ownerships: PropertyOwnership[]; bankHotels?: number },
  spaceIndex: number,
  player: Player,
): PreconditionResult {
  const space = boardSpaces[spaceIndex];
  if (!space || space.kind !== "city") return { ok: false, reason: "Not a city" };

  const ownership = getOwnership(state.ownerships, spaceIndex);
  if (!ownership || ownership.ownerId !== player.id) return { ok: false, reason: "You don't own this property" };

  if (!ownsFullColorGroup(space, state.ownerships, player.id))
    return { ok: false, reason: "You don't own the full color group" };

  if (groupHasMortgage(space, state.ownerships))
    return { ok: false, reason: "A property in this group is mortgaged" };

  if (ownership.hasHotel) return { ok: false, reason: "Property already has a hotel" };

  // All properties in the group must have exactly 4 houses (equal building rule for hotels)
  const groupSpaces = getColorGroupSpaces(space);
  const allHaveFour = groupSpaces.every((s) => {
    const o = getOwnership(state.ownerships, s.index);
    return o?.houses === 4 || o?.hasHotel === true;
  });
  if (!allHaveFour)
    return { ok: false, reason: "All properties in the group must have 4 houses before buying a hotel" };

  if ((state.bankHotels ?? 12) <= 0) return { ok: false, reason: "No hotels available in the bank" };

  if (player.cash < space.houseCost) return { ok: false, reason: "Insufficient funds" };

  return { ok: true };
}

export function canSellHotel(
  state: { ownerships: PropertyOwnership[]; bankHouses?: number },
  spaceIndex: number,
  player: Player,
): PreconditionResult {
  const space = boardSpaces[spaceIndex];
  if (!space || space.kind !== "city") return { ok: false, reason: "Not a city" };

  const ownership = getOwnership(state.ownerships, spaceIndex);
  if (!ownership || ownership.ownerId !== player.id) return { ok: false, reason: "You don't own this property" };
  if (!ownership.hasHotel) return { ok: false, reason: "No hotel to sell" };

  // Downgrading a hotel returns 4 houses to the property; bank must have capacity
  if ((state.bankHouses ?? 32) < 4)
    return { ok: false, reason: "Bank doesn't have enough houses to downgrade hotel (need 4 available)" };

  return { ok: true };
}

export function canMortgageProperty(
  state: { ownerships: PropertyOwnership[] },
  spaceIndex: number,
  player: Player,
): PreconditionResult {
  const space = boardSpaces[spaceIndex];
  if (!space || (space.kind !== "city" && space.kind !== "airport" && space.kind !== "utility"))
    return { ok: false, reason: "Not a property" };

  const ownership = getOwnership(state.ownerships, spaceIndex);
  if (!ownership || ownership.ownerId !== player.id) return { ok: false, reason: "You don't own this property" };
  if (ownership.isMortgaged) return { ok: false, reason: "Already mortgaged" };

  // City-specific: must have no improvements, and no group improvements elsewhere
  if (space.kind === "city") {
    if (ownership.houses > 0 || ownership.hasHotel) return { ok: false, reason: "Sell improvements first" };
    if (groupHasImprovements(space, state.ownerships))
      return { ok: false, reason: "Other properties in this group have improvements" };
  }

  return { ok: true };
}

export function canUnmortgageProperty(
  state: { ownerships: PropertyOwnership[] },
  spaceIndex: number,
  player: Player,
): PreconditionResult {
  const space = boardSpaces[spaceIndex];
  if (!space || (space.kind !== "city" && space.kind !== "airport" && space.kind !== "utility"))
    return { ok: false, reason: "Not a property" };

  const ownership = getOwnership(state.ownerships, spaceIndex);
  if (!ownership || ownership.ownerId !== player.id) return { ok: false, reason: "You don't own this property" };
  if (!ownership.isMortgaged) return { ok: false, reason: "Not mortgaged" };

  const mv = (space as OwnableSpace).mortgageValue;
  const cost = mv + Math.ceil(mv / 10);
  if (player.cash < cost) return { ok: false, reason: "Insufficient funds" };

  return { ok: true };
}
