import type { GridPlacement } from "@/types/board";

export function getBoardGridPlacement(index: number): GridPlacement {
  if (index < 0 || index > 39) {
    throw new Error(`Board index ${index} is outside the 0-39 board range.`);
  }

  if (index >= 0 && index <= 10) {
    return {
      gridColumn: `${11 - index}`,
      gridRow: "11",
    };
  }

  if (index >= 11 && index <= 20) {
    return {
      gridColumn: "1",
      gridRow: `${21 - index}`,
    };
  }

  if (index >= 21 && index <= 30) {
    return {
      gridColumn: `${index - 19}`,
      gridRow: "1",
    };
  }

  return {
    gridColumn: "11",
    gridRow: `${index - 29}`,
  };
}
