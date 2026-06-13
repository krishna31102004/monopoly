"use client";

import { useState } from "react";
import { boardSpaces } from "@/data/board";
import { validateTrade } from "@/lib/game/trade";
import type { GameAction, GameState, TradeOffer } from "@/types/game";

type Props = {
  state: GameState;
  dispatch: (action: GameAction) => void;
  myPlayerId?: string;
};

const EMPTY_OFFER: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };

export function TradePanel({ state, dispatch, myPlayerId }: Props) {
  const [open, setOpen] = useState(false);

  const activePlayers = state.players.filter((p) => !p.isBankrupt);

  const defaultInitiatorId = activePlayers[0]?.id ?? "";
  const defaultRecipientId = activePlayers[1]?.id ?? "";

  const [initiatorId, setInitiatorId] = useState(defaultInitiatorId);
  const [recipientId, setRecipientId] = useState(defaultRecipientId);
  const [initiatorCash, setInitiatorCash] = useState(0);
  const [recipientCash, setRecipientCash] = useState(0);
  const [initiatorProps, setInitiatorProps] = useState<number[]>([]);
  const [recipientProps, setRecipientProps] = useState<number[]>([]);
  const [initiatorGOJF, setInitiatorGOJF] = useState(0);
  const [recipientGOJF, setRecipientGOJF] = useState(0);

  if (state.phase === "gameOver") return null;

  // Pending trade view
  if (state.trade) {
    const { trade } = state;
    const initiator = state.players.find((p) => p.id === trade.initiatorPlayerId);
    const recipient = state.players.find((p) => p.id === trade.recipientPlayerId);

    const descOffer = (offer: TradeOffer, ownerId: string) => {
      const parts: string[] = [];
      if (offer.cash > 0) parts.push(`$${offer.cash}`);
      if (offer.propertySpaceIndices.length > 0) {
        const names = offer.propertySpaceIndices
          .map((i) => boardSpaces[i]?.name ?? `#${i}`)
          .join(", ");
        parts.push(names);
      }
      if (offer.getOutOfJailFreeCards > 0) parts.push(`${offer.getOutOfJailFreeCards}×GOJF`);
      void ownerId;
      return parts.length > 0 ? parts.join(", ") : "nothing";
    };

    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
          Pending Trade
        </p>
        <div className="mt-2 space-y-1 text-sm text-slate-700">
          <p>
            <span className="font-bold">{initiator?.name}</span> offers{" "}
            {descOffer(trade.offerFromInitiator, trade.initiatorPlayerId)}
          </p>
          <p>
            <span className="font-bold">{recipient?.name}</span> offers{" "}
            {descOffer(trade.offerFromRecipient, trade.recipientPlayerId)}
          </p>
        </div>
        {(() => {
          const isInitiator = !myPlayerId || myPlayerId === trade.initiatorPlayerId;
          const isRecipient = !myPlayerId || myPlayerId === trade.recipientPlayerId;
          const isUnrelated = myPlayerId && !isInitiator && !isRecipient;
          if (isUnrelated) {
            return <p className="mt-3 text-xs text-slate-500 italic">Waiting for trade to be resolved…</p>;
          }
          return (
            <div className="mt-3 flex gap-2">
              {isRecipient && !isInitiator && (
                <button
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  onClick={() => dispatch({ type: "ACCEPT_TRADE", actorPlayerId: trade.recipientPlayerId })}
                >
                  Accept
                </button>
              )}
              {isRecipient && !isInitiator && (
                <button
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                  onClick={() => dispatch({ type: "DECLINE_TRADE", actorPlayerId: trade.recipientPlayerId })}
                >
                  Decline
                </button>
              )}
              {isInitiator && (
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  onClick={() => dispatch({ type: "CANCEL_TRADE", actorPlayerId: trade.initiatorPlayerId })}
                >
                  Cancel
                </button>
              )}
              {isInitiator && !isRecipient && (
                <p className="self-center text-xs text-slate-500 italic">Waiting for {recipient?.name}…</p>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  const currentPlayerId = state.players[state.currentPlayerIndex]?.id;
  const canPropose = !myPlayerId || myPlayerId === currentPlayerId;

  if (!open) {
    return (
      <button
        disabled={!canPropose}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => { if (canPropose) setOpen(true); }}
        title={canPropose ? undefined : "Only the current player can propose a trade"}
      >
        Propose Trade
      </button>
    );
  }

  // In multiplayer, force the initiator to be the connected player (who must be current player)
  const effectiveInitiatorId = myPlayerId ?? initiatorId;
  const initiatorPlayer = state.players.find((p) => p.id === effectiveInitiatorId);
  const recipientPlayer = state.players.find((p) => p.id === recipientId);

  const initiatorOwnedIndices = [
    ...(initiatorPlayer?.ownedCityIds ?? []),
    ...(initiatorPlayer?.ownedAirportIds ?? []),
    ...(initiatorPlayer?.ownedUtilityIds ?? []),
  ];
  const recipientOwnedIndices = [
    ...(recipientPlayer?.ownedCityIds ?? []),
    ...(recipientPlayer?.ownedAirportIds ?? []),
    ...(recipientPlayer?.ownedUtilityIds ?? []),
  ];

  const offerFromInitiator: TradeOffer = {
    cash: initiatorCash,
    propertySpaceIndices: initiatorProps,
    getOutOfJailFreeCards: initiatorGOJF,
  };
  const offerFromRecipient: TradeOffer = {
    cash: recipientCash,
    propertySpaceIndices: recipientProps,
    getOutOfJailFreeCards: recipientGOJF,
  };

  const validation =
    effectiveInitiatorId && recipientId
      ? validateTrade(state, effectiveInitiatorId, recipientId, offerFromInitiator, offerFromRecipient)
      : { ok: false as const, reason: "Select two players" };

  function toggleProp(
    idx: number,
    selected: number[],
    setSelected: (v: number[]) => void,
  ) {
    if (selected.includes(idx)) {
      setSelected(selected.filter((i) => i !== idx));
    } else {
      setSelected([...selected, idx]);
    }
  }

  function handlePropose() {
    if (!validation.ok || !effectiveInitiatorId || !recipientId) return;
    dispatch({
      type: "PROPOSE_TRADE",
      actorPlayerId: effectiveInitiatorId,
      initiatorId: effectiveInitiatorId,
      recipientId,
      offerFromInitiator,
      offerFromRecipient,
    });
    setOpen(false);
    setInitiatorCash(0);
    setRecipientCash(0);
    setInitiatorProps([]);
    setRecipientProps([]);
    setInitiatorGOJF(0);
    setRecipientGOJF(0);
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">
          Propose Trade
        </p>
        <button
          className="text-xs text-slate-500 hover:text-slate-700"
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Initiator column */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600">
            From
          </label>
          <select
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            value={initiatorId}
            onChange={(e) => {
              setInitiatorId(e.target.value);
              setInitiatorProps([]);
            }}
          >
            {activePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <label className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
            Cash
          </label>
          <input
            type="number"
            min={0}
            max={initiatorPlayer?.cash ?? 0}
            value={initiatorCash}
            onChange={(e) => setInitiatorCash(Math.max(0, parseInt(e.target.value) || 0))}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />

          {(initiatorPlayer?.getOutOfJailFreeCards ?? 0) > 0 && (
            <>
              <label className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                GOJF Cards
              </label>
              <input
                type="number"
                min={0}
                max={initiatorPlayer?.getOutOfJailFreeCards ?? 0}
                value={initiatorGOJF}
                onChange={(e) =>
                  setInitiatorGOJF(Math.max(0, parseInt(e.target.value) || 0))
                }
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </>
          )}

          {initiatorOwnedIndices.length > 0 && (
            <>
              <label className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Properties
              </label>
              <div className="mt-1 max-h-32 overflow-y-auto space-y-1">
                {initiatorOwnedIndices.map((idx) => {
                  const sp = boardSpaces[idx];
                  const checked = initiatorProps.includes(idx);
                  return (
                    <label key={idx} className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleProp(idx, initiatorProps, setInitiatorProps)
                        }
                      />
                      <span>{sp?.name ?? `#${idx}`}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Recipient column */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-600">
            To
          </label>
          <select
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            value={recipientId}
            onChange={(e) => {
              setRecipientId(e.target.value);
              setRecipientProps([]);
            }}
          >
            {activePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <label className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
            Cash
          </label>
          <input
            type="number"
            min={0}
            max={recipientPlayer?.cash ?? 0}
            value={recipientCash}
            onChange={(e) => setRecipientCash(Math.max(0, parseInt(e.target.value) || 0))}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />

          {(recipientPlayer?.getOutOfJailFreeCards ?? 0) > 0 && (
            <>
              <label className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                GOJF Cards
              </label>
              <input
                type="number"
                min={0}
                max={recipientPlayer?.getOutOfJailFreeCards ?? 0}
                value={recipientGOJF}
                onChange={(e) =>
                  setRecipientGOJF(Math.max(0, parseInt(e.target.value) || 0))
                }
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </>
          )}

          {recipientOwnedIndices.length > 0 && (
            <>
              <label className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Properties
              </label>
              <div className="mt-1 max-h-32 overflow-y-auto space-y-1">
                {recipientOwnedIndices.map((idx) => {
                  const sp = boardSpaces[idx];
                  const checked = recipientProps.includes(idx);
                  return (
                    <label key={idx} className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          toggleProp(idx, recipientProps, setRecipientProps)
                        }
                      />
                      <span>{sp?.name ?? `#${idx}`}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {!validation.ok && (
        <p className="mt-3 text-xs text-red-600">{validation.reason}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          disabled={!validation.ok}
          onClick={handlePropose}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send Offer
        </button>
        <button
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
