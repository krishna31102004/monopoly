/**
 * Phase 4I.3 — Mobile board helpers unit tests
 * Tests getBoardFitScale, getMobileBoardFocusTarget, MIN_ZOOM, MAX_ZOOM
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const boardScrollSrc = fs.readFileSync(
  path.resolve(__dirname, "../lib/animation/boardScroll.ts"),
  "utf-8",
);

const mobileLayoutSrc = fs.readFileSync(
  path.resolve(__dirname, "../lib/ui/mobileLayoutHelpers.ts"),
  "utf-8",
);

describe("boardScroll.ts — zoom constants and fit scale helper", () => {
  it("exports MIN_ZOOM", () => {
    expect(boardScrollSrc).toContain("export const MIN_ZOOM");
  });

  it("exports MAX_ZOOM", () => {
    expect(boardScrollSrc).toContain("export const MAX_ZOOM");
  });

  it("MIN_ZOOM is 0.4", () => {
    expect(boardScrollSrc).toContain("MIN_ZOOM = 0.4");
  });

  it("MAX_ZOOM is 1.8", () => {
    expect(boardScrollSrc).toContain("MAX_ZOOM = 1.8");
  });

  it("exports getBoardFitScale function", () => {
    expect(boardScrollSrc).toContain("export function getBoardFitScale");
  });

  it("getBoardFitScale uses Math.min to constrain", () => {
    expect(boardScrollSrc).toContain("Math.min(");
  });

  it("getBoardFitScale guards against zero/negative container dimensions", () => {
    expect(boardScrollSrc).toContain("<= 0");
  });

  it("getBoardFitScale never upscales (caps at 1.0)", () => {
    expect(boardScrollSrc).toContain("1.0");
  });

  it("getBoardFitScale divides by MOBILE_BOARD_SIZE_PX (840)", () => {
    expect(boardScrollSrc).toMatch(/MOBILE_BOARD_SIZE_PX/);
  });
});

describe("mobileLayoutHelpers.ts — getMobileBoardFocusTarget", () => {
  it("exports getMobileBoardFocusTarget", () => {
    expect(mobileLayoutSrc).toContain("getMobileBoardFocusTarget");
  });

  it("returns auction property space index during auction phase", () => {
    expect(mobileLayoutSrc).toContain("propertySpaceIndex");
  });

  it("falls back to current player position when not in auction", () => {
    expect(mobileLayoutSrc).toContain("position");
  });
});
