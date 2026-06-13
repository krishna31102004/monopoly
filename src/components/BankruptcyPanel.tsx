"use client";

import type { GameAction, GameState } from "@/types/game";

type Props = {
  state: GameState;
  dispatch: (action: GameAction) => void;
};

export function BankruptcyPanel({ state, dispatch }: Props) {
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

  const shortage = -debtor.cash;
  const isSolvent = debtor.cash >= 0;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-700">
        Bankruptcy Pending
      </p>

      <div className="mt-2 space-y-1">
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
          <span className="font-bold">Owes:</span> {creditorName}
        </p>

        <p className="text-xs text-slate-600">
          <span className="font-bold">Cash:</span>{" "}
          <span className={debtor.cash < 0 ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>
            ${debtor.cash.toLocaleString()}
          </span>
          {debtor.cash < 0 && (
            <span className="ml-1 text-red-600">
              (short ${shortage.toLocaleString()})
            </span>
          )}
        </p>

        <p className="text-xs text-slate-500">{bankruptcy.reason}</p>
      </div>

      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        {isSolvent ? (
          "Cash is now non-negative. You can resolve your bankruptcy and continue."
        ) : (
          "Mortgage properties or sell houses/hotels to raise cash. If you cannot recover, declare bankruptcy."
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          disabled={!isSolvent}
          onClick={() => dispatch({ type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" })}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Resolve (Solvent)
        </button>
        <button
          onClick={() => dispatch({ type: "DECLARE_BANKRUPTCY" })}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
        >
          Declare Bankruptcy
        </button>
      </div>
    </div>
  );
}
