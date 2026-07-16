"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { getBoardSpaceByIndex } from "@/data/board";
import { getOwnedSpaceIds } from "@/lib/game/ownership";
import { getDesignReadableTextColor } from "@/lib/ui/designTokens";
import { CITY_COLOR_HEX } from "@/lib/ui/propertyColors";
import { TokenIcon } from "@/components/board/TokenIcon";
import { UiIcon } from "@/components/ui/UiIcon";
import {
  getJailDisplay,
  getOwnedPropertyChips,
  getPlayerStatusChips,
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
  TURN: "border border-[var(--wc-gold-border)] bg-[var(--wc-gold-soft)] text-amber-100",
  ONLINE: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  "IN JAIL": "border border-rose-500/30 bg-rose-500/10 text-rose-200",
  DEBT: "border border-amber-500/30 bg-amber-500/10 text-amber-100",
  BANKRUPT: "border border-rose-500/30 bg-rose-500/10 text-rose-200",
  TRADING: "border border-violet-400/30 bg-violet-400/10 text-violet-200",
  AUCTION: "border border-sky-400/30 bg-sky-400/10 text-sky-200",
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
  allPlayers: _allPlayers,
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
  return (
    <article
      className={`overflow-hidden rounded-[var(--wc-radius-medium)] border bg-[var(--wc-navy-raised)] transition-colors ${
        isCurrentPlayer
          ? "border-[var(--wc-gold-border)] shadow-[0_0_0_1px_var(--wc-gold-soft),var(--wc-shadow-card)]"
          : "border-[var(--wc-border)] shadow-[var(--wc-shadow-card)]"
      } ${player.isBankrupt ? "opacity-50" : ""}`}
      style={{ borderLeftWidth: 3, borderLeftColor: player.color } as CSSProperties}
    >
      {isCurrentPlayer ? (
        <div className="border-b border-[var(--wc-gold-border)] bg-[var(--wc-gold-soft)] px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-amber-100">
          Now Playing
        </div>
      ) : null}

      {/* Header row: token, name, status, cash */}
      <div className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <TokenIcon
          token={player.token}
          color={player.color}
          size={isCurrentPlayer ? 42 : 36}
          label={player.tokenLabel}
          badge
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <h3 className="truncate text-[15px] font-black text-white">{player.name}</h3>
            {statusChips.map((chip) => (
              <StatusChip key={chip} chip={chip} />
            ))}
          </div>
          <p className="flex min-w-0 items-center gap-1 truncate text-xs font-semibold text-slate-400">
            <UiIcon name="home" size={13} aria-hidden="true" />
            <span className="truncate">{position.name}</span>
            <span className="shrink-0 text-slate-500">· {ownedAssetCount} assets</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="wc-numeric text-lg font-black tracking-tight text-white">
            ${player.cash.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Compact jail status row */}
      <div className="border-t border-[var(--wc-border-subtle)] px-3 py-2">
        {jail.inJail ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5">
            <span className="flex items-center gap-1 text-xs font-black uppercase tracking-wide text-rose-200">
              <UiIcon name="jail" size={14} aria-hidden="true" />
              In Jail · Attempt {jail.attempt}/{jail.maxAttempts}
            </span>
            <span className="shrink-0 text-[10px] font-bold text-rose-200">
              {jail.jailCardCount} jail card{jail.jailCardCount === 1 ? "" : "s"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-[var(--wc-navy-elevated)] px-2 py-0.5 text-[10px] font-bold text-slate-300">
              Free
            </span>
            <span className="rounded-full bg-[var(--wc-navy-elevated)] px-2 py-0.5 text-[10px] font-bold text-slate-300">
              {jail.jailCardCount} jail card{jail.jailCardCount === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      {/* Compact property chip summary (always visible) */}
      {ownedAssetCount > 0 ? (
        <div className="border-t border-[var(--wc-border-subtle)] px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {cityGroups.map((group) =>
              group.chips.map((chip) => (
                <span
                  key={chip.spaceIndex}
                  title={chip.name}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${chip.isMortgaged ? "opacity-50" : ""}`}
                  style={{
                    backgroundColor: CITY_COLOR_HEX[group.colorGroup],
                    color: getDesignReadableTextColor(CITY_COLOR_HEX[group.colorGroup]),
                  }}
                >
                  {chip.name}
                  {group.isFullSet ? " · Full set" : ""}
                </span>
              )),
            )}
            {airports.map((chip) => (
              <span
                key={chip.spaceIndex}
                title={chip.name}
                className={`rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-white ${chip.isMortgaged ? "opacity-50" : ""}`}
              >
                <UiIcon name="airport" size={12} aria-hidden="true" /> {chip.name}
              </span>
            ))}
            {utilities.map((chip) => (
              <span
                key={chip.spaceIndex}
                title={chip.name}
                className={`rounded-full bg-cyan-700 px-2 py-0.5 text-[10px] font-bold text-white ${chip.isMortgaged ? "opacity-50" : ""}`}
              >
                <UiIcon name="utility" size={12} aria-hidden="true" /> {chip.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-[var(--wc-border-subtle)] px-3 py-2">
          <p className="text-xs font-semibold text-slate-400">No properties owned</p>
        </div>
      )}

      {/* Explicit expand/collapse affordance — same on every card */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-center gap-1 border-t border-[var(--wc-border-subtle)] py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 transition-colors hover:bg-[var(--wc-navy-hover)] hover:text-white"
      >
        Details {expanded ? "▴" : "▾"}
      </button>

      {/* Expanded detail section */}
      {expanded ? (
        <div className="space-y-2 border-t border-[var(--wc-border-subtle)] bg-[var(--wc-navy-elevated)]/60 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Portfolio detail</p>
          <div className="grid grid-cols-3 gap-1.5">
            <MiniStat label="Houses" value={String(houseCount)} />
            <MiniStat label="Hotels" value={String(hotelCount)} />
            <MiniStat label="Mortgaged" value={String(mortgagedCount)} warn={mortgagedCount > 0} />
          </div>
          {cityGroups.filter((g) => g.isFullSet).length > 0 ? (
            <p className="text-[10px] font-bold text-emerald-200">
              Full set: {cityGroups.filter((g) => g.isFullSet).map((g) => g.colorGroup).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function MiniStat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--wc-border-subtle)] bg-[var(--wc-navy)] px-2 py-1.5">
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`wc-numeric text-xs font-black ${warn ? "text-amber-200" : "text-white"}`}>{value}</p>
    </div>
  );
}
