"use client";

import { useEffect, useRef, useState } from "react";
import { getBoardSpaceByIndex } from "@/data/board";
import { isOwnableSpace } from "@/lib/game/ownership";
import { AUCTION_TURN_MS } from "@/lib/animation/timing";
import type { GameAction, GameState } from "@/types/game";

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

function getSpaceTypeLabel(kind: string) {
  if (kind === "city") return "City";
  if (kind === "airport") return "Airport";
  if (kind === "utility") return "Utility";
  return "Property";
}

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

export function AuctionPanel({ state, dispatch, isMyTurn = true, serverAuthoritative = false }: AuctionPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const prevAuctionRef = useRef(state.phase === "auction" ? state.auction : null);

  useEffect(() => {
    if (state.phase !== "auction" || !state.auction) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [state.phase, state.auction]);

  const auction = state.phase === "auction" ? state.auction : null;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-sm sm:items-center sm:p-3"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auction-title"
        className={`max-h-[95vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-amber-400/40 bg-slate-900 shadow-[0_32px_100px_rgba(0,0,0,0.6)] sm:rounded-2xl ${
          isUrgent ? "auction-modal-urgent" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-amber-400/30 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
              Live Auction
            </p>
            <h2 id="auction-title" className="mt-0.5 truncate text-xl font-black text-white">
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

        <div className="p-5">
          {/* Bid status */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-amber-400/30 bg-slate-800 p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Current Bid
              </p>
              <p className="mt-0.5 text-2xl font-black text-amber-300">
                {auction.currentBid > 0 ? `$${auction.currentBid}` : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-amber-400/30 bg-slate-800 p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Highest Bidder
              </p>
              <p className="mt-0.5 text-base font-black leading-tight text-white truncate">
                {highBidder?.name ?? "None"}
              </p>
            </div>
          </div>

          {/* Active bidder spotlight */}
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-center text-sm font-black ${
              isUrgent
                ? "border-red-400 bg-red-950/60 text-red-200"
                : "border-amber-400/40 bg-amber-900/40 text-amber-200"
            }`}
          >
            {currentBidder ? `🔥 ${currentBidder.name}'s turn to bid` : "Resolving…"}
          </div>

          {/* Active / passed player lists */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Active</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {auction.activePlayerIds.map((id) => {
                  const player = state.players.find((p) => p.id === id);
                  if (!player) return null;
                  const isLeading = id === auction.highestBidderId;
                  const isBidding = id === currentBidderId;
                  return (
                    <span
                      key={id}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isBidding
                          ? "bg-amber-500 text-slate-950"
                          : isLeading
                            ? "bg-emerald-900/60 text-emerald-300"
                            : "bg-slate-800 text-amber-200"
                      }`}
                    >
                      {isBidding ? "▶ " : ""}
                      {player.name}
                      {isLeading && !isBidding ? " ★" : ""}
                    </span>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Passed</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {auction.passedPlayerIds.length === 0 ? (
                  <span className="text-[10px] font-semibold text-slate-500">—</span>
                ) : (
                  auction.passedPlayerIds.map((id) => {
                    const player = state.players.find((p) => p.id === id);
                    if (!player) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] font-bold text-slate-500 line-through"
                      >
                        {player.name}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Bid/pass controls — gated to the active bidder only; everyone else sees a
              read-only waiting state. No custom bid input is ever rendered. */}
          {currentBidder ? (
            isActiveBidder ? (
              <div className="mt-4 rounded-xl border border-amber-400/40 bg-slate-800 p-3">
                <p className="text-xs font-semibold text-slate-400">
                  Cash: ${currentBidder.cash.toLocaleString()}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {bidOptions.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={opt.amount > currentBidder.cash}
                      onClick={() => handleBid(opt.amount)}
                      className="rounded-lg bg-amber-500 px-3 py-3 text-base font-black text-slate-950 shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-all duration-100 hover:bg-amber-400 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "PASS_AUCTION" })}
                  className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-base font-bold text-slate-300 transition-all duration-100 hover:bg-slate-800 hover:border-slate-500 active:scale-[0.98]"
                >
                  Pass
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center text-sm font-semibold text-slate-400">
                Waiting for {currentBidder.name}…
              </div>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
