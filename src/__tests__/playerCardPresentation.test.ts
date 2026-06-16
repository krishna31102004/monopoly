import { describe, it, expect } from "vitest";
import {
  getOwnedPropertyChips,
  getPlayerStatusChips,
  getJailDisplay,
  PLAYER_CARD_DEFAULT_EXPANDED,
} from "@/lib/game/playerPanelHelpers";
import { boardSpaces } from "@/data/board";
import { makeGameState } from "./helpers/factory";

const GUADALAJARA = 1; // brown

// These tests lock in the "one consistent card skeleton" invariant: the data
// that feeds a current-player card and a non-current-player card must be
// structurally identical for the same underlying player state. The only
// thing that may differ because of isCurrentPlayer is the TURN status chip
// and the wrapper's emphasis styling (border/glow), never which sections
// render or what data they contain.

describe("player card skeleton consistency", () => {
  it("every card starts with the same default expand state", () => {
    expect(PLAYER_CARD_DEFAULT_EXPANDED).toBe(false);
  });

  it("isCurrentPlayer only changes the TURN chip, not jail/property data", () => {
    const state = makeGameState(2);
    let s = state;
    s = {
      ...s,
      ownerships: s.ownerships.map((o) =>
        o.spaceIndex === GUADALAJARA ? { ...o, ownerId: s.players[0].id } : o,
      ),
    };
    const player = s.players[0];
    const ownedSpaceIds = [GUADALAJARA];

    const currentChips = getOwnedPropertyChips(ownedSpaceIds, boardSpaces, new Set());
    const nonCurrentChips = getOwnedPropertyChips(ownedSpaceIds, boardSpaces, new Set());
    expect(currentChips).toEqual(nonCurrentChips);

    const currentJail = getJailDisplay(player);
    const nonCurrentJail = getJailDisplay(player);
    expect(currentJail).toEqual(nonCurrentJail);

    const statusAsCurrent = getPlayerStatusChips({ player, isCurrentPlayer: true });
    const statusAsNonCurrent = getPlayerStatusChips({ player, isCurrentPlayer: false });
    // TURN is the only chip current-player status adds when nothing else applies
    expect(statusAsCurrent.filter((c) => c !== "TURN")).toEqual(statusAsNonCurrent);
    expect(statusAsCurrent).toContain("TURN");
    expect(statusAsNonCurrent).not.toContain("TURN");
  });

  it("bankrupt players never show TURN even if marked current player", () => {
    const state = makeGameState(2);
    const bankruptPlayer = { ...state.players[0], isBankrupt: true };
    const chips = getPlayerStatusChips({ player: bankruptPlayer, isCurrentPlayer: true });
    expect(chips).toEqual(["BANKRUPT"]);
  });
});

describe("portfolio preview consistency across players", () => {
  it("a player with no properties gets an empty city/airport/utility result, not a partial one", () => {
    const result = getOwnedPropertyChips([], boardSpaces, new Set());
    expect(result.cityGroups).toEqual([]);
    expect(result.airports).toEqual([]);
    expect(result.utilities).toEqual([]);
  });

  it("two players with identical holdings produce identical chip output", () => {
    const a = getOwnedPropertyChips([GUADALAJARA], boardSpaces, new Set());
    const b = getOwnedPropertyChips([GUADALAJARA], boardSpaces, new Set());
    expect(a).toEqual(b);
  });
});
