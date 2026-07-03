import { boardSpaces, getBoardSpaceByIndex } from "@/data/board";
import type { OwnableSpace } from "@/types/board";
import { addLogEntry, createInitialGameState, createSetupGameState } from "@/lib/game/createInitialGameState";
import { resolveLanding } from "@/lib/game/landing";
import type { DebtPending } from "@/lib/game/landing";
import { moveAroundBoard } from "@/lib/game/movement";
import { getOwnership, isOwnableSpace } from "@/lib/game/ownership";
import { drawAndApplyCard } from "@/lib/game/cards";
import { checkBankruptcy } from "@/lib/game/bankruptcy";
import {
  canBuyHouse,
  canSellHouse,
  canBuyHotel,
  canSellHotel,
  canMortgageProperty,
  canUnmortgageProperty,
} from "@/lib/game/propertyDevelopment";
import { validateTrade } from "@/lib/game/trade";
import { AUCTION_TURN_MS } from "@/lib/animation/timing";
import { getGoAward, getGoAwardLogMessage } from "@/lib/game/goSalary";
import { startPropertyAuction, applyAuctionGameIntercept } from "@/lib/game/auctionHelpers";
import type { AuctionState, BankruptcyCreditor, GameAction, GamePhase, GameState, LandingAction } from "@/types/game";

const AUCTION_STARTING_BID = 10;
const AUCTION_INCREMENTS = [1, 10, 100];

/** Valid next bid: exactly $10 to open, or currentBid + 1/10/100 thereafter. */
function isValidBidAmount(currentBid: number, amount: number): boolean {
  if (currentBid === 0) return amount === AUCTION_STARTING_BID;
  return AUCTION_INCREMENTS.some((inc) => amount === currentBid + inc);
}

function creditorFromLandingAction(action: LandingAction | null): BankruptcyCreditor {
  if (action?.kind === "rentPayment") {
    return { type: "player", playerId: action.ownerId };
  }
  return { type: "bank" };
}

function applyVoluntaryBankruptcy(state: GameState, forfeiter: import("@/types/player").Player): GameState {
  const allProps = [
    ...forfeiter.ownedCityIds,
    ...forfeiter.ownedAirportIds,
    ...forfeiter.ownedUtilityIds,
  ];

  // Count improvements on forfeiter's properties to restore bank supply
  let housesReturned = 0;
  let hotelsReturned = 0;
  for (const spaceIndex of allProps) {
    const o = state.ownerships.find((o) => o.spaceIndex === spaceIndex);
    if (o) {
      housesReturned += o.houses;
      if (o.hasHotel) hotelsReturned += 1;
    }
  }

  let nextChanceDeck = state.chanceDeck;
  for (let i = 0; i < forfeiter.getOutOfJailFreeCards; i++) {
    nextChanceDeck = [...nextChanceDeck, "chance-8"];
  }

  const nextPlayers = state.players.map((p) =>
    p.id !== forfeiter.id
      ? p
      : { ...p, cash: 0, isBankrupt: true, getOutOfJailFreeCards: 0, ownedCityIds: [], ownedAirportIds: [], ownedUtilityIds: [] },
  );

  const nextOwnerships = state.ownerships.map((o) =>
    allProps.includes(o.spaceIndex)
      ? { ...o, ownerId: null, isMortgaged: false, houses: 0, hasHotel: false }
      : o,
  );

  const msg = `${forfeiter.name} declared bankruptcy. Their properties will be auctioned.`;
  const stateAfterForfeit: GameState = {
    ...state,
    players: nextPlayers,
    ownerships: nextOwnerships,
    chanceDeck: nextChanceDeck,
    trade: null,
    bankruptcy: null,
    bankHouses: Math.min(32, state.bankHouses + housesReturned),
    bankHotels: Math.min(12, state.bankHotels + hotelsReturned),
    gameLog: addLogEntry(state.gameLog, msg),
  };

  const activePlayers = stateAfterForfeit.players.filter((p) => !p.isBankrupt);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    return {
      ...stateAfterForfeit,
      phase: "gameOver",
      winnerId: winner.id,
      forfeitAuctionQueue: [],
      gameLog: addLogEntry(stateAfterForfeit.gameLog, `${winner.name} wins the game!`),
    };
  }

  if (allProps.length > 0) {
    return startForfeitAuction(stateAfterForfeit, allProps);
  }
  return withNextTurn(stateAfterForfeit);
}

function startForfeitAuction(state: GameState, queue: number[]): GameState {
  const [spaceIndex, ...remaining] = queue;
  const activePlayers = state.players.filter((p) => !p.isBankrupt);
  const now = Date.now();
  const auctionState: AuctionState = {
    propertySpaceIndex: spaceIndex,
    activePlayerIds: activePlayers.map((p) => p.id),
    passedPlayerIds: [],
    currentBid: 0,
    highestBidderId: null,
    currentBidderIndex: 0,
    turnStartedAt: now,
    turnDeadlineAt: now + AUCTION_TURN_MS,
    status: "active",
  };
  return {
    ...state,
    phase: "auction",
    auction: auctionState,
    forfeitAuctionQueue: remaining,
  };
}

function resolveAuctionWin(
  state: GameState,
  auction: AuctionState,
  log: import("@/types/game").GameLogEntry[],
): GameState {
  const winner = state.players.find((p) => p.id === auction.highestBidderId);
  if (!winner) return state;

  const space = getBoardSpaceByIndex(auction.propertySpaceIndex);
  const winMessage = `${winner.name} won ${space.name} at auction for $${auction.currentBid}.`;
  const nextLog = addLogEntry(log, winMessage);

  const nextPlayers = state.players.map((player) => {
    if (player.id !== winner.id) return player;
    return {
      ...player,
      cash: player.cash - auction.currentBid,
      ownedCityIds:
        space.kind === "city" ? [...player.ownedCityIds, space.index] : player.ownedCityIds,
      ownedAirportIds:
        space.kind === "airport"
          ? [...player.ownedAirportIds, space.index]
          : player.ownedAirportIds,
      ownedUtilityIds:
        space.kind === "utility"
          ? [...player.ownedUtilityIds, space.index]
          : player.ownedUtilityIds,
    };
  });
  const nextOwnerships = state.ownerships.map((item) =>
    item.spaceIndex === auction.propertySpaceIndex ? { ...item, ownerId: winner.id } : item,
  );
  const stateAfterWin = {
    ...state,
    players: nextPlayers,
    ownerships: nextOwnerships,
    auction: null,
    landingMessage: winMessage,
    landingAction: { kind: "message" as const, spaceIndex: auction.propertySpaceIndex, message: winMessage },
    gameLog: nextLog,
  };

  // Drain forfeit auction queue before returning to normal flow
  if (stateAfterWin.forfeitAuctionQueue.length > 0) {
    return startForfeitAuction(stateAfterWin, stateAfterWin.forfeitAuctionQueue);
  }

  // If current player is bankrupt (forfeit path), advance to next turn instead of turnComplete
  if (stateAfterWin.players[stateAfterWin.currentPlayerIndex]?.isBankrupt) {
    return withNextTurn(stateAfterWin);
  }

  const phaseAfter = state.diceRoll?.isDouble ? "readyToRoll" : "turnComplete";
  return checkBankruptcy({ ...stateAfterWin, phase: phaseAfter }, { type: "bank" });
}

