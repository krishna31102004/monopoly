import type { PlayerToken } from "@/types/player";

const TOKEN_KEYS: PlayerToken[] = ["car", "hat", "ship", "shoe", "dog", "cat"];

export function hasTokenIcon(token: string): token is PlayerToken {
  return TOKEN_KEYS.includes(token as PlayerToken);
}

/** Truncates a player name to fit the narrow ownership badge pill. */
export function getOwnerBadgeLabel(name: string): string {
  return name.length > 5 ? name.slice(0, 4) + "…" : name;
}

export type BadgePlacement = "top" | "bottom" | "left" | "right";

/**
 * Returns which inner edge of the tile the ownership badge should sit on,
 * based on the space's position around the board.
 * "top" = color-strip side of the tile (inner board edge for bottom-row tiles).
 */
export function getOwnerBadgePlacement(spaceIndex: number): BadgePlacement {
  if (spaceIndex >= 1 && spaceIndex <= 9) return "top";
  if (spaceIndex >= 11 && spaceIndex <= 19) return "right";
  if (spaceIndex >= 21 && spaceIndex <= 29) return "bottom";
  if (spaceIndex >= 31 && spaceIndex <= 39) return "left";
  return "top";
}
