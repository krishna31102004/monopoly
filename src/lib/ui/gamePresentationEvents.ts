import { boardSpaces } from "@/data/board";
import { classifyTradeResultFromLogMessage } from "@/lib/game/tradeHelpers";
import type { CityProperty } from "@/types/board";
import type { GameState, PropertyOwnership } from "@/types/game";

export type PresentationEventKind =
  | "property-purchased" | "rent-paid" | "auction-won" | "auction-no-bid"
  | "trade-accepted" | "trade-declined" | "trade-cancelled" | "sent-to-jail"
  | "left-jail" | "bankruptcy" | "country-set-completed" | "game-started" | "game-won";

export type PresentationReleaseGate =
  | "landing-complete"
  | "open-auction-result-complete"
  | "hidden-auction-result-complete"
  | "trade-result-complete";

export type PresentationEvent = {
  key: string;
  kind: PresentationEventKind;
  title: string;
  detail: string;
  accent?: string;
  /** Presentation-only blocker; never changes authoritative game state. */
  releaseAfter?: PresentationReleaseGate;
  /** Completion counter observed when this event entered the queue. */
  releaseAfterVersion?: number;
};

export type PresentationReadiness = {
  landingComplete: boolean;
  openAuctionResultVersion: number;
  /** A chained bankruptcy/forfeit auction is the prior result's existing hand-off. */
  openAuctionResultComplete: boolean;
  hiddenAuctionResultComplete: boolean;
  tradeResultVersion: number;
};

/** Appends transition events once, preserving their factual transition order. */
export function enqueuePresentationEvents(
  queue: PresentationEvent[],
  incoming: PresentationEvent[],
  seen: ReadonlySet<string>,
) {
  return [...queue, ...incoming.filter((event) => !seen.has(event.key) && !queue.some((queued) => queued.key === event.key))];
}

/** The queue remains strictly FIFO so delayed outcomes cannot overtake earlier ones. */
export function getNextReadyPresentationEvent(
  queue: PresentationEvent[],
  readiness: PresentationReadiness,
): PresentationEvent | null {
  const event = queue[0];
  if (!event) return null;
  if (event.releaseAfter === "landing-complete") return readiness.landingComplete ? event : null;
  if (event.releaseAfter === "hidden-auction-result-complete") return readiness.hiddenAuctionResultComplete ? event : null;
  if (event.releaseAfter === "open-auction-result-complete") {
    return readiness.openAuctionResultComplete || readiness.openAuctionResultVersion > (event.releaseAfterVersion ?? 0) ? event : null;
  }
  if (event.releaseAfter === "trade-result-complete") {
    return readiness.tradeResultVersion > (event.releaseAfterVersion ?? 0) ? event : null;
  }
  return event;
}

function playerName(state: GameState, id: string | null | undefined) {
  return state.players.find((player) => player.id === id)?.name ?? "A player";
}

function ownershipAt(ownerships: PropertyOwnership[], spaceIndex: number) {
  return ownerships.find((ownership) => ownership.spaceIndex === spaceIndex);
}

function ownsCompleteGroup(state: GameState, playerId: string, group: string) {
  const members = boardSpaces.filter((space) => space.kind === "city" && space.colorGroup === group);
  return members.length > 0 && members.every((space) => ownershipAt(state.ownerships, space.index)?.ownerId === playerId);
}

function getOwnershipReleaseGate(previous: GameState, spaceIndex: number): PresentationReleaseGate {
  if (previous.hiddenAuction?.propertySpaceIndex === spaceIndex) return "hidden-auction-result-complete";
  if (previous.auction?.propertySpaceIndex === spaceIndex) return "open-auction-result-complete";
  if (previous.trade) return "trade-result-complete";
  return "landing-complete";
}

