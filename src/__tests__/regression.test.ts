import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");

function readJson(file: string) {
  return JSON.parse(readFileSync(resolve(root, file), "utf-8"));
}

function readText(file: string) {
  return readFileSync(resolve(root, file), "utf-8").trim();
}

describe("Tooling / dependency regression", () => {
  it(".nvmrc specifies Node 20", () => {
    const nvmrc = readText(".nvmrc");
    expect(nvmrc.startsWith("20")).toBe(true);
  });

  it("package.json uses exact version pins (no ^ or ~ on any dep)", () => {
    const pkg = readJson("package.json");
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, version] of Object.entries(allDeps as Record<string, string>)) {
      expect(
        version.startsWith("^") || version.startsWith("~"),
        `${name}@${version} uses a range — should be pinned exactly`,
      ).toBe(false);
    }
  });

  it("eslint-config-next version matches next version", () => {
    const pkg = readJson("package.json");
    expect(pkg.devDependencies["eslint-config-next"]).toBe(pkg.dependencies["next"]);
  });

  it("next version is 15.2.4", () => {
    const pkg = readJson("package.json");
    expect(pkg.dependencies["next"]).toBe("15.2.4");
  });

  it("react version is 19.0.0", () => {
    const pkg = readJson("package.json");
    expect(pkg.dependencies["react"]).toBe("19.0.0");
  });

  it("vitest is in devDependencies", () => {
    const pkg = readJson("package.json");
    expect(pkg.devDependencies["vitest"]).toBeTruthy();
  });

  it("package.json has a test script", () => {
    const pkg = readJson("package.json");
    expect(pkg.scripts["test"]).toBeTruthy();
  });
});

describe("Board data integrity regression", () => {
  it("boardSpaces module loads without error", async () => {
    const { boardSpaces } = await import("@/data/board");
    expect(boardSpaces).toBeDefined();
    expect(Array.isArray(boardSpaces)).toBe(true);
  });

  it("gameReducer module loads without error", async () => {
    const { gameReducer } = await import("@/lib/game/gameReducer");
    expect(typeof gameReducer).toBe("function");
  });

  it("createInitialGameState returns valid state for 2 players", async () => {
    const { createInitialGameState } = await import("@/lib/game/createInitialGameState");
    const state = createInitialGameState([
      { name: "A", token: "car", tokenLabel: "CAR", color: "#f00" },
      { name: "B", token: "hat", tokenLabel: "HAT", color: "#00f" },
    ]);
    expect(state.players).toHaveLength(2);
    expect(state.phase).toBe("readyToRoll");
  });
});
