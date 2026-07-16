"use client";

import { getBoardSpaceByIndex } from "@/data/board";
import { getPropertyOwner, getOwnership, isOwnableSpace } from "@/lib/game/ownership";
import { getAuctionTheme } from "@/lib/ui/auctionTheme";
import { UiIcon } from "@/components/ui/UiIcon";
import type { GameAction, GameState } from "@/types/game";

type LandingActionPanelProps = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  isMyTurn?: boolean;
};

function getSpaceTypeLabel(kind: string) {
  if (kind === "city") return "City";
  if (kind === "airport") return "Airport";
  if (kind === "utility") return "Utility";
  return "Space";
}

export function LandingActionPanel({ state, dispatch, isMyTurn = true }: LandingActionPanelProps) {
  if (!state.landingAction) return null;
  if (state.phase === "auction") return null;

  const currentPlayer = state.players[state.currentPlayerIndex];
  const space = getBoardSpaceByIndex(state.landingAction.spaceIndex);
  const ownership = getOwnership(state.ownerships, space.index);
  const owner = getPropertyOwner(state.ownerships, state.players, space.index);
  const isPurchaseDecision =
    state.landingAction.kind === "purchaseDecision" && isOwnableSpace(space);
  const canBuy = isPurchaseDecision && currentPlayer.cash >= (isOwnableSpace(space) ? space.price : 0);
  const isRent = state.landingAction.kind === "rentPayment";

  const accentColor = isOwnableSpace(space)
    ? getAuctionTheme(space).accentColor
    : isRent
      ? "var(--wc-danger)"
      : "var(--wc-gold)";
  const headerColor = isRent ? "text-rose-200" : "text-amber-200";

  return (
    <section
      className="overflow-hidden rounded-[var(--wc-radius-medium)] border border-[var(--wc-border)] bg-[var(--wc-navy)] text-slate-100 shadow-[var(--wc-shadow-card)]"
      style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
    >
      <div className="border-b border-[var(--wc-border-subtle)] px-4 py-3">
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${headerColor}`}>
          {isPurchaseDecision ? "Purchase Decision" : isRent ? "Rent Payment" : "Landing"}
        </p>
        <h2 className="mt-0.5 text-lg font-black text-white">{space.name}</h2>
      </div>

      <div className="p-4">
        <p className="text-sm font-semibold leading-5 text-slate-300">
          {state.landingAction.message}
        </p>

        {isOwnableSpace(space) && isPurchaseDecision ? (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Type" value={getSpaceTypeLabel(space.kind)} />
            <Stat label="List price" value={`$${space.price}`} />
            <Stat label="Your cash" value={`$${currentPlayer.cash.toLocaleString()}`} />
            <Stat
              label="Owner"
              value={owner?.name ?? (ownership?.ownerId ? "Owned" : "Unowned")}
            />
          </dl>
        ) : null}

        {isRent && state.landingAction.kind === "rentPayment" ? (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Rent paid" value={`$${state.landingAction.rentAmount}`} highlight />
            <Stat label="To" value={owner?.name ?? "—"} />
            <Stat label="Your cash" value={`$${state.landingAction.payerCashAfter.toLocaleString()}`} warn={state.landingAction.payerCashAfter < 0} />
            <Stat label="Owner cash" value={`$${state.landingAction.ownerCashAfter.toLocaleString()}`} />
            {state.landingAction.payerCashAfter < 0 ? (
              <div className="col-span-2 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-xs font-semibold text-rose-100">
                <UiIcon name="warning" size={16} aria-hidden="true" />
                Cash went below $0. Player may be bankrupt.
              </div>
            ) : null}
          </dl>
        ) : null}

        {isPurchaseDecision && !canBuy ? (
          <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/10 p-2.5 text-xs font-bold text-amber-100">
            You do not have enough cash to buy this property. Decline to send it to auction.
          </div>
        ) : null}

        {isPurchaseDecision && isOwnableSpace(space) ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!canBuy || !isMyTurn}
              onClick={() => dispatch({ type: "BUY_PROPERTY" })}
              className="wc-button wc-button-primary min-h-11 rounded-lg px-3 py-2.5 text-sm font-black disabled:cursor-not-allowed"
            >
              Buy ${space.price}
            </button>
            <button
              type="button"
              disabled={!isMyTurn}
              onClick={() => dispatch({ type: "DECLINE_PROPERTY" })}
              className="wc-button wc-button-secondary min-h-11 rounded-lg px-3 py-2.5 text-sm font-black disabled:cursor-not-allowed"
            >
              Decline
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  warn = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--wc-border-subtle)] bg-[var(--wc-navy-raised)] p-2">
      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</dt>
      <dd
        className={`wc-numeric mt-0.5 font-black ${highlight ? "text-rose-200" : warn ? "text-rose-200" : "text-white"}`}
      >
        {value}
      </dd>
    </div>
  );
}
