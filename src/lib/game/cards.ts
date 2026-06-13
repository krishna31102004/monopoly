import { chanceCards, communityChestCards, type CardDefinition } from "@/data/cards";
import { addLogEntry } from "@/lib/game/createInitialGameState";
import { resolveLanding } from "@/lib/game/landing";
import { moveAroundBoard } from "@/lib/game/movement";
import { checkBankruptcy } from "@/lib/game/bankruptcy";
import { getBoardSpaceByIndex } from "@/data/board";
import type { DrawnCard, GameState } from "@/types/game";
import type { Player } from "@/types/player";

const ALL_CARDS: Record<string, CardDefinition> = {};
for (const c of [...chanceCards, ...communityChestCards]) {
  ALL_CARDS[c.id] = c;
}

export function getCardById(id: string): CardDefinition | undefined {
  return ALL_CARDS[id];
}

// Returns nearest airport index ahead of (or at) fromIndex
export function nearestAirport(fromIndex: number): number {
  const airports = [5, 15, 25, 35];
  for (let offset = 1; offset <= 40; offset++) {
    const pos = (fromIndex + offset) % 40;
    if (airports.includes(pos)) return pos;
  }
  return 5;
}

// Returns nearest utility index ahead of (or at) fromIndex
export function nearestUtility(fromIndex: number): number {
  const utilities = [12, 28];
  for (let offset = 1; offset <= 40; offset++) {
    const pos = (fromIndex + offset) % 40;
    if (utilities.includes(pos)) return pos;
  }
  return 12;
}

function drawFromDeck(deck: string[]): { cardId: string; newDeck: string[] } {
  if (deck.length === 0) return { cardId: "", newDeck: [] };
  const [cardId, ...rest] = deck;
  return { cardId, newDeck: rest };
}

function returnCardToBottom(deck: string[], cardId: string): string[] {
  return [...deck, cardId];
}

type CardResult = {
  state: GameState;
  card: CardDefinition;
  resolvedMessage: string;
};

export function drawAndApplyCard(
  state: GameState,
  deckType: "chance" | "community-chest",
  rolledDouble: boolean,
): GameState {
  const deckKey = deckType === "chance" ? "chanceDeck" : "communityChestDeck";
  const deck = state[deckKey];

  if (deck.length === 0) {
    return state;
  }

  const { cardId, newDeck } = drawFromDeck(deck);
  const card = getCardById(cardId);
  if (!card) return state;

  const result = applyCardEffect(
    { ...state, [deckKey]: newDeck },
    card,
    deckType,
    rolledDouble,
  );

  return {
    ...result.state,
    drawnCard: { card, resolvedMessage: result.resolvedMessage },
  };
}

