import { describe, it, expect } from "vitest";
import { chanceCards, communityChestCards } from "@/data/cards";
import { drawAndApplyCard, nearestAirport, nearestUtility } from "@/lib/game/cards";
import {
  makeGameState,
  withPosition,
  withChanceDeck,
  withCommunityChestDeck,
  withOwnership,
  withHouses,
  currentPlayer,
  playerAt,
} from "./helpers/factory";

describe("Card deck data", () => {
  it("chance deck has 16 cards", () => {
    expect(chanceCards).toHaveLength(16);
  });

  it("community chest deck has 17 cards", () => {
    expect(communityChestCards).toHaveLength(17);
  });

  it("each chance card has an id, text, category, and deck", () => {
    for (const card of chanceCards) {
      expect(card.id).toBeTruthy();
      expect(card.text).toBeTruthy();
      expect(card.category).toBeTruthy();
      expect(card.deck).toBe("chance");
    }
  });

  it("each community chest card has an id, text, category, and deck", () => {
    for (const card of communityChestCards) {
      expect(card.id).toBeTruthy();
      expect(card.text).toBeTruthy();
      expect(card.category).toBeTruthy();
      expect(card.deck).toBe("community-chest");
    }
  });

  it("chance deck includes a get-out-of-jail-free card", () => {
    const found = chanceCards.find((c) => c.category === "get-out-of-jail-free");
    expect(found).toBeTruthy();
  });

  it("community chest deck includes a get-out-of-jail-free card", () => {
    const found = communityChestCards.find((c) => c.category === "get-out-of-jail-free");
    expect(found).toBeTruthy();
  });

  it("all card IDs are unique", () => {
    const allIds = [...chanceCards, ...communityChestCards].map((c) => c.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("nearestAirport", () => {
  it("finds nearest airport from position 0 → JFK (5)", () => {
    expect(nearestAirport(0)).toBe(5);
  });

  it("finds nearest airport from position 5 → Heathrow (15)", () => {
    expect(nearestAirport(5)).toBe(15);
  });

  it("finds nearest airport from position 14 → Heathrow (15)", () => {
    expect(nearestAirport(14)).toBe(15);
  });

  it("finds nearest airport from position 30 → Changi (35)", () => {
    expect(nearestAirport(30)).toBe(35);
  });

  it("finds nearest airport from position 35 → JFK (5), wrapping around", () => {
    expect(nearestAirport(35)).toBe(5);
  });
});

describe("nearestUtility", () => {
  it("finds nearest utility from position 0 → Electric Company (12)", () => {
    expect(nearestUtility(0)).toBe(12);
  });

  it("finds nearest utility from position 12 → Water Works (28)", () => {
    expect(nearestUtility(12)).toBe(28);
  });

  it("finds nearest utility from position 20 → Water Works (28)", () => {
    expect(nearestUtility(20)).toBe(28);
  });

  it("finds nearest utility from position 28 → Electric Company (12), wrapping", () => {
    expect(nearestUtility(28)).toBe(12);
  });
});

describe("Advance to GO card", () => {
  it("moves player to position 0 if not already there", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 15), ["chance-1"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).position).toBe(0);
  });

  it("gives $200 if player was not at GO", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 15), ["chance-1"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore + 200);
  });

  it("does not give $200 if player was already at GO", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 0), ["chance-1"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore);
  });
});

describe("Advance to specific space card", () => {
  it("moves to JFK Airport (chance-2, index 5)", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 20), ["chance-2"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).position).toBe(5);
  });

  it("gives $200 if passing GO during advance", () => {
    // From position 20, advance to JFK (5) — passes GO
    const state = withChanceDeck(withPosition(makeGameState(), 20), ["chance-2"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore + 200);
  });

  it("does not give $200 if not passing GO", () => {
    // From position 1, advance to JFK (5) — does not pass GO
    const state = withChanceDeck(withPosition(makeGameState(), 1), ["chance-2"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    // JFK is unowned → awaitingPurchaseDecision, cash unchanged (no GO)
    expect(currentPlayer(next).cash).toBe(cashBefore);
  });
});

describe("Advance to nearest airport card", () => {
  it("moves to nearest airport from position 3 → JFK (5)", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 3), ["chance-4"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).position).toBe(5);
  });

  it("moves to nearest airport from position 20 → Dubai Int'l (25)", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 20), ["chance-4"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).position).toBe(25);
  });
});

describe("Advance to nearest utility card", () => {
  it("moves to nearest utility from position 5 → Electric Company (12)", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 5), ["chance-6"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).position).toBe(12);
  });

  it("moves to nearest utility from position 15 → Water Works (28)", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 15), ["chance-6"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).position).toBe(28);
  });
});

describe("Go Back 3 Spaces card", () => {
  it("moves player back 3 spaces", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 10), ["chance-9"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).position).toBe(7);
  });

  it("wraps correctly going back past 0", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 2), ["chance-9"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).position).toBe(39); // (2-3+40)%40 = 39
  });
});

describe("Go To Jail card", () => {
  it("sends player to position 10 and sets isInJail", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 15), ["chance-10"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).position).toBe(10);
    expect(currentPlayer(next).isInJail).toBe(true);
  });

  it("sets phase to turnComplete after go-to-jail card", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 15), ["chance-10"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(next.phase).toBe("turnComplete");
  });
});

