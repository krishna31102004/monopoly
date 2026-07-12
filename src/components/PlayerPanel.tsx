"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { getBoardSpaceByIndex } from "@/data/board";
import { getOwnedSpaceIds } from "@/lib/game/ownership";
import { CITY_COLOR_HEX } from "@/lib/ui/propertyColors";
import { TokenIcon } from "@/components/board/TokenIcon";
import {
  getJailDisplay,
  getOwnedPropertyChips,
  getPlayerStatusChips,
  getWealthBarPercent,
  PLAYER_CARD_DEFAULT_EXPANDED,
  type PlayerStatusChip,
} from "@/lib/game/playerPanelHelpers";
import type { BoardSpace } from "@/types/board";
import type { PropertyOwnership } from "@/types/game";
import type { Player } from "@/types/player";

type PlayerPanelProps = {
  player: Player;
  spaces: BoardSpace[];
  ownerships: PropertyOwnership[];
  isCurrentPlayer?: boolean;
  allPlayers?: Player[];
  isOnline?: boolean;
  isInActiveTrade?: boolean;
  isInActiveAuction?: boolean;
  isInDebt?: boolean;
};

const STATUS_CHIP_STYLES: Record<PlayerStatusChip, string> = {
  TURN: "bg-white/90 text-slate-950",
  ONLINE: "bg-emerald-100 text-emerald-700",
  "IN JAIL": "bg-red-100 text-red-700",
  DEBT: "bg-amber-100 text-amber-700",
  BANKRUPT: "bg-red-100 text-red-700",
  TRADING: "bg-violet-100 text-violet-700",
  AUCTION: "bg-blue-100 text-blue-700",
};

