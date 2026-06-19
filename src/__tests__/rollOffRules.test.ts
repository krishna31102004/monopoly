import { describe, it, expect } from "vitest";
import {
  groupByTotal,
  buildInitialAgenda,
  advanceRollOffAgenda,
  getCurrentRollingGroup,
  isAgendaResolved,
  flattenAgenda,
  ordinalLabel,
  type RollOffEntry,
} from "@/lib/game/rollOff";

function roll(die1: number, die2: number): RollOffEntry {
  return { die1, die2, total: die1 + die2 };
}

describe("groupByTotal", () => {
  it("unique totals return all resolved items", () => {
    const rolls = { A: roll(5, 5), B: roll(3, 4), C: roll(1, 2) };
    const result = groupByTotal(["A", "B", "C"], rolls);
    expect(result.every((item) => item.kind === "resolved")).toBe(true);
    expect(result.map((item) => item.playerIds[0])).toEqual(["A", "B", "C"]);
  });

  it("ties produce a tied item", () => {
    const rolls = { A: roll(5, 5), B: roll(3, 7), C: roll(2, 3) };
    const result = groupByTotal(["A", "B", "C"], rolls);
    const tiedItem = result.find((item) => item.kind === "tied");
    expect(tiedItem).toBeDefined();
    expect(tiedItem?.playerIds.sort()).toEqual(["A", "B"]);
  });

  it("highest total is first", () => {
    const rolls = { A: roll(1, 2), B: roll(6, 6) };
    const result = groupByTotal(["A", "B"], rolls);
    expect(result[0].playerIds[0]).toBe("B");
  });

  it("all tied returns one tied item with all players", () => {
    const rolls = { A: roll(3, 3), B: roll(2, 4), C: roll(1, 5) };
    const result = groupByTotal(["A", "B", "C"], rolls);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("tied");
    expect(result[0].playerIds).toHaveLength(3);
  });
});

describe("buildInitialAgenda", () => {
  it("no ties → all resolved, in descending order", () => {
    const rolls = { A: roll(6, 6), B: roll(4, 5), C: roll(2, 3), D: roll(1, 1) };
    const agenda = buildInitialAgenda(["A", "B", "C", "D"], rolls);
    expect(agenda.every((item) => item.kind === "resolved")).toBe(true);
    expect(flattenAgenda(agenda)).toEqual(["A", "B", "C", "D"]);
  });

  it("tie for first produces tied group at index 0", () => {
    const rolls = { A: roll(5, 5), B: roll(4, 6), C: roll(1, 2) };
    const agenda = buildInitialAgenda(["A", "B", "C"], rolls);
    expect(agenda[0].kind).toBe("tied");
    expect(agenda[0].playerIds.sort()).toEqual(["A", "B"]);
    expect(agenda[1].kind).toBe("resolved");
    expect(agenda[1].playerIds).toEqual(["C"]);
  });

  it("multiple tie groups detected", () => {
    const rolls = { A: roll(6, 6), B: roll(3, 4), C: roll(3, 4), D: roll(1, 2), E: roll(1, 2) };
    const agenda = buildInitialAgenda(["A", "B", "C", "D", "E"], rolls);
    const tiedGroups = agenda.filter((item) => item.kind === "tied");
    expect(tiedGroups).toHaveLength(2);
  });
});

describe("getCurrentRollingGroup", () => {
  it("returns players in first tied item", () => {
    const agenda = [
      { kind: "tied" as const, playerIds: ["X", "Y"] },
      { kind: "resolved" as const, playerIds: ["Z"] },
    ];
    expect(getCurrentRollingGroup(agenda)).toEqual(["X", "Y"]);
  });

  it("returns empty array when fully resolved", () => {
    const agenda = [
      { kind: "resolved" as const, playerIds: ["A"] },
      { kind: "resolved" as const, playerIds: ["B"] },
    ];
    expect(getCurrentRollingGroup(agenda)).toEqual([]);
  });
});