function applyCardEffect(
  state: GameState,
  card: CardDefinition,
  deckType: "chance" | "community-chest",
  rolledDouble: boolean,
): Omit<CardResult, "card"> {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const deckKey = deckType === "chance" ? "chanceDeck" : "communityChestDeck";

  switch (card.category) {
    case "advance-go": {
      const passedGo = currentPlayer.position !== 0;
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex
          ? { ...p, position: 0, cash: p.cash + (passedGo ? 200 : 0) }
          : p,
      );
      let log = addLogEntry(state.gameLog, `${currentPlayer.name} drew: "${card.text}"`);
      if (passedGo) log = addLogEntry(log, `${currentPlayer.name} collected $200 from GO.`);
      const msg = `${currentPlayer.name} advanced to GO.`;
      const nextState: GameState = {
        ...state,
        players: nextPlayers,
        gameLog: log,
        phase: rolledDouble ? "readyToRoll" : "turnComplete",
        landingMessage: msg,
        landingAction: { kind: "message", spaceIndex: 0, message: msg },
      };
      return { state: nextState, resolvedMessage: msg };
    }

    case "advance-to": {
      const target = card.targetSpaceIndex!;
      const movement = moveAroundBoard(currentPlayer.position, (target - currentPlayer.position + 40) % 40);
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex
          ? { ...p, position: target, cash: p.cash + (movement.passedGo ? 200 : 0) }
          : p,
      );
      let log = addLogEntry(state.gameLog, `${currentPlayer.name} drew: "${card.text}"`);
      if (movement.passedGo) log = addLogEntry(log, `${currentPlayer.name} collected $200 from GO.`);
      const msg = `${currentPlayer.name} advanced to ${getBoardSpaceByIndex(target).name}.`;
      const stateAfterMove: GameState = {
        ...state,
        players: nextPlayers,
        gameLog: log,
        landingMessage: msg,
        landingAction: null,
      };
      // Resolve landing on the new space (but don't chain into another card draw)
      const targetSpace = getBoardSpaceByIndex(target);
      if (targetSpace.kind === "chance" || targetSpace.kind === "community-chest") {
        // Don't chain - just log it
        const noChainMsg = `${currentPlayer.name} landed on ${targetSpace.name} via card. No further draw.`;
        const finalLog = addLogEntry(stateAfterMove.gameLog, noChainMsg);
        const finalState: GameState = {
          ...stateAfterMove,
          gameLog: finalLog,
          phase: rolledDouble ? "readyToRoll" : "turnComplete",
          landingMessage: noChainMsg,
          landingAction: { kind: "message", spaceIndex: target, message: noChainMsg },
        };
        return { state: finalState, resolvedMessage: noChainMsg };
      }
      const resolution = resolveLanding(stateAfterMove, targetSpace, rolledDouble);
      const finalState: GameState = {
        ...stateAfterMove,
        players: resolution.players,
        phase: resolution.phase,
        doublesCount: resolution.doublesCount,
        landingMessage: resolution.landingMessage,
        landingAction: resolution.landingAction,
        gameLog: resolution.gameLog,
      };
      return { state: finalState, resolvedMessage: msg };
    }

    case "advance-nearest-airport": {
      const target = nearestAirport(currentPlayer.position);
      const movement = moveAroundBoard(currentPlayer.position, (target - currentPlayer.position + 40) % 40);
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex
          ? { ...p, position: target, cash: p.cash + (movement.passedGo ? 200 : 0) }
          : p,
      );
      let log = addLogEntry(state.gameLog, `${currentPlayer.name} drew: "${card.text}"`);
      if (movement.passedGo) log = addLogEntry(log, `${currentPlayer.name} collected $200 from GO.`);
      const msg = `${currentPlayer.name} advanced to ${getBoardSpaceByIndex(target).name} (nearest airport).`;
      const stateAfterMove: GameState = {
        ...state,
        players: nextPlayers,
        gameLog: log,
        landingMessage: msg,
        landingAction: null,
      };
      const targetSpace = getBoardSpaceByIndex(target);
      const resolution = resolveLanding(stateAfterMove, targetSpace, rolledDouble);
      const finalState: GameState = {
        ...stateAfterMove,
        players: resolution.players,
        phase: resolution.phase,
        doublesCount: resolution.doublesCount,
        landingMessage: resolution.landingMessage,
        landingAction: resolution.landingAction,
        gameLog: resolution.gameLog,
      };
      return { state: finalState, resolvedMessage: msg };
    }

    case "advance-nearest-utility": {
      const target = nearestUtility(currentPlayer.position);
      const movement = moveAroundBoard(currentPlayer.position, (target - currentPlayer.position + 40) % 40);
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex
          ? { ...p, position: target, cash: p.cash + (movement.passedGo ? 200 : 0) }
          : p,
      );
      let log = addLogEntry(state.gameLog, `${currentPlayer.name} drew: "${card.text}"`);
      if (movement.passedGo) log = addLogEntry(log, `${currentPlayer.name} collected $200 from GO.`);
      const msg = `${currentPlayer.name} advanced to ${getBoardSpaceByIndex(target).name} (nearest utility).`;
      const stateAfterMove: GameState = {
        ...state,
        players: nextPlayers,
        gameLog: log,
        landingMessage: msg,
        landingAction: null,
      };
      const targetSpace = getBoardSpaceByIndex(target);
      const resolution = resolveLanding(stateAfterMove, targetSpace, rolledDouble);
      const finalState: GameState = {
        ...stateAfterMove,
        players: resolution.players,
        phase: resolution.phase,
        doublesCount: resolution.doublesCount,
        landingMessage: resolution.landingMessage,
        landingAction: resolution.landingAction,
        gameLog: resolution.gameLog,
      };
      return { state: finalState, resolvedMessage: msg };
    }

    case "go-back-3": {
      const target = (currentPlayer.position - 3 + 40) % 40;
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, position: target } : p,
      );
      let log = addLogEntry(state.gameLog, `${currentPlayer.name} drew: "${card.text}"`);
      const msg = `${currentPlayer.name} moved back 3 spaces to ${getBoardSpaceByIndex(target).name}.`;
      const stateAfterMove: GameState = {
        ...state,
        players: nextPlayers,
        gameLog: log,
        landingMessage: msg,
        landingAction: null,
      };
      const targetSpace = getBoardSpaceByIndex(target);
      if (targetSpace.kind === "chance" || targetSpace.kind === "community-chest") {
        const noChainMsg = `${currentPlayer.name} landed on ${targetSpace.name} via card. No further draw.`;
        const finalLog = addLogEntry(stateAfterMove.gameLog, noChainMsg);
        const finalState: GameState = {
          ...stateAfterMove,
          gameLog: finalLog,
          phase: rolledDouble ? "readyToRoll" : "turnComplete",
          landingMessage: noChainMsg,
          landingAction: { kind: "message", spaceIndex: target, message: noChainMsg },
        };
        return { state: finalState, resolvedMessage: noChainMsg };
      }
      const resolution = resolveLanding(stateAfterMove, targetSpace, rolledDouble);
      const finalState: GameState = {
        ...stateAfterMove,
        players: resolution.players,
        phase: resolution.phase,
        doublesCount: resolution.doublesCount,
        landingMessage: resolution.landingMessage,
        landingAction: resolution.landingAction,
        gameLog: resolution.gameLog,
      };
      return { state: finalState, resolvedMessage: msg };
    }

    case "go-to-jail": {
      const jailMsg = `${currentPlayer.name} drew "${card.text}" and went to Jail.`;
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex
          ? { ...p, position: 10, isInJail: true, jailTurns: 0 }
          : p,
      );
      const log = addLogEntry(state.gameLog, jailMsg);
      const finalState: GameState = {
        ...state,
        players: nextPlayers,
        gameLog: log,
        phase: "turnComplete",
        doublesCount: 0,
        landingMessage: jailMsg,
        landingAction: { kind: "message", spaceIndex: 10, message: jailMsg },
      };
      return { state: finalState, resolvedMessage: jailMsg };
    }

    case "collect-bank": {
      const amount = card.amount ?? 0;
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, cash: p.cash + amount } : p,
      );
      const msg = `${currentPlayer.name} collected $${amount} from the bank.`;
      const log = addLogEntry(state.gameLog, `${currentPlayer.name} drew: "${card.text}"`);
      const log2 = addLogEntry(log, msg);
      const finalState: GameState = {
        ...state,
        players: nextPlayers,
        gameLog: log2,
        [deckKey]: returnCardToBottom(state[deckKey], card.id),
        phase: rolledDouble ? "readyToRoll" : "turnComplete",
        landingMessage: msg,
        landingAction: { kind: "message", spaceIndex: currentPlayer.position, message: msg },
      };
      return { state: finalState, resolvedMessage: msg };
    }

    case "pay-bank": {
      const amount = card.amount ?? 0;
      const newCash = currentPlayer.cash - amount;
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, cash: newCash } : p,
      );
      const msg = `${currentPlayer.name} paid $${amount} to the bank.`;
      let log = addLogEntry(state.gameLog, `${currentPlayer.name} drew: "${card.text}"`);
      log = addLogEntry(log, msg);
      if (newCash < 0) {
        log = addLogEntry(log, `${currentPlayer.name}'s cash is below $0.`);
      }
      const finalState: GameState = {
        ...state,
        players: nextPlayers,
        gameLog: log,
        [deckKey]: returnCardToBottom(state[deckKey], card.id),
        phase: rolledDouble ? "readyToRoll" : "turnComplete",
        landingMessage: msg,
        landingAction: { kind: "message", spaceIndex: currentPlayer.position, message: msg },
      };
      return { state: checkBankruptcy(finalState, { type: "bank" }), resolvedMessage: msg };
    }

    case "collect-each-player": {
      const amount = card.amount ?? 0;
      const activePlayers = state.players.filter(
        (p) => !p.isBankrupt && p.id !== currentPlayer.id,
      );
      const totalCollected = activePlayers.length * amount;
      let log = addLogEntry(state.gameLog, `${currentPlayer.name} drew: "${card.text}"`);
      const nextPlayers = state.players.map((p) => {
        if (p.id === currentPlayer.id) return { ...p, cash: p.cash + totalCollected };
        if (!p.isBankrupt) return { ...p, cash: p.cash - amount };
        return p;
      });
      const msg = `${currentPlayer.name} collected $${amount} from each player ($${totalCollected} total).`;
      log = addLogEntry(log, msg);
      const finalState: GameState = {
        ...state,
        players: nextPlayers,
        gameLog: log,
        [deckKey]: returnCardToBottom(state[deckKey], card.id),
        phase: rolledDouble ? "readyToRoll" : "turnComplete",
        landingMessage: msg,
        landingAction: { kind: "message", spaceIndex: currentPlayer.position, message: msg },
      };
      // Others pay the current player — creditor is the current player
      return {
        state: checkBankruptcy(finalState, { type: "player", playerId: currentPlayer.id }),
        resolvedMessage: msg,
      };
    }

    case "pay-each-player": {
      const amount = card.amount ?? 0;
      const activePlayers = state.players.filter(
        (p) => !p.isBankrupt && p.id !== currentPlayer.id,
      );
      const totalPaid = activePlayers.length * amount;
      let log = addLogEntry(state.gameLog, `${currentPlayer.name} drew: "${card.text}"`);
      const nextPlayers = state.players.map((p) => {
        if (p.id === currentPlayer.id) return { ...p, cash: p.cash - totalPaid };
        if (!p.isBankrupt) return { ...p, cash: p.cash + amount };
        return p;
      });
      const msg = `${currentPlayer.name} paid $${amount} to each player ($${totalPaid} total).`;
      log = addLogEntry(log, msg);
      if (currentPlayer.cash - totalPaid < 0) {
        log = addLogEntry(log, `${currentPlayer.name}'s cash is below $0.`);
      }
      const finalState: GameState = {
        ...state,
        players: nextPlayers,
        gameLog: log,
        [deckKey]: returnCardToBottom(state[deckKey], card.id),
        phase: rolledDouble ? "readyToRoll" : "turnComplete",
        landingMessage: msg,
        landingAction: { kind: "message", spaceIndex: currentPlayer.position, message: msg },
      };
      // Current player pays multiple others — creditor simplified to bank
      return { state: checkBankruptcy(finalState, { type: "bank" }), resolvedMessage: msg };
    }

    case "get-out-of-jail-free": {
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex
          ? { ...p, getOutOfJailFreeCards: p.getOutOfJailFreeCards + 1 }
          : p,
      );
      const msg = `${currentPlayer.name} received a Get Out of Jail Free card.`;
      let log = addLogEntry(state.gameLog, `${currentPlayer.name} drew: "${card.text}"`);
      log = addLogEntry(log, msg);
      // Keep card out of deck while held — don't return it
      const finalState: GameState = {
        ...state,
        players: nextPlayers,
        gameLog: log,
        phase: rolledDouble ? "readyToRoll" : "turnComplete",
        landingMessage: msg,
        landingAction: { kind: "message", spaceIndex: currentPlayer.position, message: msg },
      };
      return { state: finalState, resolvedMessage: msg };
    }

    case "repairs": {
      const houseRate = card.houseRepairCost ?? 0;
      const hotelRate = card.hotelRepairCost ?? 0;
      const playerOwnerships = state.ownerships.filter(
        (o) => o.ownerId === currentPlayer.id,
      );
      let houseCount = 0;
      let hotelCount = 0;
      for (const o of playerOwnerships) {
        if (o.hasHotel) hotelCount++;
        else houseCount += o.houses;
      }
      const total = houseCount * houseRate + hotelCount * hotelRate;
      const newCash = currentPlayer.cash - total;
      const nextPlayers = state.players.map((p, i) =>
        i === state.currentPlayerIndex ? { ...p, cash: newCash } : p,
      );
      const msg =
        total > 0
          ? `${currentPlayer.name} paid $${total} in repairs (${houseCount} houses × $${houseRate}, ${hotelCount} hotels × $${hotelRate}).`
          : `${currentPlayer.name} drew repairs card but owns no houses or hotels. No charge.`;
      let log = addLogEntry(state.gameLog, `${currentPlayer.name} drew: "${card.text}"`);
      log = addLogEntry(log, msg);
      const finalState: GameState = {
        ...state,
        players: nextPlayers,
        gameLog: log,
        [deckKey]: returnCardToBottom(state[deckKey], card.id),
        phase: rolledDouble ? "readyToRoll" : "turnComplete",
        landingMessage: msg,
        landingAction: { kind: "message", spaceIndex: currentPlayer.position, message: msg },
      };
      return { state: checkBankruptcy(finalState, { type: "bank" }), resolvedMessage: msg };
    }

    default:
      return {
        state: { ...state, [deckKey]: returnCardToBottom(state[deckKey], card.id) },
        resolvedMessage: card.text,
      };
  }
}

export { checkBankruptcy } from "@/lib/game/bankruptcy";