function StatusChip({ chip }: { chip: PlayerStatusChip }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${STATUS_CHIP_STYLES[chip]}`}
    >
      {chip}
    </span>
  );
}

export function PlayerPanel({
  player,
  spaces,
  ownerships,
  isCurrentPlayer = false,
  allPlayers,
  isOnline,
  isInActiveTrade,
  isInActiveAuction,
  isInDebt,
}: PlayerPanelProps) {
  // Every card starts collapsed — current-player emphasis is purely visual
  // (border/glow/badge), never a structural difference, so expand state
  // can't silently diverge between cards.
  const [expanded, setExpanded] = useState(PLAYER_CARD_DEFAULT_EXPANDED);

  const position = getBoardSpaceByIndex(player.position);
  const ownedSpaceIds = getOwnedSpaceIds(ownerships, player.id);
  const mortgagedSpaceIds = new Set(
    ownerships.filter((o) => o.isMortgaged).map((o) => o.spaceIndex),
  );
  const { cityGroups, airports, utilities } = getOwnedPropertyChips(
    ownedSpaceIds,
    spaces,
    mortgagedSpaceIds,
  );
  const ownedAssetCount = ownedSpaceIds.length;
  const houseCount = ownerships
    .filter((o) => ownedSpaceIds.includes(o.spaceIndex))
    .reduce((sum, o) => sum + (o.hasHotel ? 0 : o.houses), 0);
  const hotelCount = ownerships.filter(
    (o) => ownedSpaceIds.includes(o.spaceIndex) && o.hasHotel,
  ).length;
  const mortgagedCount = ownerships.filter(
    (o) => ownedSpaceIds.includes(o.spaceIndex) && o.isMortgaged,
  ).length;

  const jail = getJailDisplay(player);
  const statusChips = getPlayerStatusChips({
    player,
    isCurrentPlayer,
    isOnline,
    isInActiveTrade,
    isInActiveAuction,
    isInDebt,
  });
  const wealthPercent = allPlayers ? getWealthBarPercent(player, allPlayers) : null;

  return (
    <article
      className={`overflow-hidden rounded-2xl border transition-all ${
        isCurrentPlayer
          ? "border-transparent shadow-[0_0_0_2px_var(--turn-glow),0_18px_44px_-12px_var(--turn-glow)]"
          : "border-slate-200 bg-white shadow-sm"
      } ${player.isBankrupt ? "opacity-50" : ""}`}
      style={
        isCurrentPlayer
          ? ({
              background: `linear-gradient(155deg, ${player.color}14, #ffffff 55%)`,
              "--turn-glow": `${player.color}55`,
            } as CSSProperties)
          : {}
      }
    >
      {isCurrentPlayer ? (
        <div
          className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white"
          style={{ backgroundColor: player.color }}
        >
          Now Playing
        </div>
      ) : null}

      {/* Header row: token, name, status, cash */}
      <div className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <TokenIcon
          token={player.token}
          color={player.color}
          size={isCurrentPlayer ? 46 : 38}
          label={player.tokenLabel}
          badge
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <h3 className="truncate text-[15px] font-black text-slate-950">{player.name}</h3>
            {statusChips.map((chip) => (
              <StatusChip key={chip} chip={chip} />
            ))}
          </div>
          <p className="truncate text-xs font-semibold text-slate-500">
            📍 {position.name}
            <span className="ml-1.5 text-slate-400">· {ownedAssetCount} assets</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-black tracking-tight text-slate-950">
            ${player.cash.toLocaleString()}
          </p>
          {wealthPercent !== null ? (
            <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${wealthPercent}%`, backgroundColor: player.color }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Compact jail status row */}
      <div className="border-t border-slate-100/80 px-3 py-2">
        {jail.inJail ? (
          <div className="flex items-center justify-between rounded-lg bg-red-50 px-2.5 py-1.5">
            <span className="text-xs font-black uppercase tracking-wide text-red-700">
              🚔 In Jail · Attempt {jail.attempt}/{jail.maxAttempts}
            </span>
            <span className="text-[10px] font-bold text-red-600">
              {jail.jailCardCount} jail card{jail.jailCardCount === 1 ? "" : "s"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              Free
            </span>
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              {jail.jailCardCount} jail card{jail.jailCardCount === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      {/* Compact property chip summary (always visible) */}
      {ownedAssetCount > 0 ? (
        <div className="border-t border-slate-100/80 px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {cityGroups.map((group) =>
              group.chips.map((chip) => (
                <span
                  key={chip.spaceIndex}
                  title={chip.name}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${chip.isMortgaged ? "opacity-50" : ""}`}
                  style={{ backgroundColor: CITY_COLOR_HEX[group.colorGroup] }}
                >
                  {chip.name}
                  {group.isFullSet ? " ★" : ""}
                </span>
              )),
            )}
            {airports.map((chip) => (
              <span
                key={chip.spaceIndex}
                title={chip.name}
                className={`rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-white ${chip.isMortgaged ? "opacity-50" : ""}`}
              >
                ✈ {chip.name}
              </span>
            ))}
            {utilities.map((chip) => (
              <span
                key={chip.spaceIndex}
                title={chip.name}
                className={`rounded-full bg-cyan-700 px-2 py-0.5 text-[10px] font-bold text-white ${chip.isMortgaged ? "opacity-50" : ""}`}
              >
                💧 {chip.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-100/80 px-3 py-2">
          <p className="text-xs font-semibold text-slate-400">No properties owned</p>
        </div>
      )}

      {/* Explicit expand/collapse affordance — same on every card */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-center gap-1 border-t border-slate-100/80 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
      >
        Details {expanded ? "▴" : "▾"}
      </button>

      {/* Expanded detail section */}
      {expanded ? (
        <div className="space-y-2 border-t border-slate-100/80 bg-slate-50/60 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Portfolio detail</p>
          <div className="grid grid-cols-3 gap-1.5">
            <MiniStat label="Houses" value={String(houseCount)} />
            <MiniStat label="Hotels" value={String(hotelCount)} />
            <MiniStat label="Mortgaged" value={String(mortgagedCount)} warn={mortgagedCount > 0} />
          </div>
          {cityGroups.filter((g) => g.isFullSet).length > 0 ? (
            <p className="text-[10px] font-bold text-emerald-600">
              ★ Full set: {cityGroups.filter((g) => g.isFullSet).map((g) => g.colorGroup).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function MiniStat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-white px-2 py-1.5 shadow-sm">
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-xs font-black ${warn ? "text-amber-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}
