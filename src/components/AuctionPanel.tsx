"use client";

import { useEffect, useRef, useState } from "react";
import { getBoardSpaceByIndex } from "@/data/board";
import { isOwnableSpace } from "@/lib/game/ownership";
import { AUCTION_TURN_MS } from "@/lib/animation/timing";
import type { GameAction, GameState } from "@/types/game";
import type { CityColorGroup } from "@/types/board";

type AuctionPanelProps = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isMyTurn?: boolean;
  /** When true, the active bidder's turn timer is enforced server-side and this
   *  component must not dispatch its own timeout PASS_AUCTION (avoids duplicate
   *  actions / desync in multiplayer). Local/offline mode leaves this false so the
   *  client drives the timeout itself. */
  serverAuthoritative?: boolean;
};

// ── Status badge ────────────────────────────────────────────────────────────

type ParticipantStatus = "TURN" | "HIGHEST" | "ACTIVE" | "PASSED";

function getParticipantStatus(
  playerId: string,
  auction: NonNullable<GameState["auction"]>,
): ParticipantStatus {
  if (auction.passedPlayerIds.includes(playerId)) return "PASSED";
  const currentBidderId = auction.activePlayerIds[auction.currentBidderIndex];
  if (playerId === currentBidderId) return "TURN";
  if (auction.highestBidderId === playerId) return "HIGHEST";
  return "ACTIVE";
}

const STATUS_BADGE_STYLE: Record<ParticipantStatus, string> = {
  TURN:    "bg-amber-500 text-slate-950 font-black",
  HIGHEST: "bg-emerald-600 text-white font-black",
  ACTIVE:  "bg-slate-600 text-slate-200 font-semibold",
  PASSED:  "bg-slate-800 text-slate-500 font-semibold",
};

function StatusBadge({ status }: { status: ParticipantStatus }) {
  return (
    <span
      className={`shrink-0 rounded px-1 py-0.5 text-[9px] uppercase tracking-wide ${STATUS_BADGE_STYLE[status]}`}
      aria-label={`Auction status: ${status}`}
    >
      {status}
    </span>
  );
}

// ── Color group dots ─────────────────────────────────────────────────────────

function getSpaceTypeLabel(kind: string) {
  if (kind === "city") return "City";
  if (kind === "airport") return "Airport";
  if (kind === "utility") return "Utility";
  return "Property";
}

const COLOR_GROUP_HEX: Record<CityColorGroup, string> = {
  brown: "#a16207",
  "light-blue": "#38bdf8",
  pink: "#f472b6",
  orange: "#fb923c",
  red: "#f87171",
  yellow: "#facc15",
  green: "#4ade80",
  "dark-blue": "#60a5fa",
};

// ── Property chip ─────────────────────────────────────────────────────────────

