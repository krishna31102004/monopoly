import { afterEach, describe, expect, it, vi } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import {
  HIDDEN_AUCTION_BID_MS,
  HIDDEN_AUCTION_REVEAL_MS,
  completeHiddenAuctionReveal,
  settleHiddenAuction,
  startHiddenPropertyAuction,
} from "@/lib/game/hiddenAuction";
import { RoomManager } from "@/lib/multiplayer/rooms";
import type { GameRules, GameState } from "@/types/game";
import { dice, makeGameState, withPosition } from "./helpers/factory";

const START = 1_000_000;

afterEach(() => {
  vi.restoreAllMocks();
});

function hiddenState(playerCount = 3): GameState {
  const state = makeGameState(playerCount);
  return startHiddenPropertyAuction(
    { ...state, rules: { ...state.rules, gameMode: "hidden-auction" } },
    1,
    "Hidden auction started for Guadalajara.",
    START,
  );
}

function gameAtFirstProperty(mode: GameRules["gameMode"]): GameState {
  const state = {
    ...makeGameState(2),
    rules: { ...makeGameState(2).rules, gameMode: mode },
  };
  return gameReducer(withPosition(state, 38), { type: "ROLL_DICE", dice: dice(3, 0) });
}

describe("Hidden Auction mode isolation and local sealed bids", () => {
  it("leaves Normal purchase decisions and Auction mode open auctions unchanged", () => {
    expect(gameAtFirstProperty("normal").phase).toBe("awaitingPurchaseDecision");
    expect(gameAtFirstProperty("auction").phase).toBe("auction");
  });

  it("automatically starts a public bid-free Hidden Auction for an unowned property", () => {
    const state = gameAtFirstProperty("hidden-auction");
    expect(state.phase).toBe("hiddenAuction");
    expect(state.auction).toBeNull();
    expect(state.hiddenAuction).toMatchObject({ propertySpaceIndex: 1, status: "bidding" });
    expect(state.hiddenAuction?.bidDeadlineAt).toBe(state.hiddenAuction!.bidStartedAt + HIDDEN_AUCTION_BID_MS);
  });

  it("keeps the full 20-second window open while every local player submits editable bids", () => {
    vi.spyOn(Date, "now").mockReturnValue(START + HIDDEN_AUCTION_BID_MS - 1);
    let state = hiddenState(2);
    state = gameReducer(state, { type: "SUBMIT_HIDDEN_BID", actorPlayerId: state.players[0].id, amount: 40 });
    state = gameReducer(state, { type: "SUBMIT_HIDDEN_BID", actorPlayerId: state.players[1].id, amount: 50 });
    state = gameReducer(state, { type: "SUBMIT_HIDDEN_BID", actorPlayerId: state.players[0].id, amount: 60 });
    expect(state.phase).toBe("hiddenAuction");
    expect(state.hiddenAuction?.status).toBe("bidding");
    expect(state.hiddenAuctionLocalBids).toEqual({ [state.players[0].id]: 60, [state.players[1].id]: 50 });
  });

  it("rejects negative, over-cash, and post-deadline local bids", () => {
    let state = hiddenState(2);
    const bidder = state.players[0];
    vi.spyOn(Date, "now").mockReturnValue(START + 1);
    expect(gameReducer(state, { type: "SUBMIT_HIDDEN_BID", actorPlayerId: bidder.id, amount: -1 })).toBe(state);
    expect(gameReducer(state, { type: "SUBMIT_HIDDEN_BID", actorPlayerId: bidder.id, amount: bidder.cash + 1 })).toBe(state);
    vi.spyOn(Date, "now").mockReturnValue(START + HIDDEN_AUCTION_BID_MS);
    expect(gameReducer(state, { type: "SUBMIT_HIDDEN_BID", actorPlayerId: bidder.id, amount: 10 })).toBe(state);
  });

  it("settles once, deducts exactly the winning sealed bid, and starts a 3-second reveal", () => {
    const state = hiddenState(3);
    const winner = state.players[1];
    const result = settleHiddenAuction(
      state,
      { [state.players[0].id]: 100, [winner.id]: 247, [state.players[2].id]: 200 },
      0,
      START + HIDDEN_AUCTION_BID_MS,
    );
    expect(result.hiddenAuction?.result).toEqual({ winnerId: winner.id, winningBid: 247, tieResolved: false });
    expect(result.hiddenAuction?.revealDeadlineAt).toBe(START + HIDDEN_AUCTION_BID_MS + HIDDEN_AUCTION_REVEAL_MS);
    expect(result.players.find((player) => player.id === winner.id)?.cash).toBe(winner.cash - 247);
    expect(result.ownerships.find((ownership) => ownership.spaceIndex === 1)?.ownerId).toBe(winner.id);
    expect(result.hiddenAuctionLocalBids).toBeUndefined();
    expect(settleHiddenAuction(result, { [winner.id]: 247 }, 0, START + HIDDEN_AUCTION_BID_MS + 1)).toBe(result);
  });

  it("leaves the property unowned for zero/no bids and chooses tied high bids only from server-supplied randomness", () => {
    const state = hiddenState(2);
    const noBid = settleHiddenAuction(state, { [state.players[0].id]: 0 }, 0, START + HIDDEN_AUCTION_BID_MS);
    expect(noBid.hiddenAuction?.result).toEqual({ winnerId: null, winningBid: 0, tieResolved: false });
    expect(noBid.ownerships.find((ownership) => ownership.spaceIndex === 1)?.ownerId).toBeNull();

    const firstWinner = settleHiddenAuction(state, { [state.players[0].id]: 200, [state.players[1].id]: 200 }, 0, START + HIDDEN_AUCTION_BID_MS);
    const secondWinner = settleHiddenAuction(state, { [state.players[0].id]: 200, [state.players[1].id]: 200 }, 0.99, START + HIDDEN_AUCTION_BID_MS);
    expect(firstWinner.hiddenAuction?.result).toMatchObject({ winnerId: state.players[0].id, winningBid: 200, tieResolved: true });
    expect(secondWinner.hiddenAuction?.result).toMatchObject({ winnerId: state.players[1].id, winningBid: 200, tieResolved: true });
  });

  it("runs queued bankruptcy properties one sealed auction at a time", () => {
    const settled = settleHiddenAuction(
      { ...hiddenState(2), forfeitAuctionQueue: [3] },
      {},
      0,
      START + HIDDEN_AUCTION_BID_MS,
    );
    const next = completeHiddenAuctionReveal(settled);
    expect(next.phase).toBe("hiddenAuction");
    expect(next.hiddenAuction).toMatchObject({ propertySpaceIndex: 3, status: "bidding" });
    expect(next.forfeitAuctionQueue).toEqual([]);
  });

  it("returns to the next active player after the final bankruptcy-auction reveal", () => {
    const starting = hiddenState(3);
    const withBankruptAuctioneer = {
      ...starting,
      players: starting.players.map((player, index) => index === 0 ? { ...player, isBankrupt: true } : player),
    };
    const settled = settleHiddenAuction(withBankruptAuctioneer, {}, 0, START + HIDDEN_AUCTION_BID_MS);
    const complete = completeHiddenAuctionReveal(settled);
    expect(complete.hiddenAuction).toBeNull();
    expect(complete.currentPlayerIndex).toBe(1);
    expect(complete.phase).toBe("readyToRoll");
  });
});

