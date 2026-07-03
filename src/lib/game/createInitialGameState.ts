import { chanceCards, communityChestCards } from "@/data/cards";
import { createInitialOwnerships } from "@/lib/game/ownership";
import type { GameLogEntry, GameRules, GameState, StartGamePlayer } from "@/types/game";
import { DEFAULT_RULES } from "@/types/game";
import type { Player } from "@/types/player";

function shuffleIds(cards: { id: string }[]): string[] {
  const ids = cards.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

function createLogEntry(message: string): GameLogEntry {
  return {
    id: crypto.randomUUID(),
    message,
    createdAt: new Date().toISOString(),
  };
}

export function createSetupGameState(): GameState {
  return {
    players: [],
    ownerships: [],
    currentPlayerIndex: 0,
    phase: "setup",
    diceRoll: null,
    currentPlayerHasRolled: false,
    doublesCount: 0,
    gameLog: [],
    landingMessage: null,
    landingAction: null,
    auction: null,
    drawnCard: null,
    winnerId: null,
    chanceDeck: [],
    communityChestDeck: [],
    trade: null,
    bankruptcy: null,
    rules: DEFAULT_RULES,
    freeParkingPot: 0,
    forfeitAuctionQueue: [],
    turnDeadlineAt: null,
  };
}

export function createInitialGameState(players: StartGamePlayer[], rules?: GameRules): GameState {
  const gamePlayers: Player[] = players.map((player, index) => ({
    id: player.id ?? `player-${index + 1}`,
    name: player.name.trim(),
    token: player.token,
    tokenLabel: player.tokenLabel,
    color: player.color,
    cash: 1500,
    position: 0,
    ownedCityIds: [],
    ownedAirportIds: [],
    ownedUtilityIds: [],
    isInJail: false,
    jailTurns: 0,
    getOutOfJailFreeCards: 0,
    isBankrupt: false,
    consecutiveTurnTimeouts: 0,
  }));

  return {
    players: gamePlayers,
    ownerships: createInitialOwnerships(),
    currentPlayerIndex: 0,
    phase: "readyToRoll",
    diceRoll: null,
    currentPlayerHasRolled: false,
    doublesCount: 0,
    gameLog: [
      createLogEntry(
        `Game started with ${gamePlayers.length} players. ${gamePlayers[0].name} goes first.`,
      ),
    ],
    landingMessage: null,
    landingAction: null,
    auction: null,
    drawnCard: null,
    winnerId: null,
    chanceDeck: shuffleIds(chanceCards),
    communityChestDeck: shuffleIds(communityChestCards),
    trade: null,
    bankruptcy: null,
    rules: rules ?? DEFAULT_RULES,
    freeParkingPot: 0,
    forfeitAuctionQueue: [],
    turnDeadlineAt: null,
  };
}

export function addLogEntry(entries: GameLogEntry[], message: string): GameLogEntry[] {
  return [createLogEntry(message), ...entries].slice(0, 40);
}
