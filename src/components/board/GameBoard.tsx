"use client";

import { useRef } from "react";
import { BoardSpace } from "@/components/board/BoardSpace";
import { getBoardGridPlacement } from "@/lib/board-grid";
import { scrollBoardToSpace, MOBILE_BOARD_SIZE_PX } from "@/lib/animation/boardScroll";
import type { BoardCenterStatus } from "@/lib/ui/gameEventPresentation";
import type { BoardSpace as BoardSpaceType, OwnableSpace } from "@/types/board";
import type { PropertyOwnership } from "@/types/game";
import type { Player } from "@/types/player";

type GameBoardProps = {
  spaces: BoardSpaceType[];
  players: Player[];
  ownerships?: PropertyOwnership[];
  /** Override display positions (used for step-by-step movement animation) */
  displayPositions?: Record<string, number>;
  /** Player IDs currently in landing-bounce state */
  landingPlayerIds?: Set<string>;
  onOpenProperty: (space: OwnableSpace) => void;
  /** Index of the player whose turn it is — used by "Find me" on mobile */
  currentPlayerIndex?: number;
  /** Dynamic center-of-board status (turn, dice, auction, trade, pot, etc.) */
  centerStatus?: BoardCenterStatus;
};

export function GameBoard({
  spaces,
  players,
  ownerships = [],
  displayPositions,
  landingPlayerIds,
  onOpenProperty,
  currentPlayerIndex = 0,
  centerStatus,
}: GameBoardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const playersByPosition = players.reduce<Record<number, Player[]>>((groups, player) => {
    if (player.isBankrupt) return groups;
    const pos = displayPositions?.[player.id] ?? player.position;
    groups[pos] = [...(groups[pos] ?? []), player];
    return groups;
  }, {});

  function handleFindMe() {
    if (!scrollRef.current) return;
    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer) return;
    const pos = displayPositions?.[currentPlayer.id] ?? currentPlayer.position;
    scrollBoardToSpace(scrollRef.current, pos, MOBILE_BOARD_SIZE_PX);
  }

  return (
    <div className="relative w-full">
      {/*
        Mobile: overflow:auto + fixed 840 px board = 2-D pannable viewport.
        Desktop (sm+): overflow:visible, board self-sizes via max-w clamp.
      */}
      <div
        ref={scrollRef}
        className="w-full overflow-auto sm:overflow-visible board-scroll-container"
      >
        <div
          className={[
            // Mobile: fixed readable width — the scroll container handles overflow
            "w-[840px]",
            // sm+: responsive, fits viewport
            "sm:w-full sm:mx-auto",
            "sm:max-w-[min(94vw,calc(100vh-2rem),980px)]",
            "xl:max-w-[min(76vw,calc(100vh-2rem),1100px)]",
          ].join(" ")}
        >
          <div className="board-hero-frame relative">
            <div
              className="relative grid aspect-square grid-cols-11 grid-rows-11 overflow-hidden rounded-[10px] border-[3px] border-[var(--board-border)] bg-[var(--board-line)] shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]"
              aria-label="World Cities game board"
            >
              {/* Board centre */}
              <div className="col-start-2 col-span-9 row-start-2 row-span-9 flex flex-col items-center justify-center gap-1 border border-[var(--board-border)] bg-gradient-to-br from-[var(--board-paper)] via-[var(--board-paper)] to-amber-50 p-4 text-center shadow-[inset_0_0_40px_rgba(15,26,28,0.06)]">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500 sm:text-[11px]">
                  Private Board Game
                </p>
                <h1 className="mt-0.5 text-xl font-black leading-none tracking-tight text-slate-950 sm:text-3xl lg:text-[2.6rem]">
                  World Cities
                </h1>
                <div className="mt-1 flex gap-1 sm:gap-1.5">
                  {["🇲🇽","🇮🇳","🇩🇪","🇦🇪","🇮🇹","🇦🇺","🇬🇧","🇺🇸"].map((flag) => (
                    <span key={flag} className="text-sm sm:text-lg lg:text-xl" aria-hidden="true">{flag}</span>
                  ))}
                </div>

                {centerStatus ? (
                  <div className="mt-2 rounded-full border border-amber-300 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                    <p className="text-[10px] font-black leading-tight text-slate-900 sm:text-xs">
                      {centerStatus.title}
                    </p>
                    {centerStatus.subtitle ? (
                      <p className="mt-0.5 text-[9px] font-bold leading-tight text-amber-700 sm:text-[10px]">
                        {centerStatus.subtitle}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 hidden text-[10px] font-semibold leading-5 text-slate-500 sm:block sm:text-xs">
                    Buy cities · Collect rent · Win the world
                  </p>
                )}
              </div>

              {spaces.map((space) => (
                <BoardSpace
                  key={space.index}
                  space={space}
                  players={playersByPosition[space.index] ?? []}
                  allPlayers={players}
                  ownerships={ownerships}
                  landingPlayerIds={landingPlayerIds}
                  style={getBoardGridPlacement(space.index)}
                  onOpenProperty={onOpenProperty}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only: scroll hint + Find Me button */}
      <div className="mt-1 flex items-center justify-between sm:hidden">
        <p className="board-scroll-hint text-[10px] font-semibold text-slate-400">
          ← Drag board to scroll →
        </p>
        <button
          type="button"
          onClick={handleFindMe}
          className="mobile-action-btn rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-black text-slate-600 shadow-sm active:bg-slate-100"
        >
          📍 Find me
        </button>
      </div>
    </div>
  );
}
