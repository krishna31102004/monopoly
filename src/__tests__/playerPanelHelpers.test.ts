import { describe, it, expect } from "vitest";
import {
  getOwnedPropertyChips,
  getPlayerStatusChips,
  getJailDisplay,
  getWealthBarPercent,
  isPlayerInActiveTrade,
  isPlayerInActiveAuction,
  isPlayerInDebt,
} from "@/lib/game/playerPanelHelpers";
import { boardSpaces } from "@/data/board";
import { makeGameState, withPlayer, withOwnership } from "./helpers/factory";

const GUADALAJARA = 1; // brown
const CANCUN = 3; // brown (completes the brown set)
const MUMBAI = 6; // light-blue
const JFK_AIRPORT = 5;

describe("getOwnedPropertyChips", () => {
  it("groups owned cities by color group and flags an incomplete set", () => {
    const result = getOwnedPropertyChips([GUADALAJARA], boardSpaces, new Set());
    expect(result.cityGroups).toHaveLength(1);
    expect(result.cityGroups[0].isFullSet).toBe(false);
  });

  it("flags a full color set when all cities in the group are owned", () => {
    const result = getOwnedPropertyChips([GUADALAJARA, CANCUN], boardSpaces, new Set());
    expect(result.cityGroups[0].isFullSet).toBe(true);
    expect(result.cityGroups[0].chips.every((c) => c.isFullSet)).toBe(true);
  });

  it("separates airports and utilities from city groups", () => {
    const result = getOwnedPropertyChips([JFK_AIRPORT, MUMBAI], boardSpaces, new Set());
    expect(result.airports).toHaveLength(1);
    expect(result.cityGroups).toHaveLength(1);
  });

  it("marks mortgaged properties", () => {
    const result = getOwnedPropertyChips([GUADALAJARA], boardSpaces, new Set([GUADALAJARA]));
    expect(result.cityGroups[0].chips[0].isMortgaged).toBe(true);
  });
});

describe("getPlayerStatusChips", () => {
  it("shows only BANKRUPT when the player is bankrupt, ignoring other flags", () => {
    const state = makeGameState(2);
    const chips = getPlayerStatusChips({
      player: { ...state.players[0], isBankrupt: true },
      isCurrentPlayer: true,
      isInActiveTrade: true,
    });
    expect(chips).toEqual(["BANKRUPT"]);
  });

  it("shows TURN for the current player and nothing extra when idle", () => {
    const state = makeGameState(2);
    const chips = getPlayerStatusChips({ player: state.players[0], isCurrentPlayer: true });
    expect(chips).toEqual(["TURN"]);
  });

  it("shows IN JAIL, DEBT, AUCTION, TRADING together when all apply", () => {
    const state = makeGameState(2);
    const chips = getPlayerStatusChips({
      player: { ...state.players[0], isInJail: true },
      isCurrentPlayer: false,
      isInDebt: true,
      isInActiveAuction: true,
      isInActiveTrade: true,
    });
    expect(chips).toEqual(["IN JAIL", "DEBT", "AUCTION", "TRADING"]);
  });

  it("includes ONLINE only when isOnline is explicitly provided", () => {
    const state = makeGameState(2);
    expect(getPlayerStatusChips({ player: state.players[0], isCurrentPlayer: false, isOnline: true })).toEqual(["ONLINE"]);
    expect(getPlayerStatusChips({ player: state.players[0], isCurrentPlayer: false, isOnline: false })).toEqual([]);
    expect(getPlayerStatusChips({ player: state.players[0], isCurrentPlayer: false })).toEqual([]);
  });
});

