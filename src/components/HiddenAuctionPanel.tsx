"use client";

import { useEffect, useMemo, useState } from "react";
import { getBoardSpaceByIndex } from "@/data/board";
import { getAuctionTheme } from "@/lib/ui/auctionTheme";
import type { GameAction, GameState } from "@/types/game";

type Props = {
  state: GameState;
  dispatch: (action: GameAction) => void;
  /** Present only in multiplayer; this panel never receives any other bid. */
  myPlayerId?: string;
  ownBid?: number | null;
  serverAuthoritative?: boolean;
};

/** A sealed-bid experience kept deliberately separate from the open AuctionPanel. */
export function HiddenAuctionPanel({ state, dispatch, myPlayerId, ownBid = null, serverAuthoritative = false }: Props) {
  const auction = state.hiddenAuction;
  const [now, setNow] = useState(() => Date.now());
  const [localBidderId, setLocalBidderId] = useState(myPlayerId ?? state.players[state.currentPlayerIndex]?.id ?? "");
  const [draftBid, setDraftBid] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!auction) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [auction?.id, auction?.status]);

  useEffect(() => {
    if (!auction || auction.status !== "bidding" || serverAuthoritative || now < auction.bidDeadlineAt) return;
    dispatch({ type: "CLOSE_HIDDEN_AUCTION", deadlineAt: auction.bidDeadlineAt, tieBreaker: Math.random() });
  }, [auction, dispatch, now, serverAuthoritative]);

  useEffect(() => {
    if (!auction || auction.status !== "reveal" || serverAuthoritative || !auction.revealDeadlineAt || now < auction.revealDeadlineAt) return;
    dispatch({ type: "COMPLETE_HIDDEN_AUCTION_REVEAL", revealDeadlineAt: auction.revealDeadlineAt });
  }, [auction, dispatch, now, serverAuthoritative]);

  useEffect(() => {
    if (myPlayerId) setLocalBidderId(myPlayerId);
  }, [myPlayerId, auction?.id]);

  useEffect(() => {
    if (serverAuthoritative && ownBid !== null) setDraftBid(String(ownBid));
  }, [ownBid, serverAuthoritative, auction?.id]);

  if (!auction) return null;
  const space = getBoardSpaceByIndex(auction.propertySpaceIndex);
  const theme = getAuctionTheme(space);
  const bidderId = myPlayerId ?? localBidderId;
  const bidder = state.players.find((player) => player.id === bidderId);
  const isBidding = auction.status === "bidding";
  const secondsLeft = Math.max(0, Math.ceil((auction.bidDeadlineAt - now) / 1000));
  const revealNumber = auction.revealDeadlineAt ? Math.max(1, Math.ceil((auction.revealDeadlineAt - now) / 1000)) : 1;
  const parsedBid = Number(draftBid);
  const isValidBid = Number.isInteger(parsedBid) && parsedBid >= 0 && parsedBid <= (bidder?.cash ?? -1);
  const winner = auction.result?.winnerId ? state.players.find((player) => player.id === auction.result?.winnerId) : null;
  const submit = () => {
    if (!bidder || !isValidBid || !isBidding) return;
    dispatch({ type: "SUBMIT_HIDDEN_BID", actorPlayerId: bidder.id, amount: parsedBid });
    setSaved(true);
  };
  const clearBid = () => {
    if (!bidder || !isBidding) return;
    setDraftBid("0");
    dispatch({ type: "SUBMIT_HIDDEN_BID", actorPlayerId: bidder.id, amount: 0 });
    setSaved(true);
  };

  return (
    <section
      role="dialog"
      aria-live="polite"
      aria-modal="true"
      aria-labelledby="hidden-auction-title"
      className="fixed inset-0 z-[75] flex min-h-[100dvh] items-stretch justify-center overflow-y-auto bg-slate-950/88 p-0 backdrop-blur-sm md:items-center md:p-5"
    >
      <div className="relative flex min-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden border-y-4 bg-[var(--wc-navy)] text-slate-100 shadow-[var(--wc-shadow-modal)] md:min-h-0 md:rounded-[var(--wc-radius-large)] md:border-4" style={{ borderColor: theme.borderColor }}>
        <header className="px-5 py-4" style={{ background: `linear-gradient(180deg, ${theme.accentColor}, ${theme.mutedAccentColor})`, color: theme.accentTextColor }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="inline-flex rounded-full border border-black/25 bg-black/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]">Hidden Auction</p>
              <h2 id="hidden-auction-title" className="mt-2 truncate text-2xl font-black">{space.name}</h2>
              <p className="mt-0.5 text-sm font-bold opacity-80">{theme.groupLabel} · sealed bids stay private</p>
            </div>
            {isBidding ? <div className="wc-numeric rounded-full border border-black/20 bg-black/15 px-3 py-2 text-center"><span className="block text-[10px] font-black uppercase tracking-wide">Remaining</span><span className="text-xl font-black">{secondsLeft}s</span></div> : null}
          </div>
        </header>

        {isBidding ? (
          <div className="flex flex-1 flex-col p-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <Info label="Property type" value={space.kind} />
              <Info label="List price" value={"price" in space ? `$${space.price}` : "—"} />
              <Info label="Mortgage value" value={"mortgageValue" in space ? `$${space.mortgageValue}` : "—"} />
              <Info label="Your cash" value={`$${(bidder?.cash ?? 0).toLocaleString()}`} />
            </div>
            <div className="mt-5 rounded-[var(--wc-radius-medium)] border border-[var(--wc-gold-border)] bg-[var(--wc-gold-soft)] p-4 text-sm text-amber-100">
              <p className="font-black">Your bid is secret.</p>
              <p className="mt-1 text-amber-50/85">Every eligible player can edit a private bid until the full 20 seconds expire. No leader or other bid is shown.</p>
            </div>

            {!serverAuthoritative ? (
              <label className="mt-5 grid gap-1.5 text-sm font-bold text-slate-200">
                Private bidder
                <select
                  aria-label="Private bidder"
                  className="wc-select min-h-11"
                  value={localBidderId}
                  onChange={(event) => { setLocalBidderId(event.target.value); setDraftBid(""); setSaved(false); }}
                >
                  {auction.eligiblePlayerIds.map((id) => {
                    const player = state.players.find((candidate) => candidate.id === id);
                    return player ? <option key={id} value={id}>{player.name}</option> : null;
                  })}
                </select>
              </label>
            ) : null}

            <label className="mt-4 grid gap-1.5 text-sm font-bold text-slate-200">
              Your current bid
              <input
                aria-label="Your hidden bid"
                className="wc-input min-h-12 text-lg font-black"
                type="number"
                min="0"
                max={bidder?.cash ?? 0}
                inputMode="numeric"
                value={draftBid}
                onChange={(event) => { setDraftBid(event.target.value); setSaved(false); }}
                placeholder="0"
              />
            </label>
            {!isValidBid && draftBid !== "" ? <p className="mt-2 text-sm font-bold text-rose-300">Enter a whole-number bid from $0 to ${(bidder?.cash ?? 0).toLocaleString()}.</p> : null}
            {saved ? <p className="mt-3 text-sm font-black text-emerald-300">Bid saved. You may update it until time expires.</p> : null}

            <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
              <button type="button" className="wc-button wc-button-secondary min-h-12" onClick={clearBid}>Clear / No bid</button>
              <button type="button" className="wc-button wc-button-primary min-h-12" disabled={!isValidBid} onClick={submit}>{saved ? "Update Bid" : "Submit Bid"}</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--wc-gold)]">Bids locked</p>
            <p className="wc-numeric mt-5 text-8xl font-black leading-none text-white motion-reduce:text-6xl">{revealNumber}</p>
            <p className="mt-6 text-sm font-semibold text-slate-300">Revealing the sealed result…</p>
            {revealNumber === 1 ? (
              <div className="mt-8 rounded-[var(--wc-radius-large)] border border-[var(--wc-gold-border)] bg-[var(--wc-navy-raised)] p-5">
                {winner ? <><p className="text-2xl font-black text-white">{winner.name} wins {space.name}!</p><p className="wc-numeric mt-2 text-3xl font-black text-[var(--wc-gold)]">${auction.result?.winningBid}</p>{auction.result?.tieResolved ? <p className="mt-2 text-xs text-slate-300">A tied highest bid was resolved randomly.</p> : null}</> : <><p className="text-2xl font-black text-white">No winning bid</p><p className="mt-2 text-slate-300">{space.name} remains unowned.</p></>}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[var(--wc-radius-small)] border border-[var(--wc-border)] bg-[var(--wc-navy-raised)] px-3 py-2"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 font-black capitalize text-white">{value}</p></div>;
}
