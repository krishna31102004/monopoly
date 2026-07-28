import { getBoardSpaceByIndex } from "@/data/board";
import { DICE_RESULT_HOLD_MS, DICE_ROLL_MS, LANDING_REVEAL_DELAY_MS, TOKEN_STEP_MS } from "@/lib/animation/timing";
import { addLogEntry } from "@/lib/game/createInitialGameState";
import type { GameState, HiddenAuctionState } from "@/types/game";

export const HIDDEN_AUCTION_BID_MS = 20_000;
/** Three visible countdown steps followed by a short result presentation. */
export const HIDDEN_AUCTION_REVEAL_MS = 4_000;
export const HIDDEN_AUCTION_COUNTDOWN_MS = 3_000;
export const HIDDEN_AUCTION_RESULT_MS = HIDDEN_AUCTION_REVEAL_MS - HIDDEN_AUCTION_COUNTDOWN_MS;

/**
 * Matches the dice/movement/landing presentation gate before a landed property
 * action becomes visible. This is applied only to the first landed-property
 * round; tie-break rounds are already actionable and start immediately.
 */
export function getHiddenAuctionLandingPresentationMs(diceTotal: number): number {
  if (!Number.isInteger(diceTotal) || diceTotal <= 0) return 0;
  return DICE_ROLL_MS + DICE_RESULT_HOLD_MS + Math.max(0, diceTotal - 1) * TOKEN_STEP_MS + LANDING_REVEAL_DELAY_MS;
}

/**
 * Returns the visible countdown step, or null while the result is displayed.
 * The result state deliberately replaces (rather than displays) a zero.
 */
export function getHiddenAuctionRevealStep(revealDeadlineAt: number, now: number): 1 | 2 | 3 | null {
  const remainingMs = Math.max(0, revealDeadlineAt - now);
  if (remainingMs <= HIDDEN_AUCTION_RESULT_MS) return null;
  return Math.min(3, Math.max(1, Math.ceil((remainingMs - HIDDEN_AUCTION_RESULT_MS) / 1_000))) as 1 | 2 | 3;
}

/** Starts a sealed auction. The returned public state intentionally contains no bids. */
export function startHiddenPropertyAuction(
  state: GameState,
  spaceIndex: number,
  logMessage: string,
  now = Date.now(),
  options: { eligiblePlayerIds?: string[]; round?: number; startDelayMs?: number } = {},
): GameState {
  const eligiblePlayerIds = (options.eligiblePlayerIds ?? state.players.filter((player) => !player.isBankrupt).map((player) => player.id))
    .filter((playerId) => state.players.some((player) => player.id === playerId && !player.isBankrupt));
  const round = options.round ?? 1;
  const bidStartedAt = now + Math.max(0, options.startDelayMs ?? 0);
  const hiddenAuction: HiddenAuctionState = {
    id: `hidden-${spaceIndex}-${now}-round-${round}`,
    propertySpaceIndex: spaceIndex,
    eligiblePlayerIds,
    round,
    bidStartedAt,
    bidDeadlineAt: bidStartedAt + HIDDEN_AUCTION_BID_MS,
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
  const space = getBoardSpaceByIndex(auction.propertySpaceIndex);
  const closeLog = addLogEntry(state.gameLog, `Hidden auction bidding closed for ${space.name}.`);

  const resultAuction: HiddenAuctionState = {
    ...auction,
    status: "reveal",
    revealDeadlineAt: now + HIDDEN_AUCTION_REVEAL_MS,
    result: null,
  };

  if (highestBid === 0) {
    resultAuction.result = { kind: "no-bid", winnerId: null, winningBid: 0 };
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

  if (tied.length > 1) {
    resultAuction.result = { kind: "tie", winnerId: null, winningBid: highestBid, tiedPlayerIds: tied.map((bid) => bid.playerId) };
    const tiedNames = tied
      .map((bid) => state.players.find((player) => player.id === bid.playerId)?.name)
      .filter((name): name is string => Boolean(name))
      .join(" and ");
    const message = `${tiedNames} tied at $${highestBid} for ${space.name}. Tie-break auction next.`;
    return {
      ...state,
      hiddenAuction: resultAuction,
      hiddenAuctionLocalBids: undefined,
      landingAction: { kind: "message", spaceIndex: space.index, message },
      landingMessage: message,
      gameLog: addLogEntry(closeLog, message),
    };
  }

  const winnerBid = tied[0];
  resultAuction.result = { kind: "winner", winnerId: winnerBid.playerId, winningBid: winnerBid.amount };

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
export function completeHiddenAuctionReveal(state: GameState, now = Date.now()): GameState {
  const auction = state.hiddenAuction;
  if (state.phase !== "hiddenAuction" || !auction || auction.status !== "reveal") return state;
  if (auction.result?.kind === "tie") {
    const currentRound = auction.round ?? 1;
    return startHiddenPropertyAuction(
      { ...state, hiddenAuction: null, hiddenAuctionLocalBids: undefined },
      auction.propertySpaceIndex,
      `Tie-break hidden auction started for ${getBoardSpaceByIndex(auction.propertySpaceIndex).name}.`,
      now,
      { eligiblePlayerIds: auction.result.tiedPlayerIds, round: currentRound + 1 },
    );
  }
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
    Date.now(),
    { startDelayMs: base.currentPlayerHasRolled ? getHiddenAuctionLandingPresentationMs(base.diceRoll?.total ?? 0) : 0 },
  );
}