describe("getJailDisplay", () => {
  it("returns a calm 'not in jail' display with the jail card count", () => {
    const state = makeGameState(2);
    const player = { ...state.players[0], getOutOfJailFreeCards: 2 };
    const display = getJailDisplay(player);
    expect(display.inJail).toBe(false);
    expect(display.jailCardCount).toBe(2);
  });

  it("returns attempt number and max attempts when jailed", () => {
    const state = makeGameState(2);
    const player = { ...state.players[0], isInJail: true, jailTurns: 1 };
    const display = getJailDisplay(player);
    expect(display.inJail).toBe(true);
    if (display.inJail) {
      expect(display.attempt).toBe(2);
      expect(display.maxAttempts).toBe(3);
    }
  });

  it("caps the attempt number at maxAttempts", () => {
    const state = makeGameState(2);
    const player = { ...state.players[0], isInJail: true, jailTurns: 99 };
    const display = getJailDisplay(player);
    expect(display.inJail && display.attempt).toBe(3);
  });
});

describe("getWealthBarPercent", () => {
  it("returns 0 for a bankrupt player", () => {
    const state = makeGameState(2);
    const player = { ...state.players[0], isBankrupt: true };
    expect(getWealthBarPercent(player, state.players)).toBe(0);
  });

  it("returns 100 for the richest active player", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { cash: 2000 });
    state = withPlayer(state, 1, { cash: 500 });
    expect(getWealthBarPercent(state.players[0], state.players)).toBe(100);
  });

  it("scales a poorer player relative to the richest", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { cash: 1000 });
    state = withPlayer(state, 1, { cash: 250 });
    expect(getWealthBarPercent(state.players[1], state.players)).toBe(25);
  });
});

describe("active trade / auction / debt detection", () => {
  it("isPlayerInActiveTrade is true for either side of a pending trade", () => {
    const state = makeGameState(2);
    const withTrade = {
      ...state,
      trade: {
        initiatorPlayerId: state.players[0].id,
        recipientPlayerId: state.players[1].id,
        offerFromInitiator: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
        offerFromRecipient: { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 },
      },
    };
    expect(isPlayerInActiveTrade(withTrade, state.players[0].id)).toBe(true);
    expect(isPlayerInActiveTrade(withTrade, state.players[1].id)).toBe(true);
    expect(isPlayerInActiveTrade(state, state.players[0].id)).toBe(false);
  });

  it("isPlayerInActiveAuction is true only for active, non-passed bidders", () => {
    const state = makeGameState(2);
    const withAuction = {
      ...state,
      auction: {
        propertySpaceIndex: GUADALAJARA,
        activePlayerIds: [state.players[0].id, state.players[1].id],
        passedPlayerIds: [state.players[1].id],
        currentBid: 10,
        highestBidderId: null,
        currentBidderIndex: 0,
        turnStartedAt: 0,
        turnDeadlineAt: 0,
        status: "active" as const,
      },
    };
    expect(isPlayerInActiveAuction(withAuction, state.players[0].id)).toBe(true);
    expect(isPlayerInActiveAuction(withAuction, state.players[1].id)).toBe(false);
  });

  it("isPlayerInDebt is true only for the debtor during bankruptcyPending", () => {
    const state = makeGameState(2);
    const withDebt = {
      ...state,
      phase: "bankruptcyPending" as const,
      bankruptcy: {
        debtorPlayerId: state.players[0].id,
        creditor: { type: "bank" as const },
        amountOwed: 100,
        reason: "rent",
        status: "pending" as const,
        phaseBeforeBankruptcy: "turnComplete" as const,
      },
    };
    expect(isPlayerInDebt(withDebt, state.players[0].id)).toBe(true);
    expect(isPlayerInDebt(withDebt, state.players[1].id)).toBe(false);
  });
});

describe("ownership helper precedent unaffected", () => {
  it("withOwnership fixture still grants ownership correctly", () => {
    let state = makeGameState(2);
    state = withOwnership(state, GUADALAJARA, state.players[0].id);
    expect(state.ownerships.find((o) => o.spaceIndex === GUADALAJARA)?.ownerId).toBe(state.players[0].id);
  });
});
