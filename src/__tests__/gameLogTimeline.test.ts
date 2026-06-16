import { describe, it, expect } from "vitest";
import {
  classifyGameLogEntry,
  getGameLogIcon,
  getGameLogTone,
  getGroupedGameLogEntries,
} from "@/lib/ui/gameLogTimeline";
import type { GameLogEntry } from "@/types/game";

function entry(message: string): GameLogEntry {
  return { id: "1", message, createdAt: new Date().toISOString() };
}

describe("classifyGameLogEntry", () => {
  it("classifies a purchase event", () => {
    expect(classifyGameLogEntry("Krishna bought Mumbai for $200.")).toBe("purchase");
  });

  it("classifies a rent/payment event", () => {
    expect(classifyGameLogEntry("Krishna paid Ansh $50 rent for Mumbai.")).toBe("rent");
  });

  it("classifies a tax event", () => {
    expect(classifyGameLogEntry("Krishna paid $200 for Income Tax.")).toBe("tax");
  });

  it("classifies a Chance event", () => {
    expect(classifyGameLogEntry("Krishna drew a Chance card.")).toBe("chance");
  });

  it("classifies a Community Chest event", () => {
    expect(classifyGameLogEntry("Krishna drew a Community Chest card.")).toBe("communityChest");
  });

  it("classifies an auction event", () => {
    expect(classifyGameLogEntry("Krishna declined to buy Mumbai. Auction started.")).toBe("auction");
  });

  it("classifies a trade event", () => {
    expect(classifyGameLogEntry("Trade accepted: Krishna and Ansh swapped properties.")).toBe("trade");
  });

  it("classifies a debt/bankruptcy event", () => {
    expect(classifyGameLogEntry("Krishna cannot pay and must resolve bankruptcy.")).toBe("debt");
    expect(classifyGameLogEntry("Krishna is eliminated from the game.")).toBe("bankruptcy");
  });

  it("classifies dice roll and movement events", () => {
    expect(classifyGameLogEntry("Krishna rolled 4 + 5 = 9.")).toBe("diceRoll");
    expect(classifyGameLogEntry("Krishna moved to Mumbai.")).toBe("movement");
  });

  it("falls back safely for unknown entries", () => {
    expect(classifyGameLogEntry("Something totally unrelated happened.")).toBe("unknown");
    expect(classifyGameLogEntry(null)).toBe("unknown");
    expect(classifyGameLogEntry(undefined)).toBe("unknown");
  });
});

describe("getGameLogIcon / getGameLogTone", () => {
  it("returns a non-empty icon and valid tone for every category", () => {
    const messages = [
      "Krishna bought Mumbai for $200.",
      "Krishna paid Ansh $50 rent for Mumbai.",
      "Krishna paid $200 for Income Tax.",
      "Krishna drew a Chance card.",
      "Krishna drew a Community Chest card.",
      "Auction started.",
      "Trade accepted: deal done.",
      "Krishna cannot pay and must resolve bankruptcy.",
      "totally unknown message",
    ];
    for (const message of messages) {
      const icon = getGameLogIcon(entry(message));
      const tone = getGameLogTone(entry(message));
      expect(icon.length).toBeGreaterThan(0);
      expect(["success", "danger", "warning", "info", "neutral"]).toContain(tone);
    }
  });
});

describe("getGroupedGameLogEntries", () => {
  it("annotates each entry with category/icon/tone, preserving order", () => {
    const entries = [entry("Krishna bought Mumbai for $200."), entry("Ansh rolled 2 + 3 = 5.")];
    const grouped = getGroupedGameLogEntries(entries);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].category).toBe("purchase");
    expect(grouped[1].category).toBe("diceRoll");
    expect(grouped[0].entry).toBe(entries[0]);
  });

  it("collapsed view can show just the first N entries; expanded shows all", () => {
    const entries = Array.from({ length: 10 }, (_, i) => entry(`Event ${i}`));
    const grouped = getGroupedGameLogEntries(entries);
    const collapsedPreview = grouped.slice(0, 2);
    expect(collapsedPreview).toHaveLength(2);
    expect(grouped).toHaveLength(10);
  });
});