describe("isAgendaResolved", () => {
  it("true when no tied items", () => {
    const agenda = [
      { kind: "resolved" as const, playerIds: ["A"] },
      { kind: "resolved" as const, playerIds: ["B"] },
    ];
    expect(isAgendaResolved(agenda)).toBe(true);
  });

  it("false when any tied item remains", () => {
    const agenda = [
      { kind: "resolved" as const, playerIds: ["A"] },
      { kind: "tied" as const, playerIds: ["B", "C"] },
    ];
    expect(isAgendaResolved(agenda)).toBe(false);
  });
});

describe("advanceRollOffAgenda — tie-breaker rounds", () => {
  it("resolves first tie group using new rolls, keeps others intact", () => {
    // Initial: [tied: [A, C]], [resolved: B], [tied: [D, E]]
    const agenda = [
      { kind: "tied" as const, playerIds: ["A", "C"] },
      { kind: "resolved" as const, playerIds: ["B"] },
      { kind: "tied" as const, playerIds: ["D", "E"] },
    ];
    // A beats C
    const roundRolls = { A: roll(5, 5), C: roll(3, 2) };
    const result = advanceRollOffAgenda(agenda, roundRolls);

    expect(result[0].kind).toBe("resolved");
    expect(result[0].playerIds).toEqual(["A"]);
    expect(result[1].kind).toBe("resolved");
    expect(result[1].playerIds).toEqual(["C"]);
    // B and the second tie group unchanged
    expect(result[2].kind).toBe("resolved");
    expect(result[2].playerIds).toEqual(["B"]);
    expect(result[3].kind).toBe("tied");
    expect(result[3].playerIds).toEqual(["D", "E"]);
  });

  it("tie persists if tied group ties again", () => {
    const agenda = [{ kind: "tied" as const, playerIds: ["A", "B"] }];
    const roundRolls = { A: roll(3, 3), B: roll(2, 4) }; // both total 6
    const result = advanceRollOffAgenda(agenda, roundRolls);
    expect(result[0].kind).toBe("tied");
  });
});

describe("flattenAgenda", () => {
  it("produces final order for fully resolved agenda", () => {
    const agenda = [
      { kind: "resolved" as const, playerIds: ["A"] },
      { kind: "resolved" as const, playerIds: ["B"] },
      { kind: "resolved" as const, playerIds: ["C"] },
    ];
    expect(flattenAgenda(agenda)).toEqual(["A", "B", "C"]);
  });

  it("final order includes all players exactly once", () => {
    const rolls = { A: roll(6, 6), B: roll(4, 5), C: roll(2, 3), D: roll(1, 1) };
    const agenda = buildInitialAgenda(["A", "B", "C", "D"], rolls);
    const order = flattenAgenda(agenda);
    expect(order).toHaveLength(4);
    expect(new Set(order).size).toBe(4);
  });
});

describe("ordinalLabel", () => {
  it("produces 1st, 2nd, 3rd, 4th", () => {
    expect(ordinalLabel(1)).toBe("1st");
    expect(ordinalLabel(2)).toBe("2nd");
    expect(ordinalLabel(3)).toBe("3rd");
    expect(ordinalLabel(4)).toBe("4th");
    expect(ordinalLabel(11)).toBe("11th");
    expect(ordinalLabel(12)).toBe("12th");
  });
});

describe("full roll-off scenario: 4-player example", () => {
  it("A=10, B=7, C=10, D=4 → A and C tie, B=3rd, D=4th; A wins re-roll", () => {
    // Round 1
    const r1 = { A: roll(5, 5), B: roll(3, 4), C: roll(4, 6), D: roll(2, 2) };
    const agenda1 = buildInitialAgenda(["A", "B", "C", "D"], r1);
    expect(isAgendaResolved(agenda1)).toBe(false);
    const tiedGroup = getCurrentRollingGroup(agenda1);
    expect(tiedGroup.sort()).toEqual(["A", "C"]);

    // Round 2 tie-breaker: A beats C
    const r2 = { A: roll(5, 4), C: roll(3, 2) };
    const agenda2 = advanceRollOffAgenda(agenda1, r2);
    expect(isAgendaResolved(agenda2)).toBe(true);
    expect(flattenAgenda(agenda2)).toEqual(["A", "C", "B", "D"]);
  });
});
