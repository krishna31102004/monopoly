import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TOKEN_PRESENTATION } from "@/lib/ui/tokenPresentation";

describe("premium entry experience safeguards", () => {
  it("keeps every existing playable token ID and maps each to a visual presentation", () => {
    expect(TOKEN_PRESENTATION.map((token) => token.token)).toEqual(["car", "hat", "ship", "shoe", "dog", "cat"]);
    expect(new Set(TOKEN_PRESENTATION.map((token) => token.color)).size).toBe(6);
    expect(TOKEN_PRESENTATION.every((token) => token.displayName.length > 0 && token.tokenLabel.length > 0)).toBe(true);
  });

  it("retains the existing entry routes and their navigation targets", () => {
    const home = readFileSync(resolve(process.cwd(), "src/components/multiplayer/HomeScreen.tsx"), "utf8");
    expect(home).toContain('href="/create"');
    expect(home).toContain('href="/join"');
    expect(home).toContain('href="/play"');
  });

  it("uses radio semantics for token choices and keeps room payload field names intact", () => {
    const picker = readFileSync(resolve(process.cwd(), "src/components/multiplayer/TokenPicker.tsx"), "utf8");
    const create = readFileSync(resolve(process.cwd(), "src/components/multiplayer/CreateRoom.tsx"), "utf8");
    const join = readFileSync(resolve(process.cwd(), "src/components/multiplayer/JoinRoom.tsx"), "utf8");
    expect(picker).toContain('role="radiogroup"');
    for (const field of ["displayName", "token", "tokenLabel", "color"]) expect(create).toContain(field);
    for (const field of ["displayName", "roomCode", "token", "tokenLabel", "color"]) expect(join).toContain(field);
  });
});
