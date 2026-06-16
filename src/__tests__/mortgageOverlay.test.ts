import { describe, it, expect } from "vitest";
import { makeGameState, withOwnership, withMortgage } from "@/__tests__/helpers/factory";
import { getMortgageVisualState } from "@/lib/game/mortgageDisplay";

const BERLIN = 1;   // city
const JFK = 5;      // airport
const ELECTRIC = 12; // utility

describe("getMortgageVisualState — mortgaged properties", () => {
  it("mortgaged city shows isMortgaged=true", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, BERLIN, pid);
    state = withMortgage(state, BERLIN);
    const ownership = state.ownerships.find((o) => o.spaceIndex === BERLIN);
    const result = getMortgageVisualState(ownership);
    expect(result.isMortgaged).toBe(true);
  });

  it("mortgaged airport shows isMortgaged=true", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, JFK, pid);
    state = withMortgage(state, JFK);
    const ownership = state.ownerships.find((o) => o.spaceIndex === JFK);
    const result = getMortgageVisualState(ownership);
    expect(result.isMortgaged).toBe(true);
  });

  it("mortgaged utility shows isMortgaged=true", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, ELECTRIC, pid);
    state = withMortgage(state, ELECTRIC);
    const ownership = state.ownerships.find((o) => o.spaceIndex === ELECTRIC);
    const result = getMortgageVisualState(ownership);
    expect(result.isMortgaged).toBe(true);
  });

  it("mortgaged property has non-empty overlayLabel", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, BERLIN, pid);
    state = withMortgage(state, BERLIN);
    const ownership = state.ownerships.find((o) => o.spaceIndex === BERLIN);
    const result = getMortgageVisualState(ownership);
    expect(result.overlayLabel.length).toBeGreaterThan(0);
  });
});

describe("getMortgageVisualState — non-mortgaged properties", () => {
  it("owned but unmortgaged city shows isMortgaged=false", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, BERLIN, pid);
    const ownership = state.ownerships.find((o) => o.spaceIndex === BERLIN);
    const result = getMortgageVisualState(ownership);
    expect(result.isMortgaged).toBe(false);
  });

  it("unowned city shows isMortgaged=false", () => {
    const state = makeGameState();
    const ownership = state.ownerships.find((o) => o.spaceIndex === BERLIN);
    const result = getMortgageVisualState(ownership);
    expect(result.isMortgaged).toBe(false);
  });

  it("undefined ownership shows isMortgaged=false", () => {
    const result = getMortgageVisualState(undefined);
    expect(result.isMortgaged).toBe(false);
  });

  it("unmortgaged property has empty overlayLabel", () => {
    const state = makeGameState();
    const ownership = state.ownerships.find((o) => o.spaceIndex === BERLIN);
    const result = getMortgageVisualState(ownership);
    expect(result.overlayLabel).toBe("");
  });
});

describe("getMortgageVisualState — owner badge not affected", () => {
  it("mortgage state does not change owner id", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, BERLIN, pid);
    state = withMortgage(state, BERLIN);
    const ownership = state.ownerships.find((o) => o.spaceIndex === BERLIN);
    expect(ownership?.ownerId).toBe(pid);
  });

  it("mortgaged property still has owner readable for badge", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, BERLIN, pid);
    state = withMortgage(state, BERLIN);
    const ownership = state.ownerships.find((o) => o.spaceIndex === BERLIN);
    const owner = state.players.find((p) => p.id === ownership?.ownerId);
    expect(owner?.name).toBeTruthy();
    expect(owner?.color).toBeTruthy();
  });
});

describe("getMortgageVisualState — accessible label", () => {
  it("overlayLabel for mortgaged property is human-readable", () => {
    let state = makeGameState();
    const pid = state.players[0].id;
    state = withOwnership(state, BERLIN, pid);
    state = withMortgage(state, BERLIN);
    const ownership = state.ownerships.find((o) => o.spaceIndex === BERLIN);
    const { overlayLabel } = getMortgageVisualState(ownership);
    expect(overlayLabel.toUpperCase()).toContain("MORTGAGED");
  });
});
