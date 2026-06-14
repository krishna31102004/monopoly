import { describe, it, expect } from "vitest";
import { makeGameState, withOwnership } from "@/__tests__/helpers/factory";
import { getOwnerBadgeLabel, getOwnerBadgePlacement } from "@/lib/tokenMeta";

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

  it("hotel is distinct from 4 houses (different data path in component)", () => {
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

describe("getOwnerBadgeLabel", () => {
  it("returns name unchanged when 5 chars or fewer", () => {
    expect(getOwnerBadgeLabel("kb")).toBe("kb");
    expect(getOwnerBadgeLabel("Ansh")).toBe("Ansh");
    expect(getOwnerBadgeLabel("Alice")).toBe("Alice");
  });

  it("truncates names longer than 5 chars to 4 + ellipsis", () => {
    expect(getOwnerBadgeLabel("Maximilian")).toBe("Maxi…");
    expect(getOwnerBadgeLabel("Krishna")).toBe("Kris…");
    expect(getOwnerBadgeLabel("Alexander")).toBe("Alex…");
  });

  it("result is at most 5 chars", () => {
    const label = getOwnerBadgeLabel("VeryLongPlayerName");
    expect(label.length).toBeLessThanOrEqual(5);
  });

  it("exactly 5-char name is not truncated", () => {
    expect(getOwnerBadgeLabel("Bobby")).toBe("Bobby");
  });

  it("exactly 6-char name is truncated", () => {
    expect(getOwnerBadgeLabel("Robert")).toBe("Robe…");
  });
});

describe("getOwnerBadgePlacement", () => {
  it("bottom row spaces (1-9) get top placement", () => {
    for (let i = 1; i <= 9; i++) {
      expect(getOwnerBadgePlacement(i)).toBe("top");
    }
  });

  it("left side spaces (11-19) get right placement", () => {
    for (let i = 11; i <= 19; i++) {
      expect(getOwnerBadgePlacement(i)).toBe("right");
    }
  });

  it("top row spaces (21-29) get bottom placement", () => {
    for (let i = 21; i <= 29; i++) {
      expect(getOwnerBadgePlacement(i)).toBe("bottom");
    }
  });

  it("right side spaces (31-39) get left placement", () => {
    for (let i = 31; i <= 39; i++) {
      expect(getOwnerBadgePlacement(i)).toBe("left");
    }
  });

  it("corners (0, 10, 20, 30) fall back to top", () => {
    expect(getOwnerBadgePlacement(0)).toBe("top");
    expect(getOwnerBadgePlacement(10)).toBe("top");
    expect(getOwnerBadgePlacement(20)).toBe("top");
    expect(getOwnerBadgePlacement(30)).toBe("top");
  });
});
