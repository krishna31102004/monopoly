import { afterEach, describe, expect, it, vi } from "vitest";
import { gameReducer } from "@/lib/game/gameReducer";
import {
  HIDDEN_AUCTION_BID_MS,
  HIDDEN_AUCTION_REVEAL_MS,
  getHiddenAuctionLandingPresentationMs,
  getHiddenAuctionRevealStep,
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

  it("starts the authoritative 20-second bid window only after the landing presentation", () => {
    vi.spyOn(Date, "now").mockReturnValue(START);
    const state = gameAtFirstProperty("hidden-auction");
    const auction = state.hiddenAuction!;
    expect(auction.bidStartedAt).toBe(START + getHiddenAuctionLandingPresentationMs(3));
    expect(auction.bidDeadlineAt - auction.bidStartedAt).toBe(HIDDEN_AUCTION_BID_MS);

    const beforeStart = gameReducer(state, { type: "SUBMIT_HIDDEN_BID", actorPlayerId: state.players[0].id, amount: 10 });
    expect(beforeStart).toBe(state);
    vi.spyOn(Date, "now").mockReturnValue(auction.bidStartedAt);
    expect(gameReducer(state, { type: "SUBMIT_HIDDEN_BID", actorPlayerId: state.players[0].id, amount: 10 }).hiddenAuctionLocalBids).toEqual({ [state.players[0].id]: 10 });
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

  it("settles once, deducts exactly the winning sealed bid, and starts a 3-2-1 reveal followed by a result state", () => {
    const state = hiddenState(3);
    const winner = state.players[1];
    const result = settleHiddenAuction(
      state,
      { [state.players[0].id]: 100, [winner.id]: 247, [state.players[2].id]: 200 },
      START + HIDDEN_AUCTION_BID_MS,
    );
    expect(result.hiddenAuction?.result).toEqual({ kind: "winner", winnerId: winner.id, winningBid: 247 });
    expect(result.hiddenAuction?.revealDeadlineAt).toBe(START + HIDDEN_AUCTION_BID_MS + HIDDEN_AUCTION_REVEAL_MS);
    expect(result.players.find((player) => player.id === winner.id)?.cash).toBe(winner.cash - 247);
    expect(result.ownerships.find((ownership) => ownership.spaceIndex === 1)?.ownerId).toBe(winner.id);
    expect(result.hiddenAuctionLocalBids).toBeUndefined();
    expect(settleHiddenAuction(result, { [winner.id]: 247 }, START + HIDDEN_AUCTION_BID_MS + 1)).toBe(result);
  });

  it("uses 20 seconds for every sealed round and never renders a zero reveal step", () => {
    const state = hiddenState(2);
    expect(state.hiddenAuction?.bidDeadlineAt).toBe(START + HIDDEN_AUCTION_BID_MS);
    const tied = settleHiddenAuction(state, { [state.players[0].id]: 100, [state.players[1].id]: 100 }, START + HIDDEN_AUCTION_BID_MS);
    const tieBreak = completeHiddenAuctionReveal(tied, tied.hiddenAuction!.revealDeadlineAt!);
    expect(tieBreak.hiddenAuction?.bidDeadlineAt).toBe(tieBreak.hiddenAuction!.bidStartedAt + HIDDEN_AUCTION_BID_MS);

    const deadline = tied.hiddenAuction!.revealDeadlineAt!;
    expect(getHiddenAuctionRevealStep(deadline, deadline - 4_000)).toBe(3);
    expect(getHiddenAuctionRevealStep(deadline, deadline - 3_000)).toBe(2);
    expect(getHiddenAuctionRevealStep(deadline, deadline - 2_000)).toBe(1);
    expect(getHiddenAuctionRevealStep(deadline, deadline - 1_000)).toBeNull();
    expect(getHiddenAuctionRevealStep(deadline, deadline)).toBeNull();
  });

  it("leaves the property unowned for zero/no bids and starts a fresh tie-break without settlement", () => {
    const state = hiddenState(2);
    const noBid = settleHiddenAuction(state, { [state.players[0].id]: 0 }, START + HIDDEN_AUCTION_BID_MS);
    expect(noBid.hiddenAuction?.result).toEqual({ kind: "no-bid", winnerId: null, winningBid: 0 });
    expect(noBid.ownerships.find((ownership) => ownership.spaceIndex === 1)?.ownerId).toBeNull();

    const tied = settleHiddenAuction(state, { [state.players[0].id]: 200, [state.players[1].id]: 200 }, START + HIDDEN_AUCTION_BID_MS);
    expect(tied.hiddenAuction?.result).toEqual({ kind: "tie", winnerId: null, winningBid: 200, tiedPlayerIds: [state.players[0].id, state.players[1].id] });
    expect(tied.ownerships.find((ownership) => ownership.spaceIndex === 1)?.ownerId).toBeNull();
    expect(tied.players.map((player) => player.cash)).toEqual(state.players.map((player) => player.cash));

    const tieBreak = completeHiddenAuctionReveal(tied, START + HIDDEN_AUCTION_BID_MS + HIDDEN_AUCTION_REVEAL_MS);
    expect(tieBreak.hiddenAuction).toMatchObject({ status: "bidding", round: 2, eligiblePlayerIds: [state.players[0].id, state.players[1].id] });
    expect(tieBreak.hiddenAuction?.bidDeadlineAt).toBe(START + HIDDEN_AUCTION_BID_MS + HIDDEN_AUCTION_REVEAL_MS + HIDDEN_AUCTION_BID_MS);
  });

  it("keeps only the tied players eligible through repeated tie-breaks and charges the fresh winning bid", () => {
    const state = hiddenState(3);
    const firstTie = settleHiddenAuction(state, { [state.players[0].id]: 250, [state.players[1].id]: 250, [state.players[2].id]: 180 }, START + HIDDEN_AUCTION_BID_MS);
    const firstTieBreak = completeHiddenAuctionReveal(firstTie, START + HIDDEN_AUCTION_BID_MS + HIDDEN_AUCTION_REVEAL_MS);
    expect(gameReducer(firstTieBreak, { type: "SUBMIT_HIDDEN_BID", actorPlayerId: state.players[2].id, amount: 500 })).toBe(firstTieBreak);

    const secondTie = settleHiddenAuction(firstTieBreak, { [state.players[0].id]: 300, [state.players[1].id]: 300 }, firstTieBreak.hiddenAuction!.bidDeadlineAt);
    const secondTieBreak = completeHiddenAuctionReveal(secondTie, secondTie.hiddenAuction!.revealDeadlineAt!);
    const final = settleHiddenAuction(secondTieBreak, { [state.players[0].id]: 325, [state.players[1].id]: 340 }, secondTieBreak.hiddenAuction!.bidDeadlineAt);
    expect(final.hiddenAuction?.result).toEqual({ kind: "winner", winnerId: state.players[1].id, winningBid: 340 });
    expect(final.players[1].cash).toBe(state.players[1].cash - 340);
  });

  it("leaves the property unowned when every tied player submits no bid in the tie-break", () => {
    const state = hiddenState(2);
    const tied = settleHiddenAuction(state, { [state.players[0].id]: 200, [state.players[1].id]: 200 }, START + HIDDEN_AUCTION_BID_MS);
    const tieBreak = completeHiddenAuctionReveal(tied, tied.hiddenAuction!.revealDeadlineAt!);
    const noBid = settleHiddenAuction(tieBreak, { [state.players[0].id]: 0, [state.players[1].id]: 0 }, tieBreak.hiddenAuction!.bidDeadlineAt);
    expect(noBid.hiddenAuction?.result).toEqual({ kind: "no-bid", winnerId: null, winningBid: 0 });
    expect(noBid.ownerships.find((ownership) => ownership.spaceIndex === 1)?.ownerId).toBeNull();
  });

  it("runs queued bankruptcy properties one sealed auction at a time", () => {
    const settled = settleHiddenAuction(
      { ...hiddenState(2), forfeitAuctionQueue: [3] },
      {},
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
    const settled = settleHiddenAuction(withBankruptAuctioneer, {}, START + HIDDEN_AUCTION_BID_MS);
    const complete = completeHiddenAuctionReveal(settled);
    expect(complete.hiddenAuction).toBeNull();
    expect(complete.currentPlayerIndex).toBe(1);
    expect(complete.phase).toBe("readyToRoll");
  });
});

function createHiddenAuctionRoom(includeCara = false) {
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
  const cara = includeCara
    ? manager.joinRoom(
      { roomCode: room.roomCode, displayName: "Cara", token: "ship", tokenLabel: "SHIP", color: "#16a34a" },
      "socket-cara",
    )
    : null;
  if (cara && !cara.ok) throw new Error("Cara failed to join");
  const started = manager.startGame(room.roomCode, aliceId, {
    ...makeGameState().rules,
    gameMode: "hidden-auction",
  });
  if (!started.ok) throw new Error("Game failed to start");
  const raw = manager.getRawRoom(room.roomCode)!;
  raw.gameState = startHiddenPropertyAuction(started.value.gameState, 1, "Hidden auction started for Guadalajara.", START);
  return { manager, roomCode: room.roomCode, aliceId, bobId: join.value.playerId, caraId: cara?.ok ? cara.value.playerId : null };
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

  it("server authority rejects a bid before the scheduled actionable start", () => {
    const { manager, roomCode, aliceId } = createHiddenAuctionRoom();
    const raw = manager.getRawRoom(roomCode)!;
    raw.gameState = startHiddenPropertyAuction(raw.gameState!, 1, "Hidden auction preparing.", START, { startDelayMs: 2_500 });
    const auction = manager.getGameState(roomCode)!.hiddenAuction!;
    expect(auction.bidStartedAt).toBe(START + 2_500);
    expect(auction.bidDeadlineAt - auction.bidStartedAt).toBe(HIDDEN_AUCTION_BID_MS);
    expect(manager.submitHiddenBid(roomCode, aliceId, 50, auction.bidStartedAt - 1).ok).toBe(false);
    expect(manager.submitHiddenBid(roomCode, aliceId, 50, auction.bidStartedAt).ok).toBe(true);
  });

  it("rejects late bids, settles exactly once on the server, and preserves the reconnect deadline", () => {
    const { manager, roomCode, aliceId, bobId } = createHiddenAuctionRoom();
    const auction = manager.getGameState(roomCode)!.hiddenAuction!;
    expect(manager.submitHiddenBid(roomCode, aliceId, 125, START + 1).ok).toBe(true);
    expect(manager.submitHiddenBid(roomCode, bobId, 225, START + 2).ok).toBe(true);
    expect(manager.joinRoom({ roomCode, playerId: bobId, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" }, "socket-bob-reconnected").ok).toBe(true);
    expect(manager.getGameState(roomCode)?.hiddenAuction?.bidDeadlineAt).toBe(auction.bidDeadlineAt);
    expect(manager.submitHiddenBid(roomCode, bobId, 300, auction.bidDeadlineAt).ok).toBe(false);

    const closed = manager.closeHiddenAuction(roomCode, auction.bidDeadlineAt, auction.bidDeadlineAt);
    expect(closed.ok).toBe(true);
    if (closed.ok) {
      expect(closed.value.hiddenAuction?.result).toMatchObject({ winnerId: bobId, winningBid: 225 });
      expect(closed.value.players.find((player) => player.id === bobId)?.cash).toBe(1275);
    }
    expect(manager.closeHiddenAuction(roomCode, auction.bidDeadlineAt, auction.bidDeadlineAt + 1).ok).toBe(false);
  });

  it("keeps tie-break bids private, advances only tied players, and preserves the fresh server deadline on reconnect", () => {
    const { manager, roomCode, aliceId, bobId, caraId } = createHiddenAuctionRoom(true);
    if (!caraId) throw new Error("Cara missing");
    const auction = manager.getGameState(roomCode)!.hiddenAuction!;
    expect(manager.submitHiddenBid(roomCode, aliceId, 250, START + 1).ok).toBe(true);
    expect(manager.submitHiddenBid(roomCode, bobId, 250, START + 1).ok).toBe(true);
    expect(manager.submitHiddenBid(roomCode, caraId, 180, START + 1).ok).toBe(true);
    const closed = manager.closeHiddenAuction(roomCode, auction.bidDeadlineAt, auction.bidDeadlineAt);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.value.hiddenAuction?.result).toEqual({ kind: "tie", winnerId: null, winningBid: 250, tiedPlayerIds: [aliceId, bobId] });
    expect(JSON.stringify(closed.value)).not.toContain("180");

    const reveal = manager.completeHiddenAuctionReveal(roomCode, closed.value.hiddenAuction!.revealDeadlineAt!, closed.value.hiddenAuction!.revealDeadlineAt!);
    expect(reveal.ok).toBe(true);
    if (!reveal.ok) return;
    const tieBreak = reveal.value.hiddenAuction!;
    expect(tieBreak).toMatchObject({ status: "bidding", round: 2, eligiblePlayerIds: [aliceId, bobId] });
    expect(manager.submitHiddenBid(roomCode, caraId, 400, tieBreak.bidStartedAt + 1).ok).toBe(false);
    expect(manager.submitHiddenBid(roomCode, aliceId, 275, tieBreak.bidStartedAt + 1).ok).toBe(true);
    expect(manager.submitHiddenBid(roomCode, bobId, 310, tieBreak.bidStartedAt + 1).ok).toBe(true);
    expect(manager.joinRoom({ roomCode, playerId: bobId, displayName: "Bob", token: "hat", tokenLabel: "HAT", color: "#2563eb" }, "socket-bob-reconnected").ok).toBe(true);
    expect(manager.getGameState(roomCode)?.hiddenAuction?.bidDeadlineAt).toBe(tieBreak.bidDeadlineAt);
    const final = manager.closeHiddenAuction(roomCode, tieBreak.bidDeadlineAt, tieBreak.bidDeadlineAt);
    expect(final.ok).toBe(true);
    if (final.ok) {
      expect(final.value.hiddenAuction?.result).toEqual({ kind: "winner", winnerId: bobId, winningBid: 310 });
      expect(final.value.players.find((player) => player.id === bobId)?.cash).toBe(1190);
    }
  });
});
