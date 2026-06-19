import type { GameRules } from "@/types/game";

/**
 * Returns the GO award for a single move event.
 *
 * exactGoBonus rule:
 *   OFF → $200 for any GO crossing (pass or land)
 *   ON  → $300 for landing exactly on GO, $200 for passing without landing
 *
 * If neither passedGo nor landedOnGo, returns 0 (no GO event).
 * Landing exactly on GO counts as ONE event — no double payment.
 */
export function getGoAward(
  passedGo: boolean,
  landedOnGo: boolean,
  rules: GameRules,
): number {
  if (!passedGo && !landedOnGo) return 0;
  if (landedOnGo && rules.exactGoBonus) return 300;
  return 200;
}

export function getGoAwardLogMessage(
  playerName: string,
  passedGo: boolean,
  landedOnGo: boolean,
  rules: GameRules,
): string | null {
  const award = getGoAward(passedGo, landedOnGo, rules);
  if (award === 0) return null;
  if (landedOnGo && rules.exactGoBonus) {
    return `${playerName} landed on GO and collected $300.`;
  }
  if (passedGo) {
    return `${playerName} passed GO and collected $200.`;
  }
  return null;
}
