/**
 * Computes the approximate pixel centre of a board space inside a square board.
 * Mirrors the grid column/row logic from getBoardGridPlacement.
 */
export const MOBILE_BOARD_SIZE_PX = 840;

/** Zoom limits for the mobile board view. */
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 1.8;

/**
 * Compute the CSS scale factor to fit the full board within container dimensions.
 * Returns at most 1.0 so the board is never upscaled beyond its natural size.
 */
export function getBoardFitScale(containerWidth: number, containerHeight: number): number {
  if (containerWidth <= 0 || containerHeight <= 0) return 1;
  return Math.min(
    containerWidth / MOBILE_BOARD_SIZE_PX,
    containerHeight / MOBILE_BOARD_SIZE_PX,
    1.0,
  );
}

export function getBoardSpaceScrollOffset(
  spaceIndex: number,
  boardSizePx = MOBILE_BOARD_SIZE_PX,
): { x: number; y: number } {
  const COLS = 11;
  const cellSize = boardSizePx / COLS;

  let col: number;
  let row: number;

  if (spaceIndex >= 0 && spaceIndex <= 10) {
    col = 11 - spaceIndex;
    row = 11;
  } else if (spaceIndex >= 11 && spaceIndex <= 20) {
    col = 1;
    row = 21 - spaceIndex;
  } else if (spaceIndex >= 21 && spaceIndex <= 30) {
    col = spaceIndex - 19;
    row = 1;
  } else {
    col = 11;
    row = spaceIndex - 29;
  }

  return {
    x: (col - 0.5) * cellSize,
    y: (row - 0.5) * cellSize,
  };
}

/** Scrolls a container element to centre on a given board space. */
export function scrollBoardToSpace(
  container: HTMLElement,
  spaceIndex: number,
  boardSizePx = MOBILE_BOARD_SIZE_PX,
): void {
  const { x, y } = getBoardSpaceScrollOffset(spaceIndex, boardSizePx);
  const left = Math.max(0, x - container.clientWidth / 2);
  const top = Math.max(0, y - container.clientHeight / 2);
  container.scrollTo({ left, top, behavior: "smooth" });
}
