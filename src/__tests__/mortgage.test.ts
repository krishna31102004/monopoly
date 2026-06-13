import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import { calculateRent } from "@/lib/game/rent";
import { getBoardSpaceByIndex } from "@/data/board";
import {
  makeGameState,
  withOwnership,
  withPlayer,
  withHouses,
  withMortgage,
  currentPlayer,
} from "@/__tests__/helpers/factory";

// Brown group: spaceIndex 1 (Guadalajara, mortgageValue $30) and 3 (Cancún, mortgageValue $30)
const BROWN_1 = 1;
const BROWN_2 = 3;

function withBrownGroup(state: ReturnType<typeof makeGameState>) {
  const playerId = currentPlayer(state).id;
  return withOwnership(withOwnership(state, BROWN_1, playerId), BROWN_2, playerId);
}

// ──────────────────────────────────────────────────────────────────────────────
// MORTGAGE_PROPERTY
// ──────────────────────────────────────────────────────────────────────────────
describe("MORTGAGE_PROPERTY", () => {
  it("can mortgage owned unimproved property: adds mortgageValue to cash", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before + 30);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.isMortgaged).toBe(true);
  });

  it("cannot mortgage unowned property", () => {
    const state = makeGameState();
    // BROWN_1 is unowned
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.isMortgaged).toBe(false);
  });

  it("cannot mortgage already mortgaged property", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withMortgage(state, BROWN_1);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
  });

  it("cannot mortgage with houses on the property", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withHouses(state, BROWN_1, 1);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.isMortgaged).toBe(false);
  });

  it("cannot mortgage if any group property has improvements", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withHouses(state, BROWN_2, 1); // BROWN_2 has a house
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.isMortgaged).toBe(false);
  });

  it("cannot mortgage with hotel on the property", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = {
      ...state,
      ownerships: state.ownerships.map((o) =>
        o.spaceIndex === BROWN_1 ? { ...o, hasHotel: true } : o,
      ),
    };
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// UNMORTGAGE_PROPERTY
// ──────────────────────────────────────────────────────────────────────────────
describe("UNMORTGAGE_PROPERTY", () => {
  it("can unmortgage: deducts mortgageValue * 1.1 (ceil)", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withMortgage(state, BROWN_1);
    const before = currentPlayer(state).cash;
    // mortgageValue = 30, cost = ceil(30 * 1.1) = ceil(33) = 33
    const after = gameReducer(state, { type: "UNMORTGAGE_PROPERTY", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before - 33);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.isMortgaged).toBe(false);
  });

  it("cannot unmortgage if not mortgaged", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "UNMORTGAGE_PROPERTY", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
  });

  it("cannot unmortgage with insufficient cash", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withMortgage(state, BROWN_1);
    state = withPlayer(state, state.currentPlayerIndex, { cash: 10 });
    const after = gameReducer(state, { type: "UNMORTGAGE_PROPERTY", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(10);
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.isMortgaged).toBe(true);
  });

  it("cannot unmortgage unowned property", () => {
    const state = makeGameState();
    // BROWN_1 is not owned, set it to mortgaged manually (edge case)
    const patched = {
      ...state,
      ownerships: state.ownerships.map((o) =>
        o.spaceIndex === BROWN_1 ? { ...o, isMortgaged: true } : o,
      ),
    };
    const before = currentPlayer(patched).cash;
    const after = gameReducer(patched, { type: "UNMORTGAGE_PROPERTY", spaceIndex: BROWN_1 });
    expect(currentPlayer(after).cash).toBe(before);
    // still mortgaged because player doesn't own it
    expect(after.ownerships.find((o) => o.spaceIndex === BROWN_1)?.isMortgaged).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Airport mortgage / unmortgage
// ──────────────────────────────────────────────────────────────────────────────

// JFK Airport: index 5, mortgageValue 100
// Heathrow Airport: index 15, mortgageValue 100
const JFK = 5;

describe("MORTGAGE_PROPERTY — airport", () => {
  it("can mortgage owned airport: adds $100 to cash and sets isMortgaged", () => {
    let state = makeGameState();
    state = withOwnership(state, JFK, currentPlayer(state).id);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: JFK });
    expect(currentPlayer(after).cash).toBe(before + 100);
    expect(after.ownerships.find((o) => o.spaceIndex === JFK)?.isMortgaged).toBe(true);
  });

  it("cannot mortgage unowned airport", () => {
    const state = makeGameState();
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: JFK });
    expect(currentPlayer(after).cash).toBe(before);
  });

  it("cannot mortgage already mortgaged airport", () => {
    let state = makeGameState();
    state = withOwnership(state, JFK, currentPlayer(state).id);
    state = withMortgage(state, JFK);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: JFK });
    expect(currentPlayer(after).cash).toBe(before);
  });
});

describe("UNMORTGAGE_PROPERTY — airport", () => {
  it("can unmortgage airport: deducts ceil(100 * 1.1) = $110", () => {
    let state = makeGameState();
    state = withOwnership(state, JFK, currentPlayer(state).id);
    state = withMortgage(state, JFK);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "UNMORTGAGE_PROPERTY", spaceIndex: JFK });
    expect(currentPlayer(after).cash).toBe(before - 110);
    expect(after.ownerships.find((o) => o.spaceIndex === JFK)?.isMortgaged).toBe(false);
  });

  it("cannot unmortgage airport with insufficient cash", () => {
    let state = makeGameState();
    state = withOwnership(state, JFK, currentPlayer(state).id);
    state = withMortgage(state, JFK);
    state = withPlayer(state, state.currentPlayerIndex, { cash: 50 });
    const after = gameReducer(state, { type: "UNMORTGAGE_PROPERTY", spaceIndex: JFK });
    expect(currentPlayer(after).cash).toBe(50);
    expect(after.ownerships.find((o) => o.spaceIndex === JFK)?.isMortgaged).toBe(true);
  });
});

