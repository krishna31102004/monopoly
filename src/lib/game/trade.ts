import { boardSpaces } from "@/data/board";
import { getOwnership } from "@/lib/game/ownership";
import { getColorGroupSpaces } from "@/lib/game/propertyDevelopment";
import type { GameState, PropertyOwnership, TradeOffer } from "@/types/game";

export type TradeValidationResult = { ok: true } | { ok: false; reason: string };

export function canTradeProperty(
  spaceIndex: number,
  offeringPlayerId: string,
  ownerships: PropertyOwnership[],
): TradeValidationResult {
  const space = boardSpaces[spaceIndex];
  if (!space || (space.kind !== "city" && space.kind !== "airport" && space.kind !== "utility")) {
    return { ok: false, reason: "Not a tradeable property" };
  }

  const ownership = getOwnership(ownerships, spaceIndex);
  if (!ownership || ownership.ownerId !== offeringPlayerId) {
    return { ok: false, reason: `Player does not own this property` };
  }

  if (space.kind === "city") {
    if (ownership.houses > 0 || ownership.hasHotel) {
      return { ok: false, reason: `${space.name} has improvements — sell them first` };
    }
    const groupSpaces = getColorGroupSpaces(space);
    for (const gs of groupSpaces) {
      const go = getOwnership(ownerships, gs.index);
      if ((go?.houses ?? 0) > 0 || go?.hasHotel) {
        return { ok: false, reason: `Color group has improvements — sell them first` };
      }
    }
  }

  return { ok: true };
}

export function validateTrade(
  state: GameState,
  initiatorId: string,
  recipientId: string,
  offerFromInitiator: TradeOffer,
  offerFromRecipient: TradeOffer,
): TradeValidationResult {
  if (state.phase === "gameOver") return { ok: false, reason: "Game is over" };

  if (initiatorId === recipientId) return { ok: false, reason: "Cannot trade with yourself" };

  const initiator = state.players.find((p) => p.id === initiatorId);
  const recipient = state.players.find((p) => p.id === recipientId);
  if (!initiator) return { ok: false, reason: "Initiator not found" };
  if (!recipient) return { ok: false, reason: "Recipient not found" };
  if (initiator.isBankrupt) return { ok: false, reason: `${initiator.name} is bankrupt` };
  if (recipient.isBankrupt) return { ok: false, reason: `${recipient.name} is bankrupt` };

  if (offerFromInitiator.cash < 0) return { ok: false, reason: "Cash cannot be negative" };
  if (offerFromInitiator.cash > initiator.cash)
    return { ok: false, reason: `${initiator.name} does not have enough cash` };
  if (offerFromInitiator.getOutOfJailFreeCards < 0)
    return { ok: false, reason: "GOJF count cannot be negative" };
  if (offerFromInitiator.getOutOfJailFreeCards > initiator.getOutOfJailFreeCards)
    return { ok: false, reason: `${initiator.name} does not have enough GOJF cards` };

  for (const idx of offerFromInitiator.propertySpaceIndices) {
    const check = canTradeProperty(idx, initiatorId, state.ownerships);
    if (!check.ok) return check;
  }

  if (offerFromRecipient.cash < 0) return { ok: false, reason: "Cash cannot be negative" };
  if (offerFromRecipient.cash > recipient.cash)
    return { ok: false, reason: `${recipient.name} does not have enough cash` };
  if (offerFromRecipient.getOutOfJailFreeCards < 0)
    return { ok: false, reason: "GOJF count cannot be negative" };
  if (offerFromRecipient.getOutOfJailFreeCards > recipient.getOutOfJailFreeCards)
    return { ok: false, reason: `${recipient.name} does not have enough GOJF cards` };

  for (const idx of offerFromRecipient.propertySpaceIndices) {
    const check = canTradeProperty(idx, recipientId, state.ownerships);
    if (!check.ok) return check;
  }

  const initiatorSet = new Set(offerFromInitiator.propertySpaceIndices);
  for (const idx of offerFromRecipient.propertySpaceIndices) {
    if (initiatorSet.has(idx)) {
      return { ok: false, reason: "A property cannot appear on both sides of the trade" };
    }
  }

  return { ok: true };
}
