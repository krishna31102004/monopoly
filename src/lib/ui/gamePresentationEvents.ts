import { boardSpaces } from "@/data/board";
import type { CityProperty } from "@/types/board";
import type { GameState, PropertyOwnership } from "@/types/game";

export type PresentationEventKind =
  | "property-purchased" | "rent-paid" | "auction-won" | "auction-no-bid"
  | "trade-accepted" | "trade-declined" | "trade-cancelled" | "sent-to-jail"
  | "left-jail" | "bankruptcy" | "country-set-completed" | "game-started" | "game-won";

export type PresentationEvent = {
  key: string;
  kind: PresentationEventKind;
  title: string;
  detail: string;
  accent?: string;
};

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

/** Pure, presentation-only transition derivation. It never mutates game state. */
export function deriveGamePresentationEvents(previous: GameState, current: GameState): PresentationEvent[] {
  const events: PresentationEvent[] = [];
  const latestLogId = current.gameLog.at(-1)?.id ?? `${current.currentPlayerIndex}:${current.phase}`;

  if (previous.phase === "setup" && current.phase !== "setup") {
    events.push({ key: `start:${latestLogId}`, kind: "game-started", title: "World Cities", detail: "Your journey begins." });
  }

  if (previous.phase !== "gameOver" && current.phase === "gameOver" && current.winnerId) {
    events.push({ key: `won:${current.winnerId}:${latestLogId}`, kind: "game-won", title: `${playerName(current, current.winnerId)} builds a world empire`, detail: "The final travel ledger is ready." });
  }

  const rent = current.landingAction;
  if (rent?.kind === "rentPayment" && previous.landingAction !== rent) {
    const property = boardSpaces[rent.spaceIndex];
    events.push({ key: `rent:${latestLogId}`, kind: "rent-paid", title: `$${rent.rentAmount} rent transferred`, detail: `${playerName(current, rent.payerId)} → ${playerName(current, rent.ownerId)} · ${property?.name ?? "Property"}` });
  }

  for (const ownership of current.ownerships) {
    const previousOwnership = ownershipAt(previous.ownerships, ownership.spaceIndex);
    if (!previousOwnership?.ownerId && ownership.ownerId) {
      const property = boardSpaces[ownership.spaceIndex];
      const wasAuction = previous.auction?.propertySpaceIndex === ownership.spaceIndex;
      events.push({
        key: `${wasAuction ? "auction" : "purchase"}:${ownership.spaceIndex}:${ownership.ownerId}:${latestLogId}`,
        kind: wasAuction ? "auction-won" : "property-purchased",
        title: wasAuction ? `${playerName(current, ownership.ownerId)} wins the auction` : `${playerName(current, ownership.ownerId)} acquires ${property?.name ?? "a property"}`,
        detail: property && "price" in property ? `${property.name} · $${property.price} · ${property.kind}` : "Property acquired",
      });
    }
  }
  if (previous.auction && !current.auction && !current.ownerships.find((entry) => entry.spaceIndex === previous.auction!.propertySpaceIndex)?.ownerId) {
    events.push({ key: `auction-none:${previous.auction.propertySpaceIndex}:${latestLogId}`, kind: "auction-no-bid", title: "Auction closed", detail: "No bids were placed." });
  }

  for (const player of current.players) {
    const before = previous.players.find((candidate) => candidate.id === player.id);
    if (before && !before.isInJail && player.isInJail) events.push({ key: `jail-in:${player.id}:${latestLogId}`, kind: "sent-to-jail", title: `${player.name} is in jail`, detail: "Their journey pauses until release." });
    if (before && before.isInJail && !player.isInJail) events.push({ key: `jail-out:${player.id}:${latestLogId}`, kind: "left-jail", title: `${player.name} leaves jail`, detail: "Travel resumes." });
    if (before && !before.isBankrupt && player.isBankrupt) events.push({ key: `bankruptcy:${player.id}:${latestLogId}`, kind: "bankruptcy", title: `${player.name} is bankrupt`, detail: "Assets follow the authoritative resolution." });
  }

  for (const player of current.players.filter((candidate) => !candidate.isBankrupt)) {
    for (const group of new Set(boardSpaces.filter((candidate) => candidate.kind === "city").map((city) => city.colorGroup))) {
      const space = boardSpaces.find((candidate) => candidate.kind === "city" && candidate.colorGroup === group);
      if (!space || space.kind !== "city") continue;
      if (!ownsCompleteGroup(previous, player.id, group) && ownsCompleteGroup(current, player.id, group)) {
        events.push({ key: `stamp:${player.id}:${group}:${latestLogId}`, kind: "country-set-completed", title: `${space.country} complete`, detail: `${player.name} completed the ${group} set.` });
      }
    }
  }

  if (previous.trade && !current.trade) {
    const message = current.gameLog.at(-1)?.message.toLowerCase() ?? "";
    const kind = message.includes("declined") ? "trade-declined" : message.includes("cancelled") ? "trade-cancelled" : "trade-accepted";
    events.push({ key: `trade:${kind}:${latestLogId}`, kind, title: kind === "trade-accepted" ? "Trade completed" : kind === "trade-declined" ? "Trade declined" : "Trade cancelled", detail: `${playerName(previous, previous.trade.initiatorPlayerId)} and ${playerName(previous, previous.trade.recipientPlayerId)}` });
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
