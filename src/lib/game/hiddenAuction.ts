import { getBoardSpaceByIndex } from "@/data/board";
import { addLogEntry } from "@/lib/game/createInitialGameState";
import type { GameState, HiddenAuctionState } from "@/types/game";

export const HIDDEN_AUCTION_BID_MS = 20_000;
export const HIDDEN_AUCTION_REVEAL_MS = 3_000;

/** Starts a sealed auction. The returned public state intentionally contains no bids. */
export function startHiddenPropertyAuction(
  state: GameState,
  spaceIndex: number,
  logMessage: string,
  now = Date.now(),
): GameState {
  const hiddenAuction: HiddenAuctionState = {
    id: `hidden-${spaceIndex}-${now}`,
    propertySpaceIndex: spaceIndex,
    eligiblePlayerIds: state.players.filter((player) => !player.isBankrupt).map((player) => player.id),
    bidStartedAt: now,
    bidDeadlineAt: now + HIDDEN_AUCTION_BID_MS,
    status: "bidding",
    revealDeadlineAt: null,
    result: null,
  };

  return {
    ...state,
    phase: "hiddenAuction",
    auction: null,
    hiddenAuction,
    hiddenAuctionLocalBids: {},
    landingAction: { kind: "message", spaceIndex, message: logMessage },
    landingMessage: logMessage,
    gameLog: addLogEntry(state.gameLog, logMessage),
  };
}

/**
 * Settles an already-closed sealed auction. Callers supply a private bid book;
 * bids are deliberately never copied into the returned GameState.
 */
export function settleHiddenAuction(
  state: GameState,
  bids: Readonly<Record<string, number>>,
  tieBreaker: number,
  now = Date.now(),
): GameState {
  const auction = state.hiddenAuction;
  if (state.phase !== "hiddenAuction" || !auction || auction.status !== "bidding") return state;

  const validBids = auction.eligiblePlayerIds.flatMap((playerId) => {
    const player = state.players.find((candidate) => candidate.id === playerId);
    const amount = bids[playerId] ?? 0;
    return player && !player.isBankrupt && Number.isInteger(amount) && amount > 0 && amount <= player.cash
      ? [{ playerId, amount }]
      : [];
  });
  const highestBid = Math.max(0, ...validBids.map((bid) => bid.amount));
  const tied = highestBid > 0 ? validBids.filter((bid) => bid.amount === highestBid) : [];
  const winnerBid = tied.length > 0
    ? tied[Math.min(tied.length - 1, Math.floor(Math.max(0, Math.min(0.999999, tieBreaker)) * tied.length))]
    : null;
  const space = getBoardSpaceByIndex(auction.propertySpaceIndex);
  const tieResolved = tied.length > 1;
  const closeLog = addLogEntry(state.gameLog, `Hidden auction bidding closed for ${space.name}.`);

  const resultAuction: HiddenAuctionState = {
    ...auction,
    status: "reveal",
    revealDeadlineAt: now + HIDDEN_AUCTION_REVEAL_MS,
    result: {
      winnerId: winnerBid?.playerId ?? null,
      winningBid: winnerBid?.amount ?? 0,
      tieResolved,
    },
  };

  if (!winnerBid) {
    const message = `No winning bid for ${space.name}. It remains unowned.`;
    return {
      ...state,
      hiddenAuction: resultAuction,
      hiddenAuctionLocalBids: undefined,
      landingAction: { kind: "message", spaceIndex: space.index, message },
      landingMessage: message,
      gameLog: addLogEntry(closeLog, message),
    };
  }

  const winner = state.players.find((player) => player.id === winnerBid.playerId);
  if (!winner) return state;
  const message = `${winner.name} won ${space.name} in the hidden auction for $${winnerBid.amount}.`;
  return {
    ...state,
    players: state.players.map((player) => player.id !== winner.id ? player : {
      ...player,
      cash: player.cash - winnerBid.amount,
      ownedCityIds: space.kind === "city" ? [...player.ownedCityIds, space.index] : player.ownedCityIds,
      ownedAirportIds: space.kind === "airport" ? [...player.ownedAirportIds, space.index] : player.ownedAirportIds,
      ownedUtilityIds: space.kind === "utility" ? [...player.ownedUtilityIds, space.index] : player.ownedUtilityIds,
    }),
    ownerships: state.ownerships.map((ownership) => ownership.spaceIndex === space.index ? { ...ownership, ownerId: winner.id } : ownership),
    hiddenAuction: resultAuction,
    hiddenAuctionLocalBids: undefined,
    landingAction: { kind: "message", spaceIndex: space.index, message },
    landingMessage: message,
    gameLog: addLogEntry(closeLog, message),
  };
}

/** Starts the next queued forfeit auction after the prior sealed reveal completes. */
export function completeHiddenAuctionReveal(state: GameState): GameState {
  const auction = state.hiddenAuction;
  if (state.phase !== "hiddenAuction" || !auction || auction.status !== "reveal") return state;
  if (state.forfeitAuctionQueue.length > 0) {
    const [spaceIndex, ...remaining] = state.forfeitAuctionQueue;
    return startHiddenPropertyAuction({ ...state, forfeitAuctionQueue: remaining, hiddenAuction: null }, spaceIndex, `Hidden auction started for ${getBoardSpaceByIndex(spaceIndex).name}.`);
  }
  const currentPlayer = state.players[state.currentPlayerIndex];
  // A bankruptcy auction belongs to the forfeiting player. Once the final
  // reveal completes, skip that bankrupt player just as the open-auction path
  // does; there is no End Turn action left for them to take.
  if (currentPlayer?.isBankrupt) {
    let nextPlayerIndex = -1;
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const candidateIndex = (state.currentPlayerIndex + offset) % state.players.length;
      if (!state.players[candidateIndex]?.isBankrupt) {
        nextPlayerIndex = candidateIndex;
        break;
      }
    }
    const nextPlayer = state.players[nextPlayerIndex];
    if (nextPlayer) {
      return {
        ...state,
        currentPlayerIndex: nextPlayerIndex,
        phase: nextPlayer.isInJail ? "awaitingJailDecision" : "readyToRoll",
        diceRoll: null,
        currentPlayerHasRolled: false,
        doublesCount: 0,
        landingMessage: null,
        landingAction: null,
        hiddenAuction: null,
        hiddenAuctionLocalBids: undefined,
        drawnCard: null,
        forfeitAuctionQueue: [],
        turnDeadlineAt: Date.now() + 3 * 60 * 1000,
        gameLog: addLogEntry(state.gameLog, `${nextPlayer.name}'s turn begins.`),
      };
    }
  }
  const phase = state.diceRoll?.isDouble ? "readyToRoll" : "turnComplete";
  return { ...state, phase, hiddenAuction: null, hiddenAuctionLocalBids: undefined };
}

/** Applies the immediate-auction intercept exclusively to Hidden Auction mode. */
export function applyHiddenAuctionIntercept(
  base: GameState,
  resolvedPhase: string,
  spaceIndex: number | undefined,
): GameState | null {
  if (base.rules.gameMode !== "hidden-auction" || resolvedPhase !== "awaitingPurchaseDecision" || spaceIndex == null) return null;
  const currentPlayer = base.players[base.currentPlayerIndex];
  const space = getBoardSpaceByIndex(spaceIndex);
  return startHiddenPropertyAuction(
    base,
    spaceIndex,
    `${currentPlayer.name} landed on ${space.name}. Hidden auction started.`,
  );
}
