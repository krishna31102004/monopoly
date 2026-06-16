import { getColorGroupSpaces, ownsFullColorGroup } from "@/lib/game/propertyDevelopment";
import type { CityProperty } from "@/types/board";
import type { PropertyOwnership } from "@/types/game";

/** Which outer edge of the board a tile sits on, based on its grid index (0-39). Bottom row is
 *  0-10, left column is 11-20, top row is 21-30, right column is 31-39 (see board-grid.ts). */
export type BoardEdge = "bottom" | "left" | "top" | "right";

/** Compact, premium owner badge label — initials, never a truncated "PLAY…"-style fragment.
 *  - Multi-word names: initials of the first two words ("Krishna Balaji" -> "KB").
 *  - Single word + trailing digits: first letter + digits ("Player2" -> "P2").
 *  - Short single word (<=4 chars): full word, uppercased ("ansh" -> "ANSH", "kb" -> "KB").
 *  - Long single word with no digits: first two letters ("Player" -> "PL"). */
export function getOwnerBadgeLabel(playerName: string): string {
  const trimmed = playerName.trim();
  if (!trimmed) return "?";

  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    return words
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
  }

  const word = words[0];
  const digitMatch = word.match(/^([A-Za-z]+)(\d+)$/);
  if (digitMatch) {
    return (digitMatch[1][0] + digitMatch[2]).toUpperCase();
  }

  if (word.length <= 4) return word.toUpperCase();
  return word.slice(0, 2).toUpperCase();
}

/** The board edge a tile's owner badge should attach to, so it never overlaps the city name,
 *  price, or houses/hotels in the tile's interior. */
export function getOwnerBadgePlacement(spaceIndex: number): BoardEdge {
  if (spaceIndex >= 0 && spaceIndex <= 10) return "bottom";
  if (spaceIndex >= 11 && spaceIndex <= 20) return "left";
  if (spaceIndex >= 21 && spaceIndex <= 30) return "top";
  return "right";
}

/** True when the given owner currently owns every city in this property's color group —
 *  drives the subtle full-set glow/indicator on the board. Re-exported under a UI-facing name
 *  so board components don't need to reach into game logic helpers directly. */
export function isFullSetOwner(
  city: CityProperty,
  ownerships: PropertyOwnership[],
  ownerId: string,
): boolean {
  return ownsFullColorGroup(city, ownerships, ownerId);
}

export { getColorGroupSpaces };
