import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "src");

function read(relPath: string) {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

describe("RollOffScreen source assertions", () => {
  const src = read("components/multiplayer/RollOffScreen.tsx");

  it("is a client component", () => {
    expect(src).toMatch(/"use client"/);
  });

  it("shows roll button for active player who has not rolled", () => {
    expect(src).toMatch(/canRoll/);
    expect(src).toMatch(/Roll for Order/);
  });

  it("shows waiting message when player has rolled but others haven't", () => {
    expect(src).toMatch(/Waiting for/);
    expect(src).toMatch(/more player/);
  });

  it("shows final resolved order using ordinalLabel", () => {
    expect(src).toMatch(/ordinalLabel/);
    expect(src).toMatch(/resolvedOrder/);
  });

  it("shows tie-breaker header for round > 1", () => {
    expect(src).toMatch(/Tie Breaker/);
    expect(src).toMatch(/isTieBreaker/);
  });

  it("highlights current player's row", () => {
    expect(src).toMatch(/isMe/);
    expect(src).toMatch(/amber-900/);
  });

  it("shows dice values using DieFace for rolled players", () => {
    expect(src).toMatch(/DieFace/);
    expect(src).toMatch(/die1/);
    expect(src).toMatch(/die2/);
  });

  it("dims players not in current rolling group", () => {
    expect(src).toMatch(/opacity-50/);
    expect(src).toMatch(/Position decided/);
  });

  it("shows 'Starting game…' after resolved order", () => {
    expect(src).toMatch(/Starting game/);
  });

  it("onRoll prop is called from roll button", () => {
    expect(src).toMatch(/onClick={onRoll}/);
  });
});

describe("LocalRollOffScreen source assertions", () => {
  const src = read("components/setup/LocalRollOffScreen.tsx");

  it("is a client component", () => {
    expect(src).toMatch(/"use client"/);
  });

  it("uses rollDice from game lib (not from client input)", () => {
    expect(src).toMatch(/rollDice/);
    expect(src).not.toMatch(/die1.*props/);
  });

  it("shows Roll button per player", () => {
    expect(src).toMatch(/Roll/);
    expect(src).toMatch(/handleRoll/);
  });

  it("advances agenda with buildInitialAgenda and advanceRollOffAgenda", () => {
    expect(src).toMatch(/buildInitialAgenda/);
    expect(src).toMatch(/advanceRollOffAgenda/);
  });

  it("shows 'Start Game' button after all resolved", () => {
    expect(src).toMatch(/Start Game/);
  });

  it("shows tie-breaker round header", () => {
    expect(src).toMatch(/Tie Breaker/);
    expect(src).toMatch(/isTieBreaker/);
  });

  it("calls onComplete with sorted player list", () => {
    expect(src).toMatch(/onComplete/);
    expect(src).toMatch(/sortedPlayers|sorted/);
  });
});

describe("GameLayout source assertions", () => {
  const src = read("components/GameLayout.tsx");

  it("imports LocalRollOffScreen", () => {
    expect(src).toMatch(/LocalRollOffScreen/);
  });

  it("renders LocalRollOffScreen when pendingRollOff is set", () => {
    expect(src).toMatch(/pendingRollOff/);
    expect(src).toMatch(/<LocalRollOffScreen/);
  });

  it("GameSetup passes players/rules to setPendingRollOff (not direct dispatch)", () => {
    expect(src).toMatch(/setPendingRollOff/);
  });
});

describe("CreateRoom source assertions", () => {
  const src = read("components/multiplayer/CreateRoom.tsx");

  it("imports RollOffScreen", () => {
    expect(src).toMatch(/RollOffScreen/);
  });

  it("renders RollOffScreen when status is rollOff", () => {
    expect(src).toMatch(/rollOff/);
    expect(src).toMatch(/<RollOffScreen/);
  });

  it("passes rollForOrder to RollOffScreen", () => {
    expect(src).toMatch(/rollForOrder/);
  });
});

describe("JoinRoom source assertions", () => {
  const src = read("components/multiplayer/JoinRoom.tsx");

  it("imports RollOffScreen", () => {
    expect(src).toMatch(/RollOffScreen/);
  });

  it("renders RollOffScreen when status is rollOff", () => {
    expect(src).toMatch(/rollOff/);
    expect(src).toMatch(/<RollOffScreen/);
  });

  it("passes rollForOrder to RollOffScreen", () => {
    expect(src).toMatch(/rollForOrder/);
  });
});
