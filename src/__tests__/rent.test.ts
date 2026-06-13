import { describe, it, expect } from "vitest";
import { calculateRent } from "@/lib/game/rent";
import { boardSpaces } from "@/data/board";
import { createInitialOwnerships } from "@/lib/game/ownership";
import { gameReducer } from "@/lib/game/gameReducer";
import {
  makeGameState,
  withPosition,
  withOwnership,
  withPlayer,
  currentPlayer,
  playerAt,
} from "./helpers/factory";
import type { CityProperty, AirportProperty, UtilityProperty } from "@/types/board";
import type { PropertyOwnership } from "@/types/game";

const guadalajara = boardSpaces.find(
  (s): s is CityProperty => s.kind === "city" && s.name === "Guadalajara",
)!;
const cancun = boardSpaces.find(
  (s): s is CityProperty => s.kind === "city" && s.name === "Cancún",
)!;
const berlin = boardSpaces.find(
  (s): s is CityProperty => s.kind === "city" && s.name === "Berlin",
)!;
const munich = boardSpaces.find(
  (s): s is CityProperty => s.kind === "city" && s.name === "Munich",
)!;
const hamburg = boardSpaces.find(
  (s): s is CityProperty => s.kind === "city" && s.name === "Hamburg",
)!;

const jfk = boardSpaces.find(
  (s): s is AirportProperty => s.kind === "airport" && s.name === "JFK Airport",
)!;
const heathrow = boardSpaces.find(
  (s): s is AirportProperty => s.kind === "airport" && s.name === "Heathrow Airport",
)!;
const dubai = boardSpaces.find(
  (s): s is AirportProperty => s.kind === "airport" && s.name === "Dubai International Airport",
)!;
const changi = boardSpaces.find(
  (s): s is AirportProperty => s.kind === "airport" && s.name === "Changi Airport",
)!;

const electric = boardSpaces.find(
  (s): s is UtilityProperty => s.kind === "utility" && s.name.includes("Electric"),
)!;
const water = boardSpaces.find(
  (s): s is UtilityProperty => s.kind === "utility" && s.name.includes("Water"),
)!;

function makeOwnership(spaceIndex: number, ownerId: string, overrides?: Partial<PropertyOwnership>): PropertyOwnership {
  return {
    spaceIndex,
    ownerId,
    isMortgaged: false,
    houses: 0,
    hasHotel: false,
    ...overrides,
  };
}

describe("City rent", () => {
  it("charges base rent when owner does not own full color group", () => {
    const ownerships = createInitialOwnerships().map((o) =>
      o.spaceIndex === guadalajara.index ? { ...o, ownerId: "p1" } : o,
    );
    const ownership = ownerships.find((o) => o.spaceIndex === guadalajara.index)!;
    const result = calculateRent(guadalajara, ownership, ownerships, 7);
    expect(result.amount).toBe(guadalajara.rent[0]); // base rent
    expect(result.isMortgaged).toBe(false);
  });

  it("doubles unimproved rent when owner owns full color group", () => {
    const ownerships = createInitialOwnerships().map((o) => {
      if (o.spaceIndex === guadalajara.index || o.spaceIndex === cancun.index) {
        return { ...o, ownerId: "p1" };
      }
      return o;
    });
    const ownership = ownerships.find((o) => o.spaceIndex === guadalajara.index)!;
    const result = calculateRent(guadalajara, ownership, ownerships, 7);
    expect(result.amount).toBe(guadalajara.rent[0] * 2);
  });

  it("charges house rent based on house count", () => {
    const ownerships = createInitialOwnerships().map((o) =>
      o.spaceIndex === guadalajara.index ? { ...o, ownerId: "p1", houses: 2 } : o,
    );
    const ownership = ownerships.find((o) => o.spaceIndex === guadalajara.index)!;
    const result = calculateRent(guadalajara, ownership, ownerships, 7);
    expect(result.amount).toBe(guadalajara.rent[2]); // rent[2] = 2 houses
  });

  it("charges hotel rent", () => {
    const ownerships = createInitialOwnerships().map((o) =>
      o.spaceIndex === guadalajara.index ? { ...o, ownerId: "p1", hasHotel: true } : o,
    );
    const ownership = ownerships.find((o) => o.spaceIndex === guadalajara.index)!;
    const result = calculateRent(guadalajara, ownership, ownerships, 7);
    expect(result.amount).toBe(guadalajara.rent[5]); // rent[5] = hotel
  });

  it("mortgaged city charges no rent", () => {
    const ownerships = createInitialOwnerships().map((o) =>
      o.spaceIndex === guadalajara.index ? { ...o, ownerId: "p1", isMortgaged: true } : o,
    );
    const ownership = ownerships.find((o) => o.spaceIndex === guadalajara.index)!;
    const result = calculateRent(guadalajara, ownership, ownerships, 7);
    expect(result.amount).toBe(0);
    expect(result.isMortgaged).toBe(true);
  });

  it("Germany group full set doubles rent correctly", () => {
    const ownerships = createInitialOwnerships().map((o) => {
      if ([hamburg.index, munich.index, berlin.index].includes(o.spaceIndex)) {
        return { ...o, ownerId: "p1" };
      }
      return o;
    });
    const ownership = ownerships.find((o) => o.spaceIndex === berlin.index)!;
    const result = calculateRent(berlin, ownership, ownerships, 5);
    expect(result.amount).toBe(berlin.rent[0] * 2);
  });
});

