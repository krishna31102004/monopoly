import { describe, it, expect } from "vitest";
import { makeGameState, withOwnership } from "@/__tests__/helpers/factory";

const BERLIN = 1;   // city
const JFK = 5;      // airport
const ELECTRIC = 12; // utility (check board data; may vary)

describe("Board ownership badge — data layer", () => {
  it("unowned city has no owner in ownerships", () => {
    const state = makeGameState();
    const o = state.ownerships.find((x) => x.spaceIndex === BERLIN);
    expect(o?.ownerId).toBeFalsy();
  });

  it("owned city returns owner with name for badge", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, BERLIN, pid);
    const o = state.ownerships.find((x) => x.spaceIndex === BERLIN);
    expect(o?.ownerId).toBe(pid);
    const owner = state.players.find((p) => p.id === pid);
    expect(owner?.name).toBeTruthy();
    // Badge should be able to display a truncated version
    const label = (owner?.name ?? "").length > 5
      ? (owner?.name ?? "").slice(0, 4) + "…"
      : owner?.name ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("owned airport has ownership record with owner name", () => {
    let state = makeGameState();
    const pid = state.players[1].id;
    state = withOwnership(state, JFK, pid);
    const o = state.ownerships.find((x) => x.spaceIndex === JFK);
    expect(o?.ownerId).toBe(pid);
    const owner = state.players.find((p) => p.id === pid);
    expect(owner?.name).toBeTruthy();
    expect(owner?.color).toBeTruthy(); // used for badge accent
  });

  it("owner color and name are available for badge styling", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, BERLIN, pid);
    const owner = state.players.find((p) => p.id === pid);
    expect(owner?.color).toMatch(/^#/); // hex color
    expect(owner?.name.length).toBeGreaterThan(0);
  });

  it("truncation logic keeps label short enough for narrow tiles", () => {
    const longName = "Maximilian";
    const label = longName.length > 5 ? longName.slice(0, 4) + "…" : longName;
    expect(label.length).toBeLessThanOrEqual(5);
  });

  it("short name is shown without truncation", () => {
    const shortName = "kb";
    const label = shortName.length > 5 ? shortName.slice(0, 4) + "…" : shortName;
    expect(label).toBe("kb");
  });
});

describe("Property buildings — data layer", () => {
  it("city with 2 houses shows correct house count", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, BERLIN, pid);
    // Patch houses directly
    state = {
      ...state,
      ownerships: state.ownerships.map((o) =>
        o.spaceIndex === BERLIN ? { ...o, houses: 2 } : o
      ),
    };
    const o = state.ownerships.find((x) => x.spaceIndex === BERLIN);
    expect(o?.houses).toBe(2);
    expect(o?.hasHotel).toBe(false);
  });

  it("hotel indicator shows hasHotel=true and houses=0", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, BERLIN, pid);
    state = {
      ...state,
      ownerships: state.ownerships.map((o) =>
        o.spaceIndex === BERLIN ? { ...o, houses: 0, hasHotel: true } : o
      ),
    };
    const o = state.ownerships.find((x) => x.spaceIndex === BERLIN);
    expect(o?.hasHotel).toBe(true);
    expect(o?.houses).toBe(0);
  });

  it("hotel is distinct from houses (different data path in component)", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, BERLIN, pid);
    // 4 houses
    state = { ...state, ownerships: state.ownerships.map((o) => o.spaceIndex === BERLIN ? { ...o, houses: 4 } : o) };
    const houses4 = state.ownerships.find((x) => x.spaceIndex === BERLIN);
    // hotel
    const stateHotel = { ...state, ownerships: state.ownerships.map((o) => o.spaceIndex === BERLIN ? { ...o, houses: 0, hasHotel: true } : o) };
    const hotel = stateHotel.ownerships.find((x) => x.spaceIndex === BERLIN);
    expect(houses4?.hasHotel).toBe(false);
    expect(hotel?.hasHotel).toBe(true);
    expect(hotel?.houses).toBe(0);
  });
});
