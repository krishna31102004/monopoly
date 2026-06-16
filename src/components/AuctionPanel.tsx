"use client";

import { useEffect, useState } from "react";
import { getBoardSpaceByIndex } from "@/data/board";
import { isOwnableSpace } from "@/lib/game/ownership";
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

export function AuctionPanel({ state, dispatch, isMyTurn = true, serverAuthoritative = false }: AuctionPanelProps) {
  const [now, setNow] = useState(() => Date.now());

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-[2px] sm:items-center"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auction-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-300 bg-white shadow-[0_32px_100px_rgba(15,23,42,0.35)]"
      >
        <div className="border-b border-amber-200 bg-amber-100 px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
              Auction
            </p>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-black ${
                secondsLeft <= 5 ? "bg-red-600 text-white" : "bg-amber-600 text-white"
              }`}
              aria-label="Time remaining"
            >
              {secondsLeft}s
            </span>
          </div>
          <h2 id="auction-title" className="mt-0.5 text-xl font-black text-slate-950">
            {space.name}
          </h2>
          {isOwnableSpace(space) ? (
            <p className="text-xs font-semibold text-amber-700">
              {getSpaceTypeLabel(space.kind)} · List ${listPrice}
            </p>
          ) : null}
        </div>

        <div className="p-5">
          {/* Bid status */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Current Bid
              </p>
              <p className="mt-0.5 text-xl font-black text-slate-950">
                {auction.currentBid > 0 ? `$${auction.currentBid}` : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Highest Bidder
              </p>
              <p className="mt-0.5 text-base font-black leading-tight text-slate-950 truncate">
                {highBidder?.name ?? "None"}
              </p>
            </div>
          </div>

          {/* Active turn indicator */}
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm font-black text-amber-800">
            {currentBidder ? `${currentBidder.name}'s turn` : "Resolving…"}
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
                          ? "bg-amber-600 text-white"
                          : isLeading
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
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
                  <span className="text-[10px] font-semibold text-slate-400">—</span>
                ) : (
                  auction.passedPlayerIds.map((id) => {
                    const player = state.players.find((p) => p.id === id);
                    if (!player) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400 line-through"
                      >
                        {player.name}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Bid/pass controls — gated to the active bidder only */}
          {currentBidder ? (
            isActiveBidder ? (
              <div className="mt-4 rounded-xl border border-amber-300 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500">
                  Cash: ${currentBidder.cash.toLocaleString()}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {bidOptions.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={opt.amount > currentBidder.cash}
                      onClick={() => handleBid(opt.amount)}
                      className="rounded-lg bg-amber-500 px-2 py-2 text-sm font-black text-white transition-all duration-100 hover:bg-amber-600 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "PASS_AUCTION" })}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600 transition-all duration-100 hover:bg-white hover:border-slate-300 active:scale-[0.98]"
                >
                  Pass
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-sm font-semibold text-slate-500">
                Waiting for {currentBidder.name}…
              </div>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
