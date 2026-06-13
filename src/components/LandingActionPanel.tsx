"use client";

import { getBoardSpaceByIndex } from "@/data/board";
import { getPropertyOwner, getOwnership, isOwnableSpace } from "@/lib/game/ownership";
import type { GameAction, GameState } from "@/types/game";

type LandingActionPanelProps = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
};

function getSpaceTypeLabel(kind: string) {
  if (kind === "city") return "City";
  if (kind === "airport") return "Airport";
  if (kind === "utility") return "Utility";
  return "Space";
}

export function LandingActionPanel({ state, dispatch }: LandingActionPanelProps) {
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

  const borderColor = isPurchaseDecision
    ? "border-blue-200"
    : isRent
      ? "border-red-200"
      : "border-slate-200";
  const bgColor = isPurchaseDecision
    ? "bg-blue-50"
    : isRent
      ? "bg-red-50"
      : "bg-white";
  const headerColor = isPurchaseDecision
    ? "text-blue-600"
    : isRent
      ? "text-red-600"
      : "text-slate-500";

  return (
    <section className={`overflow-hidden rounded-xl border ${borderColor} ${bgColor} shadow-sm`}>
      <div className="border-b border-inherit px-4 py-3">
        <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${headerColor}`}>
          {isPurchaseDecision ? "Purchase Decision" : isRent ? "Rent Payment" : "Landing"}
        </p>
        <h2 className="mt-0.5 text-lg font-black text-slate-950">{space.name}</h2>
      </div>

      <div className="p-4">
        <p className="text-sm font-semibold leading-5 text-slate-700">
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
              <div className="col-span-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs font-semibold text-red-800">
                ⚠️ Cash went below $0. Player may be bankrupt.
              </div>
            ) : null}
          </dl>
        ) : null}

        {isPurchaseDecision && isOwnableSpace(space) ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!canBuy}
              onClick={() => dispatch({ type: "BUY_PROPERTY" })}
              className="rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-black text-white transition-all duration-100 hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              Buy ${space.price}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "DECLINE_PROPERTY" })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-black text-slate-700 transition-all duration-100 hover:bg-slate-50 active:scale-[0.98]"
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
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</dt>
      <dd
        className={`mt-0.5 font-black ${highlight ? "text-red-700" : warn ? "text-red-600" : "text-slate-950"}`}
      >
        {value}
      </dd>
    </div>
  );
}
