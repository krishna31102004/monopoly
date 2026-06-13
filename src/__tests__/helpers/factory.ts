import { createInitialGameState } from "@/lib/game/createInitialGameState";
import { getBoardSpaceByIndex } from "@/data/board";
import type { StartGamePlayer, GameState, DiceRoll } from "@/types/game";
import type { Player } from "@/types/player";

const TOKENS = ["car", "hat", "ship", "shoe", "dog", "cat"] as const;
const COLORS = ["#ef4444", "#2563eb", "#16a34a", "#ca8a04", "#7c3aed", "#0891b2"];

export function makePlayer(n: number): StartGamePlayer {
  return {
    name: `Player ${n + 1}`,
    token: TOKENS[n % TOKENS.length],
    tokenLabel: TOKENS[n % TOKENS.length].toUpperCase().slice(0, 3),
    color: COLORS[n % COLORS.length],
  };
}

export function makeGameState(playerCount = 2): GameState {
  const players = Array.from({ length: playerCount }, (_, i) => makePlayer(i));
  return createInitialGameState(players);
}

/** Fixed deterministic dice roll */
export function dice(die1: number, die2: number): DiceRoll {
  return { die1, die2, total: die1 + die2, isDouble: die1 === die2 };
}

/** Patch a specific player */
export function withPlayer(state: GameState, index: number, patch: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((p, i) => (i === index ? { ...p, ...patch } : p)),
  };
}

/** Set current player's position */
export function withPosition(state: GameState, position: number): GameState {
  return withPlayer(state, state.currentPlayerIndex, { position });
}

/** Set current player's cash */
export function withCash(state: GameState, cash: number): GameState {
  return withPlayer(state, state.currentPlayerIndex, { cash });
}

/**
 * Give a property at spaceIndex to the player with playerId.
 * Updates both ownerships and the player's owned arrays.
 */
export function withOwnership(
  state: GameState,
  spaceIndex: number,
  playerId: string,
): GameState {
  const nextOwnerships = state.ownerships.map((o) =>
    o.spaceIndex === spaceIndex ? { ...o, ownerId: playerId } : o,
  );

  const space = getBoardSpaceByIndex(spaceIndex);

  const nextPlayers = state.players.map((p) => {
    if (p.id !== playerId) return p;
    return {
      ...p,
      ownedCityIds: space.kind === "city" ? [...p.ownedCityIds, spaceIndex] : p.ownedCityIds,
      ownedAirportIds:
        space.kind === "airport" ? [...p.ownedAirportIds, spaceIndex] : p.ownedAirportIds,
      ownedUtilityIds:
        space.kind === "utility" ? [...p.ownedUtilityIds, spaceIndex] : p.ownedUtilityIds,
    };
  });

  return { ...state, ownerships: nextOwnerships, players: nextPlayers };
}

/** Mark a property as mortgaged */
export function withMortgage(state: GameState, spaceIndex: number): GameState {
  return {
    ...state,
    ownerships: state.ownerships.map((o) =>
      o.spaceIndex === spaceIndex ? { ...o, isMortgaged: true } : o,
    ),
  };
}

/** Set houses on a property */
export function withHouses(state: GameState, spaceIndex: number, houses: number): GameState {
  return {
    ...state,
    ownerships: state.ownerships.map((o) =>
      o.spaceIndex === spaceIndex ? { ...o, houses } : o,
    ),
  };
}

/** Set a fixed chance deck (first card will be drawn next) */
export function withChanceDeck(state: GameState, cardIds: string[]): GameState {
  return { ...state, chanceDeck: cardIds };
}

export function withCommunityChestDeck(state: GameState, cardIds: string[]): GameState {
  return { ...state, communityChestDeck: cardIds };
}

/** Get the current player from state */
export function currentPlayer(state: GameState) {
  return state.players[state.currentPlayerIndex];
}

/** Get player by 0-based index */
export function playerAt(state: GameState, index: number) {
  return state.players[index];
}

/** Find player by id */
export function playerById(state: GameState, id: string) {
  return state.players.find((p) => p.id === id)!;
}
