/** Pure, deterministic roll-off logic — fully testable without any DOM or socket dependencies. */

export type RollOffEntry = { die1: number; die2: number; total: number };

export type RollOffAgendaItem =
  | { kind: "resolved"; playerIds: string[] }
  | { kind: "tied"; playerIds: string[] };

/**
 * Group a set of players by their roll total (descending), producing an agenda
 * of resolved singletons and tied groups that need re-rolling.
 */
export function groupByTotal(
  playerIds: string[],
  rolls: Record<string, RollOffEntry>,
): RollOffAgendaItem[] {
  const byTotal = new Map<number, string[]>();
  for (const id of playerIds) {
    const roll = rolls[id];
    if (!roll) continue;
    const group = byTotal.get(roll.total) ?? [];
    group.push(id);
    byTotal.set(roll.total, group);
  }

  return [...byTotal.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, players]) =>
      players.length === 1
        ? { kind: "resolved" as const, playerIds: players }
        : { kind: "tied" as const, playerIds: players },
    );
}

/**
 * Build the initial agenda from round-1 rolls of all participants.
 * Each player must appear in `rolls` (all must have rolled before calling this).
 */
export function buildInitialAgenda(
  participantIds: string[],
  rolls: Record<string, RollOffEntry>,
): RollOffAgendaItem[] {
  return groupByTotal(participantIds, rolls);
}

/**
 * Given the current agenda and the results of the latest tie-breaker round,
 * replace the first `tied` item with the newly resolved groups.
 * Items before and after the first tied group are unchanged.
 */
export function advanceRollOffAgenda(
  agenda: RollOffAgendaItem[],
  roundRolls: Record<string, RollOffEntry>,
): RollOffAgendaItem[] {
  const firstTiedIndex = agenda.findIndex((item) => item.kind === "tied");
  if (firstTiedIndex === -1) return agenda;

  const tiedItem = agenda[firstTiedIndex] as { kind: "tied"; playerIds: string[] };
  const newItems = groupByTotal(tiedItem.playerIds, roundRolls);

  return [
    ...agenda.slice(0, firstTiedIndex),
    ...newItems,
    ...agenda.slice(firstTiedIndex + 1),
  ];
}

/** Returns the players in the current tie group (first `tied` agenda item). */
export function getCurrentRollingGroup(agenda: RollOffAgendaItem[]): string[] {
  return agenda.find((item) => item.kind === "tied")?.playerIds ?? [];
}

/** True when all agenda items are `resolved` — no more tied groups to re-roll. */
export function isAgendaResolved(agenda: RollOffAgendaItem[]): boolean {
  return !agenda.some((item) => item.kind === "tied");
}

/** Flatten the agenda into a final ordered list of player IDs. */
export function flattenAgenda(agenda: RollOffAgendaItem[]): string[] {
  return agenda.flatMap((item) => item.playerIds);
}

/** Ordinal label: 1 → "1st", 2 → "2nd", etc. */
export function ordinalLabel(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
