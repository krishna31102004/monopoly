import { boardSpaces } from "@/data/board";
import { getOwnership } from "@/lib/game/ownership";
import { getColorGroupSpaces } from "@/lib/game/propertyDevelopment";
import { canMortgageProperty, canSellHotel, canSellHouse } from "@/lib/game/propertyDevelopment";
import type { GameState, PropertyOwnership, TradeOffer } from "@/types/game";
import type { OwnableSpace } from "@/types/board";

export type TradeValidationResult = { ok: true } | { ok: false; reason: string };

export type TradingMode =
  | { type: "normal" }
  | { type: "debt-resolution"; debtorPlayerId: string; outstandingAmount: number };

export type GuaranteedDebtCapacity = {
  currentCash: number;
  legalBuildingSaleProceeds: number;
  remainingMortgageProceeds: number;
  totalGuaranteedFunds: number;
};
export type DebtTradeSubtype = "cash-raising" | "asset-restructuring";

const hasNonCashAsset = (offer: TradeOffer) =>
  offer.propertySpaceIndices.length > 0 || offer.getOutOfJailFreeCards > 0;

export function classifyDebtTradeSubtype(
  debtorOffer: TradeOffer,
  counterpartyOffer: TradeOffer,
): DebtTradeSubtype | null {
  if (debtorOffer.cash !== 0 || !hasNonCashAsset(debtorOffer)) return null;
  if (counterpartyOffer.cash > 0 && !hasNonCashAsset(counterpartyOffer)) return "cash-raising";
  if (counterpartyOffer.cash === 0 && hasNonCashAsset(counterpartyOffer)) return "asset-restructuring";
  return null;
}

/** The debt state is authoritative; no trade-specific debt flag is persisted. */
export function getTradingMode(state: GameState): TradingMode {
  const debt = state.phase === "bankruptcyPending" ? state.bankruptcy : null;
  if (!debt) return { type: "normal" };
  const debtor = state.players.find((player) => player.id === debt.debtorPlayerId);
  if (!debtor || debtor.cash >= debt.amountOwed) return { type: "normal" };
  return { type: "debt-resolution", debtorPlayerId: debt.debtorPlayerId, outstandingAmount: debt.amountOwed };
}

export function getMortgageTransferFee(state: GameState, spaceIndices: number[]): number {
  return spaceIndices.reduce((total, idx) => {
    const ownership = state.ownerships.find((entry) => entry.spaceIndex === idx);
    const space = boardSpaces[idx] as OwnableSpace | undefined;
    return ownership?.isMortgaged && space ? total + Math.ceil(space.mortgageValue / 10) : total;
  }, 0);
}

export function calculateProjectedTradeState(
  state: GameState,
  initiatorId: string,
  recipientId: string,
  fromInitiator: TradeOffer,
  fromRecipient: TradeOffer,
): GameState {
  const initiatorFee = getMortgageTransferFee(state, fromRecipient.propertySpaceIndices);
  const recipientFee = getMortgageTransferFee(state, fromInitiator.propertySpaceIndices);
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.id === initiatorId) {
        return { ...player, cash: player.cash - fromInitiator.cash + fromRecipient.cash - initiatorFee };
      }
      if (player.id === recipientId) {
        return { ...player, cash: player.cash - fromRecipient.cash + fromInitiator.cash - recipientFee };
      }
      return player;
    }),
    ownerships: state.ownerships.map((ownership) => {
      if (fromInitiator.propertySpaceIndices.includes(ownership.spaceIndex)) return { ...ownership, ownerId: recipientId };
      if (fromRecipient.propertySpaceIndices.includes(ownership.spaceIndex)) return { ...ownership, ownerId: initiatorId };
      return ownership;
    }),
  };
}

/**
 * Calculates only bank-guaranteed funds. It simulates the existing legal
 * sell/mortgage preconditions against a clone, so houses, hotels, supplies and
 * group mortgage restrictions are not approximated or double-counted.
 */