/** Compact chip for a single owned property during the auction overview. */
function PropertyChip({ spaceIndex, state }: { spaceIndex: number; state: GameState }) {
  const space = getBoardSpaceByIndex(spaceIndex);
  const ownership = state.ownerships.find((o) => o.spaceIndex === spaceIndex);
  const isMortgaged = ownership?.isMortgaged ?? false;
  const houses = ownership?.houses ?? 0;
  const hasHotel = ownership?.hasHotel ?? false;

  let dotColor = "#94a3b8"; // slate-400 default
  if (space.kind === "city") {
    dotColor = COLOR_GROUP_HEX[(space as { colorGroup: CityColorGroup }).colorGroup] ?? dotColor;
  }

  let badge: string | null = null;
  if (isMortgaged) badge = "M";
  else if (hasHotel) badge = "🏨";
  else if (houses > 0) badge = `H${houses}`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none ${
        isMortgaged ? "bg-slate-700 text-slate-400 line-through" : "bg-slate-700 text-slate-200"
      }`}
      title={space.name}
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />
      <span className="max-w-[60px] truncate">{space.name}</span>
      {badge ? (
        <span className={`ml-0.5 shrink-0 font-black ${isMortgaged ? "text-slate-500" : "text-amber-300"}`}>
          {badge}
        </span>
      ) : null}
    </span>
  );
}

// ── Per-player portfolio card ─────────────────────────────────────────────────

/** Per-player ownership summary card shown in the overview panel. */
function PlayerOwnershipCard({
  playerId,
  state,
  isBidding,
  isLeading,
  status,
  isExpanded,
  onToggle,
}: {
  playerId: string;
  state: GameState;
  isBidding: boolean;
  isLeading: boolean;
  status: ParticipantStatus;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  const ownedSpaceIndices = state.ownerships.filter((o) => o.ownerId === playerId).map((o) => o.spaceIndex);
  const cities = ownedSpaceIndices.filter((i) => getBoardSpaceByIndex(i).kind === "city");
  const airports = ownedSpaceIndices.filter((i) => getBoardSpaceByIndex(i).kind === "airport");
  const utilities = ownedSpaceIndices.filter((i) => getBoardSpaceByIndex(i).kind === "utility");
  const isEmpty = ownedSpaceIndices.length === 0;

  const isPassed = status === "PASSED";

  const borderClass = isBidding
    ? "border-amber-400"
    : isLeading
      ? "border-emerald-500/60"
      : isPassed
        ? "border-slate-800"
        : "border-slate-700";

  const headerBg = isBidding
    ? "bg-amber-500 text-slate-950"
    : isLeading
      ? "bg-emerald-900/60 text-emerald-200"
      : isPassed
        ? "bg-slate-900 text-slate-500"
        : "bg-slate-800 text-slate-300";

  return (
    <div
      className={`rounded-lg border ${borderClass} overflow-hidden ${isPassed ? "opacity-60" : ""}`}
      data-testid="player-ownership-card"
    >
      {/* Clickable header: name · cash · status badge · expand toggle */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={`flex w-full items-center justify-between gap-1.5 px-2.5 py-1.5 text-left text-[11px] font-bold ${headerBg} active:opacity-80`}
      >
        <span className="min-w-0 flex items-center gap-1.5">
          {isBidding ? "▶ " : ""}
          <span className="truncate">{player.name}</span>
          {isLeading && !isBidding ? " ★" : ""}
          <StatusBadge status={status} />
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <span className="tabular-nums font-black" aria-label={`${player.name} cash: $${player.cash}`}>
            ${player.cash.toLocaleString()}
          </span>
          <span className="text-[10px] opacity-60" aria-hidden="true">
            {isExpanded ? "▲" : "▼"}
          </span>
        </span>
      </button>

      {/* Expanded body: property chips */}
      {isExpanded && (
        <div className="px-2 py-1.5 bg-slate-800/60" data-testid="portfolio-body">
          {isEmpty ? (
            <p className="text-[10px] text-slate-500 italic">No properties yet</p>
          ) : (
            <div className="space-y-1">
              {cities.length > 0 && (
                <div className="flex flex-wrap gap-1" data-testid="city-properties">
                  {cities.map((i) => (
                    <PropertyChip key={i} spaceIndex={i} state={state} />
                  ))}
                </div>
              )}
              {airports.length > 0 && (
                <div className="flex flex-wrap gap-1" data-testid="airport-properties">
                  {airports.map((i) => (
                    <PropertyChip key={i} spaceIndex={i} state={state} />
                  ))}
                </div>
              )}
              {utilities.length > 0 && (
                <div className="flex flex-wrap gap-1" data-testid="utility-properties">
                  {utilities.map((i) => (
                    <PropertyChip key={i} spaceIndex={i} state={state} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Timer ring ────────────────────────────────────────────────────────────────

/** Circular countdown ring — premium alternative to a plain numeric badge. Goes urgent
 *  (orange → red) in the final 5 seconds, per the dramatic-auction spec. */
function TimerRing({ secondsLeft }: { secondsLeft: number }) {
  const fraction = Math.max(0, Math.min(1, secondsLeft / (AUCTION_TURN_MS / 1000)));
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const isUrgent = secondsLeft <= 5;
  const ringColor = isUrgent ? "#dc2626" : "#d97706";

  return (
    <div className="relative h-12 w-12 shrink-0" aria-label="Time remaining" data-urgent={isUrgent}>
      <svg viewBox="0 0 52 52" className={isUrgent ? "auction-timer-ring-urgent" : ""}>
        <circle cx="26" cy="26" r={radius} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform="rotate(-90 26 26)"
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-sm font-black ${
          isUrgent ? "text-red-300" : "text-amber-100"
        }`}
      >
        {secondsLeft}
      </span>
    </div>
  );
}

// ── Bid controls ──────────────────────────────────────────────────────────────

