import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { calculateRent } from "@/lib/game/rent";
import { getBoardSpaceByIndex } from "@/data/board";
import {
  makeGameState,
  withOwnership,
  withPlayer,
  withHouses,
  currentPlayer,
} from "@/__tests__/helpers/factory";

// Brown group: spaceIndex 1 (Guadalajara, houseCost $50) and 3 (Cancún, houseCost $50)
const BROWN_1 = 1;
const BROWN_2 = 3;

function withBrownGroup(state: ReturnType<typeof makeGameState>) {
  const playerId = currentPlayer(state).id;
  return withOwnership(withOwnership(state, BROWN_1, playerId), BROWN_2, playerId);
}

// ──────────────────────────────────────────────────────────────────────────────
// BUY_HOUSE
// ──────────────────────────────────────────────────────────────────────────────
describe("BUY_HOUSE", () => {
  it("cannot buy house without full color group", () => {
    let state = makeGameState();
    const playerId = currentPlayer(state).id;
    state = withOwnership(state, BROWN_1, playerId); // only one city
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "BUY_HOUSE", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.houses).toBe(0);
  });

  it("cannot buy house on property you don't own", () => {
    let state = makeGameState();
    const p1id = state.players[1].id;
    state = withOwnership(withOwnership(state, BROWN_1, p1id), BROWN_2, p1id);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "BUY_HOUSE", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.houses).toBe(0);
  });

  it("can buy house with full color group, deducts cash, increments houses", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "BUY_HOUSE", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before - 50);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.houses).toBe(1);
  });

  it("cannot build unevenly (even-building rule)", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withHouses(state, BROWN_1, 1); // BROWN_1 has 1, BROWN_2 has 0
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "BUY_HOUSE", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.houses).toBe(1);
  });

  it("can buy on BROWN_2 when BROWN_1 has 1 house (even-building ok)", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withHouses(state, BROWN_1, 1);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "BUY_HOUSE", spaceIndex: BROWN_2 });
    expect(currentPlayer(after).cash).toBe(before - 50);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_2)?.houses).toBe(1);
  });

  it("cannot buy beyond 4 houses", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withHouses(state, BROWN_1, 4);
    state = withHouses(state, BROWN_2, 4);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "BUY_HOUSE", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.houses).toBe(4);
  });

  it("cannot buy house on mortgaged group", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = {
      ...state,
      ownerships: state.ownerships.map((o) =>
        o.spaceIndex === BROWN_2 ? { ...o, isMortgaged: true } : o,
      ),
    };
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "BUY_HOUSE", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
  });

  it("cannot buy house if insufficient cash", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withPlayer(state, state.currentPlayerIndex, { cash: 10 });
    const after = gameReducer(state, { type: "BUY_HOUSE", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(10);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.houses).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SELL_HOUSE
// ──────────────────────────────────────────────────────────────────────────────
describe("SELL_HOUSE", () => {
  it("selling house adds half cost, decrements count", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withHouses(state, BROWN_1, 2);
    state = withHouses(state, BROWN_2, 2);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "SELL_HOUSE", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before + 25); // half of 50
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.houses).toBe(1);
  });

  it("cannot sell house if property has no houses", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "SELL_HOUSE", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
  });

  it("cannot sell in a way that violates even-selling rule", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withHouses(state, BROWN_1, 2);
    state = withHouses(state, BROWN_2, 1);
    // BROWN_2 has 1 house, BROWN_1 has 2. Selling from BROWN_2 would leave it at 0, less than BROWN_1's 2
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "SELL_HOUSE", spaceIndex: BROWN_2 });
    expect(currentPlayer(after).cash).toBe(before);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_2)?.houses).toBe(1);
  });

  it("cannot sell house if hotel is present (must sell hotel first)", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = {
      ...state,
      ownerships: state.ownerships.map((o) =>
        o.spaceIndex === BROWN_1 ? { ...o, hasHotel: true } : o,
      ),
    };
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "SELL_HOUSE", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BUY_HOTEL
// ──────────────────────────────────────────────────────────────────────────────
describe("BUY_HOTEL", () => {
  function with4Houses(state: ReturnType<typeof makeGameState>) {
    return withHouses(withHouses(state, BROWN_1, 4), BROWN_2, 4);
  }

  it("cannot buy hotel without exactly 4 houses", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withHouses(state, BROWN_1, 3);
    state = withHouses(state, BROWN_2, 4);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "BUY_HOTEL", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.hasHotel).toBe(false);
  });

  it("can buy hotel: deducts cash, houses→0, hasHotel→true", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = with4Houses(state);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "BUY_HOTEL", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before - 50);
    const o = after.ownerships.find((o) => o.spaceIndex === BROWN_1)!;
    expect(o.houses).toBe(0);
    expect(o.hasHotel).toBe(true);
  });

  it("cannot buy hotel on mortgaged group", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = with4Houses(state);
    state = {
      ...state,
      ownerships: state.ownerships.map((o) =>
        o.spaceIndex === BROWN_2 ? { ...o, isMortgaged: true } : o,
      ),
    };
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "BUY_HOTEL", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
  });

  it("cannot buy hotel if already has hotel", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = with4Houses(state);
    state = {
      ...state,
      ownerships: state.ownerships.map((o) =>
        o.spaceIndex === BROWN_1 ? { ...o, houses: 0, hasHotel: true } : o,
      ),
    };
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "BUY_HOTEL", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
  });

  it("cannot buy hotel if insufficient cash", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = with4Houses(state);
    state = withPlayer(state, state.currentPlayerIndex, { cash: 10 });
    const after = gameReducer(state, { type: "BUY_HOTEL", spaceIndex: BROWN_1 });
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.hasHotel).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SELL_HOTEL
// ──────────────────────────────────────────────────────────────────────────────
describe("SELL_HOTEL", () => {
  it("selling hotel adds half cost, removes hotel, restores 4 houses", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = {
      ...state,
      ownerships: state.ownerships.map((o) =>
        o.spaceIndex === BROWN_1 ? { ...o, houses: 0, hasHotel: true } : o,
      ),
    };
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "SELL_HOTEL", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before + 25);
    const o = after.ownerships.find((o) => o.spaceIndex === BROWN_1)!;
    expect(o.hasHotel).toBe(false);
    expect(o.houses).toBe(4);
  });

  it("cannot sell hotel if there is no hotel", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "SELL_HOTEL", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Rent integration via calculateRent
// ──────────────────────────────────────────────────────────────────────────────
describe("Rent increases with houses/hotel (calculateRent integration)", () => {
  it("rent increases after buying houses through the reducer", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    const playerId = currentPlayer(state).id;
    state = gameReducer(state, { type: "BUY_HOUSE", spaceIndex: BROWN_1 });
    const o = state.ownerships.find((o) => o.spaceIndex === BROWN_1)!;
    expect(o.houses).toBe(1);
    const space = getBoardSpaceByIndex(BROWN_1);
    if (space.kind !== "city") throw new Error("Expected city");
    const rentNoHouse = calculateRent(space, { ...o, houses: 0 }, state.ownerships, 7);
    const rentWithHouse = calculateRent(space, o, state.ownerships, 7);
    expect(rentWithHouse.amount).toBeGreaterThan(rentNoHouse.amount);
  });

  it("hotel rent is greater than 4-house rent", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    const o4 = state.ownerships.find((o) => o.spaceIndex === BROWN_1)!;
    const space = getBoardSpaceByIndex(BROWN_1);
    if (space.kind !== "city") throw new Error("Expected city");
    const rent4 = calculateRent(space, { ...o4, houses: 4 }, state.ownerships, 7);
    const rentHotel = calculateRent(space, { ...o4, hasHotel: true, houses: 0 }, state.ownerships, 7);
    expect(rentHotel.amount).toBeGreaterThan(rent4.amount);
  });
});
