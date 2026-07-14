import { describe, it, expect } from "vitest";
import { validateTradeDraft } from "@/lib/game/tradeHelpers";
import { makeGameState, withPlayer, withOwnership } from "./helpers/factory";

const EMPTY = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };
const BERLIN = 1;

describe("validateTradeDraft", () => {
  it("rejects an empty trade with nothing on either side", () => {
    const state = makeGameState(2);
    const p0 = state.players[0].id;
    const p1 = state.players[1].id;
    const result = validateTradeDraft(state, p0, p1, EMPTY, EMPTY);
    expect(result.ok).toBe(false);
  });

  it("rejects a cash-only trade", () => {
    const state = makeGameState(2);
    const p0 = state.players[0].id;
    const p1 = state.players[1].id;
    const result = validateTradeDraft(state, p0, p1, { ...EMPTY, cash: 100 }, EMPTY);
    expect(result.ok).toBe(false);
  });

  it("rejects trading with yourself", () => {
    const state = makeGameState(2);
    const p0 = state.players[0].id;
    const result = validateTradeDraft(state, p0, p0, { ...EMPTY, cash: 10 }, EMPTY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/yourself/i);
  });

  it("rejects an unknown recipient", () => {
    const state = makeGameState(2);
    const p0 = state.players[0].id;
    const result = validateTradeDraft(state, p0, "nope", { ...EMPTY, cash: 10 }, EMPTY);
    expect(result.ok).toBe(false);
  });

  it("rejects an empty recipient id", () => {
    const state = makeGameState(2);
    const p0 = state.players[0].id;
    const result = validateTradeDraft(state, p0, "", { ...EMPTY, cash: 10 }, EMPTY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/select/i);
  });

  it("rejects trading with a bankrupt player", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 1, { isBankrupt: true });
    const p0 = state.players[0].id;
    const p1 = state.players[1].id;
    const result = validateTradeDraft(state, p0, p1, { ...EMPTY, cash: 10 }, EMPTY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/bankrupt/i);
  });

  it("rejects the same property appearing on both sides", () => {
    let state = makeGameState(2);
    const p0 = state.players[0].id;
    const p1 = state.players[1].id;
    state = withOwnership(state, BERLIN, p0);
    state = withOwnership(state, BERLIN, p1); // re-owned by p1 too (last write wins in fixture)
    const result = validateTradeDraft(
      state,
      p0,
      p1,
      { ...EMPTY, propertySpaceIndices: [BERLIN] },
      { ...EMPTY, propertySpaceIndices: [BERLIN] },
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && /both sides/i.test(result.reason)).toBe(true);
  });

  it("rejects insufficient cash from the proposer", () => {
    let state = makeGameState(2);
    state = withPlayer(state, 0, { cash: 5 });
    const p0 = state.players[0].id;
    const p1 = state.players[1].id;
    const result = validateTradeDraft(state, p0, p1, { ...EMPTY, cash: 500 }, EMPTY);
    expect(result.ok).toBe(false);
  });

  it("accepts a valid property-for-cash trade", () => {
    let state = makeGameState(2);
    const p0 = state.players[0].id;
    const p1 = state.players[1].id;
    state = withOwnership(state, BERLIN, p0);
    const result = validateTradeDraft(
      state,
      p0,
      p1,
      { ...EMPTY, propertySpaceIndices: [BERLIN] },
      { ...EMPTY, cash: 50 },
    );
    expect(result.ok).toBe(true);
  });
});