function BidControls({
  currentBidder,
  isActiveBidder,
  bidOptions,
  onBid,
  onPass,
}: {
  currentBidder: { name: string; cash: number } | undefined;
  isActiveBidder: boolean;
  bidOptions: { label: string; amount: number }[];
  onBid: (amount: number) => void;
  onPass: () => void;
}) {
  if (!currentBidder) return null;

  if (!isActiveBidder) {
    return (
      <div className="p-3 text-center text-sm font-semibold text-slate-400" data-testid="waiting-state">
        Waiting for {currentBidder.name}…
      </div>
    );
  }

  return (
    <div className="p-3" data-testid="bid-controls">
      <p className="text-xs font-semibold text-slate-400">
        Cash: ${currentBidder.cash.toLocaleString()}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {bidOptions.map((opt) => (
          <button
            key={opt.label}
            type="button"
            disabled={opt.amount > currentBidder.cash}
            onClick={() => onBid(opt.amount)}
            className="rounded-lg bg-amber-500 px-2 py-3 text-sm font-black text-slate-950 shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all duration-100 hover:bg-amber-400 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onPass}
        className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-base font-bold text-slate-300 transition-all duration-100 hover:bg-slate-800 hover:border-slate-500 active:scale-[0.98]"
      >
        Pass
      </button>
    </div>
  );
}

// ── Main AuctionPanel ─────────────────────────────────────────────────────────

export function AuctionPanel({ state, dispatch, isMyTurn = true, serverAuthoritative = false }: AuctionPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const prevAuctionRef = useRef(state.phase === "auction" ? state.auction : null);
  // Set of player IDs whose portfolio cards are expanded.
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (state.phase !== "auction" || !state.auction) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [state.phase, state.auction]);

  const auction = state.phase === "auction" ? state.auction : null;

  // Auto-expand the current bidder's card; collapse others on bidder change.
  useEffect(() => {
    if (!auction) return;
    const currentBidderId = auction.activePlayerIds[auction.currentBidderIndex];
    if (currentBidderId) {
      setExpandedPlayers(new Set([currentBidderId]));
    }
  }, [auction?.currentBidderIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Local-mode fallback: client drives the auto-pass on timeout.
  useEffect(() => {
    if (!auction || serverAuthoritative) return;
    if (now < auction.turnDeadlineAt) return;
    dispatch({ type: "PASS_AUCTION" });
  }, [auction, now, serverAuthoritative, dispatch]);

  // Brief premium result state (winner / no-bid) once the auction resolves, shown inside this
  // modal only — does not reintroduce a floating event banner elsewhere in the UI.
  useEffect(() => {
    const prevAuction = prevAuctionRef.current;
    prevAuctionRef.current = auction;
    if (prevAuction && !auction) {
      const message = state.landingAction?.kind === "message" ? state.landingAction.message : null;
      if (message) {
        setResultMessage(message);
        const id = setTimeout(() => setResultMessage(null), 2200);
        return () => clearTimeout(id);
      }
    }
  }, [auction, state.landingAction]);

  if (!auction && resultMessage) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <div className="w-full max-w-sm rounded-2xl border border-amber-300 bg-white px-6 py-8 text-center shadow-[0_32px_100px_rgba(15,23,42,0.45)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">
            Auction Result
          </p>
          <p className="mt-2 text-lg font-black leading-snug text-slate-950">{resultMessage}</p>
        </div>
      </div>
    );
  }

  if (!auction) return null;

  const space = getBoardSpaceByIndex(auction.propertySpaceIndex);
  const currentBidderId = auction.activePlayerIds[auction.currentBidderIndex];
  const currentBidder = state.players.find((p) => p.id === currentBidderId);
  const highBidder = auction.highestBidderId
    ? state.players.find((p) => p.id === auction.highestBidderId)
    : null;
  const listPrice = isOwnableSpace(space) ? space.price : 0;

  const isActiveBidder = isMyTurn && !!currentBidder;
  const secondsLeft = Math.max(0, Math.ceil((auction.turnDeadlineAt - now) / 1000));
  const isUrgent = secondsLeft <= 5;

  // All non-bankrupt players — active bidders + passed — for the ownership overview
  const allAuctionPlayers = state.players.filter((p) => !p.isBankrupt);
  const activeCount = auction.activePlayerIds.length;
  const passedCount = auction.passedPlayerIds.length;

  const bidOptions: { label: string; amount: number }[] =
    auction.currentBid === 0
      ? [{ label: "Open bid $10", amount: 10 }]
      : [
          { label: "+$1", amount: auction.currentBid + 1 },
          { label: "+$10", amount: auction.currentBid + 10 },
          { label: "+$100", amount: auction.currentBid + 100 },
        ];

  function handleBid(amount: number) {
    if (!currentBidder || amount > currentBidder.cash) return;
    dispatch({ type: "PLACE_BID", amount });
  }

  function toggleExpanded(playerId: string) {
    setExpandedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-sm sm:items-center sm:p-3"
      role="presentation"
    >
      {/*
        Mobile: full-height sheet from bottom with flex layout.
          - Sticky header (property, timer, bid status)
          - Scrollable body (participant summary + portfolio cards)
          - Sticky footer (bid controls)
        Desktop (sm+): compact modal, two-column grid inside scroll area.
      */}
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auction-title"
        aria-live="polite"
        className={`flex w-full max-w-3xl flex-col rounded-t-2xl border border-amber-400/40 bg-slate-900 shadow-[0_32px_100px_rgba(0,0,0,0.6)] sm:rounded-2xl sm:max-h-[92vh] max-h-[95vh] ${
          isUrgent ? "auction-modal-urgent" : ""
        }`}
      >
        {/* ── Sticky header ─────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-amber-400/30 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 px-4 py-3 rounded-t-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
              Live Auction
            </p>
            <h2 id="auction-title" className="mt-0.5 truncate text-lg font-black text-white sm:text-xl">
              {space.name}
            </h2>
            {isOwnableSpace(space) ? (
              <p className="text-xs font-semibold text-amber-100/90">
                {getSpaceTypeLabel(space.kind)} · List ${listPrice}
              </p>
            ) : null}
          </div>
          <TimerRing secondsLeft={secondsLeft} />
        </div>

        {/* ── Bid status strip (always visible) ────────────────────────── */}
        <div className="shrink-0 grid grid-cols-2 gap-2 px-4 py-2 border-b border-slate-800">
          <div className="rounded-lg border border-amber-400/30 bg-slate-800 p-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Current Bid
            </p>
            <p className="mt-0.5 text-xl font-black text-amber-300">
              {auction.currentBid > 0 ? `$${auction.currentBid}` : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-amber-400/30 bg-slate-800 p-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Highest Bidder
            </p>
            <p className="mt-0.5 text-sm font-black leading-tight text-white truncate">
              {highBidder?.name ?? "None"}
            </p>
          </div>
        </div>

        {/* ── Active bidder spotlight (always visible) ──────────────────── */}
        <div
          className={`shrink-0 px-4 py-2 text-center text-sm font-black border-b ${
            isUrgent
              ? "border-red-800 bg-red-950/60 text-red-200"
              : "border-slate-800 bg-amber-900/30 text-amber-200"
          }`}
        >
          {currentBidder ? `🔥 ${currentBidder.name}'s turn to bid` : "Resolving…"}
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Two-column on desktop, single column on mobile */}
          <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_1fr]">

            {/* Left col: passed players + desktop bid controls */}
            <div className="border-b border-slate-700 p-4 md:border-b-0 md:border-r">
              {/* Passed players */}
              {auction.passedPlayerIds.length > 0 ? (
                <div className="mb-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Passed</p>
                  <div className="mt-1 flex flex-col gap-1">
                    {auction.passedPlayerIds.map((id) => {
                      const player = state.players.find((p) => p.id === id);
                      if (!player) return null;
                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between rounded-lg bg-slate-800/40 px-2.5 py-1.5 text-[11px] font-bold text-slate-500"
                        >
                          <span className="flex items-center gap-1.5 line-through">{player.name}<StatusBadge status="PASSED" /></span>
                          <span className="ml-2 tabular-nums opacity-60">${player.cash.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Desktop-only bid controls — hidden on mobile (sticky footer used instead) */}
              <div className="hidden md:block">
                <BidControls
                  currentBidder={currentBidder}
                  isActiveBidder={isActiveBidder}
                  bidOptions={bidOptions}
                  onBid={handleBid}
                  onPass={() => dispatch({ type: "PASS_AUCTION" })}
                />
              </div>
            </div>

            {/* Right col: player ownership overview */}
            <div className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                  Active Players · Properties
                </p>
                {/* Participant summary count */}
                <p className="text-[10px] font-semibold text-slate-500" data-testid="participant-summary">
                  {activeCount} active · {passedCount} passed
                </p>
              </div>
              <div className="flex flex-col gap-2" data-testid="ownership-overview">
                {allAuctionPlayers.map((player) => {
                  const playerStatus = getParticipantStatus(player.id, auction);
                  return (
                    <PlayerOwnershipCard
                      key={player.id}
                      playerId={player.id}
                      state={state}
                      isBidding={player.id === currentBidderId}
                      isLeading={player.id === auction.highestBidderId}
                      status={playerStatus}
                      isExpanded={expandedPlayers.has(player.id)}
                      onToggle={() => toggleExpanded(player.id)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          {/* Bottom padding so content is not obscured by the mobile sticky footer */}
          <div className="h-4 md:h-0" aria-hidden="true" />
        </div>

        {/* ── Sticky bid controls footer — mobile only ──────────────────── */}
        <div
          className="shrink-0 border-t border-slate-700 bg-slate-900 md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          data-testid="auction-controls"
        >
          <BidControls
            currentBidder={currentBidder}
            isActiveBidder={isActiveBidder}
            bidOptions={bidOptions}
            onBid={handleBid}
            onPass={() => dispatch({ type: "PASS_AUCTION" })}
          />
        </div>
      </section>
    </div>
  );
}
// updated