export function calculateGuaranteedDebtCapacity(state: GameState, debtorPlayerId: string): GuaranteedDebtCapacity {
  const debtor = state.players.find((player) => player.id === debtorPlayerId);
  if (!debtor) return { currentCash: 0, legalBuildingSaleProceeds: 0, remainingMortgageProceeds: 0, totalGuaranteedFunds: 0 };

  let simulated: GameState = {
    ...state,
    players: state.players.map((player) => player.id === debtorPlayerId ? { ...player } : player),
    ownerships: state.ownerships.map((ownership) => ({ ...ownership })),
  };
  let buildingSales = 0;
  let mortgages = 0;
  const simulatedDebtor = () => simulated.players.find((player) => player.id === debtorPlayerId)!;

  // Hotels must be downgraded before houses can be sold. Repeated passes honour
  // the current bank-house availability and the even-selling validator.
  let changed = true;
  while (changed) {
    changed = false;
    for (const ownership of simulated.ownerships) {
      if (ownership.ownerId !== debtorPlayerId || !ownership.hasHotel) continue;
      if (!canSellHotel(simulated, ownership.spaceIndex, simulatedDebtor()).ok) continue;
      const space = boardSpaces[ownership.spaceIndex];
      if (!space || space.kind !== "city") continue;
      buildingSales += Math.floor(space.houseCost / 2);
      simulated = {
        ...simulated,
        bankHouses: simulated.bankHouses - 4,
        bankHotels: Math.min(12, simulated.bankHotels + 1),
        ownerships: simulated.ownerships.map((entry) => entry.spaceIndex === ownership.spaceIndex
          ? { ...entry, hasHotel: false, houses: 4 } : entry),
      };
      changed = true;
    }
  }
  changed = true;
  while (changed) {
    changed = false;
    for (const ownership of simulated.ownerships) {
      if (ownership.ownerId !== debtorPlayerId || ownership.houses <= 0) continue;
      if (!canSellHouse(simulated, ownership.spaceIndex, simulatedDebtor()).ok) continue;
      const space = boardSpaces[ownership.spaceIndex];
      if (!space || space.kind !== "city") continue;
      buildingSales += Math.floor(space.houseCost / 2);
      simulated = {
        ...simulated,
        bankHouses: Math.min(32, simulated.bankHouses + 1),
        ownerships: simulated.ownerships.map((entry) => entry.spaceIndex === ownership.spaceIndex
          ? { ...entry, houses: entry.houses - 1 } : entry),
      };
      changed = true;
    }
  }
  for (const ownership of simulated.ownerships) {
    if (ownership.ownerId !== debtorPlayerId || ownership.isMortgaged) continue;
    if (!canMortgageProperty(simulated, ownership.spaceIndex, simulatedDebtor()).ok) continue;
    const space = boardSpaces[ownership.spaceIndex] as OwnableSpace | undefined;
    if (!space) continue;
    mortgages += space.mortgageValue;
    simulated = { ...simulated, ownerships: simulated.ownerships.map((entry) => entry.spaceIndex === ownership.spaceIndex ? { ...entry, isMortgaged: true } : entry) };
  }
  return {
    currentCash: debtor.cash,
    legalBuildingSaleProceeds: buildingSales,
    remainingMortgageProceeds: mortgages,
    totalGuaranteedFunds: debtor.cash + buildingSales + mortgages,
  };
}

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
  if (initiatorSet.size !== offerFromInitiator.propertySpaceIndices.length ||
      new Set(offerFromRecipient.propertySpaceIndices).size !== offerFromRecipient.propertySpaceIndices.length) {
    return { ok: false, reason: "A property cannot appear more than once in a trade" };
  }
  for (const idx of offerFromRecipient.propertySpaceIndices) {
    if (initiatorSet.has(idx)) {
      return { ok: false, reason: "A property cannot appear on both sides of the trade" };
    }
  }

  const mode = getTradingMode(state);
  if (state.phase === "bankruptcyPending" && state.bankruptcy && mode.type === "normal") {
    return { ok: false, reason: "The outstanding debt can now be paid. Resolve it before trading again." };
  }

  if (mode.type === "normal") {
    if (!hasNonCashAsset(offerFromInitiator) && !hasNonCashAsset(offerFromRecipient)) {
      return { ok: false, reason: "Cash-only trades are not allowed. Include at least one property or Get Out of Jail Free card." };
    }
  } else {
    if (initiatorId !== mode.debtorPlayerId && recipientId !== mode.debtorPlayerId) {
      return { ok: false, reason: "Debt-resolution trades must involve the debtor." };
    }
    const debtorIsInitiator = initiatorId === mode.debtorPlayerId;
    const debtorOffer = debtorIsInitiator ? offerFromInitiator : offerFromRecipient;
    const counterpartyOffer = debtorIsInitiator ? offerFromRecipient : offerFromInitiator;
    const subtype = classifyDebtTradeSubtype(debtorOffer, counterpartyOffer);
    if (!subtype) return { ok: false, reason: "Debt trades must be either assets for cash or a zero-cash asset swap." };
    if (subtype === "cash-raising" && (counterpartyOffer.propertySpaceIndices.length > 0 || counterpartyOffer.getOutOfJailFreeCards > 0)) {
      return { ok: false, reason: "Cash-raising debt trades may give the debtor cash only." };
    }

    const initiatorFee = getMortgageTransferFee(state, offerFromRecipient.propertySpaceIndices);
    const recipientFee = getMortgageTransferFee(state, offerFromInitiator.propertySpaceIndices);
    if (initiator.cash - offerFromInitiator.cash + offerFromRecipient.cash - initiatorFee < 0 ||
        recipient.cash - offerFromRecipient.cash + offerFromInitiator.cash - recipientFee < 0) {
      return { ok: false, reason: "A party cannot afford mortgage transfer fees." };
    }
    const projected = calculateProjectedTradeState(state, initiatorId, recipientId, offerFromInitiator, offerFromRecipient);
    const projectedDebtor = projected.players.find((player) => player.id === mode.debtorPlayerId)!;
    if (subtype === "cash-raising" && projectedDebtor.cash <= (state.players.find((player) => player.id === mode.debtorPlayerId)?.cash ?? 0)) {
      return { ok: false, reason: "The debtor's cash must increase during debt resolution." };
    }
    if (subtype === "asset-restructuring") {
      const debtorMortgageFee = debtorIsInitiator ? initiatorFee : recipientFee;
      if (debtorMortgageFee > 0) return { ok: false, reason: "The debtor cannot receive a mortgaged property that creates an immediate transfer fee." };
      const before = calculateGuaranteedDebtCapacity(state, mode.debtorPlayerId);
      const after = calculateGuaranteedDebtCapacity(projected, mode.debtorPlayerId);
      const protectedFloor = Math.min(mode.outstandingAmount, before.totalGuaranteedFunds);
      if (after.totalGuaranteedFunds < protectedFloor) {
        return { ok: false, reason: "This swap would reduce the funds protected for the creditor." };
      }
      return { ok: true };
    }
    const capacity = calculateGuaranteedDebtCapacity(projected, mode.debtorPlayerId);
    if (capacity.totalGuaranteedFunds < mode.outstandingAmount) {
      return { ok: false, reason: `This trade would leave you unable to cover the outstanding $${mode.outstandingAmount} payment. Receive more cash or retain assets that can be legally liquidated.` };
    }
  }

  return { ok: true };
}