describe("Rent on mortgaged airport", () => {
  it("mortgaged airport charges no rent via calculateRent", () => {
    let state = makeGameState();
    state = withOwnership(state, JFK, currentPlayer(state).id);
    state = withMortgage(state, JFK);
    const space = getBoardSpaceByIndex(JFK);
    if (space.kind !== "airport") throw new Error("Expected airport");
    const o = state.ownerships.find((o) => o.spaceIndex === JFK)!;
    const rent = calculateRent(space, o, state.ownerships, 7);
    expect(rent.amount).toBe(0);
    expect(rent.isMortgaged).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Utility mortgage / unmortgage
// ──────────────────────────────────────────────────────────────────────────────

// Electric Company: index 12, mortgageValue 75
const ELECTRIC = 12;

describe("MORTGAGE_PROPERTY — utility", () => {
  it("can mortgage owned utility: adds $75 to cash and sets isMortgaged", () => {
    let state = makeGameState();
    state = withOwnership(state, ELECTRIC, currentPlayer(state).id);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: ELECTRIC });
    expect(currentPlayer(after).cash).toBe(before + 75);
    expect(after.ownerships.find((o) => o.spaceIndex === ELECTRIC)?.isMortgaged).toBe(true);
  });

  it("cannot mortgage unowned utility", () => {
    const state = makeGameState();
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: ELECTRIC });
    expect(currentPlayer(after).cash).toBe(before);
  });

  it("cannot mortgage already mortgaged utility", () => {
    let state = makeGameState();
    state = withOwnership(state, ELECTRIC, currentPlayer(state).id);
    state = withMortgage(state, ELECTRIC);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: ELECTRIC });
    expect(currentPlayer(after).cash).toBe(before);
  });
});

describe("UNMORTGAGE_PROPERTY — utility", () => {
  it("can unmortgage utility: deducts ceil(75 * 1.1) = $83", () => {
    let state = makeGameState();
    state = withOwnership(state, ELECTRIC, currentPlayer(state).id);
    state = withMortgage(state, ELECTRIC);
    const before = currentPlayer(state).cash;
    const after = gameReducer(state, { type: "UNMORTGAGE_PROPERTY", spaceIndex: ELECTRIC });
    // ceil(75 * 1.1) = ceil(82.5) = 83
    expect(currentPlayer(after).cash).toBe(before - 83);
    expect(after.ownerships.find((o) => o.spaceIndex === ELECTRIC)?.isMortgaged).toBe(false);
  });

  it("cannot unmortgage utility with insufficient cash", () => {
    let state = makeGameState();
    state = withOwnership(state, ELECTRIC, currentPlayer(state).id);
    state = withMortgage(state, ELECTRIC);
    state = withPlayer(state, state.currentPlayerIndex, { cash: 40 });
    const after = gameReducer(state, { type: "UNMORTGAGE_PROPERTY", spaceIndex: ELECTRIC });
    expect(currentPlayer(after).cash).toBe(40);
    expect(after.ownerships.find((o) => o.spaceIndex === ELECTRIC)?.isMortgaged).toBe(true);
  });
});

describe("Rent on mortgaged utility", () => {
  it("mortgaged utility charges no rent via calculateRent", () => {
    let state = makeGameState();
    state = withOwnership(state, ELECTRIC, currentPlayer(state).id);
    state = withMortgage(state, ELECTRIC);
    const space = getBoardSpaceByIndex(ELECTRIC);
    if (space.kind !== "utility") throw new Error("Expected utility");
    const o = state.ownerships.find((o) => o.spaceIndex === ELECTRIC)!;
    const rent = calculateRent(space, o, state.ownerships, 6);
    expect(rent.amount).toBe(0);
    expect(rent.isMortgaged).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Rent is 0 on mortgaged property
// ──────────────────────────────────────────────────────────────────────────────
describe("Rent on mortgaged property", () => {
  it("rent is 0 on mortgaged property (via calculateRent)", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = withMortgage(state, BROWN_1);
    const space = getBoardSpaceByIndex(BROWN_1);
    if (space.kind !== "city") throw new Error("Expected city");
    const o = state.ownerships.find((o) => o.spaceIndex === BROWN_1)!;
    const rent = calculateRent(space, o, state.ownerships, 7);
    expect(rent.amount).toBe(0);
    expect(rent.isMortgaged).toBe(true);
  });

  it("rent is 0 on mortgaged property after MORTGAGE_PROPERTY action", () => {
    let state = makeGameState();
    state = withBrownGroup(state);
    state = gameReducer(state, { type: "MORTGAGE_PROPERTY", spaceIndex: BROWN_1 });
    const space = getBoardSpaceByIndex(BROWN_1);
    if (space.kind !== "city") throw new Error("Expected city");
    const o = state.ownerships.find((o) => o.spaceIndex === BROWN_1)!;
    const rent = calculateRent(space, o, state.ownerships, 7);
    expect(rent.amount).toBe(0);
    expect(rent.isMortgaged).toBe(true);
  });
});
