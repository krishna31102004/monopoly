// GameLogDrawer's collapsed header must never reveal the latest log message — that spoiled
// movement/landing outcomes before the token visually arrived (Phase 4E.8B fix). Verified via
// source text since this repo has no DOM renderer for "use client" components.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const gameLogDrawerSource = readFileSync(
  fileURLToPath(new URL("../components/GameLogDrawer.tsx", import.meta.url)),
  "utf-8",
);

const gameStatusStripSource = readFileSync(
  fileURLToPath(new URL("../components/GameStatusStrip.tsx", import.meta.url)),
  "utf-8",
);

describe("collapsed game log header: no outcome spoilers", () => {
  it("never renders entry.message in the collapsed (button) header", () => {
    // The header lives inside the <button>...</button> block; the expanded <ol> below it is
    // allowed to render entry.message. Isolate the button block and assert it's message-free.
    const buttonBlock = gameLogDrawerSource.slice(
      gameLogDrawerSource.indexOf("<button"),
      gameLogDrawerSource.indexOf("</button>"),
    );
    expect(buttonBlock).not.toContain("entry.message");
    expect(buttonBlock).not.toContain(".message");
  });

  it("shows a neutral title and label, not a per-entry preview", () => {
    const buttonBlock = gameLogDrawerSource.slice(
      gameLogDrawerSource.indexOf("<button"),
      gameLogDrawerSource.indexOf("</button>"),
    );
    expect(buttonBlock).toContain("Game Log");
    expect(buttonBlock).toContain("Recent Actions");
  });

  it("still shows the entry count in the header", () => {
    const buttonBlock = gameLogDrawerSource.slice(
      gameLogDrawerSource.indexOf("<button"),
      gameLogDrawerSource.indexOf("</button>"),
    );
    expect(buttonBlock).toContain("entries.length");
  });

  it("still has an expand/collapse arrow control", () => {
    expect(gameLogDrawerSource).toContain('isOpen ? "▲" : "▼"');
    expect(gameLogDrawerSource).toContain("aria-expanded={isOpen}");
  });

  it("no longer has a COLLAPSED_PREVIEW_COUNT or preview slice", () => {
    expect(gameLogDrawerSource).not.toContain("COLLAPSED_PREVIEW_COUNT");
    expect(gameLogDrawerSource).not.toContain("preview[0]");
  });

  it("expanded section (the <ol>) is still allowed to render full entry messages", () => {
    const olBlock = gameLogDrawerSource.slice(gameLogDrawerSource.indexOf("<ol"));
    expect(olBlock).toContain("entry.message");
  });

  it("expanded section still carries icon/tone classification styling", () => {
    const olBlock = gameLogDrawerSource.slice(gameLogDrawerSource.indexOf("<ol"));
    expect(olBlock).toContain("icon");
    expect(olBlock).toContain("tone");
  });
});

describe("status strip: no outcome spoilers", () => {
  it("never references the game log or landing message text", () => {
    expect(gameStatusStripSource).not.toContain("landingMessage");
    expect(gameStatusStripSource).not.toContain("gameLog");
    expect(gameStatusStripSource).not.toContain("entry.message");
  });

  it("only shows neutral phase/turn info, not outcome text", () => {
    expect(gameStatusStripSource).toContain("phaseLabel");
    expect(gameStatusStripSource).toContain("currentPlayerName");
  });
});
