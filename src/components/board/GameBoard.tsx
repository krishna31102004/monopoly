"use client";

// trigger redeploy
import { useEffect, useRef, useState } from "react";
import { BoardSpace } from "@/components/board/BoardSpace";
import { getBoardGridPlacement } from "@/lib/board-grid";
import { scrollBoardToSpace, MOBILE_BOARD_SIZE_PX, MIN_ZOOM, MAX_ZOOM } from "@/lib/animation/boardScroll";
import type { BoardSpace as BoardSpaceType, OwnableSpace } from "@/types/board";
import type { PropertyOwnership } from "@/types/game";
import type { Player } from "@/types/player";

const ZOOM_STEP = 0.2;

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
  /**
   * Opaque key that changes on meaningful game events (dice roll, turn change).
   * When it changes, auto-follow scrolls to the current player's position.
   */
  autoFollowKey?: string | null;
};

export function GameBoard({
  spaces,
  players,
  ownerships = [],
  displayPositions,
  landingPlayerIds,
  onOpenProperty,
  currentPlayerIndex = 0,
  autoFollowKey,
}: GameBoardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.0);
  const [fitMode, setFitMode] = useState(false);
  // True when the user manually scrolled/dragged — pauses auto-follow until reset.
  const userPausedRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);

  const playersByPosition = players.reduce<Record<number, Player[]>>((groups, player) => {
    if (player.isBankrupt) return groups;
    const pos = displayPositions?.[player.id] ?? player.position;
    groups[pos] = [...(groups[pos] ?? []), player];
    return groups;
  }, {});

  // ── Scroll helper ──────────────────────────────────────────────────────────

  function scrollToSpace(spaceIndex: number) {
    if (!scrollRef.current) return;
    isProgrammaticScrollRef.current = true;
    // In fit mode, the whole board is visible — no scrolling needed.
    if (!fitMode) {
      const boardPx = zoom !== 1.0 ? Math.round(MOBILE_BOARD_SIZE_PX * zoom) : MOBILE_BOARD_SIZE_PX;
      scrollBoardToSpace(scrollRef.current, spaceIndex, boardPx);
    }
    setTimeout(() => { isProgrammaticScrollRef.current = false; }, 600);
  }

  // ── Auto-follow ───────────────────────────────────────────────────────────

  useEffect(() => {
    // Do not fight the user if they manually panned.
    if (userPausedRef.current) return;
    // No scrolling needed in fit mode — whole board is already visible.
    if (fitMode) return;
    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer) return;
    const pos = displayPositions?.[currentPlayer.id] ?? currentPlayer.position;
    // Small delay lets the DOM settle after a state update.
    const id = setTimeout(() => scrollToSpace(pos), 100);
    return () => clearTimeout(id);
  }, [currentPlayerIndex, autoFollowKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll event — detect user-initiated panning ──────────────────────────

  function handleScroll() {
    if (!isProgrammaticScrollRef.current) {
      userPausedRef.current = true;
    }
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  function handleFindMe() {
    setFitMode(false);
    userPausedRef.current = false;
    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer) return;
    const pos = displayPositions?.[currentPlayer.id] ?? currentPlayer.position;
    setTimeout(() => scrollToSpace(pos), 50);
  }

  function handleFitBoard() {
    setFitMode(true);
    userPausedRef.current = false;
  }

  function handleZoomIn() {
    setFitMode(false);
    userPausedRef.current = false;
    setZoom((z) => Math.min(MAX_ZOOM, parseFloat((z + ZOOM_STEP).toFixed(1))));
  }

  function handleZoomOut() {
    setFitMode(false);
    userPausedRef.current = false;
    setZoom((z) => Math.max(MIN_ZOOM, parseFloat((z - ZOOM_STEP).toFixed(1))));
  }

  // ── Board sizing ───────────────────────────────────────────────────────────

  // In fit mode: board fills the container width (responsive, uses aspect-square).
  // In zoom mode: board is physically wider/narrower (scroll handles overflow).
  // In default: board is 840px (existing mobile scroll behavior).
  const innerBoardClass = [
    fitMode
      ? "w-full"
      : zoom !== 1.0
        ? "" // width set via inline style
        : "w-[840px]",
    "sm:w-full sm:mx-auto",
    "sm:max-w-[min(94vw,calc(100vh-2rem),980px)]",
    "xl:max-w-[min(76vw,calc(100vh-2rem),1100px)]",
  ]
    .filter(Boolean)
    .join(" ");

  const innerBoardStyle: React.CSSProperties =
    !fitMode && zoom !== 1.0
      ? { width: `${Math.round(MOBILE_BOARD_SIZE_PX * zoom)}px` }
      : {};

  const containerClass = [
    "w-full",
    fitMode ? "overflow-hidden" : "overflow-auto",
    "sm:overflow-visible board-scroll-container",
  ].join(" ");

  return (
    <div className="relative w-full">
      {/*
        Mobile: overflow:auto + fixed 840 px board = 2-D pannable viewport.
        Fit mode: overflow:hidden + w-full = entire board visible, scaled down.
        Desktop (sm+): overflow:visible, board self-sizes via max-w clamp.
      */}
      <div
        ref={scrollRef}
        className={containerClass}
        onScroll={handleScroll}
      >
        <div
          className={innerBoardClass}
          style={innerBoardStyle}
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

                <p className="mt-1 hidden text-[10px] font-semibold leading-5 text-slate-500 sm:block sm:text-xs">
                  Buy cities · Collect rent · Win the world
                </p>
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

      {/* Mobile-only controls: Fit Board · Find Me button · Zoom Out · Zoom In */}
      <div className="mt-1 flex items-center justify-between sm:hidden" data-testid="mobile-board-controls">
        <p className={`text-[10px] font-semibold ${fitMode ? "text-amber-600" : "text-slate-400"} board-scroll-hint`}>
          {fitMode ? "Fit view — tap Drag to scroll" : "← Drag board to scroll →"}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleFitBoard}
            aria-label="Fit board to screen"
            title="Fit Board"
            className={`mobile-action-btn rounded-full border px-2.5 py-1 text-[11px] font-black shadow-sm active:scale-95 ${
              fitMode
                ? "border-amber-400 bg-amber-50 text-amber-700"
                : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            🗺️
          </button>
          <button
            type="button"
            onClick={handleFindMe}
            aria-label="Find current player"
            title="Find Me"
            className="mobile-action-btn rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 shadow-sm active:scale-95"
          >
            📍
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            title="Zoom Out"
            disabled={zoom <= MIN_ZOOM && !fitMode}
            className="mobile-action-btn rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 shadow-sm active:scale-95 disabled:opacity-40"
          >
            −
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            title="Zoom In"
            disabled={zoom >= MAX_ZOOM}
            className="mobile-action-btn rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 shadow-sm active:scale-95 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
