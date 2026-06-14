import { describe, it, expect } from "vitest";

// Pip layout mirrors DiceFace component
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 28], [70, 72]],
  3: [[30, 28], [50, 50], [70, 72]],
  4: [[30, 28], [70, 28], [30, 72], [70, 72]],
  5: [[30, 28], [70, 28], [50, 50], [30, 72], [70, 72]],
  6: [[30, 22], [70, 22], [30, 50], [70, 50], [30, 78], [70, 78]],
};

function getPipCount(value: number): number {
  const clamped = Math.max(1, Math.min(6, value));
  return PIP_LAYOUTS[clamped]?.length ?? 1;
}

describe("DiceFace pip counts", () => {
  it("value 1 has 1 pip", () => expect(getPipCount(1)).toBe(1));
  it("value 2 has 2 pips", () => expect(getPipCount(2)).toBe(2));
  it("value 3 has 3 pips", () => expect(getPipCount(3)).toBe(3));
  it("value 4 has 4 pips", () => expect(getPipCount(4)).toBe(4));
  it("value 5 has 5 pips", () => expect(getPipCount(5)).toBe(5));
  it("value 6 has 6 pips", () => expect(getPipCount(6)).toBe(6));

  it("value 0 clamps to 1 pip", () => expect(getPipCount(0)).toBe(1));
  it("value 7 clamps to 6 pips", () => expect(getPipCount(7)).toBe(6));
  it("negative value clamps to 1 pip", () => expect(getPipCount(-3)).toBe(1));

  it("all pip positions are within 0–100 range", () => {
    for (const pips of Object.values(PIP_LAYOUTS)) {
      for (const [cx, cy] of pips) {
        expect(cx).toBeGreaterThan(0);
        expect(cx).toBeLessThan(100);
        expect(cy).toBeGreaterThan(0);
        expect(cy).toBeLessThan(100);
      }
    }
  });
});

describe("Token movement timing constants", () => {
  it("TOKEN_STEP_MS is at least 250ms for visible pace", async () => {
    const { TOKEN_STEP_MS } = await import("@/hooks/usePlayerMovementAnimation");
    expect(TOKEN_STEP_MS).toBeGreaterThanOrEqual(250);
  });

  it("TOKEN_LAND_MS is defined and positive", async () => {
    const { TOKEN_LAND_MS } = await import("@/hooks/usePlayerMovementAnimation");
    expect(TOKEN_LAND_MS).toBeGreaterThan(0);
  });
});