function createHiddenAuctionRoom() {
  const manager = new RoomManager();
  const { room, playerId: aliceId } = manager.createRoom(
    { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
    "socket-alice",
  );
  const join = manager.joinRoom(
    { roomCode: room.roomCode, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" },
    "socket-bob",
  );
  if (!join.ok) throw new Error("Bob failed to join");
  const started = manager.startGame(room.roomCode, aliceId, {
    ...makeGameState().rules,
    gameMode: "hidden-auction",
  });
  if (!started.ok) throw new Error("Game failed to start");
  const raw = manager.getRawRoom(room.roomCode)!;
  raw.gameState = startHiddenPropertyAuction(started.value.gameState, 1, "Hidden auction started for Guadalajara.", START);
  return { manager, roomCode: room.roomCode, aliceId, bobId: join.value.playerId };
}

describe("Hidden Auction multiplayer privacy and authority", () => {
  it("strips the local bid map before broadcasting a server-started auction", () => {
    const { manager, roomCode } = createHiddenAuctionRoom();
    const raw = manager.getRawRoom(roomCode)!;
    const currentPlayerId = raw.gameState!.players[raw.gameState!.currentPlayerIndex].id;
    raw.gameState = {
      ...raw.gameState!,
      players: raw.gameState!.players.map((player) =>
        player.id === currentPlayerId ? { ...player, position: 38 } : player,
      ),
    };

    const result = manager.applyGameAction(
      roomCode,
      currentPlayerId,
      { type: "ROLL_DICE" },
      { die1: 3, die2: 0, total: 3, isDouble: false },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.hiddenAuction?.status).toBe("bidding");
      expect(result.value.hiddenAuctionLocalBids).toBeUndefined();
    }
  });

  it("keeps each latest bid in the private room book and only restores it to its owner", () => {
    const { manager, roomCode, aliceId, bobId } = createHiddenAuctionRoom();
    expect(manager.submitHiddenBid(roomCode, aliceId, 125, START + 1).ok).toBe(true);
    expect(manager.submitHiddenBid(roomCode, bobId, 225, START + 2).ok).toBe(true);
    expect(manager.submitHiddenBid(roomCode, aliceId, 175, START + 3).ok).toBe(true);

    const publicState = manager.getGameState(roomCode)!;
    expect(publicState.hiddenAuctionLocalBids).toBeUndefined();
    expect(JSON.stringify(publicState)).not.toContain("225");
    expect(manager.getHiddenAuctionOwnBid(roomCode, aliceId)).toEqual({ auctionId: publicState.hiddenAuction!.id, amount: 175 });
    expect(manager.getHiddenAuctionOwnBid(roomCode, bobId)).toEqual({ auctionId: publicState.hiddenAuction!.id, amount: 225 });
  });

  it("rejects late bids, settles exactly once on the server, and preserves the reconnect deadline", () => {
    const { manager, roomCode, aliceId, bobId } = createHiddenAuctionRoom();
    const auction = manager.getGameState(roomCode)!.hiddenAuction!;
    expect(manager.submitHiddenBid(roomCode, aliceId, 125, START + 1).ok).toBe(true);
    expect(manager.submitHiddenBid(roomCode, bobId, 225, START + 2).ok).toBe(true);
    expect(manager.joinRoom({ roomCode, playerId: bobId, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" }, "socket-bob-reconnected").ok).toBe(true);
    expect(manager.getGameState(roomCode)?.hiddenAuction?.bidDeadlineAt).toBe(auction.bidDeadlineAt);
    expect(manager.submitHiddenBid(roomCode, bobId, 300, auction.bidDeadlineAt).ok).toBe(false);

    const closed = manager.closeHiddenAuction(roomCode, auction.bidDeadlineAt, 0, auction.bidDeadlineAt);
    expect(closed.ok).toBe(true);
    if (closed.ok) {
      expect(closed.value.hiddenAuction?.result).toMatchObject({ winnerId: bobId, winningBid: 225 });
      expect(closed.value.players.find((player) => player.id === bobId)?.cash).toBe(1275);
    }
    expect(manager.closeHiddenAuction(roomCode, auction.bidDeadlineAt, 0, auction.bidDeadlineAt + 1).ok).toBe(false);
  });
});
