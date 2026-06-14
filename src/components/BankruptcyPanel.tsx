"use client";

import type { GameAction, GameState } from "@/types/game";

type Props = {
  state: GameState;
  dispatch: (action: GameAction) => void;
  myPlayerId?: string;
};

export function BankruptcyPanel({ state, dispatch, myPlayerId }: Props) {
  if (state.phase !== "bankruptcyPending" || !state.bankruptcy) return null;

  const { bankruptcy } = state;
  const debtor = state.players.find((p) => p.id === bankruptcy.debtorPlayerId);
  const creditorName =
    bankruptcy.creditor.type === "bank"
      ? "the Bank"
      : (state.players.find(
          (p) =>
            p.id === (bankruptcy.creditor as { type: "player"; playerId: string }).playerId,
        )?.name ?? "another player");

  if (!debtor) return null;

  const amountDue = bankruptcy.amountOwed;
  const currentCash = debtor.cash; // always >= 0
  const shortage = amountDue - currentCash;
  const canPay = currentCash >= amountDue;

  // In multiplayer: only the debtor gets active buttons
  const isDebtor = !myPlayerId || myPlayerId === debtor.id;
  const isWatcher = myPlayerId && myPlayerId !== debtor.id;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-700">
        Payment Required
      </p>

      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
            style={{ backgroundColor: debtor.color }}
          >
            {debtor.tokenLabel.slice(0, 3)}
          </span>
          <span className="text-sm font-bold text-slate-900">{debtor.name}</span>
        </div>

        <p className="text-xs text-slate-600">
          <span className="font-bold">Owes:</span>{" "}
          <span className="font-semibold text-slate-800">{creditorName}</span>
        </p>

        <p className="text-xs text-slate-600">
          <span className="font-bold">Amount due:</span>{" "}
          <span className="font-bold text-red-700">${amountDue.toLocaleString()}</span>
        </p>

        <p className="text-xs text-slate-600">
          <span className="font-bold">Current cash:</span>{" "}
          <span className={canPay ? "font-bold text-emerald-600" : "font-bold text-amber-700"}>
            ${currentCash.toLocaleString()}
          </span>
          {!canPay && (
            <span className="ml-1 text-red-600 font-semibold">
              (needs ${shortage.toLocaleString()} more)
            </span>
          )}
        </p>
      </div>

      {isWatcher ? (
        <p className="mt-3 text-xs text-slate-500 italic">
          Waiting for {debtor.name} to resolve payment…
        </p>
      ) : (
        <>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {canPay
              ? "You have enough cash to pay. Click Pay to settle the debt and continue."
              : "Raise Cash: mortgage properties or sell houses/hotels to raise funds. Once you have enough, the Pay button will activate."
            }
          </div>

          <div className="mt-3 flex gap-2 flex-wrap">
            <button
              disabled={!canPay}
              onClick={() => dispatch({ type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" })}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Pay ${amountDue.toLocaleString()}
            </button>
            <button
              onClick={() => dispatch({ type: "DECLARE_BANKRUPTCY" })}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
            >
              Declare Bankruptcy
            </button>
          </div>
        </>
      )}
    </div>
  );
}