describe("Airport rent", () => {
  it("charges $25 for 1 airport owned", () => {
    const ownerships = createInitialOwnerships().map((o) =>
      o.spaceIndex === jfk.index ? { ...o, ownerId: "p1" } : o,
    );
    const ownership = ownerships.find((o) => o.spaceIndex === jfk.index)!;
    const result = calculateRent(jfk, ownership, ownerships, 7);
    expect(result.amount).toBe(25);
  });

  it("charges $50 for 2 airports owned", () => {
    const ownerships = createInitialOwnerships().map((o) => {
      if (o.spaceIndex === jfk.index || o.spaceIndex === heathrow.index) {
        return { ...o, ownerId: "p1" };
      }
      return o;
    });
    const ownership = ownerships.find((o) => o.spaceIndex === jfk.index)!;
    const result = calculateRent(jfk, ownership, ownerships, 7);
    expect(result.amount).toBe(50);
  });

  it("charges $100 for 3 airports owned", () => {
    const ownerships = createInitialOwnerships().map((o) => {
      if ([jfk.index, heathrow.index, dubai.index].includes(o.spaceIndex)) {
        return { ...o, ownerId: "p1" };
      }
      return o;
    });
    const ownership = ownerships.find((o) => o.spaceIndex === jfk.index)!;
    const result = calculateRent(jfk, ownership, ownerships, 7);
    expect(result.amount).toBe(100);
  });

  it("charges $200 for 4 airports owned", () => {
    const ownerships = createInitialOwnerships().map((o) => {
      if ([jfk.index, heathrow.index, dubai.index, changi.index].includes(o.spaceIndex)) {
        return { ...o, ownerId: "p1" };
      }
      return o;
    });
    const ownership = ownerships.find((o) => o.spaceIndex === jfk.index)!;
    const result = calculateRent(jfk, ownership, ownerships, 7);
    expect(result.amount).toBe(200);
  });

  it("mortgaged airport charges no rent", () => {
    const ownerships = createInitialOwnerships().map((o) =>
      o.spaceIndex === jfk.index ? { ...o, ownerId: "p1", isMortgaged: true } : o,
    );
    const ownership = ownerships.find((o) => o.spaceIndex === jfk.index)!;
    const result = calculateRent(jfk, ownership, ownerships, 7);
    expect(result.amount).toBe(0);
    expect(result.isMortgaged).toBe(true);
  });
});

describe("Utility rent", () => {
  it("charges dice total × 4 when owner has 1 utility", () => {
    const ownerships = createInitialOwnerships().map((o) =>
      o.spaceIndex === electric.index ? { ...o, ownerId: "p1" } : o,
    );
    const ownership = ownerships.find((o) => o.spaceIndex === electric.index)!;
    const result = calculateRent(electric, ownership, ownerships, 8);
    expect(result.amount).toBe(32); // 8 × 4
  });

  it("charges dice total × 10 when owner has 2 utilities", () => {
    const ownerships = createInitialOwnerships().map((o) => {
      if (o.spaceIndex === electric.index || o.spaceIndex === water.index) {
        return { ...o, ownerId: "p1" };
      }
      return o;
    });
    const ownership = ownerships.find((o) => o.spaceIndex === electric.index)!;
    const result = calculateRent(electric, ownership, ownerships, 6);
    expect(result.amount).toBe(60); // 6 × 10
  });

  it("mortgaged utility charges no rent", () => {
    const ownerships = createInitialOwnerships().map((o) =>
      o.spaceIndex === electric.index ? { ...o, ownerId: "p1", isMortgaged: true } : o,
    );
    const ownership = ownerships.find((o) => o.spaceIndex === electric.index)!;
    const result = calculateRent(electric, ownership, ownerships, 8);
    expect(result.amount).toBe(0);
    expect(result.isMortgaged).toBe(true);
  });
});

describe("Rent cash transfer via reducer", () => {
  it("payer loses cash, owner gains cash on rent payment", () => {
    const state = makeGameState(2);
    const p2id = playerAt(state, 1).id;
    // Give Guadalajara (index 1) to player 2
    const s2 = withOwnership(withPosition(state, 38), 1, p2id);
    const p1CashBefore = currentPlayer(s2).cash;
    const p2CashBefore = playerAt(s2, 1).cash;

    const next = gameReducer(s2, { type: "ROLL_DICE", dice: { die1: 3, die2: 0, total: 3, isDouble: false } });
    const ownershipsWithP2 = createInitialOwnerships().map(o => o.spaceIndex === 1 ? { ...o, ownerId: p2id } : o);
    const rentPaid = calculateRent(guadalajara, { spaceIndex: 1, ownerId: p2id, isMortgaged: false, houses: 0, hasHotel: false }, ownershipsWithP2, 3);

    // passes GO (+200), lands on Guadalajara (pays rent)
    expect(currentPlayer(next).cash).toBe(p1CashBefore + 200 - rentPaid.amount);
    expect(playerAt(next, 1).cash).toBe(p2CashBefore + rentPaid.amount);
  });

  it("rent payment creates log entry", () => {
    const state = makeGameState(2);
    const p2id = playerAt(state, 1).id;
    const s2 = withOwnership(withPosition(state, 38), 1, p2id);
    const next = gameReducer(s2, { type: "ROLL_DICE", dice: { die1: 3, die2: 0, total: 3, isDouble: false } });

    const rentLog = next.gameLog.find((e) => e.message.toLowerCase().includes("rent"));
    expect(rentLog).toBeTruthy();
  });
});
