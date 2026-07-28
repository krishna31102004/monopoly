"use client";

import { useEffect, useState } from "react";
import {
  AuctionPropertyDetails,
  AuctionSetOverview,
  PlayerOwnershipCard,
  type ParticipantStatus,
} from "@/components/AuctionPanel";
import { getBoardSpaceByIndex } from "@/data/board";
import { isOwnableSpace } from "@/lib/game/ownership";
import {
  getHiddenAuctionRevealStep,
  HIDDEN_AUCTION_BID_MS,
} from "@/lib/game/hiddenAuction";
import { getAuctionPropertyContext } from "@/lib/ui/auctionPropertyContext";
import { getAuctionTheme } from "@/lib/ui/auctionTheme";
import { AUCTION_ACTION_TOKENS } from "@/lib/ui/auctionVisualTokens";
import type { GameAction, GameState } from "@/types/game";
import type { CSSProperties } from "react";

type Props = {
  state: GameState;
  dispatch: (action: GameAction) => void;
  /** Present only in multiplayer; this panel never receives any other bid. */
  myPlayerId?: string;
  ownBid?: number | null;
  serverAuthoritative?: boolean;
};

type HiddenAuctionMobileSection = "set" | "players" | "details";

/** A sealed-bid experience that deliberately reuses the premium open-auction shell. */
export function HiddenAuctionPanel({ state, dispatch, myPlayerId, ownBid = null, serverAuthoritative = false }: Props) {
  const auction = state.hiddenAuction;
  const [now, setNow] = useState(() => Date.now());
  const [localBidderId, setLocalBidderId] = useState(myPlayerId ?? state.players[state.currentPlayerIndex]?.id ?? "");
  const [draftBid, setDraftBid] = useState("");
  const [saved, setSaved] = useState(false);
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
  const [mobileSection, setMobileSection] = useState<HiddenAuctionMobileSection>("set");

  useEffect(() => {
    if (!auction) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [auction?.id, auction?.status]);

  useEffect(() => {
    if (!auction || auction.status !== "bidding" || serverAuthoritative || now < auction.bidDeadlineAt) return;
    dispatch({ type: "CLOSE_HIDDEN_AUCTION", deadlineAt: auction.bidDeadlineAt });
  }, [auction, dispatch, now, serverAuthoritative]);

  useEffect(() => {
    if (!auction || auction.status !== "reveal" || serverAuthoritative || !auction.revealDeadlineAt || now < auction.revealDeadlineAt) return;
    dispatch({ type: "COMPLETE_HIDDEN_AUCTION_REVEAL", revealDeadlineAt: auction.revealDeadlineAt });
  }, [auction, dispatch, now, serverAuthoritative]);

  useEffect(() => {
    if (myPlayerId) setLocalBidderId(myPlayerId);
  }, [myPlayerId, auction?.id]);

  useEffect(() => {
    if (!myPlayerId && auction && !auction.eligiblePlayerIds.includes(localBidderId)) {
      setLocalBidderId(auction.eligiblePlayerIds[0] ?? "");
      setDraftBid("");
      setSaved(false);
    }
  }, [auction, localBidderId, myPlayerId]);

  useEffect(() => {
    if (serverAuthoritative && ownBid !== null) setDraftBid(String(ownBid));
  }, [ownBid, serverAuthoritative, auction?.id]);

  if (!auction) return null;

  const space = getBoardSpaceByIndex(auction.propertySpaceIndex);
  const theme = getAuctionTheme(space);
  const propertyContext = getAuctionPropertyContext(state, auction.propertySpaceIndex);
  const bidderId = myPlayerId ?? localBidderId;
  const bidder = state.players.find((player) => player.id === bidderId);
  const isEligibleBidder = Boolean(bidder && auction.eligiblePlayerIds.includes(bidder.id));
  const isBidding = auction.status === "bidding";
  const isActionable = isBidding && now >= auction.bidStartedAt;
  const secondsLeft = Math.max(0, Math.ceil((auction.bidDeadlineAt - now) / 1000));
  const revealStep = auction.revealDeadlineAt ? getHiddenAuctionRevealStep(auction.revealDeadlineAt, now) : null;
  const parsedBid = Number(draftBid);
  const isValidBid = Number.isInteger(parsedBid) && parsedBid >= 0 && parsedBid <= (bidder?.cash ?? -1);
  const winner = auction.result?.kind === "winner"
    ? state.players.find((player) => player.id === auction.result?.winnerId)
    : null;
  const tiedPlayers = auction.result?.kind === "tie"
    ? auction.result.tiedPlayerIds
      .map((playerId) => state.players.find((player) => player.id === playerId)?.name)
      .filter((name): name is string => Boolean(name))
    : [];
  const publicPlayers = state.players.filter((player) => !player.isBankrupt);
  const panelStyle = {
    background: `linear-gradient(180deg, ${theme.bodyTintColor} 0%, #0f172a 42%, #0f172a 100%)`,
    borderColor: theme.borderColor,
    boxShadow: `0 32px 100px rgba(0,0,0,0.6), 0 0 28px ${theme.glowColor}`,
  } as CSSProperties;

  function toggleExpanded(playerId: string) {
    setExpandedPlayers((previous) => {
      const next = new Set(previous);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function submit() {
    if (!bidder || !isEligibleBidder || !isValidBid || !isBidding) return;
    dispatch({ type: "SUBMIT_HIDDEN_BID", actorPlayerId: bidder.id, amount: parsedBid });
    setSaved(true);
  }

  function clearBid() {
    if (!bidder || !isEligibleBidder || !isBidding) return;
    setDraftBid("0");
    dispatch({ type: "SUBMIT_HIDDEN_BID", actorPlayerId: bidder.id, amount: 0 });
    setSaved(true);
  }

  const bidControls = isEligibleBidder && bidder ? (
    <HiddenBidControls
      bidder={bidder}
      draftBid={draftBid}
      isValidBid={isValidBid}
      saved={saved}
      onDraftBidChange={(value) => { setDraftBid(value); setSaved(false); }}
      onClear={clearBid}
      onSubmit={submit}
    />
  ) : (
    <div className="rounded-lg border border-[var(--wc-border)] bg-[var(--wc-navy-raised)] p-4 text-sm text-slate-300">
      <p className="font-black text-slate-100">You are not in this tie-break.</p>
      <p className="mt-1">Only the players tied for the highest previous bid can submit a fresh sealed bid.</p>
    </div>
  );

  if (isBidding && !isActionable) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/85 p-0 backdrop-blur-sm sm:items-center sm:p-3" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        aria-labelledby="hidden-auction-title"
        className="flex w-full max-w-3xl max-h-[95vh] flex-col rounded-t-2xl border bg-slate-900 sm:max-h-[92vh] sm:rounded-2xl lg:max-w-5xl"
        style={panelStyle}
      >
        <div className="shrink-0 flex items-center justify-between gap-3 rounded-t-2xl border-b px-4 py-3" style={{ background: `linear-gradient(180deg, ${theme.accentColor}, ${theme.mutedAccentColor})`, borderColor: theme.mutedAccentColor, color: theme.accentTextColor }}>
          <div className="min-w-0 flex-1">
            <p className="inline-flex rounded border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: AUCTION_ACTION_TOKENS.gold, borderColor: AUCTION_ACTION_TOKENS.goldBorder, backgroundColor: "rgba(15,23,42,0.72)" }}>
              {auction.round > 1 ? `Hidden Auction · Tie-break ${auction.round - 1}` : `Hidden Auction · ${theme.groupLabel}`}
            </p>
            <h2 id="hidden-auction-title" className="mt-0.5 truncate text-lg font-black sm:text-xl">{space.name}</h2>
            <p className="text-xs font-semibold opacity-85">{space.kind[0].toUpperCase() + space.kind.slice(1)} · List ${isOwnableSpace(space) ? space.price : "—"} · Mortgage ${isOwnableSpace(space) ? space.mortgageValue : "—"}</p>
          </div>
          {isBidding ? <HiddenTimerRing secondsLeft={secondsLeft} /> : null}
        </div>

        {isBidding ? <>
          <div className="shrink-0 grid grid-cols-2 gap-2 border-b border-slate-800 px-4 py-2">
            <div className="rounded-lg border bg-slate-800 p-2 text-center" style={{ borderColor: theme.mutedAccentColor }}><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Sealed bids</p><p className="mt-0.5 text-sm font-black text-white">Private</p></div>
            <div className="rounded-lg border bg-slate-800 p-2 text-center" style={{ borderColor: theme.mutedAccentColor }}><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Eligible players</p><p className="mt-0.5 text-sm font-black text-white">{auction.eligiblePlayerIds.length}</p></div>
          </div>
          <div className="shrink-0 border-b bg-[#182235] px-4 py-2 text-center text-sm font-semibold text-slate-300" style={{ borderColor: AUCTION_ACTION_TOKENS.goldBorder }}><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: AUCTION_ACTION_TOKENS.gold }} aria-hidden="true" />{auction.round > 1 ? <><span className="font-black text-white">Tie-break round</span> · only tied players remain</> : "Bids stay hidden until the reveal"}</div>
        </> : null}

        {propertyContext ? <div className="hidden shrink-0 border-b border-slate-800 px-4 py-3 md:block" style={{ borderColor: theme.mutedAccentColor }}><AuctionSetOverview context={propertyContext} theme={theme} /></div> : null}

        {isBidding ? <div className="shrink-0 border-b border-slate-800 px-3 py-2 md:hidden" style={{ borderColor: theme.mutedAccentColor }} role="tablist" aria-label="Hidden auction information">
          {(["set", "players", "details"] as const).map((section) => <button key={section} id={`hidden-auction-tab-${section}`} type="button" role="tab" aria-controls={`hidden-auction-panel-${section}`} aria-selected={mobileSection === section} onClick={() => setMobileSection(section)} className={`mr-1 rounded px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ${mobileSection === section ? "text-slate-950" : "text-slate-300"}`} style={mobileSection === section ? { backgroundColor: theme.accentColor, color: theme.accentTextColor } : undefined}>{section}</button>)}
        </div> : null}

        {isBidding ? <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-4 md:hidden" id={`hidden-auction-panel-${mobileSection}`} role="tabpanel" aria-labelledby={`hidden-auction-tab-${mobileSection}`}>
            {mobileSection === "set" && propertyContext ? <AuctionSetOverview context={propertyContext} theme={theme} /> : null}
            {mobileSection === "details" && propertyContext ? <AuctionPropertyDetails context={propertyContext} theme={theme} /> : null}
            {mobileSection === "players" ? <HiddenAuctionPlayers state={state} players={publicPlayers} eligiblePlayerIds={auction.eligiblePlayerIds} expandedPlayers={expandedPlayers} onToggle={toggleExpanded} /> : null}
          </div>
          <div className="hidden md:grid md:grid-cols-[1fr_1fr]">
            <div className="border-b border-slate-700 p-4 md:border-b-0 md:border-r">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Your sealed bid</p>
              <p className="mt-1 text-sm text-slate-300">Your amount is private. No current leader or bid ranking is shown.</p>
              {!serverAuthoritative ? <label className="mt-4 grid gap-1.5 text-sm font-bold text-slate-200">Private bidder<select aria-label="Private bidder" className="wc-select min-h-11" value={localBidderId} onChange={(event) => { setLocalBidderId(event.target.value); setDraftBid(""); setSaved(false); }}>{auction.eligiblePlayerIds.map((id) => { const player = state.players.find((candidate) => candidate.id === id); return player ? <option key={id} value={id}>{player.name}</option> : null; })}</select></label> : null}
              <div className="mt-4">{bidControls}</div>
            </div>
            <div className="p-4"><HiddenAuctionPlayers state={state} players={publicPlayers} eligiblePlayerIds={auction.eligiblePlayerIds} expandedPlayers={expandedPlayers} onToggle={toggleExpanded} />{propertyContext ? <details className="mt-3 rounded-lg border border-slate-700 bg-slate-800/40 p-2"><summary className="cursor-pointer text-[10px] font-black uppercase tracking-wide text-slate-300">Property details</summary><div className="mt-2"><AuctionPropertyDetails context={propertyContext} theme={theme} /></div></details> : null}</div>
          </div>
        </div> : <HiddenAuctionResult winner={winner ?? undefined} spaceName={space.name} winningBid={auction.result?.winningBid ?? 0} tiedPlayers={tiedPlayers} tieBid={auction.result?.kind === "tie" ? auction.result.winningBid : 0} revealStep={revealStep} />}

        {isBidding ? <div className="shrink-0 border-t border-slate-700 bg-slate-900 p-3 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}><p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">Your sealed bid</p>{!serverAuthoritative ? <label className="mb-3 grid gap-1 text-xs font-bold text-slate-200">Private bidder<select aria-label="Private bidder" className="wc-select min-h-11" value={localBidderId} onChange={(event) => { setLocalBidderId(event.target.value); setDraftBid(""); setSaved(false); }}>{auction.eligiblePlayerIds.map((id) => { const player = state.players.find((candidate) => candidate.id === id); return player ? <option key={id} value={id}>{player.name}</option> : null; })}</select></label> : null}{bidControls}</div> : null}
      </section>
    </div>
  );
}

function HiddenAuctionPlayers({ state, players, eligiblePlayerIds, expandedPlayers, onToggle }: { state: GameState; players: GameState["players"]; eligiblePlayerIds: string[]; expandedPlayers: Set<string>; onToggle: (id: string) => void }) {
  return <section aria-label="Active players and properties"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Active players · Properties</p><p className="text-[10px] font-semibold text-slate-500">{eligiblePlayerIds.length} eligible</p></div><div className="flex flex-col gap-2" data-testid="hidden-auction-ownership-overview">{players.map((player) => <PlayerOwnershipCard key={player.id} playerId={player.id} state={state} isBidding={eligiblePlayerIds.includes(player.id)} isLeading={false} status={(eligiblePlayerIds.includes(player.id) ? "ACTIVE" : "PASSED") as ParticipantStatus} isExpanded={expandedPlayers.has(player.id)} onToggle={() => onToggle(player.id)} />)}</div></section>;
}

 function HiddenBidControls({ bidder, draftBid, isValidBid, saved, onDraftBidChange, onClear, onSubmit }: { bidder: { cash: number }; draftBid: string; isValidBid: boolean; saved: boolean; onDraftBidChange: (value: string) => void; onClear: () => void; onSubmit: () => void }) {
   return <div data-testid="hidden-bid-controls"><p className="text-xs font-semibold text-slate-400">Your cash: <span className="wc-numeric font-black text-white">${bidder.cash.toLocaleString()}</span></p><p className="mt-2 text-xs text-slate-300">Your bid is secret. No leader or other bid is shown.</p><label className="mt-3 grid gap-1.5 text-sm font-bold text-slate-200">Your hidden bid<input aria-label="Your hidden bid" className="wc-input min-h-12 text-lg font-black" type="number" min="0" max={bidder.cash} inputMode="numeric" value={draftBid} onChange={(event) => onDraftBidChange(event.target.value)} placeholder="0" /></label>{!isValidBid && draftBid !== "" ? <p className="mt-2 text-sm font-bold text-rose-300">Enter a whole-number bid from $0 to ${bidder.cash.toLocaleString()}.</p> : null}{saved ? <p className="mt-3 text-sm font-black text-emerald-300">Bid saved. You may update it until time expires.</p> : null}<div className="mt-4 grid grid-cols-2 gap-2"><button type="button" className="wc-button wc-button-secondary min-h-12" onClick={onClear}>Clear / No bid</button><button type="button" className="wc-button wc-button-primary min-h-12" disabled={!isValidBid} onClick={onSubmit}>{saved ? "Update Bid" : "Submit Bid"}</button></div></div>;
}

function HiddenAuctionResult({ winner, spaceName, winningBid, tiedPlayers, tieBid, revealStep }: { winner: GameState["players"][number] | undefined; spaceName: string; winningBid: number; tiedPlayers: string[]; tieBid: number; revealStep: 1 | 2 | 3 | null }) {
  if (revealStep !== null) return <div className="flex min-h-[340px] flex-1 flex-col items-center justify-center p-8 text-center"><p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--wc-gold)]">Bids locked</p><p className="wc-numeric mt-5 text-8xl font-black leading-none text-white motion-reduce:text-6xl">{revealStep}</p><p className="mt-6 text-sm font-semibold text-slate-300">Revealing the sealed result…</p></div>;
  return <div className="flex min-h-[340px] flex-1 flex-col items-center justify-center p-8 text-center"><div className="rounded-[var(--wc-radius-large)] border border-[var(--wc-gold-border)] bg-[var(--wc-navy-raised)] p-5">{winner ? <><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Hidden auction result</p><p className="mt-2 text-2xl font-black text-white">{winner.name} wins {spaceName}!</p><p className="wc-numeric mt-2 text-3xl font-black text-[var(--wc-gold)]">${winningBid}</p></> : tiedPlayers.length > 0 ? <><p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--wc-gold)]">{tiedPlayers.length}-way tie</p><p className="mt-2 text-2xl font-black text-white">{tiedPlayers.join(" and ")}</p><p className="wc-numeric mt-2 text-xl font-black text-[var(--wc-gold)]">${tieBid} each</p><p className="mt-2 text-sm text-slate-300">Tie-break auction starting with only the tied players.</p></> : <><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">Hidden auction result</p><p className="mt-2 text-2xl font-black text-white">No winning bid</p><p className="mt-2 text-slate-300">{spaceName} remains unowned.</p></>}</div></div>;
}

function HiddenTimerRing({ secondsLeft }: { secondsLeft: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(1, secondsLeft / (HIDDEN_AUCTION_BID_MS / 1_000)));
  const urgent = secondsLeft <= 5;
  const color = urgent ? AUCTION_ACTION_TOKENS.urgent : AUCTION_ACTION_TOKENS.gold;
  return <div className="relative h-12 w-12 shrink-0 rounded-full bg-slate-950/80" aria-label={`${secondsLeft} seconds remaining`}><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r={radius} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" /><circle cx="26" cy="26" r={radius} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)} transform="rotate(-90 26 26)" style={{ transition: "stroke-dashoffset 0.25s linear" }} /></svg><span className={`wc-numeric absolute inset-0 flex items-center justify-center text-sm font-black ${urgent ? "text-red-300" : "text-white"}`}>{secondsLeft}</span></div>;
}
