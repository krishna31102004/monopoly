import type { GameMode } from "@/types/game";

export const FREE_PARKING_POT_CAP = 500;

/** Auction variants share the capped Free Parking jackpot rule. */
export function hasCappedFreeParkingPot(gameMode: GameMode): boolean {
  return gameMode === "auction" || gameMode === "hidden-auction";
}
