"use client";

import { useState } from "react";
import { getBoardSpaceByIndex } from "@/data/board";
import { isOwnableSpace } from "@/lib/game/ownership";
import type { GameAction, GameState } from "@/types/game";

type AuctionPanelProps = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
};

function getSpaceTypeLabel(kind: string) {
  if (kind === "city") return "City";
  if (kind === "airport") return "Airport";
  if (kind === "utility") return "Utility";
  return "Property";
}

export function AuctionPanel({ state, dispatch }: AuctionPanelProps) {
  const [customBid, setCustomBid] = useState("");

  if (state.phase !== "auction" || !state.auction) return null;

  const { auction } = state;
  const space = getBoardSpaceByIndex(auction.spaceIndex);
  const currentBidder = state.players.find((p) => p.id === auction.currentAuctionBidderId);
  const highBidder = auction.highBidderId
    ? state.players.find((p) => p.id === auction.highBidderId)
    : null;
  const listPrice = isOwnableSpace(space) ? space.price : 0;
  const minBid = auction.minimumNextBid;

  const quickAmounts = Array.from(
    new Set([minBid, minBid + 40, minBid + 90, minBid + 190]),
  ).filter((a) => a > auction.currentBid);

  function handleQuickBid(amount: number) {
    if (!currentBidder || amount > currentBidder.cash) return;
    dispatch({ type: "PLACE_BID", amount });
  }

  function handleCustomBid() {
    const parsed = parseInt(customBid, 10);
    if (!isNaN(parsed) && parsed >= minBid && currentBidder && parsed <= currentBidder.cash) {
      dispatch({ type: "PLACE_BID", amount: parsed });
      setCustomBid("");
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50 shadow-sm">
      <div className="border-b border-amber-200 bg-amber-100 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
          Auction
        </p>
        <h2 className="mt-0.5 text-lg font-black text-slate-950">{auction.propertyName}</h2>
        {isOwnableSpace(space) ? (
          <p className="text-xs font-semibold text-amber-700">
            {getSpaceTypeLabel(space.kind)} · List ${listPrice}
          </p>
        ) : null}
      </div>

      <div className="p-4">
        {/* Bid status */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-amber-200 bg-white p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              High Bid
            </p>
            <p className="mt-0.5 text-xl font-black text-slate-950">
              {auction.currentBid > 0 ? `$${auction.currentBid}` : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-white p-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Leader
            </p>
            <p className="mt-0.5 text-base font-black leading-tight text-slate-950 truncate">
              {highBidder?.name ?? "None"}
            </p>
          </div>
        </div>

        {/* Player status */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {state.players
            .filter((p) => !p.isBankrupt)
            .map((player) => {
              const inAuction = auction.activeBidderIds.includes(player.id);
              const passed = auction.passedPlayerIds.includes(player.id);
              const isLeading = player.id === auction.highBidderId;
              const isBidding = player.id === auction.currentAuctionBidderId;
              return (
                <span
                  key={player.id}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    passed
                      ? "bg-slate-100 text-slate-400 line-through"
                      : isBidding
                        ? "bg-amber-600 text-white"
                        : isLeading
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {isBidding ? "▶ " : ""}
                  {player.name}
                  {passed ? " (passed)" : ""}
                  {isLeading && !isBidding && !passed ? " ★" : ""}
                </span>
              );
            })}
        </div>

        {/* Current bidder controls */}
        {currentBidder ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-white p-3">
            <p className="text-sm font-black text-slate-950">
              {currentBidder.name}&apos;s turn
            </p>
            <p className="text-xs font-semibold text-slate-500">
              Cash: ${currentBidder.cash.toLocaleString()} · Min bid: ${minBid}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  disabled={amount > currentBidder.cash}
                  onClick={() => handleQuickBid(amount)}
                  className="rounded-lg bg-amber-500 px-2 py-2 text-sm font-black text-white transition-all duration-100 hover:bg-amber-600 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  ${amount}
                </button>
              ))}
            </div>

            <div className="mt-2 flex gap-1.5">
              <input
                type="number"
                min={minBid}
                max={currentBidder.cash}
                value={customBid}
                onChange={(e) => setCustomBid(e.target.value)}
                placeholder={`Custom $${minBid}+`}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              <button
                type="button"
                disabled={
                  !customBid ||
                  parseInt(customBid, 10) < minBid ||
                  parseInt(customBid, 10) > currentBidder.cash
                }
                onClick={handleCustomBid}
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-black text-white transition-all duration-100 hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                Bid
              </button>
            </div>

            <button
              type="button"
              onClick={() => dispatch({ type: "PASS_AUCTION" })}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600 transition-all duration-100 hover:bg-white hover:border-slate-300 active:scale-[0.98]"
            >
              Pass
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
