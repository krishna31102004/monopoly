import { describe, expect, it } from "vitest";
import { getAuctionPropertyContext } from "@/lib/ui/auctionPropertyContext";
import { makeGameState, withHouses, withMortgage, withOwnership } from "./helpers/factory";

describe("getAuctionPropertyContext", () => {
  it("derives city members, factual ownership, improvements, and completion", () => {
    let state = makeGameState(3);
    const [first, second, bankrupt] = state.players;
    state = withOwnership(state, 13, first.id);
    state = withMortgage(state, 13);
    state = withHouses(state, 13, 2);
    state = withOwnership(state, 14, first.id);
    state = {
      ...state,
      players: state.players.map((player) => player.id === bankrupt.id ? { ...player, isBankrupt: true } : player),
      ownerships: state.ownerships.map((ownership) => ownership.spaceIndex === 14 ? { ...ownership, hasHotel: true } : ownership),
    };

    const context = getAuctionPropertyContext(state, 11)!;

    expect(context.groupType).toBe("color");
    expect(context.groupName).toBe("Germany Color Group");
    expect(context.groupMembers.map((member) => member.name)).toEqual(["Hamburg", "Munich", "Berlin"]);
    expect(context.groupMembers[0].isBeingAuctioned).toBe(true);
    expect(context.groupMembers[1]).toMatchObject({ ownerId: first.id, isMortgaged: true, houseCount: 2 });
    expect(context.groupMembers[2]).toMatchObject({ ownerId: first.id, hasHotel: true });
    expect(context.completionByPlayer).toContainEqual(expect.objectContaining({ playerId: first.id, ownedBeforeAuction: 2, groupSize: 3, wouldCompleteGroup: true }));
    expect(context.completionByPlayer.find((completion) => completion.playerId === bankrupt.id)).toBeUndefined();
    expect(context.auctionedProperty).toMatchObject({ baseRent: 10, fullGroupRent: 20, houseCost: 100, rentLevels: [10, 50, 150, 450, 625, 750] });
    expect(second).toBeDefined();
  });

  it("returns the complete airport network with owners and mortgage status", () => {
    let state = makeGameState(2);
    state = withOwnership(state, 15, state.players[0].id);
    state = withOwnership(state, 25, state.players[0].id);
    state = withMortgage(state, 25);
    const context = getAuctionPropertyContext(state, 5)!;

    expect(context.groupType).toBe("airport");
    expect(context.groupMembers).toHaveLength(4);
    expect(context.groupMembers.find((member) => member.spaceIndex === 5)?.isBeingAuctioned).toBe(true);
    expect(context.groupMembers.find((member) => member.spaceIndex === 25)).toMatchObject({ ownerId: state.players[0].id, isMortgaged: true, houseCount: 0, hasHotel: false });
    expect(context.completionByPlayer[0]).toMatchObject({ ownedBeforeAuction: 2, groupSize: 4, wouldCompleteGroup: false });
    expect(context.auctionedProperty.rentLevels).toEqual([25, 50, 100, 200]);
  });

  it("returns both utilities and treats mortgaged ownership as owned for completion", () => {
    let state = makeGameState(2);
    state = withOwnership(state, 28, state.players[1].id);
    state = withMortgage(state, 28);
    const context = getAuctionPropertyContext(state, 12)!;

    expect(context.groupType).toBe("utility");
    expect(context.groupMembers.map((member) => member.name)).toEqual(["Electric Company", "Water Works"]);
    expect(context.groupMembers[1]).toMatchObject({ ownerId: state.players[1].id, isMortgaged: true });
    expect(context.completionByPlayer.find((completion) => completion.playerId === state.players[1].id)).toMatchObject({ ownedBeforeAuction: 1, groupSize: 2, wouldCompleteGroup: true });
    expect(context.auctionedProperty.utilityMultipliers).toEqual([4, 10]);
  });
});
