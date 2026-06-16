import { describe, it, expect } from "vitest";
import {
  getBoardSpaceScrollOffset,
  scrollBoardToSpace,
  MOBILE_BOARD_SIZE_PX,
} from "@/lib/animation/boardScroll";
import { makeGameState, withPosition } from "@/__tests__/helpers/factory";

// ── MOBILE_BOARD_SIZE_PX constant ────────────────────────────────────────────

describe("MOBILE_BOARD_SIZE_PX", () => {
  it("is at least 760px to ensure readable tiles on mobile", () => {
    expect(MOBILE_BOARD_SIZE_PX).toBeGreaterThanOrEqual(760);
  });

  it("is at most 1000px to avoid excessive board size", () => {
    expect(MOBILE_BOARD_SIZE_PX).toBeLessThanOrEqual(1000);
  });

  it("gives cell size of at least 60px per tile (readable minimum)", () => {
    const cellSize = MOBILE_BOARD_SIZE_PX / 11;
    expect(cellSize).toBeGreaterThanOrEqual(60);
  });
});

// ── getBoardSpaceScrollOffset — corner/anchor positions ───────────────────────

describe("getBoardSpaceScrollOffset — corners", () => {
  it("GO (index 0) is in the bottom-right corner", () => {
    const { x, y } = getBoardSpaceScrollOffset(0, 880);
    const cell = 880 / 11;
    // col 11, row 11 → centre at (10.5*cell, 10.5*cell)
    expect(x).toBeCloseTo(10.5 * cell, 0);
    expect(y).toBeCloseTo(10.5 * cell, 0);
  });

  it("Jail/Just Visiting (index 10) is in the bottom-left corner", () => {
    const { x, y } = getBoardSpaceScrollOffset(10, 880);
    const cell = 880 / 11;
    // col 1, row 11
    expect(x).toBeCloseTo(0.5 * cell, 0);
    expect(y).toBeCloseTo(10.5 * cell, 0);
  });

  it("Free Parking (index 20) is in the top-left corner", () => {
    const { x, y } = getBoardSpaceScrollOffset(20, 880);
    const cell = 880 / 11;
    // col 1, row 1
    expect(x).toBeCloseTo(0.5 * cell, 0);
    expect(y).toBeCloseTo(0.5 * cell, 0);
  });

  it("Go To Jail (index 30) is in the top-right corner", () => {
    const { x, y } = getBoardSpaceScrollOffset(30, 880);
    const cell = 880 / 11;
    // col 11, row 1
    expect(x).toBeCloseTo(10.5 * cell, 0);
    expect(y).toBeCloseTo(0.5 * cell, 0);
  });
});

describe("getBoardSpaceScrollOffset — edge spaces", () => {
  it("bottom row (index 5) is on the bottom edge", () => {
    const { y } = getBoardSpaceScrollOffset(5, 880);
    const cell = 880 / 11;
    // row 11 → y ≈ 10.5*cell
    expect(y).toBeCloseTo(10.5 * cell, 0);
  });

  it("left column (index 15) is on the left edge", () => {
    const { x } = getBoardSpaceScrollOffset(15, 880);
    const cell = 880 / 11;
    // col 1 → x ≈ 0.5*cell
    expect(x).toBeCloseTo(0.5 * cell, 0);
  });

  it("top row (index 25) is on the top edge", () => {
    const { y } = getBoardSpaceScrollOffset(25, 880);
    const cell = 880 / 11;
    // row 1 → y ≈ 0.5*cell
    expect(y).toBeCloseTo(0.5 * cell, 0);
  });

  it("right column (index 35) is on the right edge", () => {
    const { x } = getBoardSpaceScrollOffset(35, 880);
    const cell = 880 / 11;
    // col 11 → x ≈ 10.5*cell
    expect(x).toBeCloseTo(10.5 * cell, 0);
  });

  it("all 40 spaces return coordinates within the board bounds", () => {
    for (let i = 0; i < 40; i++) {
      const { x, y } = getBoardSpaceScrollOffset(i, MOBILE_BOARD_SIZE_PX);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(MOBILE_BOARD_SIZE_PX);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(MOBILE_BOARD_SIZE_PX);
    }
  });
});

// ── scrollBoardToSpace — DOM interaction (no DOM in vitest/node, test contract) ──

describe("scrollBoardToSpace — contract", () => {
  it("calls scrollTo on the container element", () => {
    let capturedArgs: ScrollToOptions | undefined;
    const fakeContainer = {
      clientWidth: 374,
      clientHeight: 400,
      scrollTo: (args: ScrollToOptions) => { capturedArgs = args; },
    } as unknown as HTMLElement;

    scrollBoardToSpace(fakeContainer, 0, 840);

    expect(capturedArgs).toBeDefined();
    expect(capturedArgs?.behavior).toBe("smooth");
  });

  it("computes non-negative scroll offsets for all spaces", () => {
    for (let i = 0; i < 40; i++) {
      let capturedArgs: ScrollToOptions | undefined;
      const fakeContainer = {
        clientWidth: 374,
        clientHeight: 400,
        scrollTo: (args: ScrollToOptions) => { capturedArgs = args; },
      } as unknown as HTMLElement;

      scrollBoardToSpace(fakeContainer, i, 840);
      expect(capturedArgs?.left).toBeGreaterThanOrEqual(0);
      expect(capturedArgs?.top).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── Current player position helper ──────────────────────────────────────────

describe("current player position mapping", () => {
  it("current player starting position (GO) returns index 0", () => {
    const state = makeGameState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    expect(currentPlayer.position).toBe(0);
    const { x, y } = getBoardSpaceScrollOffset(currentPlayer.position, MOBILE_BOARD_SIZE_PX);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });

  it("moved player position returns scroll offset within board bounds", () => {
    let state = makeGameState();
    state = withPosition(state, 15); // put current player on space 15
    const currentPlayer = state.players[state.currentPlayerIndex];
    expect(currentPlayer.position).toBe(15);
    const { x, y } = getBoardSpaceScrollOffset(15, MOBILE_BOARD_SIZE_PX);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(x).toBeLessThan(MOBILE_BOARD_SIZE_PX);
    expect(y).toBeLessThan(MOBILE_BOARD_SIZE_PX);
  });
});

// ── Responsive board sizing ──────────────────────────────────────────────────

describe("Responsive board sizing contract", () => {
  it("mobile board size (840px) is larger than typical phone width (390px)", () => {
    const phoneWidth = 390;
    expect(MOBILE_BOARD_SIZE_PX).toBeGreaterThan(phoneWidth);
  });

  it("mobile board size creates scrollable content on 390px phone", () => {
    const phoneWidth = 390;
    const padding = 16; // 2×8px
    const containerWidth = phoneWidth - padding;
    expect(MOBILE_BOARD_SIZE_PX).toBeGreaterThan(containerWidth);
  });

  it("mobile board at 840px gives tiles ~76px wide — comfortably readable", () => {
    const tileWidth = MOBILE_BOARD_SIZE_PX / 11;
    expect(tileWidth).toBeGreaterThanOrEqual(70);
  });
});