/** Pure, presentation-only transition derivation. It never mutates game state. */
export function deriveGamePresentationEvents(previous: GameState, current: GameState): PresentationEvent[] {
  const events: PresentationEvent[] = [];
  const latestLogEntry = current.gameLog[0];
  const latestLogId = latestLogEntry?.id ?? `${current.currentPlayerIndex}:${current.phase}`;

  if (previous.phase === "setup" && current.phase !== "setup") {
    events.push({ key: `start:${latestLogId}`, kind: "game-started", title: "World Cities", detail: "Your journey begins." });
  }

  if (previous.phase !== "gameOver" && current.phase === "gameOver" && current.winnerId) {
    events.push({ key: `won:${current.winnerId}:${latestLogId}`, kind: "game-won", title: `${playerName(current, current.winnerId)} builds a world empire`, detail: "The final travel ledger is ready." });
  }

  const rent = current.landingAction;
  if (rent?.kind === "rentPayment" && previous.landingAction !== rent) {
    const property = boardSpaces[rent.spaceIndex];
    events.push({ key: `rent:${latestLogId}`, kind: "rent-paid", title: `$${rent.rentAmount} rent transferred`, detail: `${playerName(current, rent.payerId)} → ${playerName(current, rent.ownerId)} · ${property?.name ?? "Property"}`, releaseAfter: "landing-complete" });
  }

  for (const ownership of current.ownerships) {
    const previousOwnership = ownershipAt(previous.ownerships, ownership.spaceIndex);
    if (!previousOwnership?.ownerId && ownership.ownerId) {
      const property = boardSpaces[ownership.spaceIndex];
      const wasOpenAuction = previous.auction?.propertySpaceIndex === ownership.spaceIndex;
      const wasHiddenAuction = previous.hiddenAuction?.propertySpaceIndex === ownership.spaceIndex;
      const wasAuction = wasOpenAuction || wasHiddenAuction;
      const releaseAfter = getOwnershipReleaseGate(previous, ownership.spaceIndex);
      events.push({
        key: `${wasAuction ? "auction" : "purchase"}:${ownership.spaceIndex}:${ownership.ownerId}:${latestLogId}`,
        kind: wasAuction ? "auction-won" : "property-purchased",
        title: wasAuction ? `${playerName(current, ownership.ownerId)} wins the auction` : `${playerName(current, ownership.ownerId)} acquires ${property?.name ?? "a property"}`,
        detail: wasAuction
          ? `${property?.name ?? "Property"} · final bid $${wasHiddenAuction && current.hiddenAuction?.result?.kind === "winner" ? current.hiddenAuction.result.winningBid : previous.auction?.currentBid ?? 0}`
          : property && "price" in property ? `${property.name} · $${property.price} · ${property.kind}` : "Property acquired",
        releaseAfter,
      });
    }
  }
  const previousAuction = previous.auction;
  const previousAuctionCompleted = previousAuction && (
    !current.auction || current.auction.propertySpaceIndex !== previousAuction.propertySpaceIndex
  );
  if (previousAuctionCompleted && !current.ownerships.find((entry) => entry.spaceIndex === previousAuction.propertySpaceIndex)?.ownerId) {
    const property = boardSpaces[previousAuction.propertySpaceIndex];
    events.push({ key: `auction-none:${previousAuction.propertySpaceIndex}:${latestLogId}`, kind: "auction-no-bid", title: `Auction closed: ${property?.name ?? "Property"}`, detail: "No bids were placed.", releaseAfter: "open-auction-result-complete" });
  }

  const previousHiddenAuction = previous.hiddenAuction;
  const hiddenAuctionNoBid = previousHiddenAuction?.status === "bidding" &&
    current.hiddenAuction?.status === "reveal" &&
    current.hiddenAuction.propertySpaceIndex === previousHiddenAuction.propertySpaceIndex &&
    current.hiddenAuction.result?.kind === "no-bid";
  if (hiddenAuctionNoBid) {
    const property = boardSpaces[previousHiddenAuction.propertySpaceIndex];
    events.push({ key: `hidden-auction-none:${previousHiddenAuction.propertySpaceIndex}:${latestLogId}`, kind: "auction-no-bid", title: `Auction closed: ${property?.name ?? "Property"}`, detail: "No bids were placed.", releaseAfter: "hidden-auction-result-complete" });
  }

  for (const player of current.players) {
    const before = previous.players.find((candidate) => candidate.id === player.id);
    if (before && !before.isInJail && player.isInJail) events.push({ key: `jail-in:${player.id}:${latestLogId}`, kind: "sent-to-jail", title: `${player.name} is in jail`, detail: "Their journey pauses until release.", releaseAfter: "landing-complete" });
    if (before && before.isInJail && !player.isInJail) events.push({ key: `jail-out:${player.id}:${latestLogId}`, kind: "left-jail", title: `${player.name} leaves jail`, detail: "Travel resumes.", releaseAfter: "landing-complete" });
    if (before && !before.isBankrupt && player.isBankrupt) events.push({ key: `bankruptcy:${player.id}:${latestLogId}`, kind: "bankruptcy", title: `${player.name} is bankrupt`, detail: "Assets follow the authoritative resolution.", releaseAfter: "landing-complete" });
  }

  for (const player of current.players.filter((candidate) => !candidate.isBankrupt)) {
    for (const group of new Set(boardSpaces.filter((candidate) => candidate.kind === "city").map((city) => city.colorGroup))) {
      const space = boardSpaces.find((candidate) => candidate.kind === "city" && candidate.colorGroup === group);
      if (!space || space.kind !== "city") continue;
      if (!ownsCompleteGroup(previous, player.id, group) && ownsCompleteGroup(current, player.id, group)) {
        const acquiredMember = boardSpaces.find((candidate) =>
          candidate.kind === "city" &&
          candidate.colorGroup === group &&
          ownershipAt(previous.ownerships, candidate.index)?.ownerId !== player.id &&
          ownershipAt(current.ownerships, candidate.index)?.ownerId === player.id,
        );
        events.push({ key: `stamp:${player.id}:${group}:${latestLogId}`, kind: "country-set-completed", title: `${space.country} complete`, detail: `${player.name} completed the ${group} set.`, releaseAfter: acquiredMember ? getOwnershipReleaseGate(previous, acquiredMember.index) : "landing-complete" });
      }
    }
  }

  if (previous.trade && !current.trade) {
    const result = classifyTradeResultFromLogMessage(latestLogEntry?.message);
    if (!result) return events;
    const kind = result === "accepted" ? "trade-accepted" : result === "declined" ? "trade-declined" : "trade-cancelled";
    events.push({ key: `trade:${kind}:${latestLogId}`, kind, title: kind === "trade-accepted" ? "Trade completed" : kind === "trade-declined" ? "Trade declined" : "Trade cancelled", detail: `${playerName(previous, previous.trade.initiatorPlayerId)} and ${playerName(previous, previous.trade.recipientPlayerId)}`, releaseAfter: "trade-result-complete" });
  }
  return events;
}

export function getEndGameFacts(state: GameState, winnerId: string) {
  const owned = state.ownerships.filter((ownership) => ownership.ownerId === winnerId);
  const cities = owned.filter((ownership) => boardSpaces[ownership.spaceIndex]?.kind === "city");
  return {
    properties: owned.length,
    airports: owned.filter((ownership) => boardSpaces[ownership.spaceIndex]?.kind === "airport").length,
    utilities: owned.filter((ownership) => boardSpaces[ownership.spaceIndex]?.kind === "utility").length,
    houses: cities.reduce((total, ownership) => total + ownership.houses, 0),
    hotels: cities.filter((ownership) => ownership.hasHotel).length,
    mortgaged: owned.filter((ownership) => ownership.isMortgaged).length,
    completedGroups: [...new Set(boardSpaces.filter((space): space is CityProperty => space.kind === "city").filter((space) => ownsCompleteGroup(state, winnerId, space.colorGroup)).map((space) => space.country))],
  };
}
