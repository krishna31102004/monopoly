import type { BoardSpace, CityColorGroup } from "@/types/board";
import type { GameState } from "@/types/game";
import type { Player } from "@/types/player";

/** Total number of cities in each color group on this board (used for "full set" detection). */
export const COLOR_GROUP_SIZE: Record<CityColorGroup, number> = {
  brown: 2,
  "light-blue": 3,
  pink: 3,
  orange: 3,
  red: 3,
  yellow: 3,
  green: 3,
  "dark-blue": 2,
};

/**
 * Single source of truth for whether a player card starts expanded.
 * Every card — current player or not — must use this same default so the
 * portfolio-detail section never appears on one card but not another
 * without an explicit user click.
 */
export const PLAYER_CARD_DEFAULT_EXPANDED = false;

export type PropertyChipKind = "city" | "airport" | "utility";

export type PropertyChip = {
  spaceIndex: number;
  name: string;
  kind: PropertyChipKind;
  colorGroup: CityColorGroup | null;
  isMortgaged: boolean;
  isFullSet: boolean;
};

export type PropertyGroup = {
  colorGroup: CityColorGroup;
  chips: PropertyChip[];
  isFullSet: boolean;
};

/**
 * Builds visual chip data for a player's owned properties, grouping cities by
 * color group (for full-set detection/highlighting) and listing airports and
 * utilities separately.
 */
export function getOwnedPropertyChips(
  ownedSpaceIds: number[],
  spaces: BoardSpace[],
  mortgagedSpaceIds: Set<number>,
): { cityGroups: PropertyGroup[]; airports: PropertyChip[]; utilities: PropertyChip[] } {
  const ownedSet = new Set(ownedSpaceIds);
  const cityGroups = new Map<CityColorGroup, PropertyChip[]>();
  const airports: PropertyChip[] = [];
  const utilities: PropertyChip[] = [];

  for (const id of ownedSpaceIds) {
    const space = spaces.find((s) => s.index === id);
    if (!space) continue;

    if (space.kind === "city") {
      const group = cityGroups.get(space.colorGroup) ?? [];
      group.push({
        spaceIndex: id,
        name: space.name,
        kind: "city",
        colorGroup: space.colorGroup,
        isMortgaged: mortgagedSpaceIds.has(id),
        isFullSet: false,
      });
      cityGroups.set(space.colorGroup, group);
    } else if (space.kind === "airport") {
      airports.push({
        spaceIndex: id,
        name: space.name,
        kind: "airport",
        colorGroup: null,
        isMortgaged: mortgagedSpaceIds.has(id),
        isFullSet: false,
      });
    } else if (space.kind === "utility") {
      utilities.push({
        spaceIndex: id,
        name: space.name,
        kind: "utility",
        colorGroup: null,
        isMortgaged: mortgagedSpaceIds.has(id),
        isFullSet: false,
      });
    }
  }

  const groupTotals = new Map<CityColorGroup, number>();
  for (const space of spaces) {
    if (space.kind === "city") {
      groupTotals.set(space.colorGroup, (groupTotals.get(space.colorGroup) ?? 0) + (ownedSet.has(space.index) ? 1 : 0));
    }
  }

  const cityGroupResults: PropertyGroup[] = Array.from(cityGroups.entries()).map(([colorGroup, chips]) => {
    const isFullSet = (groupTotals.get(colorGroup) ?? 0) >= COLOR_GROUP_SIZE[colorGroup];
    return {
      colorGroup,
      chips: chips.map((chip) => ({ ...chip, isFullSet })),
      isFullSet,
    };
  });

  return { cityGroups: cityGroupResults, airports, utilities };
}

export type PlayerStatusChip =
  | "ONLINE"
  | "TURN"
  | "IN JAIL"
  | "DEBT"
  | "BANKRUPT"
  | "TRADING"
  | "AUCTION";

export type PlayerStatusInput = {
  player: Player;
  isCurrentPlayer: boolean;
  isOnline?: boolean;
  isInActiveTrade?: boolean;
  isInActiveAuction?: boolean;
  isInDebt?: boolean;
};

/**
 * Decides which status chips should be shown for a player, in priority order.
 * Only relevant chips are returned — callers should not show more than this set.
 */
export function getPlayerStatusChips(input: PlayerStatusInput): PlayerStatusChip[] {
  const { player, isCurrentPlayer, isOnline, isInActiveTrade, isInActiveAuction, isInDebt } = input;
  const chips: PlayerStatusChip[] = [];

  if (player.isBankrupt) {
    chips.push("BANKRUPT");
    return chips;
  }

  if (isCurrentPlayer) chips.push("TURN");
  if (player.isInJail) chips.push("IN JAIL");
  if (isInDebt) chips.push("DEBT");
  if (isInActiveAuction) chips.push("AUCTION");
  if (isInActiveTrade) chips.push("TRADING");
  if (isOnline !== undefined) chips.push(...(isOnline ? (["ONLINE"] as const) : []));

  return chips;
}

export type JailDisplay =
  | { inJail: false; jailCardCount: number }
  | { inJail: true; attempt: number; maxAttempts: number; jailCardCount: number };

const MAX_JAIL_ATTEMPTS = 3;

/** Determines the jail chip display: a calm "Free" chip, or a dramatic in-jail panel. */
export function getJailDisplay(player: Player): JailDisplay {
  if (!player.isInJail) {
    return { inJail: false, jailCardCount: player.getOutOfJailFreeCards };
  }
  return {
    inJail: true,
    attempt: Math.min(player.jailTurns + 1, MAX_JAIL_ATTEMPTS),
    maxAttempts: MAX_JAIL_ATTEMPTS,
    jailCardCount: player.getOutOfJailFreeCards,
  };
}

/**
 * A lightweight 0-100 wealth bar value, scaled against the richest active
 * player in the game so the bar is relative rather than an arbitrary cap.
 */
export function getWealthBarPercent(player: Player, allPlayers: Player[]): number {
  const active = allPlayers.filter((p) => !p.isBankrupt);
  const maxCash = Math.max(1, ...active.map((p) => p.cash));
  if (player.isBankrupt) return 0;
  return Math.max(2, Math.round((player.cash / maxCash) * 100));
}

export function isPlayerInActiveTrade(state: GameState, playerId: string): boolean {
  if (!state.trade) return false;
  return state.trade.initiatorPlayerId === playerId || state.trade.recipientPlayerId === playerId;
}

export function isPlayerInActiveAuction(state: GameState, playerId: string): boolean {
  if (!state.auction) return false;
  return state.auction.activePlayerIds.includes(playerId) && !state.auction.passedPlayerIds.includes(playerId);
}

export function isPlayerInDebt(state: GameState, playerId: string): boolean {
  return state.phase === "bankruptcyPending" && state.bankruptcy?.debtorPlayerId === playerId;
}