describe("Collect from bank card", () => {
  it("increases player cash by card amount (chance-7: $50)", () => {
    const state = withChanceDeck(withPosition(makeGameState(), 5), ["chance-7"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore + 50);
  });

  it("card returns to bottom of deck after collect-bank", () => {
    const state = withChanceDeck(makeGameState(), ["chance-7", "chance-1"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(next.chanceDeck).toContain("chance-7");
    expect(next.chanceDeck[next.chanceDeck.length - 1]).toBe("chance-7");
  });
});

describe("Pay bank card", () => {
  it("decreases player cash by card amount (chance-12: $15)", () => {
    const state = withChanceDeck(makeGameState(), ["chance-12"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).cash).toBe(cashBefore - 15);
  });
});

describe("Collect from each player card", () => {
  it("transfers money from each non-bankrupt player (cc-7: $50 each)", () => {
    const state = withCommunityChestDeck(makeGameState(3), ["cc-7"]);
    const collectingId = currentPlayer(state).id;
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "community-chest", false);
    // 2 other players each pay $50 → collector gets $100
    expect(playerById(next, collectingId).cash).toBe(cashBefore + 100);
    expect(next.players.filter((p) => p.id !== collectingId).every((p) => {
      const before = state.players.find((sp) => sp.id === p.id)!.cash;
      return p.cash === before - 50;
    })).toBe(true);
  });
});

describe("Pay each player card", () => {
  it("transfers money to each non-bankrupt player (chance-14: $50 each)", () => {
    const state = withChanceDeck(makeGameState(3), ["chance-14"]);
    const payerId = currentPlayer(state).id;
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "chance", false);
    // 2 other players each get $50 → payer loses $100
    expect(playerById(next, payerId).cash).toBe(cashBefore - 100);
    expect(next.players.filter((p) => p.id !== payerId).every((p) => {
      const before = state.players.find((sp) => sp.id === p.id)!.cash;
      return p.cash === before + 50;
    })).toBe(true);
  });
});

describe("Get Out of Jail Free card", () => {
  it("increments player's getOutOfJailFreeCards (chance-8)", () => {
    const state = withChanceDeck(makeGameState(), ["chance-8"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(currentPlayer(next).getOutOfJailFreeCards).toBe(1);
  });

  it("GOJF card stays out of deck while held", () => {
    const state = withChanceDeck(makeGameState(), ["chance-8", "chance-1"]);
    const next = drawAndApplyCard(state, "chance", false);
    // "chance-8" should NOT be at bottom of deck since it's held
    expect(next.chanceDeck).not.toContain("chance-8");
  });
});

describe("Repair card", () => {
  it("charges $0 when player has no houses or hotels (cc-15)", () => {
    const state = withCommunityChestDeck(makeGameState(), ["cc-15"]);
    const cashBefore = currentPlayer(state).cash;
    const next = drawAndApplyCard(state, "community-chest", false);
    expect(currentPlayer(next).cash).toBe(cashBefore); // $0 repair
  });

  it("charges based on house count (cc-15: $40/house)", () => {
    const state = withCommunityChestDeck(makeGameState(), ["cc-15"]);
    const playerId = currentPlayer(state).id;
    // Give player 2 houses on Guadalajara (index 1)
    const s2 = withOwnership(state, 1, playerId);
    const s3 = withHouses(s2, 1, 2);
    const cashBefore = currentPlayer(s3).cash;
    const next = drawAndApplyCard(s3, "community-chest", false);
    // cc-15: $40/house, $115/hotel
    expect(currentPlayer(next).cash).toBe(cashBefore - 80); // 2 houses × $40
  });
});

describe("Card phase behavior", () => {
  it("draws drawnCard state after card effect", () => {
    const state = withChanceDeck(makeGameState(), ["chance-7"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(next.drawnCard).not.toBeNull();
    expect(next.drawnCard?.card.id).toBe("chance-7");
  });

  it("phase is turnComplete after non-double collect-bank card", () => {
    const state = withChanceDeck(makeGameState(), ["chance-7"]);
    const next = drawAndApplyCard(state, "chance", false);
    expect(next.phase).toBe("turnComplete");
  });

  it("phase is readyToRoll after double + collect-bank card", () => {
    const state = withChanceDeck(makeGameState(), ["chance-7"]);
    const next = drawAndApplyCard(state, "chance", true);
    expect(next.phase).toBe("readyToRoll");
  });

  it("advance to card space does not chain-draw another card", () => {
    // chance-9 (go back 3 from position 10 → 7 which is Chance space)
    const state = withChanceDeck(withPosition(makeGameState(), 10), ["chance-9", "chance-7"]);
    const next = drawAndApplyCard(state, "chance", false);
    // Lands on Chance (position 7) — should NOT draw chance-7
    expect(next.drawnCard?.card.id).toBe("chance-9"); // only chance-9 drawn
    expect(currentPlayer(next).cash).toBe(currentPlayer(state).cash); // no $50 from chance-7
  });
});

// Helper used in tests above
function playerById(state: ReturnType<typeof makeGameState>, id: string) {
  return state.players.find((p) => p.id === id)!;
}
