import { getColorGroupSpaces, ownsFullColorGroup } from "@/lib/game/propertyDevelopment";
import type { CityProperty } from "@/types/board";
import type { PropertyOwnership } from "@/types/game";

/** Restored (pre-4E.5) badge placement: a single fixed position — top-center, absolutely
 *  positioned over the color strip — regardless of which side of the board the tile sits on.
 *  Kept as a named type/return value (rather than a literal) so callers and tests have a
 *  stable contract even though there is currently only one placement. */
export type BoardEdge = "top-center";

/** Owner badge label — the player's actual display name, not initials. Truncated with an
 *  ellipsis only when the name is too long to fit the tile; short/normal names (e.g. "kb",
 *  "ansh", "botdaddy") are shown verbatim, case preserved. */
const MAX_BADGE_NAME_LENGTH = 10;

export function getOwnerBadgeLabel(playerName: string): string {
  const trimmed = playerName.trim();
  if (!trimmed) return "?";
  if (trimmed.length <= MAX_BADGE_NAME_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_BADGE_NAME_LENGTH - 1)}…`;
}

/** The owner badge's placement, restored to the single pre-4E.5 position (top-center over the
 *  color strip) for every space, regardless of which side of the board it's on. */
export function getOwnerBadgePlacement(_spaceIndex: number): BoardEdge {
  return "top-center";
}

/** CSS class for the badge's positioning, matching the restored top-center placement. */
export function getOwnerBadgeClassName(_spaceIndex: number): string {
  return "board-owner-badge-top-center";
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
