import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");
const layer = read("components/presentation/GamePresentationLayer.tsx");
const localLayout = read("components/GameLayout.tsx");
const multiplayerLayout = read("components/multiplayer/GameLayoutMultiplayer.tsx");
const board = read("components/board/GameBoard.tsx");

describe("Phase 5 presentation architecture safeguards", () => {
  it("keeps presentation local and outside reducer or socket paths", () => {
    expect(layer).toContain("deriveGamePresentationEvents");
    expect(layer).not.toContain("dispatch(");
    expect(layer).not.toContain("sendAction(");
    expect(localLayout).toContain("<GamePresentationLayer state={state}");
    expect(multiplayerLayout).toContain("<GamePresentationLayer state={gameState}");
  });

  it("keeps world routes decorative and sound explicitly optional", () => {
    expect(board).toContain('aria-hidden="true"');
    expect(board).toContain("world-route-overlay");
    expect(board).toContain("airport");
    expect(layer).toContain("aria-pressed={enabled}");
    expect(layer).toContain("localStorage");
    expect(layer).toContain("world-cities-presentation");
  });

  it("keeps an accessible start sequence and factual end-game heading", () => {
    expect(layer).toContain('aria-labelledby="journey-start-title"');
    expect(layer).toContain("Begin journey");
    expect(layer).toContain('aria-labelledby="world-empire-title"');
    expect(layer).toContain("getEndGameFacts");
  });
});
