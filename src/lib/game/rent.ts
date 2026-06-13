import { boardSpaces } from "@/data/board";
import { getOwnedSpaceIds, getOwnership, isOwnableSpace } from "@/lib/game/ownership";
import type { AirportProperty, CityProperty, OwnableSpace, UtilityProperty } from "@/types/board";
import type { PropertyOwnership } from "@/types/game";

export type RentCalculation = {
  amount: number;
  reason: string;
  isMortgaged: boolean;
};

function ownerOwnsFullColorGroup(
  city: CityProperty,
  ownerships: PropertyOwnership[],
  ownerId: string,
) {
  const colorGroupCities = boardSpaces.filter(
    (space): space is CityProperty =>
      space.kind === "city" && space.colorGroup === city.colorGroup,
  );

  return colorGroupCities.every((space) => {
    const ownership = getOwnership(ownerships, space.index);
    return ownership?.ownerId === ownerId;
  });
}

function calculateCityRent(
  city: CityProperty,
  ownership: PropertyOwnership,
  ownerships: PropertyOwnership[],
): RentCalculation {
  if (ownership.isMortgaged) {
    return {
      amount: 0,
      reason: "mortgaged city",
      isMortgaged: true,
    };
  }

  if (ownership.hasHotel) {
    return {
      amount: city.rent[5],
      reason: "hotel rent",
      isMortgaged: false,
    };
  }

  if (ownership.houses > 0) {
    return {
      amount: city.rent[Math.min(ownership.houses, 4)],
      reason: `${ownership.houses} house${ownership.houses === 1 ? "" : "s"} rent`,
      isMortgaged: false,
    };
  }

  const ownsFullGroup = ownership.ownerId
    ? ownerOwnsFullColorGroup(city, ownerships, ownership.ownerId)
    : false;

  return {
    amount: ownsFullGroup ? city.rent[0] * 2 : city.rent[0],
    reason: ownsFullGroup ? "doubled color-set rent" : "base rent",
    isMortgaged: false,
  };
}

function calculateAirportRent(
  airport: AirportProperty,
  ownership: PropertyOwnership,
  ownerships: PropertyOwnership[],
): RentCalculation {
  if (ownership.isMortgaged) {
    return {
      amount: 0,
      reason: "mortgaged airport",
      isMortgaged: true,
    };
  }

  const ownedAirportCount = ownership.ownerId
    ? getOwnedSpaceIds(ownerships, ownership.ownerId).filter(
        (spaceIndex) => boardSpaces[spaceIndex]?.kind === "airport",
      ).length
    : 0;

  return {
    amount: airport.rentByOwnedCount[Math.max(ownedAirportCount - 1, 0)] ?? 0,
    reason: `${ownedAirportCount} airport${ownedAirportCount === 1 ? "" : "s"} owned`,
    isMortgaged: false,
  };
}

function calculateUtilityRent(
  utility: UtilityProperty,
  ownership: PropertyOwnership,
  ownerships: PropertyOwnership[],
  diceTotal: number,
): RentCalculation {
  if (ownership.isMortgaged) {
    return {
      amount: 0,
      reason: "mortgaged utility",
      isMortgaged: true,
    };
  }

  const ownedUtilityCount = ownership.ownerId
    ? getOwnedSpaceIds(ownerships, ownership.ownerId).filter(
        (spaceIndex) => boardSpaces[spaceIndex]?.kind === "utility",
      ).length
    : 0;
  const multiplier = ownedUtilityCount >= 2 ? 10 : 4;

  return {
    amount: diceTotal * multiplier,
    reason: `${ownedUtilityCount} utilit${ownedUtilityCount === 1 ? "y" : "ies"} owned, ${multiplier}x dice`,
    isMortgaged: false,
  };
}

export function calculateRent(
  space: OwnableSpace,
  ownership: PropertyOwnership,
  ownerships: PropertyOwnership[],
  diceTotal: number,
): RentCalculation {
  if (!isOwnableSpace(space)) {
    return {
      amount: 0,
      reason: "not ownable",
      isMortgaged: false,
    };
  }

  if (space.kind === "city") {
    return calculateCityRent(space, ownership, ownerships);
  }

  if (space.kind === "airport") {
    return calculateAirportRent(space, ownership, ownerships);
  }

  return calculateUtilityRent(space, ownership, ownerships, diceTotal);
}
