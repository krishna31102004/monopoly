import { describe, it, expect } from "vitest";
import {
  getPlayerStatusChips,
  getOwnedPropertyChips,
  getJailDisplay,
  getWealthBarPercent,
} from "@/lib/game/playerPanelHelpers";
import { boardSpaces } from "@/data/board";
import { makeGameState } from "./helpers/factory";

// PlayerPanel.tsx is a "use client" component and can't be imported/rendered
// from a .test.ts file in this Vitest setup (no DOM testing library
// installed). These tests lock in the per-player status-chip and
// online-badge-dedup contract the component relies on instead.

const GUADALAJARA = 1; // brown
const JFK_AIRPORT = 5;
const MUMBAI = 6; // light-blue (utility test uses a real utility below)
const WATER_WORKS = boardSpaces.find((s) => s.kind === "utility")?.index ?? -1;

describe("status chip cleanup (no global/per-player ONLINE duplication)", () => {
  it("ONLINE chip only appears when isOnline is explicitly passed true — there is no implicit/global default", () => {
    const state = makeGameState(2);
    expect(getPlayerStatusChips({ player: state.players[0], isCurrentPlayer: false })).not.toContain("ONLINE");
    expect(
      getPlayerStatusChips({ player: state.players[0], isCurrentPlayer: false, isOnline: false }),
    ).not.toContain("ONLINE");
    expect(
      getPlayerStatusChips({ player: state.players[0], isCurrentPlayer: false, isOnline: true }),
    ).toContain("ONLINE");
  });

  it("TURN chip appears only for the current player", () => {
    const state = makeGameState(2);
    expect(getPlayerStatusChips({ player: state.players[0], isCurrentPlayer: true })).toContain("TURN");
    expect(getPlayerStatusChips({ player: state.players[0], isCurrentPlayer: false })).not.toContain("TURN");
  });

  it("IN JAIL chip tracks the player's jail state", () => {
    const state = makeGameState(2);
    const jailed = { ...state.players[0], isInJail: true };
    const free = { ...state.players[0], isInJail: false };
    expect(getPlayerStatusChips({ player: jailed, isCurrentPlayer: false })).toContain("IN JAIL");
    expect(getPlayerStatusChips({ player: free, isCurrentPlayer: false })).not.toContain("IN JAIL");
  });

  it("DEBT and BANKRUPT chips only appear when relevant, and BANKRUPT suppresses everything else", () => {
    const state = makeGameState(2);
    expect(getPlayerStatusChips({ player: state.players[0], isCurrentPlayer: false, isInDebt: true })).toContain("DEBT");
    expect(getPlayerStatusChips({ player: state.players[0], isCurrentPlayer: false })).not.toContain("DEBT");

    const bankrupt = { ...state.players[0], isBankrupt: true };
    const chips = getPlayerStatusChips({
      player: bankrupt,
      isCurrentPlayer: true,
      isInDebt: true,
      isInActiveTrade: true,
      isInActiveAuction: true,
      isOnline: true,
    });
    expect(chips).toEqual(["BANKRUPT"]);
  });
});

describe("portfolio chip rendering by property kind", () => {
  it("renders a city chip with its color group", () => {
    const result = getOwnedPropertyChips([GUADALAJARA], boardSpaces, new Set());
    expect(result.cityGroups[0].colorGroup).toBe("brown");
    expect(result.cityGroups[0].chips[0].kind).toBe("city");
  });

  it("renders an airport chip distinctly from city/utility chips", () => {
    const result = getOwnedPropertyChips([JFK_AIRPORT], boardSpaces, new Set());
    expect(result.airports).toHaveLength(1);
    expect(result.airports[0].kind).toBe("airport");
  });

  it("renders a utility chip distinctly", () => {
    expect(WATER_WORKS).toBeGreaterThan(-1);
    const result = getOwnedPropertyChips([WATER_WORKS], boardSpaces, new Set());
    expect(result.utilities).toHaveLength(1);
    expect(result.utilities[0].kind).toBe("utility");
  });

  it("flags a mortgaged property on its chip", () => {
    const result = getOwnedPropertyChips([GUADALAJARA], boardSpaces, new Set([GUADALAJARA]));
    expect(result.cityGroups[0].chips[0].isMortgaged).toBe(true);
  });

  it("a player with no properties gets a clean, compact empty result (no partial city/airport list)", () => {
    const result = getOwnedPropertyChips([], boardSpaces, new Set());
    expect(result.cityGroups).toHaveLength(0);
    expect(result.airports).toHaveLength(0);
    expect(result.utilities).toHaveLength(0);
  });

  it("full-set helper flags a complete color group as a full set", () => {
    // brown has 2 cities total: Guadalajara (1) + Cancún (3)
    const result = getOwnedPropertyChips([GUADALAJARA, 3], boardSpaces, new Set());
    expect(result.cityGroups[0].isFullSet).toBe(true);
  });
});

describe("no-regression: core info survives the redesign", () => {
  it("player cash, jail state, and token data remain accessible from player state", () => {
    const state = makeGameState(2);
    const player = state.players[0];
    expect(typeof player.cash).toBe("number");
    expect(typeof player.token).toBe("string");
    expect(typeof player.isInJail).toBe("boolean");
  });

  it("jail display and wealth bar remain safe for a bankrupt/debt player", () => {
    const state = makeGameState(2);
    const bankrupt = { ...state.players[0], isBankrupt: true, cash: 0 };
    expect(() => getJailDisplay(bankrupt)).not.toThrow();
    expect(getWealthBarPercent(bankrupt, state.players)).toBe(0);
  });

  it("MUMBAI is a city (sanity check the board fixture used above)", () => {
    const space = boardSpaces.find((s) => s.index === MUMBAI);
    expect(space?.kind).toBe("city");
  });
});
