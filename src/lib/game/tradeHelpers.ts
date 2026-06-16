import { validateTrade } from "@/lib/game/trade";
import type { GameState, TradeOffer, TradeState } from "@/types/game";
import type { TradeDraftState } from "@/types/multiplayer";

export type TradeModalRole = "proposer" | "recipient" | "spectator" | "none";

/**
 * Determines what role the given actor plays with respect to a live trade
 * draft or a pending (already-proposed) trade. Used to gate which controls
 * the trade modal renders for a given viewer.
 */
export function getTradeModalRole(
  actorId: string | undefined,
  tradeOrDraft: TradeState | TradeDraftState | null | undefined,
): TradeModalRole {
  if (!tradeOrDraft) return "none";
  const proposerId =
    "initiatorPlayerId" in tradeOrDraft ? tradeOrDraft.initiatorPlayerId : tradeOrDraft.proposerId;
  const recipientId =
    "recipientPlayerId" in tradeOrDraft ? tradeOrDraft.recipientPlayerId : tradeOrDraft.recipientId;
  if (!actorId) return "spectator";
  if (actorId === proposerId) return "proposer";
  if (actorId === recipientId) return "recipient";
  return "spectator";
}

export function canEditTradeDraft(actorId: string | undefined, draft: TradeDraftState | null): boolean {
  if (!draft || !actorId) return false;
  return actorId === draft.proposerId;
}

export function canSubmitTradeDraft(
  state: GameState,
  actorId: string | undefined,
  draft: TradeDraftState | null,
): boolean {
  if (!canEditTradeDraft(actorId, draft) || !draft) return false;
  const validation = validateTrade(
    state,
    draft.proposerId,
    draft.recipientId,
    draft.offerFromProposer,
    draft.offerFromRecipient,
  );
  return validation.ok;
}

export function canAcceptTrade(actorId: string | undefined, trade: TradeState | null): boolean {
  if (!trade || !actorId) return false;
  return actorId === trade.recipientPlayerId;
}

export function canCancelTrade(actorId: string | undefined, trade: TradeState | null): boolean {
  if (!trade || !actorId) return false;
  return actorId === trade.initiatorPlayerId;
}

export type TradeSideSummary = {
  cash: number;
  propertySpaceIndices: number[];
  getOutOfJailFreeCards: number;
  isEmpty: boolean;
};

export function getTradeSideSummary(offer: TradeOffer): TradeSideSummary {
  return {
    cash: offer.cash,
    propertySpaceIndices: offer.propertySpaceIndices,
    getOutOfJailFreeCards: offer.getOutOfJailFreeCards,
    isEmpty:
      offer.cash === 0 && offer.propertySpaceIndices.length === 0 && offer.getOutOfJailFreeCards === 0,
  };
}

export type TradeValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * Validates a draft's shape before it is even submitted to validateTrade —
 * covers the friendly, field-level checks the live editor should surface
 * inline (self-trade, bankrupt recipient, duplicate properties, empty offer).
 */
export function validateTradeDraft(
  state: GameState,
  proposerId: string,
  recipientId: string,
  offerFromProposer: TradeOffer,
  offerFromRecipient: TradeOffer,
): TradeValidationResult {
  if (!recipientId) return { ok: false, reason: "Select a player to trade with." };
  if (proposerId === recipientId) return { ok: false, reason: "You cannot trade with yourself." };

  const recipient = state.players.find((p) => p.id === recipientId);
  if (!recipient) return { ok: false, reason: "Recipient not found." };
  if (recipient.isBankrupt) return { ok: false, reason: "Cannot trade with a bankrupt player." };

  const proposerSummary = getTradeSideSummary(offerFromProposer);
  const recipientSummary = getTradeSideSummary(offerFromRecipient);
  if (proposerSummary.isEmpty && recipientSummary.isEmpty) {
    return { ok: false, reason: "Add cash, properties, or cards to the trade." };
  }

  const overlap = offerFromProposer.propertySpaceIndices.filter((i) =>
    offerFromRecipient.propertySpaceIndices.includes(i),
  );
  if (overlap.length > 0) {
    return { ok: false, reason: "The same property cannot be on both sides of the trade." };
  }

  return validateTrade(state, proposerId, recipientId, offerFromProposer, offerFromRecipient);
}

export type TradeResultKind = "accepted" | "declined" | "cancelled";

/**
 * Classifies the most recent game-log message as a trade resolution kind,
 * so the UI can show a brief success/declined/cancelled banner for everyone
 * in the room (including spectators) without needing a dedicated reducer
 * field — the existing log entry is the only signal every client already
 * receives identically.
 */
export function classifyTradeResultFromLogMessage(message: string | undefined): TradeResultKind | null {
  if (!message) return null;
  if (message.startsWith("Trade accepted")) return "accepted";
  if (message.includes("declined the trade")) return "declined";
  if (message.includes("cancelled the trade")) return "cancelled";
  return null;
}

/** Status badge text shown in the trade modal header, per the modal's current stage. */
export function getTradeStatusBadgeText(params: {
  hasDraft: boolean;
  hasPendingTrade: boolean;
  isProposer: boolean;
  recipientName?: string;
}): string {
  const { hasDraft, hasPendingTrade, isProposer, recipientName } = params;
  if (hasPendingTrade) return isProposer ? `Waiting for ${recipientName ?? "recipient"}` : "Offer Sent";
  if (hasDraft) return isProposer ? "Drafting" : "Live Draft";
  return "Drafting";
}
