import type { PropertyOwnership } from "@/types/game";

/**
 * Returns display state for the mortgage overlay on a board tile.
 * Pure helper — no JSX, testable in node environment.
 */
export function getMortgageVisualState(ownership: PropertyOwnership | undefined): {
  isMortgaged: boolean;
  overlayLabel: string;
} {
  const isMortgaged = ownership?.isMortgaged ?? false;
  return { isMortgaged, overlayLabel: isMortgaged ? "MORTGAGED" : "" };
}
