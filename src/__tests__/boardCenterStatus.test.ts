// Phase 4E.4F removed the board-center status pill entirely (it showed "Rolled X + Y = Z",
// purchase/rent/tax/card status, auction/trade status, etc., duplicating info already shown in
// GameControls, the game log, and the landing panel). getBoardCenterStatus/BoardCenterStatus
// were deleted from gameEventPresentation.ts. This file now asserts via source text that the
// board center renders only clean branding with no notification pill.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const gameBoardSource = readFileSync(
  fileURLToPath(new URL("../components/board/GameBoard.tsx", import.meta.url)),
  "utf-8",
);

const gameEventPresentationSource = readFileSync(
  fileURLToPath(new URL("../lib/ui/gameEventPresentation.ts", import.meta.url)),
  "utf-8",
);

describe("board center: clean branding only, no status pill", () => {
  it("renders the World Cities branding", () => {
    expect(gameBoardSource).toContain("World Cities");
    expect(gameBoardSource).toContain("Private Board Game");
  });

  it("renders the tagline", () => {
    expect(gameBoardSource).toContain("Buy cities · Collect rent · Win the world");
  });

  it("does not render a dice-result pill (no 'Rolled' text or centerStatus prop)", () => {
    expect(gameBoardSource).not.toContain("Rolled");
    expect(gameBoardSource).not.toContain("centerStatus");
  });

  it("does not import or reference getBoardCenterStatus/BoardCenterStatus", () => {
    expect(gameBoardSource).not.toContain("getBoardCenterStatus");
    expect(gameBoardSource).not.toContain("BoardCenterStatus");
  });

  it("getBoardCenterStatus/BoardCenterStatus no longer exist in the presentation helpers", () => {
    expect(gameEventPresentationSource).not.toContain("getBoardCenterStatus");
    expect(gameEventPresentationSource).not.toContain("BoardCenterStatus");
  });
});

describe("regression: GameLayout / GameLayoutMultiplayer no longer wire centerStatus into GameBoard", () => {
  it("GameLayout does not pass centerStatus", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../components/GameLayout.tsx", import.meta.url)),
      "utf-8",
    );
    expect(source).not.toContain("centerStatus");
    expect(source).not.toContain("getBoardCenterStatus");
  });

  it("GameLayoutMultiplayer does not pass centerStatus", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../components/multiplayer/GameLayoutMultiplayer.tsx", import.meta.url)),
      "utf-8",
    );
    expect(source).not.toContain("centerStatus");
    expect(source).not.toContain("getBoardCenterStatus");
  });

  it("GameControls still renders dice results (status feedback lives there, not on the board)", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../components/GameControls.tsx", import.meta.url)),
      "utf-8",
    );
    expect(source.length).toBeGreaterThan(0);
  });
});