function getNextActivePlayerIndex(state: GameState) {
  const playerCount = state.players.length;
  for (let offset = 1; offset <= playerCount; offset += 1) {
    const candidateIndex = (state.currentPlayerIndex + offset) % playerCount;
    if (!state.players[candidateIndex].isBankrupt) {
      return candidateIndex;
    }
  }
  return state.currentPlayerIndex;
}

const TURN_LIMIT_MS = 3 * 60 * 1000; // 3 minutes

function withNextTurn(state: GameState, logMessage?: string): GameState {
  const nextPlayerIndex = getNextActivePlayerIndex(state);
  const nextPlayer = state.players[nextPlayerIndex];
  const nextLog = logMessage ? addLogEntry(state.gameLog, logMessage) : state.gameLog;
  const nextPhase = nextPlayer.isInJail ? "awaitingJailDecision" : "readyToRoll";

  return {
    ...state,
    currentPlayerIndex: nextPlayerIndex,
    phase: nextPhase,
    diceRoll: null,
    currentPlayerHasRolled: false,
    doublesCount: 0,
    landingMessage: null,
    landingAction: null,
    auction: null,
    drawnCard: null,
    forfeitAuctionQueue: [],
    turnDeadlineAt: Date.now() + TURN_LIMIT_MS,
    gameLog: addLogEntry(nextLog, `${nextPlayer.name}'s turn begins.`),
  };
}

function phaseAfterPurchaseDecision(state: GameState) {
  return state.diceRoll?.isDouble ? "readyToRoll" : "turnComplete";
}

/** Cap-aware helper for updating the Free Parking pot. Negative deltas (collections) apply directly; positive additions are capped at $500 in Auction Game. */
function addToFreeParkingPot(state: GameState, delta: number): number {
  if (delta === 0) return state.freeParkingPot;
  // Negative delta = player is collecting the pot — always apply directly
  if (delta < 0) return state.freeParkingPot + delta;
  // Positive delta = money being added to pot
  if (state.rules.gameMode === "auction") {
    return Math.min(500, state.freeParkingPot + delta);
  }
  return state.freeParkingPot + delta;
}

function applyLandingResolution(
  base: GameState,
  resolution: ReturnType<typeof resolveLanding>,
  landedSpaceKind: string,
  rolledDouble: boolean,
): GameState {
  const potDelta = resolution.freeParkingPotDelta ?? 0;
  let finalState: GameState = {
    ...base,
    players: resolution.players,
    phase: resolution.phase,
    doublesCount: resolution.doublesCount,
    landingMessage: resolution.landingMessage,
    landingAction: resolution.landingAction,
    gameLog: resolution.gameLog,
    freeParkingPot: addToFreeParkingPot(base, potDelta),
  };

  // Auction Game: immediately start auction when landing on unowned ownable property
  const spaceIndex = resolution.landingAction?.kind === "purchaseDecision"
    ? resolution.landingAction.spaceIndex
    : undefined;
  const auctionIntercepted = applyAuctionGameIntercept(
    { ...base, players: resolution.players, gameLog: resolution.gameLog, doublesCount: resolution.doublesCount },
    resolution.phase,
    spaceIndex,
  );
  if (auctionIntercepted) return auctionIntercepted;

  if (landedSpaceKind === "chance") {
    finalState = drawAndApplyCard(finalState, "chance", rolledDouble);
  } else if (landedSpaceKind === "community-chest") {
    finalState = drawAndApplyCard(finalState, "community-chest", rolledDouble);
  }

  // No-negative-cash rule: if the landing produced a debt the player couldn't
  // pay, enter bankruptcyPending directly without calling checkBankruptcy (which
  // would find no negative cash and do nothing).
  if (resolution.debtPending) {
    return enterDebtPending(finalState, resolution.debtPending);
  }

  return checkBankruptcy(finalState, creditorFromLandingAction(finalState.landingAction));
}

/**
 * Enter bankruptcyPending state due to an unaffordable mandatory payment.
 * Cash is NOT modified — it stays at its current (non-negative) value.
 */
