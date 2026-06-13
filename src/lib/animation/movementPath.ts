const BOARD_SIZE = 40;
const JAIL_INDEX = 10;
// Max steps before we treat a move as a "teleport" (e.g. Go To Jail, card effect)
const TELEPORT_THRESHOLD = 13;

/**
 * Returns the ordered list of space indices a token visits when moving forward
 * from `fromIndex` to `toIndex` (not including `fromIndex`, including `toIndex`).
 *
 * Wraps around GO (index 0). For "Go To Jail" style moves that would require
 * more than TELEPORT_THRESHOLD steps, returns [toIndex] so the token snaps
 * instead of looping most of the board.
 */
export function getBoardMovementPath(
  fromIndex: number,
  toIndex: number,
  boardSize = BOARD_SIZE,
): number[] {
  if (fromIndex === toIndex) return [toIndex];

  const path: number[] = [];
  let current = fromIndex;
  while (current !== toIndex) {
    current = (current + 1) % boardSize;
    path.push(current);
    // Safety: cap at boardSize steps to avoid infinite loop on bad data
    if (path.length >= boardSize) break;
  }

  // If the path is very long, it's a non-movement teleport (Go To Jail, card).
  // Return a single-step "snap" so we don't animate 20+ spaces.
  if (path.length > TELEPORT_THRESHOLD) return [toIndex];

  return path;
}

/** Returns true if this move should be treated as a jail teleport */
export function isJailTeleport(fromIndex: number, toIndex: number, boardSize = BOARD_SIZE): boolean {
  if (toIndex !== JAIL_INDEX) return false;
  const steps = ((toIndex - fromIndex + boardSize) % boardSize) || boardSize;
  return steps > TELEPORT_THRESHOLD;
}
