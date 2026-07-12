import { boardSpaces, getBoardSpaceByIndex } from "@/data/board";
import { isOwnableSpace } from "@/lib/game/ownership";
import type { GameState } from "@/types/game";
import type { OwnableSpace } from "@/types/board";

export type AuctionGroupType = "color" | "airport" | "utility";

export type AuctionGroupMember = {
  spaceIndex: number;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  isUnowned: boolean;
  isMortgaged: boolean;
  houseCount: number;
  hasHotel: boolean;
  isBeingAuctioned: boolean;
};

export type AuctionSetCompletion = {
  playerId: string;
  playerName: string;
  ownedBeforeAuction: number;
  groupSize: number;
  wouldCompleteGroup: boolean;
};

export type AuctionPropertyContext = {
  auctionedProperty: {
    spaceIndex: number;
    name: string;
    type: "city" | "airport" | "utility";
    listPrice: number;
    mortgageValue: number;
    baseRent?: number;
    houseCost?: number;
    rentLevels?: number[];
    fullGroupRent?: number;
    utilityMultipliers?: number[];
  };
  groupType: AuctionGroupType;
  groupName: string;
  groupMembers: AuctionGroupMember[];
  completionByPlayer: AuctionSetCompletion[];
};

function getGroup(space: OwnableSpace): { type: AuctionGroupType; name: string; members: OwnableSpace[] } {
  if (space.kind === "city") {
    return {
      type: "color",
      name: `${space.country} Color Group`,
      members: boardSpaces.filter(
        (candidate): candidate is OwnableSpace =>
          candidate.kind === "city" && candidate.colorGroup === space.colorGroup,
      ),
    };
  }

  if (space.kind === "airport") {
    return {
      type: "airport",
      name: "Airport Network",
      members: boardSpaces.filter((candidate): candidate is OwnableSpace => candidate.kind === "airport"),
    };
  }

  return {
    type: "utility",
    name: "Utilities",
    members: boardSpaces.filter((candidate): candidate is OwnableSpace => candidate.kind === "utility"),
  };
}

/**
 * Derives factual auction context from the current authoritative game state.
 * It deliberately has no dependency on auction controls or component state.
 */
export function getAuctionPropertyContext(
  state: Pick<GameState, "players" | "ownerships">,
  propertySpaceIndex: number,
): AuctionPropertyContext | null {
  const candidate = getBoardSpaceByIndex(propertySpaceIndex);
  if (!isOwnableSpace(candidate)) return null;

  const { type: groupType, name: groupName, members } = getGroup(candidate);
  const playerById = new Map(state.players.map((player) => [player.id, player]));
  const ownershipBySpace = new Map(state.ownerships.map((ownership) => [ownership.spaceIndex, ownership]));

  const groupMembers = members.map((member) => {
    const ownership = ownershipBySpace.get(member.index);
    const owner = ownership?.ownerId ? playerById.get(ownership.ownerId) : undefined;
    return {
      spaceIndex: member.index,
      name: member.name,
      ownerId: ownership?.ownerId ?? null,
      ownerName: owner?.name ?? null,
      isUnowned: !ownership?.ownerId,
      isMortgaged: ownership?.isMortgaged ?? false,
      houseCount: member.kind === "city" ? ownership?.houses ?? 0 : 0,
      hasHotel: member.kind === "city" ? ownership?.hasHotel ?? false : false,
      isBeingAuctioned: member.index === propertySpaceIndex,
    };
  });

  const completionByPlayer = state.players
    .filter((player) => !player.isBankrupt)
    .map((player) => {
      const ownedBeforeAuction = groupMembers.filter(
        (member) => !member.isBeingAuctioned && member.ownerId === player.id,
      ).length;
      const alreadyOwnsAuctionedProperty = groupMembers.some(
        (member) => member.isBeingAuctioned && member.ownerId === player.id,
      );
      return {
        playerId: player.id,
        playerName: player.name,
        ownedBeforeAuction,
        groupSize: groupMembers.length,
        wouldCompleteGroup:
          !alreadyOwnsAuctionedProperty && ownedBeforeAuction === groupMembers.length - 1,
      };
    });

  const auctionedProperty = {
    spaceIndex: candidate.index,
    name: candidate.name,
    type: candidate.kind,
    listPrice: candidate.price,
    mortgageValue: candidate.mortgageValue,
    ...(candidate.kind === "city"
      ? {
          baseRent: candidate.rent[0],
          houseCost: candidate.houseCost,
          rentLevels: [...candidate.rent],
          fullGroupRent: candidate.rent[0] * 2,
        }
      : candidate.kind === "airport"
        ? { rentLevels: [...candidate.rentByOwnedCount] }
        : { utilityMultipliers: [4, 10] }),
  };

  return { auctionedProperty, groupType, groupName, groupMembers, completionByPlayer };
}