function enterDebtPending(state: GameState, debt: DebtPending): GameState {
  const log = addLogEntry(
    state.gameLog,
    `Debt pending: must pay $${debt.amountOwed}. Sell assets or declare bankruptcy.`,
  );
  const currentPlayer = state.players[state.currentPlayerIndex];
  return {
    ...state,
    phase: "bankruptcyPending",
    gameLog: log,
    bankruptcy: {
      debtorPlayerId: currentPlayer.id,
      creditor: debt.creditor,
      amountOwed: debt.amountOwed,
      reason: debt.reason,
      status: "pending",
      phaseBeforeBankruptcy: state.phase,
    },
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_GAME":
      return createInitialGameState(action.players, action.rules);

    case "ROLL_DICE": {
      if (state.phase !== "readyToRoll") return state;

      const currentPlayer = state.players[state.currentPlayerIndex];
      const nextDoublesCount = action.dice.isDouble ? state.doublesCount + 1 : 0;
      let nextLog = addLogEntry(
        state.gameLog,
        `${currentPlayer.name} rolled ${action.dice.die1} and ${action.dice.die2} for ${action.dice.total}${action.dice.isDouble ? " (doubles)" : ""}.`,
      );

      if (nextDoublesCount >= 3) {
        const jailedPlayers = state.players.map((player, index) =>
          index === state.currentPlayerIndex
            ? { ...player, position: 10, isInJail: true, jailTurns: 0 }
            : player,
        );
        nextLog = addLogEntry(
          nextLog,
          `${currentPlayer.name} rolled three doubles in a row and went to Jail.`,
        );
        return withNextTurn(
          {
            ...state,
            players: jailedPlayers,
            phase: "turnComplete",
            diceRoll: action.dice,
            currentPlayerHasRolled: true,
            doublesCount: 0,
            landingMessage: "Landed on Jail / Just Visiting",
            landingAction: {
              kind: "message",
              spaceIndex: 10,
              message: `${currentPlayer.name} rolled three doubles in a row and went to Jail.`,
            },
            gameLog: nextLog,
          },
          `${currentPlayer.name}'s turn ended.`,
        );
      }

      const movement = moveAroundBoard(currentPlayer.position, action.dice.total);
      const landedSpace = getBoardSpaceByIndex(movement.to);
      const landedOnGo = movement.to === 0;
      const goAward = getGoAward(movement.passedGo, landedOnGo, state.rules);
      const movedPlayers = state.players.map((player, index) => {
        if (index !== state.currentPlayerIndex) return player;
        return {
          ...player,
          position: movement.to,
          cash: player.cash + goAward,
        };
      });

      nextLog = addLogEntry(
        nextLog,
        `${currentPlayer.name} moved from ${getBoardSpaceByIndex(movement.from).name} to ${landedSpace.name}.`,
      );
      const goMsg = getGoAwardLogMessage(currentPlayer.name, movement.passedGo, landedOnGo, state.rules);
      if (goMsg) {
        nextLog = addLogEntry(nextLog, goMsg);
      }

      const stateAfterMovement: GameState = {
        ...state,
        players: movedPlayers,
        diceRoll: action.dice,
        currentPlayerHasRolled: true,
        doublesCount: nextDoublesCount,
        landingMessage: `Landed on ${landedSpace.name}`,
        landingAction: null,
        gameLog: nextLog,
        drawnCard: null,
      };

      const landingResolution = resolveLanding(stateAfterMovement, landedSpace, action.dice.isDouble);
      return applyLandingResolution(stateAfterMovement, landingResolution, landedSpace.kind, action.dice.isDouble);
    }

    case "PAY_JAIL_FEE": {
      if (state.phase !== "awaitingJailDecision") return state;
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (!currentPlayer.isInJail) return state;
      // No-negative-cash rule: block payment if player can't afford it
      if (currentPlayer.cash < 50) return state;

      const newCash = currentPlayer.cash - 50;
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex
          ? { ...p, cash: newCash, isInJail: false, jailTurns: 0 }
          : p,
      );
      const msg = `${currentPlayer.name} paid $50 to leave Jail.`;
      const log = addLogEntry(state.gameLog, msg);

      return {
        ...state,
        players: nextPlayers,
        phase: "readyToRoll",
        gameLog: log,
        landingMessage: msg,
        landingAction: { kind: "message", spaceIndex: 10, message: msg },
        drawnCard: null,
      };
    }

    case "USE_JAIL_CARD": {
      if (state.phase !== "awaitingJailDecision") return state;
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (!currentPlayer.isInJail || currentPlayer.getOutOfJailFreeCards < 1) return state;

      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex
          ? { ...p, getOutOfJailFreeCards: p.getOutOfJailFreeCards - 1, isInJail: false, jailTurns: 0 }
          : p,
      );
      const msg = `${currentPlayer.name} used a Get Out of Jail Free card.`;
      const log = addLogEntry(state.gameLog, msg);

      return {
        ...state,
        players: nextPlayers,
        phase: "readyToRoll",
        gameLog: log,
        chanceDeck: [...state.chanceDeck, "chance-8"],
        landingMessage: msg,
        landingAction: { kind: "message", spaceIndex: 10, message: msg },
        drawnCard: null,
      };
    }

    case "ROLL_IN_JAIL": {
      if (state.phase !== "awaitingJailDecision") return state;
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (!currentPlayer.isInJail) return state;

      let nextLog = addLogEntry(
        state.gameLog,
        `${currentPlayer.name} rolled ${action.dice.die1} and ${action.dice.die2} for ${action.dice.total}${action.dice.isDouble ? " (doubles)" : ""}.`,
      );

      if (action.dice.isDouble) {
        nextLog = addLogEntry(nextLog, `${currentPlayer.name} rolled doubles and was released from Jail.`);
        const movement = moveAroundBoard(currentPlayer.position, action.dice.total);
        const landedSpace = getBoardSpaceByIndex(movement.to);
        const landedOnGoJailDoubles = movement.to === 0;
        const goAwardJailDoubles = getGoAward(movement.passedGo, landedOnGoJailDoubles, state.rules);
        const releasedPlayers = state.players.map((p, i) =>
          i === state.currentPlayerIndex
            ? {
                ...p,
                position: movement.to,
                isInJail: false,
                jailTurns: 0,
                cash: p.cash + goAwardJailDoubles,
              }
            : p,
        );
        const goMsgJailDoubles = getGoAwardLogMessage(currentPlayer.name, movement.passedGo, landedOnGoJailDoubles, state.rules);
        if (goMsgJailDoubles) {
          nextLog = addLogEntry(nextLog, goMsgJailDoubles);
        }

        const stateAfterMove: GameState = {
          ...state,
          players: releasedPlayers,
          diceRoll: action.dice,
          currentPlayerHasRolled: true,
          doublesCount: 0,
          landingMessage: `Released from Jail, landed on ${landedSpace.name}`,
          landingAction: null,
          gameLog: nextLog,
          drawnCard: null,
        };

        // Pass rolledDouble=false: no extra roll from jail doubles (Monopoly rule)
        const resolution = resolveLanding(stateAfterMove, landedSpace, false);
        return applyLandingResolution(stateAfterMove, resolution, landedSpace.kind, false);
      }

      // Not doubles
      const newJailTurns = currentPlayer.jailTurns + 1;

      if (newJailTurns >= 3) {
        // Third failed roll — forced $50 release
        nextLog = addLogEntry(
          nextLog,
          `${currentPlayer.name} failed to roll doubles for the third time and was charged $50 to leave Jail.`,
        );
        const movement = moveAroundBoard(currentPlayer.position, action.dice.total);
        const landedSpace = getBoardSpaceByIndex(movement.to);
        // No-negative-cash rule: apply GO bonus first, then deduct $50.
        // If player still can't afford $50 after GO, they move but enter debt pending.
        const landedOnGoJailForced = movement.to === 0;
        const goBonus = getGoAward(movement.passedGo, landedOnGoJailForced, state.rules);
        const cashAfterGo = currentPlayer.cash + goBonus;
        const canAffordJailFee = cashAfterGo >= 50;
        const releasedPlayers = state.players.map((p, i) =>
          i === state.currentPlayerIndex
            ? {
                ...p,
                position: movement.to,
                isInJail: false,
                jailTurns: 0,
                cash: canAffordJailFee ? cashAfterGo - 50 : cashAfterGo,
              }
            : p,
        );
        const goMsgJailForced = getGoAwardLogMessage(currentPlayer.name, movement.passedGo, landedOnGoJailForced, state.rules);
        if (goMsgJailForced) {
          nextLog = addLogEntry(nextLog, goMsgJailForced);
        }

        const stateAfterMove: GameState = {
          ...state,
          players: releasedPlayers,
          diceRoll: action.dice,
          currentPlayerHasRolled: true,
          doublesCount: 0,
          landingMessage: `Released from Jail (paid $50), landed on ${landedSpace.name}`,
          landingAction: null,
          gameLog: nextLog,
          drawnCard: null,
        };

        // If they couldn't afford the $50 jail fee, enter debt pending first
        if (!canAffordJailFee) {
          return enterDebtPending(stateAfterMove, {
            amountOwed: 50,
            creditor: { type: "bank" },
            reason: `${currentPlayer.name} owes $50 jail fee to the Bank.`,
            potEligible: false,
          });
        }

        const resolution = resolveLanding(stateAfterMove, landedSpace, false);
        return applyLandingResolution(stateAfterMove, resolution, landedSpace.kind, false);
      }

      // Failed roll — stay in jail
      const stayPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, jailTurns: newJailTurns } : p,
      );
      const stayMsg = `${currentPlayer.name} failed to roll doubles. Still in Jail (attempt ${newJailTurns}/3).`;
      nextLog = addLogEntry(nextLog, stayMsg);

      return {
        ...state,
        players: stayPlayers,
        diceRoll: action.dice,
        currentPlayerHasRolled: true,
        phase: "turnComplete",
        landingMessage: stayMsg,
        landingAction: { kind: "message", spaceIndex: 10, message: stayMsg },
        gameLog: nextLog,
        drawnCard: null,
      };
    }

    case "BUY_PROPERTY": {
      if (state.phase !== "awaitingPurchaseDecision" || !state.landingAction) return state;
      // Auction Game: purchase decision never enters this phase; reject as a safety guard
      if (state.rules.gameMode === "auction") return state;

      const space = getBoardSpaceByIndex(state.landingAction.spaceIndex);
      if (!isOwnableSpace(space)) return state;

      const currentPlayer = state.players[state.currentPlayerIndex];
      const ownership = getOwnership(state.ownerships, space.index);
      if (!ownership || ownership.ownerId || currentPlayer.cash < space.price) return state;

      const nextPlayers = state.players.map((player, index) => {
        if (index !== state.currentPlayerIndex) return player;
        return {
          ...player,
          cash: player.cash - space.price,
          ownedCityIds:
            space.kind === "city" ? [...player.ownedCityIds, space.index] : player.ownedCityIds,
          ownedAirportIds:
            space.kind === "airport"
              ? [...player.ownedAirportIds, space.index]
              : player.ownedAirportIds,
          ownedUtilityIds:
            space.kind === "utility"
              ? [...player.ownedUtilityIds, space.index]
              : player.ownedUtilityIds,
        };
      });
      const nextOwnerships = state.ownerships.map((item) =>
        item.spaceIndex === space.index ? { ...item, ownerId: currentPlayer.id } : item,
      );
      const message = `${currentPlayer.name} bought ${space.name} for $${space.price}.`;

      return {
        ...state,
        players: nextPlayers,
        ownerships: nextOwnerships,
        phase: phaseAfterPurchaseDecision(state),
        landingAction: { kind: "message", spaceIndex: space.index, message },
        landingMessage: message,
        gameLog: addLogEntry(state.gameLog, message),
      };
    }

    case "DECLINE_PROPERTY": {
      if (state.phase !== "awaitingPurchaseDecision" || !state.landingAction) return state;

      const space = getBoardSpaceByIndex(state.landingAction.spaceIndex);
      if (!isOwnableSpace(space)) return state;

      const currentPlayer = state.players[state.currentPlayerIndex];

      // If auctions rule is OFF, just skip to next phase without starting an auction
      if (!state.rules.auctions) {
        const noAuctionMessage = `${currentPlayer.name} declined to buy ${space.name}. No auction (rule disabled).`;
        const phaseAfter = phaseAfterPurchaseDecision(state);
        return {
          ...state,
          phase: phaseAfter,
          landingAction: { kind: "message", spaceIndex: space.index, message: noAuctionMessage },
          landingMessage: noAuctionMessage,
          gameLog: addLogEntry(state.gameLog, noAuctionMessage),
        };
      }

      const declineMessage = `${currentPlayer.name} declined to buy ${space.name}. Auction started.`;
      return startPropertyAuction(state, space.index, declineMessage);
    }

    case "PLACE_BID": {
      if (state.phase !== "auction" || !state.auction) return state;

      const { auction } = state;
      const bidderId = auction.activePlayerIds[auction.currentBidderIndex];
      const bidder = state.players.find((p) => p.id === bidderId);
      if (!bidder || bidder.isBankrupt) return state;
      if (!isValidBidAmount(auction.currentBid, action.amount)) return state;
      if (action.amount > bidder.cash) return state;

      const space = getBoardSpaceByIndex(auction.propertySpaceIndex);
      const bidMessage = `${bidder.name} bid $${action.amount} on ${space.name}.`;
      const nextLog = addLogEntry(state.gameLog, bidMessage);

      const now = Date.now();
      const nextIdx = (auction.currentBidderIndex + 1) % auction.activePlayerIds.length;

      const updatedAuction: AuctionState = {
        ...auction,
        currentBid: action.amount,
        highestBidderId: bidder.id,
        currentBidderIndex: nextIdx,
        turnStartedAt: now,
        turnDeadlineAt: now + AUCTION_TURN_MS,
      };

      if (auction.activePlayerIds.length === 1) {
        return resolveAuctionWin(state, updatedAuction, nextLog);
      }

      return { ...state, auction: updatedAuction, gameLog: nextLog };
    }

    case "PASS_AUCTION": {
      if (state.phase !== "auction" || !state.auction) return state;

      const { auction } = state;
      const passerId = auction.activePlayerIds[auction.currentBidderIndex];
      const passer = state.players.find((p) => p.id === passerId);
      if (!passer) return state;

      const space = getBoardSpaceByIndex(auction.propertySpaceIndex);
      const passMessage = `${passer.name} passed on ${space.name}.`;
      let nextLog = addLogEntry(state.gameLog, passMessage);

      const remainingBidders = auction.activePlayerIds.filter((id) => id !== passerId);
      const nextPassedPlayerIds = [...auction.passedPlayerIds, passerId];
      const now = Date.now();

      if (remainingBidders.length === 0 && !auction.highestBidderId) {
        const noOneBidMessage = `No one bid on ${space.name}. It remains unowned.`;
        nextLog = addLogEntry(nextLog, noOneBidMessage);
        const stateNoBid = {
          ...state,
          auction: null,
          landingMessage: noOneBidMessage,
          landingAction: { kind: "message" as const, spaceIndex: auction.propertySpaceIndex, message: noOneBidMessage },
          gameLog: nextLog,
        };
        if (stateNoBid.forfeitAuctionQueue.length > 0) {
          return startForfeitAuction(stateNoBid, stateNoBid.forfeitAuctionQueue);
        }
        // If current player is bankrupt (forfeit path), advance to next turn
        if (stateNoBid.players[stateNoBid.currentPlayerIndex]?.isBankrupt) {
          return withNextTurn(stateNoBid);
        }
        const phaseAfter = state.diceRoll?.isDouble ? "readyToRoll" : "turnComplete";
        return { ...stateNoBid, phase: phaseAfter };
      }

      if (
        remainingBidders.length === 1 &&
        auction.highestBidderId !== null &&
        remainingBidders[0] === auction.highestBidderId
      ) {
        const updatedAuction: AuctionState = {
          ...auction,
          activePlayerIds: remainingBidders,
          passedPlayerIds: nextPassedPlayerIds,
          currentBidderIndex: 0,
        };
        return resolveAuctionWin(state, updatedAuction, nextLog);
      }

      if (remainingBidders.length === 0 && auction.highestBidderId) {
        const updatedAuction: AuctionState = {
          ...auction,
          activePlayerIds: remainingBidders,
          passedPlayerIds: nextPassedPlayerIds,
          currentBidderIndex: 0,
        };
        return resolveAuctionWin(state, updatedAuction, nextLog);
      }

      const currentIdx = auction.activePlayerIds.indexOf(passerId);
      const nextIdx = currentIdx % remainingBidders.length;

      const updatedAuction: AuctionState = {
        ...auction,
        activePlayerIds: remainingBidders,
        passedPlayerIds: nextPassedPlayerIds,
        currentBidderIndex: nextIdx,
        turnStartedAt: now,
        turnDeadlineAt: now + AUCTION_TURN_MS,
      };

      return { ...state, auction: updatedAuction, gameLog: nextLog };
    }

    case "END_TURN": {
      if (state.phase !== "turnComplete" || !state.currentPlayerHasRolled) return state;
      const currentPlayer = state.players[state.currentPlayerIndex];
      // Reset consecutive timeout count on a successful (player-initiated) turn completion.
      const stateResetTimeout = {
        ...state,
        players: state.players.map((p, i) =>
          i === state.currentPlayerIndex ? { ...p, consecutiveTurnTimeouts: 0 } : p,
        ),
      };
      return withNextTurn(stateResetTimeout, `${currentPlayer.name}'s turn ended.`);
    }

    case "BUY_HOUSE": {
      if (
        state.phase === "gameOver" ||
        state.phase === "bankruptcyPending" ||
        state.phase === "awaitingPurchaseDecision" ||
        state.phase === "auction"
      ) return state;
      const player = state.players[state.currentPlayerIndex];
      const check = canBuyHouse(state, action.spaceIndex, player);
      if (!check.ok) return state;

      const space = boardSpaces[action.spaceIndex];
      if (!space || space.kind !== "city") return state;

      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, cash: p.cash - space.houseCost } : p,
      );
      const nextOwnerships = state.ownerships.map((o) =>
        o.spaceIndex === action.spaceIndex ? { ...o, houses: o.houses + 1 } : o,
      );
      const ownership = state.ownerships.find((o) => o.spaceIndex === action.spaceIndex)!;
      const msg = `${player.name} bought a house on ${space.name} (now ${ownership.houses + 1} house${ownership.houses + 1 === 1 ? "" : "s"}).`;

      return {
        ...state,
        players: nextPlayers,
        ownerships: nextOwnerships,
        bankHouses: state.bankHouses - 1,
        gameLog: addLogEntry(state.gameLog, msg),
      };
    }

    case "SELL_HOUSE": {
      if (
        state.phase === "gameOver" ||
        state.phase === "awaitingPurchaseDecision" ||
        state.phase === "auction"
      ) return state;
      const player = state.players[state.currentPlayerIndex];
      const check = canSellHouse(state, action.spaceIndex, player);
      if (!check.ok) return state;

      const space = boardSpaces[action.spaceIndex];
      if (!space || space.kind !== "city") return state;

      const halfCost = Math.floor(space.houseCost / 2);
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, cash: p.cash + halfCost } : p,
      );
      const nextOwnerships = state.ownerships.map((o) =>
        o.spaceIndex === action.spaceIndex ? { ...o, houses: o.houses - 1 } : o,
      );
      const ownership = state.ownerships.find((o) => o.spaceIndex === action.spaceIndex)!;
      const msg = `${player.name} sold a house on ${space.name} for $${halfCost} (now ${ownership.houses - 1} house${ownership.houses - 1 === 1 ? "" : "s"}).`;

      return {
        ...state,
        players: nextPlayers,
        ownerships: nextOwnerships,
        bankHouses: Math.min(32, state.bankHouses + 1),
        gameLog: addLogEntry(state.gameLog, msg),
      };
    }

    case "BUY_HOTEL": {
      if (
        state.phase === "gameOver" ||
        state.phase === "bankruptcyPending" ||
        state.phase === "awaitingPurchaseDecision" ||
        state.phase === "auction"
      ) return state;
      const player = state.players[state.currentPlayerIndex];
      const check = canBuyHotel(state, action.spaceIndex, player);
      if (!check.ok) return state;

      const space = boardSpaces[action.spaceIndex];
      if (!space || space.kind !== "city") return state;

      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, cash: p.cash - space.houseCost } : p,
      );
      const nextOwnerships = state.ownerships.map((o) =>
        o.spaceIndex === action.spaceIndex ? { ...o, houses: 0, hasHotel: true } : o,
      );
      const msg = `${player.name} bought a hotel on ${space.name}.`;

      return {
        ...state,
        players: nextPlayers,
        ownerships: nextOwnerships,
        // Hotel purchase: consume 1 hotel, return 4 houses (the property's 4 houses go back to bank)
        bankHouses: Math.min(32, state.bankHouses + 4),
        bankHotels: state.bankHotels - 1,
        gameLog: addLogEntry(state.gameLog, msg),
      };
    }

    case "SELL_HOTEL": {
      if (
        state.phase === "gameOver" ||
        state.phase === "awaitingPurchaseDecision" ||
        state.phase === "auction"
      ) return state;
      const player = state.players[state.currentPlayerIndex];
      const check = canSellHotel(state, action.spaceIndex, player);
      if (!check.ok) return state;

      const space = boardSpaces[action.spaceIndex];
      if (!space || space.kind !== "city") return state;

      const halfCost = Math.floor(space.houseCost / 2);
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, cash: p.cash + halfCost } : p,
      );
      const nextOwnerships = state.ownerships.map((o) =>
        o.spaceIndex === action.spaceIndex ? { ...o, houses: 4, hasHotel: false } : o,
      );
      const msg = `${player.name} sold the hotel on ${space.name} for $${halfCost}, reverting to 4 houses.`;

      return {
        ...state,
        players: nextPlayers,
        ownerships: nextOwnerships,
        // Hotel downgrade: return 1 hotel to bank, consume 4 houses from bank
        bankHotels: Math.min(12, state.bankHotels + 1),
        bankHouses: state.bankHouses - 4,
        gameLog: addLogEntry(state.gameLog, msg),
      };
    }

    case "MORTGAGE_PROPERTY": {
      if (
        state.phase === "gameOver" ||
        state.phase === "awaitingPurchaseDecision" ||
        state.phase === "auction"
      ) return state;
      if (!state.rules.mortgages) return state;
      const player = state.players[state.currentPlayerIndex];
      const check = canMortgageProperty(state, action.spaceIndex, player);
      if (!check.ok) return state;

      const space = boardSpaces[action.spaceIndex] as OwnableSpace | undefined;
      if (!space) return state;

      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, cash: p.cash + space.mortgageValue } : p,
      );
      const nextOwnerships = state.ownerships.map((o) =>
        o.spaceIndex === action.spaceIndex ? { ...o, isMortgaged: true } : o,
      );
      const msg = `${player.name} mortgaged ${space.name} for $${space.mortgageValue}.`;

      return {
        ...state,
        players: nextPlayers,
        ownerships: nextOwnerships,
        gameLog: addLogEntry(state.gameLog, msg),
      };
    }

    case "UNMORTGAGE_PROPERTY": {
      if (
        state.phase === "gameOver" ||
        state.phase === "bankruptcyPending" ||
        state.phase === "awaitingPurchaseDecision" ||
        state.phase === "auction"
      ) return state;
      if (!state.rules.mortgages) return state;
      const player = state.players[state.currentPlayerIndex];
      const check = canUnmortgageProperty(state, action.spaceIndex, player);
      if (!check.ok) return state;

      const space = boardSpaces[action.spaceIndex] as OwnableSpace | undefined;
      if (!space) return state;

      const cost = space.mortgageValue + Math.ceil(space.mortgageValue / 10);
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, cash: p.cash - cost } : p,
      );
      const nextOwnerships = state.ownerships.map((o) =>
        o.spaceIndex === action.spaceIndex ? { ...o, isMortgaged: false } : o,
      );
      const msg = `${player.name} unmortgaged ${space.name} for $${cost}.`;

      return {
        ...state,
        players: nextPlayers,
        ownerships: nextOwnerships,
        gameLog: addLogEntry(state.gameLog, msg),
      };
    }

    case "PROPOSE_TRADE": {
      if (
        state.phase === "gameOver" ||
        state.phase === "auction" ||
        state.phase === "awaitingPurchaseDecision"
      ) return state;
      if (state.trade) return state;

      if (state.phase === "bankruptcyPending") {
        // During bankruptcyPending, only the debtor can propose a trade (emergency trade)
        if (!state.bankruptcy) return state;
        if (action.actorPlayerId !== state.bankruptcy.debtorPlayerId) return state;
        if (action.actorPlayerId !== action.initiatorId) return state;
      } else {
        // Normal gameplay: actor must be the current player
        const currentActorId = state.players[state.currentPlayerIndex]?.id;
        if (action.actorPlayerId !== currentActorId) return state;
        if (action.actorPlayerId !== action.initiatorId) return state;
      }

      const check = validateTrade(
        state,
        action.initiatorId,
        action.recipientId,
        action.offerFromInitiator,
        action.offerFromRecipient,
      );
      if (!check.ok) return state;

      return {
        ...state,
        trade: {
          initiatorPlayerId: action.initiatorId,
          recipientPlayerId: action.recipientId,
          offerFromInitiator: action.offerFromInitiator,
          offerFromRecipient: action.offerFromRecipient,
        },
      };
    }

    case "ACCEPT_TRADE": {
      if (!state.trade) return state;
      if (action.actorPlayerId !== state.trade.recipientPlayerId) return state;
      const { initiatorPlayerId, recipientPlayerId, offerFromInitiator, offerFromRecipient } =
        state.trade;

      const recheck = validateTrade(
        state,
        initiatorPlayerId,
        recipientPlayerId,
        offerFromInitiator,
        offerFromRecipient,
      );
      if (!recheck.ok) return { ...state, trade: null };

      const initiator = state.players.find((p) => p.id === initiatorPlayerId)!;
      const recipient = state.players.find((p) => p.id === recipientPlayerId)!;

      // Transfer ownerships in the ownerships array
      let nextOwnerships = state.ownerships;
      for (const idx of offerFromInitiator.propertySpaceIndices) {
        nextOwnerships = nextOwnerships.map((o) =>
          o.spaceIndex === idx ? { ...o, ownerId: recipientPlayerId } : o,
        );
      }
      for (const idx of offerFromRecipient.propertySpaceIndices) {
        nextOwnerships = nextOwnerships.map((o) =>
          o.spaceIndex === idx ? { ...o, ownerId: initiatorPlayerId } : o,
        );
      }

      function transferPlayerArrays(
        p: typeof initiator,
        losing: number[],
        gaining: number[],
      ) {
        const losingSet = new Set(losing);
        const gainingCities = gaining.filter((i) => boardSpaces[i]?.kind === "city");
        const gainingAirports = gaining.filter((i) => boardSpaces[i]?.kind === "airport");
        const gainingUtilities = gaining.filter((i) => boardSpaces[i]?.kind === "utility");
        return {
          ownedCityIds: [
            ...p.ownedCityIds.filter((id) => !losingSet.has(id)),
            ...gainingCities,
          ],
          ownedAirportIds: [
            ...p.ownedAirportIds.filter((id) => !losingSet.has(id)),
            ...gainingAirports,
          ],
          ownedUtilityIds: [
            ...p.ownedUtilityIds.filter((id) => !losingSet.has(id)),
            ...gainingUtilities,
          ],
        };
      }

      // Mortgage transfer fee: receiver pays 10% of mortgage value per mortgaged property received
      function calcMortgageFee(spaceIndices: number[]): number {
        return spaceIndices.reduce((total, idx) => {
          const o = state.ownerships.find((o) => o.spaceIndex === idx);
          if (!o?.isMortgaged) return total;
          const space = boardSpaces[idx] as OwnableSpace | undefined;
          return space ? total + Math.ceil(space.mortgageValue / 10) : total;
        }, 0);
      }
      // Initiator receives offerFromRecipient.propertySpaceIndices
      const initiatorMortgageFee = calcMortgageFee(offerFromRecipient.propertySpaceIndices);
      // Recipient receives offerFromInitiator.propertySpaceIndices
      const recipientMortgageFee = calcMortgageFee(offerFromInitiator.propertySpaceIndices);

      // Block trade acceptance if either party can't afford their mortgage transfer fee
      const initiatorPostCash = initiator.cash - offerFromInitiator.cash + offerFromRecipient.cash - initiatorMortgageFee;
      const recipientPostCash = recipient.cash - offerFromRecipient.cash + offerFromInitiator.cash - recipientMortgageFee;
      if (initiatorPostCash < 0 || recipientPostCash < 0) {
        // Can't afford mortgage transfer fees — cancel trade
        return { ...state, trade: null, gameLog: addLogEntry(state.gameLog, "Trade cancelled: a party cannot afford mortgage transfer fees.") };
      }

      const nextPlayers = state.players.map((p) => {
        if (p.id === initiatorPlayerId) {
          return {
            ...p,
            cash: p.cash - offerFromInitiator.cash + offerFromRecipient.cash - initiatorMortgageFee,
            getOutOfJailFreeCards:
              p.getOutOfJailFreeCards -
              offerFromInitiator.getOutOfJailFreeCards +
              offerFromRecipient.getOutOfJailFreeCards,
            ...transferPlayerArrays(
              p,
              offerFromInitiator.propertySpaceIndices,
              offerFromRecipient.propertySpaceIndices,
            ),
          };
        }
        if (p.id === recipientPlayerId) {
          return {
            ...p,
            cash: p.cash - offerFromRecipient.cash + offerFromInitiator.cash - recipientMortgageFee,
            getOutOfJailFreeCards:
              p.getOutOfJailFreeCards -
              offerFromRecipient.getOutOfJailFreeCards +
              offerFromInitiator.getOutOfJailFreeCards,
            ...transferPlayerArrays(
              p,
              offerFromRecipient.propertySpaceIndices,
              offerFromInitiator.propertySpaceIndices,
            ),
          };
        }
        return p;
      });

      const propNames = (indices: number[]) =>
        indices.map((i) => boardSpaces[i]?.name ?? `#${i}`).join(", ");
      const initiatorOfferDesc = [
        offerFromInitiator.cash > 0 ? `$${offerFromInitiator.cash}` : "",
        offerFromInitiator.propertySpaceIndices.length > 0
          ? propNames(offerFromInitiator.propertySpaceIndices)
          : "",
        offerFromInitiator.getOutOfJailFreeCards > 0
          ? `${offerFromInitiator.getOutOfJailFreeCards}×GOJF`
          : "",
      ]
        .filter(Boolean)
        .join(", ") || "nothing";
      const recipientOfferDesc = [
        offerFromRecipient.cash > 0 ? `$${offerFromRecipient.cash}` : "",
        offerFromRecipient.propertySpaceIndices.length > 0
          ? propNames(offerFromRecipient.propertySpaceIndices)
          : "",
        offerFromRecipient.getOutOfJailFreeCards > 0
          ? `${offerFromRecipient.getOutOfJailFreeCards}×GOJF`
          : "",
      ]
        .filter(Boolean)
        .join(", ") || "nothing";
      const mortgageFeeNotes = [
        recipientMortgageFee > 0 ? `${recipient.name} paid $${recipientMortgageFee} mortgage transfer fee` : "",
        initiatorMortgageFee > 0 ? `${initiator.name} paid $${initiatorMortgageFee} mortgage transfer fee` : "",
      ].filter(Boolean).join("; ");
      const msg = `Trade accepted: ${initiator.name} gave ${initiatorOfferDesc} to ${recipient.name} in exchange for ${recipientOfferDesc}.${mortgageFeeNotes ? ` ${mortgageFeeNotes}.` : ""}`;

      return {
        ...state,
        players: nextPlayers,
        ownerships: nextOwnerships,
        trade: null,
        gameLog: addLogEntry(state.gameLog, msg),
      };
    }

    case "DECLINE_TRADE": {
      if (!state.trade) return state;
      if (action.actorPlayerId !== state.trade.recipientPlayerId) return state;
      const recipient = state.players.find((p) => p.id === state.trade!.recipientPlayerId);
      const msg = `${recipient?.name ?? "Recipient"} declined the trade.`;
      return {
        ...state,
        trade: null,
        gameLog: addLogEntry(state.gameLog, msg),
      };
    }

    case "CANCEL_TRADE": {
      if (!state.trade) return state;
      if (action.actorPlayerId !== state.trade.initiatorPlayerId) return state;
      const initiator = state.players.find((p) => p.id === state.trade!.initiatorPlayerId);
      const msg = `${initiator?.name ?? "Proposer"} cancelled the trade.`;
      return { ...state, trade: null, gameLog: addLogEntry(state.gameLog, msg) };
    }

    case "RESOLVE_BANKRUPTCY_IF_SOLVENT": {
      if (!state.bankruptcy || state.phase !== "bankruptcyPending") return state;
      const debtor = state.players.find((p) => p.id === state.bankruptcy!.debtorPlayerId);
      // No-negative-cash rule: cash stays non-negative, so we check cash >= amountOwed
      if (!debtor || debtor.cash < state.bankruptcy.amountOwed) return state;

      const { bankruptcy } = state;
      const creditor = bankruptcy.creditor;

      // Transfer the owed amount to creditor now that debtor has enough cash
      let nextPlayers = state.players.map((p) => {
        if (p.id === debtor.id) return { ...p, cash: p.cash - bankruptcy.amountOwed };
        if (
          creditor.type === "player" &&
          p.id === (creditor as { type: "player"; playerId: string }).playerId
        ) {
          return { ...p, cash: p.cash + bankruptcy.amountOwed };
        }
        return p;
      });

      // Handle pot for bank payments that are pot-eligible
      // (we don't have potEligible in BankruptcyState, so check via reason heuristic — skip for now)

      const msg = `${debtor.name} paid $${bankruptcy.amountOwed} and resolved the debt.`;
      return {
        ...state,
        players: nextPlayers,
        bankruptcy: null,
        phase: bankruptcy.phaseBeforeBankruptcy,
        gameLog: addLogEntry(state.gameLog, msg),
      };
    }

    case "DECLARE_BANKRUPTCY": {
      if (!state.bankruptcy || state.phase !== "bankruptcyPending") return state;
      const { debtorPlayerId, creditor } = state.bankruptcy;

      const debtor = state.players.find((p) => p.id === debtorPlayerId);
      if (!debtor) return state;

      const debtorCities = debtor.ownedCityIds;
      const debtorAirports = debtor.ownedAirportIds;
      const debtorUtilities = debtor.ownedUtilityIds;
      const debtorAllProps = [...debtorCities, ...debtorAirports, ...debtorUtilities];

      let nextOwnerships = state.ownerships;
      let nextPlayers = state.players;
      let nextChanceDeck = state.chanceDeck;
      let nextBankHouses = state.bankHouses;
      let nextBankHotels = state.bankHotels;
      let msg = "";

      if (creditor.type === "player") {
        const creditorPlayer = state.players.find((p) => p.id === creditor.playerId);
        if (!creditorPlayer) return state;

        // Calculate 10% mortgage transfer fee for mortgaged properties received by creditor
        // Properties with houses/hotels cannot be mortgaged per game rules, so supply is unaffected here
        const mortgagedDebtorProps = debtorAllProps.filter((spaceIndex) => {
          const o = state.ownerships.find((o) => o.spaceIndex === spaceIndex);
          return o?.isMortgaged === true;
        });
        const mortgageFee = mortgagedDebtorProps.reduce((total, spaceIndex) => {
          const space = boardSpaces[spaceIndex] as OwnableSpace | undefined;
          return space ? total + Math.ceil(space.mortgageValue / 10) : total;
        }, 0);

        nextOwnerships = state.ownerships.map((o) =>
          o.ownerId === debtorPlayerId ? { ...o, ownerId: creditor.playerId } : o,
        );

        nextPlayers = state.players.map((p) => {
          if (p.id === debtorPlayerId) {
            return {
              ...p,
              cash: 0,
              isBankrupt: true,
              getOutOfJailFreeCards: 0,
              ownedCityIds: [],
              ownedAirportIds: [],
              ownedUtilityIds: [],
            };
          }
          if (p.id === creditor.playerId) {
            // Creditor receives debtor's remaining cash, minus mortgage transfer fees
            const cashReceived = Math.max(0, debtor.cash);
            return {
              ...p,
              cash: Math.max(0, p.cash + cashReceived - mortgageFee),
              getOutOfJailFreeCards: p.getOutOfJailFreeCards + debtor.getOutOfJailFreeCards,
              ownedCityIds: [...p.ownedCityIds, ...debtorCities],
              ownedAirportIds: [...p.ownedAirportIds, ...debtorAirports],
              ownedUtilityIds: [...p.ownedUtilityIds, ...debtorUtilities],
            };
          }
          return p;
        });

        const feeNote = mortgageFee > 0 ? ` (${creditorPlayer.name} paid $${mortgageFee} mortgage transfer fee)` : "";
        msg = `${debtor.name} declared bankruptcy to ${creditorPlayer.name}. All assets transferred.${feeNote}`;
      } else {
        // Creditor is bank: return properties to unowned, clear improvements, restore bank supply
        let housesRestored = 0;
        let hotelsRestored = 0;
        for (const spaceIndex of debtorAllProps) {
          const o = state.ownerships.find((o) => o.spaceIndex === spaceIndex);
          if (o) {
            housesRestored += o.houses;
            if (o.hasHotel) hotelsRestored += 1;
          }
        }
        nextBankHouses = Math.min(32, state.bankHouses + housesRestored);
        nextBankHotels = Math.min(12, state.bankHotels + hotelsRestored);

        nextOwnerships = state.ownerships.map((o) =>
          debtorAllProps.includes(o.spaceIndex)
            ? { ...o, ownerId: null, isMortgaged: false, houses: 0, hasHotel: false }
            : o,
        );

        // Return GOJF cards to chance deck
        for (let i = 0; i < debtor.getOutOfJailFreeCards; i++) {
          nextChanceDeck = [...nextChanceDeck, "chance-8"];
        }

        nextPlayers = state.players.map((p) => {
          if (p.id === debtorPlayerId) {
            return {
              ...p,
              cash: 0,
              isBankrupt: true,
              getOutOfJailFreeCards: 0,
              ownedCityIds: [],
              ownedAirportIds: [],
              ownedUtilityIds: [],
            };
          }
          return p;
        });

        msg = `${debtor.name} declared bankruptcy to the Bank. Properties returned to the Bank.`;
      }

      const nextLog = addLogEntry(state.gameLog, msg);
      const stateAfterBankruptcy: GameState = {
        ...state,
        players: nextPlayers,
        ownerships: nextOwnerships,
        chanceDeck: nextChanceDeck,
        bankruptcy: null,
        trade: null,
        bankHouses: nextBankHouses,
        bankHotels: nextBankHotels,
        gameLog: nextLog,
      };

      // Check for winner
      const activePlayers = stateAfterBankruptcy.players.filter((p) => !p.isBankrupt);
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        const winMsg = `${winner.name} wins the game!`;
        return {
          ...stateAfterBankruptcy,
          phase: "gameOver",
          winnerId: winner.id,
          gameLog: addLogEntry(nextLog, winMsg),
        };
      }

      return withNextTurn(stateAfterBankruptcy);
    }

    case "TURN_TIMER_EXPIRED": {
      // Ignore if game is in a phase that manages its own timing
      const blockedPhases: GamePhase[] = ["gameOver", "setup", "auction", "bankruptcyPending"];
      if (blockedPhases.includes(state.phase as GamePhase)) return state;

      const currentPlayer = state.players[state.currentPlayerIndex];
      if (!currentPlayer || currentPlayer.id !== action.playerId) return state;
      if (state.turnDeadlineAt !== action.deadlineAt) return state;

      const newTimeouts = currentPlayer.consecutiveTurnTimeouts + 1;
      const timeoutLog = `${currentPlayer.name}'s turn timed out (${newTimeouts}/3 consecutive timeouts).`;
      const stateWithTimeout: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === state.currentPlayerIndex ? { ...p, consecutiveTurnTimeouts: newTimeouts } : p,
        ),
        gameLog: addLogEntry(state.gameLog, timeoutLog),
      };

      if (newTimeouts >= 3) {
        const autoBankruptLog = `${currentPlayer.name} auto-bankrupted after 3 consecutive turn timeouts.`;
        return applyVoluntaryBankruptcy(
          { ...stateWithTimeout, gameLog: addLogEntry(stateWithTimeout.gameLog, autoBankruptLog) },
          stateWithTimeout.players[state.currentPlayerIndex],
        );
      }

      // Auto-decline a pending purchase decision so the property returns to the pool
      if (state.phase === "awaitingPurchaseDecision" && state.landingAction) {
        const space = getBoardSpaceByIndex(state.landingAction.spaceIndex);
        if (isOwnableSpace(space)) {
          if (!stateWithTimeout.rules.auctions) {
            const phaseAfter = phaseAfterPurchaseDecision(stateWithTimeout);
            return {
              ...stateWithTimeout,
              phase: phaseAfter,
              landingAction: { kind: "message", spaceIndex: space.index, message: timeoutLog },
              landingMessage: timeoutLog,
            };
          }
          const activePlayerIds = stateWithTimeout.players.filter((p) => !p.isBankrupt).map((p) => p.id);
          const now = Date.now();
          return {
            ...stateWithTimeout,
            phase: "auction",
            auction: {
              propertySpaceIndex: space.index,
              activePlayerIds,
              passedPlayerIds: [],
              currentBid: 0,
              highestBidderId: null,
              currentBidderIndex: 0,
              turnStartedAt: now,
              turnDeadlineAt: now + AUCTION_TURN_MS,
              status: "active",
            },
          };
        }
      }

      return withNextTurn(stateWithTimeout);
    }

    case "VOLUNTARY_BANKRUPTCY": {
      // Any active player may forfeit on their own accord (not during auction/bankruptcy/gameOver)
      const allowedPhases: GamePhase[] = ["readyToRoll", "awaitingJailDecision", "awaitingPurchaseDecision", "turnComplete"];
      if (!allowedPhases.includes(state.phase as GamePhase)) return state;

      const forfeiter = state.players.find((p) => p.id === action.actorPlayerId);
      if (!forfeiter || forfeiter.isBankrupt) return state;

      return applyVoluntaryBankruptcy(state, forfeiter);
    }

    case "RESET_GAME":
      return createSetupGameState();

    case "LOAD_GAME":
      return action.state;

    default:
      return state;
  }
}
