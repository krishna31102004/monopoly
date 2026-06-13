import { describe, it, expect } from "vitest";
import { makeGameState, withOwnership, withPlayer, withHouses } from "@/__tests__/helpers/factory";

// Board space indices (from board data — cities are ownable, airports too)
const BERLIN = 1;   // city (brown group)
const HAMBURG = 3;  // city (brown group)
const JFK = 5;      // airport

// ── Helpers that mirror what BoardSpace uses ──────────────────────────────────

/** Find ownership record for a space */
function getOwnershipRecord(state: ReturnType<typeof makeGameState>, spaceIndex: number) {
  return state.ownerships.find((o) => o.spaceIndex === spaceIndex);
}

/** Determine owner Player for a space */
function getOwner(state: ReturnType<typeof makeGameState>, spaceIndex: number) {
  const ownership = getOwnershipRecord(state, spaceIndex);
  if (!ownership?.ownerId) return undefined;
  return state.players.find((p) => p.id === ownership.ownerId);
}

// ── Ownership indicator data ──────────────────────────────────────────────────

describe("Board ownership indicators — helper data", () => {
  it("unowned city has no owner", () => {
    const state = makeGameState();
    expect(getOwner(state, BERLIN)).toBeUndefined();
  });

  it("owned city returns correct owner player", () => {
    let state = makeGameState();
    const pid0 = state.players[0].id;
    state = withOwnership(state, BERLIN, pid0);
    const owner = getOwner(state, BERLIN);
    expect(owner).toBeDefined();
    expect(owner?.id).toBe(pid0);
  });

  it("owned airport returns correct owner player", () => {
    let state = makeGameState();
    const pid1 = state.players[1].id;
    state = withOwnership(state, JFK, pid1);
    const owner = getOwner(state, JFK);
    expect(owner?.id).toBe(pid1);
  });

  it("owner has color and tokenLabel for badge rendering", () => {
    let state = makeGameState();
    const pid0 = state.players[0].id;
    state = withOwnership(state, BERLIN, pid0);
    const owner = getOwner(state, BERLIN);
    expect(owner?.color).toBeTruthy();
    expect(owner?.tokenLabel).toBeTruthy();
  });

  it("after ownership transfer, badge should reflect new owner", () => {
    let state = makeGameState();
    const pid0 = state.players[0].id;
    const pid1 = state.players[1].id;
    state = withOwnership(state, BERLIN, pid0);
    expect(getOwner(state, BERLIN)?.id).toBe(pid0);
    // Transfer to pid1
    state = withOwnership(state, BERLIN, pid1);
    expect(getOwner(state, BERLIN)?.id).toBe(pid1);
  });
});

// ── House/hotel indicators ────────────────────────────────────────────────────

describe("Board house/hotel indicator data", () => {
  it("unimproved city has 0 houses and no hotel", () => {
    let state = makeGameState();
    state = withOwnership(state, BERLIN, state.players[0].id);
    const ownership = getOwnershipRecord(state, BERLIN);
    expect(ownership?.houses).toBe(0);
    expect(ownership?.hasHotel).toBe(false);
  });

  it("city with 2 houses shows houses=2", () => {
    let state = makeGameState();
    state = withOwnership(state, BERLIN, state.players[0].id);
    state = withHouses(state, BERLIN, 2);
    const ownership = getOwnershipRecord(state, BERLIN);
    expect(ownership?.houses).toBe(2);
    expect(ownership?.hasHotel).toBe(false);
  });

  it("city with 4 houses shows houses=4", () => {
    let state = makeGameState();
    state = withOwnership(state, BERLIN, state.players[0].id);
    state = withHouses(state, BERLIN, 4);
    expect(getOwnershipRecord(state, BERLIN)?.houses).toBe(4);
  });

  it("city with hotel shows hasHotel=true", () => {
    let state = makeGameState();
    state = withOwnership(state, BERLIN, state.players[0].id);
    // Apply hotel directly via ownership patch
    state = {
      ...state,
      ownerships: state.ownerships.map((o) =>
        o.spaceIndex === BERLIN ? { ...o, houses: 0, hasHotel: true } : o,
      ),
    };
    const ownership = getOwnershipRecord(state, BERLIN);
    expect(ownership?.hasHotel).toBe(true);
    expect(ownership?.houses).toBe(0);
  });

  it("airport ownership record exists but never has houses or hotel", () => {
    let state = makeGameState();
    state = withOwnership(state, JFK, state.players[0].id);
    const ownership = getOwnershipRecord(state, JFK);
    expect(ownership?.houses).toBe(0);
    expect(ownership?.hasHotel).toBe(false);
  });

  it("improvement dots only for cities (not airports/utilities)", () => {
    // Airport ownership has no house fields active
    let state = makeGameState();
    state = withOwnership(state, JFK, state.players[0].id);
    const airportOwnership = getOwnershipRecord(state, JFK);
    // Airport cannot have houses — verify data structure
    expect(airportOwnership?.houses).toBe(0);
    expect(airportOwnership?.hasHotel).toBe(false);
  });
});

// ── boardDisplayName helper (mirrors component logic) ─────────────────────────

function boardDisplayName(name: string, kind: string): string {
  if (kind === "airport") {
    return name
      .replace(" International Airport", "")
      .replace(" Airport", "");
  }
  return name;
}

describe("Board display name shortening", () => {
  it('removes " Airport" suffix from airport names', () => {
    expect(boardDisplayName("JFK Airport", "airport")).toBe("JFK");
    expect(boardDisplayName("Heathrow Airport", "airport")).toBe("Heathrow");
    expect(boardDisplayName("Changi Airport", "airport")).toBe("Changi");
  });

  it('removes " International Airport" from long airport names', () => {
    expect(boardDisplayName("Dubai International Airport", "airport")).toBe("Dubai");
  });

  it("does not shorten city names", () => {
    expect(boardDisplayName("Berlin", "city")).toBe("Berlin");
    expect(boardDisplayName("San Francisco", "city")).toBe("San Francisco");
  });

  it("does not shorten utility names", () => {
    expect(boardDisplayName("Electric Company", "utility")).toBe("Electric Company");
  });
});
