import { describe, it, expect } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import {
  makeGameState,
  dice,
  withPosition,
  withCash,
  withOwnership,
  currentPlayer,
  playerAt,
  withChanceDeck,
  withCommunityChestDeck,
} from "./helpers/factory";

describe("ROLL_DICE: movement and GO salary", () => {
  it("player moves by dice total", () => {
    // Position 10 (Jail/Just Visiting) + dice(2,3)=5 → position 15 (Heathrow Airport, unowned)
    const state = withPosition(makeGameState(), 10);
    const next = gameReducer(state, { type: "ROLL_DICE", dice: dice(2, 3) });
    expect(currentPlayer(next).position).toBe(15);
  });

  it("passing GO awards $200", () => {
    const state = withPosition(makeGameState(), 38);
    const before = currentPlayer(state).cash;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: dice(3, 2) });
    // passes GO (38+5=43 → position 3)
    expect(currentPlayer(next).position).toBe(3);
    // $200 bonus minus no other deductions (landed on Cancún which is unowned → awaitingPurchaseDecision)
    expect(currentPlayer(next).cash).toBe(before + 200);
  });

  it("landing exactly on GO awards $300 (exactGoBonus default ON)", () => {
    const state = withPosition(makeGameState(), 38);
    const before = currentPlayer(state).cash;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 1) });
    // 38+2=40 → position 0 (GO), exactGoBonus=true → $300
    expect(currentPlayer(next).position).toBe(0);
    expect(currentPlayer(next).cash).toBe(before + 300);
  });

  it("does not award $200 when not passing GO", () => {
    const state = withPosition(makeGameState(), 5);
    const before = currentPlayer(state).cash;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: dice(3, 2) });
    expect(currentPlayer(next).position).toBe(10);
    // landed on Jail (just visiting) — no salary
    expect(currentPlayer(next).cash).toBe(before);
  });

  it("non-double roll sets phase to turnComplete after uncontested landing", () => {
    const state = withPosition(makeGameState(), 5);
    // Move to position 15 (Heathrow Airport) — unowned
    const next = gameReducer(state, { type: "ROLL_DICE", dice: dice(4, 6) });
    // Unowned airport → awaitingPurchaseDecision
    expect(next.phase).toBe("awaitingPurchaseDecision");
  });

  it("non-double roll to non-ownable space → turnComplete", () => {
    // Position 5 (JFK airport just visited) + 5 steps = 10 (Jail / Just Visiting)
    const state = withPosition(makeGameState(), 5);
    const next = gameReducer(state, { type: "ROLL_DICE", dice: dice(3, 2) });
    expect(next.phase).toBe("turnComplete");
  });

  it("double roll to non-ownable space → readyToRoll", () => {
    const state = withPosition(makeGameState(), 5);
    // 5+4+4=13 → Munich (city, unowned) → awaitingPurchaseDecision
    // Let's try 5+5+5=15 → Heathrow (airport, unowned) → awaitingPurchaseDecision
    // Let's use position 8 (Delhi) + doubles 1+1 = 10 (Jail/Just Visiting) → turnComplete (even with doubles, go-to-jail space takes over)
    // Use position 3 (Cancún) + 3+3=6 → position 9 (Bengaluru, unowned city)
    const s2 = withPosition(makeGameState(), 3);
    const next = gameReducer(s2, { type: "ROLL_DICE", dice: dice(3, 3) });
    // Bengaluru is unowned city → awaitingPurchaseDecision (not readyToRoll because purchase needed)
    expect(next.doublesCount).toBe(1);
  });

  it("three doubles in a row sends player to Jail", () => {
    // Use a state with doubles count already at 2, then roll third double
    const state = {
      ...withPosition(makeGameState(), 20),
      doublesCount: 2,
    };
    const next = gameReducer(state, { type: "ROLL_DICE", dice: dice(3, 3) });
    // After 3rd double, player is jailed and turn advances. Find the jailed player.
    const p1 = next.players[0]; // player 0 (who was rolling)
    expect(p1.isInJail).toBe(true);
    expect(p1.position).toBe(10);
  });

  it("dice state is stored after roll", () => {
    const state = makeGameState();
    const d = dice(3, 5);
    const next = gameReducer(state, { type: "ROLL_DICE", dice: d });
    expect(next.diceRoll).toEqual(d);
    expect(next.currentPlayerHasRolled).toBe(true);
  });

  it("income tax deducts $200", () => {
    // Income Tax is at position 4
    const state = withPosition(makeGameState(), 2);
    const before = currentPlayer(state).cash;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 1) });
    // 2+2=4 (Income Tax), doubles so doublesCount=1 but tax deducted
    expect(currentPlayer(next).cash).toBe(before - 200);
  });

  it("luxury tax deducts $100", () => {
    // Luxury Tax is at position 38
    const state = withPosition(makeGameState(), 36);
    const before = currentPlayer(state).cash;
    const next = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 1) });
    // 36+2=38 (Luxury Tax), doubles
    expect(currentPlayer(next).cash).toBe(before - 100);
  });
});

describe("BUY_PROPERTY", () => {
  it("landing on unowned city creates purchase decision", () => {
    // Guadalajara is at index 1
    const state = withPosition(makeGameState(), 0);
    const next = gameReducer(state, { type: "ROLL_DICE", dice: dice(1, 0) }); // can't do 0 die
    // Use real die: move to 1 (Guadalajara)
    const s2 = withPosition(makeGameState(), 0);
    const n2 = gameReducer(s2, { type: "ROLL_DICE", dice: { die1: 1, die2: 0, total: 1, isDouble: false } });
    // die2=0 is invalid but let's use 1,0 total=1 for test purposes
    // Actually dice values should be 1-6. Use position 37 to land on 38 instead.
    // Let's use position 0 and roll to Guadalajara at 1
    const s3 = withPosition(makeGameState(), 38);
    const n3 = gameReducer(s3, { type: "ROLL_DICE", dice: { die1: 3, die2: 0, total: 3, isDouble: false } });
    // 38+3 passes GO → position 1 (Guadalajara)
    expect(n3.phase).toBe("awaitingPurchaseDecision");
    expect(n3.landingAction?.kind).toBe("purchaseDecision");
  });

  it("buying property deducts price and assigns owner", () => {
    const state = withPosition(makeGameState(), 38);
    // Roll to Guadalajara (pos 1), passing GO
    const rolled = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 3, die2: 0, total: 3, isDouble: false } });
    expect(rolled.phase).toBe("awaitingPurchaseDecision");
    const player = currentPlayer(rolled);
    const cashBefore = player.cash; // includes $200 GO salary

    const bought = gameReducer(rolled, { type: "BUY_PROPERTY" });
    const playerAfter = currentPlayer(bought);
    expect(playerAfter.cash).toBe(cashBefore - 60); // Guadalajara costs $60
    expect(playerAfter.ownedCityIds).toContain(1);
    // ownership updated
    const ownership = bought.ownerships.find((o) => o.spaceIndex === 1);
    expect(ownership?.ownerId).toBe(player.id);
  });

  it("declining purchase starts auction", () => {
    const state = withPosition(makeGameState(), 38);
    const rolled = gameReducer(state, { type: "ROLL_DICE", dice: { die1: 3, die2: 0, total: 3, isDouble: false } });
    const declined = gameReducer(rolled, { type: "DECLINE_PROPERTY" });
    expect(declined.phase).toBe("auction");
    expect(declined.auction).not.toBeNull();
  });

  it("landing on own property charges no rent", () => {
    const state = makeGameState();
    const playerId = currentPlayer(state).id;
    // Give player Guadalajara (index 1)
    const s2 = withOwnership(withPosition(state, 38), 1, playerId);
    const cashBefore = currentPlayer(s2).cash;
    const next = gameReducer(s2, { type: "ROLL_DICE", dice: { die1: 3, die2: 0, total: 3, isDouble: false } });
    // Passes GO (+200), no rent
    expect(currentPlayer(next).cash).toBe(cashBefore + 200);
    expect(next.landingAction?.kind).toBe("message");
  });
});

describe("END_TURN", () => {
  it("advances to next player", () => {
    const state = makeGameState(2);
    // Roll to Jail/Just Visiting (non-ownable) so turn completes
    const rolled = gameReducer(withPosition(state, 5), { type: "ROLL_DICE", dice: dice(2, 3) });
    expect(rolled.phase).toBe("turnComplete");
    const ended = gameReducer(rolled, { type: "END_TURN" });
    expect(ended.currentPlayerIndex).toBe(1);
    expect(ended.phase).toBe("readyToRoll");
  });

  it("resets dice state on new turn", () => {
    const state = makeGameState(2);
    const rolled = gameReducer(withPosition(state, 5), { type: "ROLL_DICE", dice: dice(2, 3) });
    const ended = gameReducer(rolled, { type: "END_TURN" });
    expect(ended.diceRoll).toBeNull();
    expect(ended.currentPlayerHasRolled).toBe(false);
    expect(ended.doublesCount).toBe(0);
  });

  it("END_TURN is ignored when phase is not turnComplete", () => {
    const state = makeGameState(2);
    expect(state.phase).toBe("readyToRoll");
    const after = gameReducer(state, { type: "END_TURN" });
    expect(after.currentPlayerIndex).toBe(0); // unchanged
  });

  it("skips bankrupt players in turn order", () => {
    const state = makeGameState(3);
    // Bankrupt player 1
    const withBankrupt = {
      ...state,
      players: state.players.map((p, i) => (i === 1 ? { ...p, isBankrupt: true } : p)),
    };
    const rolled = gameReducer(withPosition(withBankrupt, 5), { type: "ROLL_DICE", dice: dice(2, 3) });
    const ended = gameReducer(rolled, { type: "END_TURN" });
    expect(ended.currentPlayerIndex).toBe(2); // skipped bankrupt player 1
  });
});
