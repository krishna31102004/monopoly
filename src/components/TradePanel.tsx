"use client";

import { useState } from "react";
import { boardSpaces } from "@/data/board";
import { validateTrade } from "@/lib/game/trade";
import { TokenIcon } from "@/components/board/TokenIcon";
import type { GameAction, GameState, TradeOffer } from "@/types/game";
import type { Player } from "@/types/player";

type Props = {
  state: GameState;
  dispatch: (action: GameAction) => void;
  myPlayerId?: string;
};

const EMPTY_OFFER: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };

// ── Property chip ─────────────────────────────────────────────────────────────

function PropertyChip({
  spaceIndex,
  selected,
  onToggle,
  disabled,
}: {
  spaceIndex: number;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const space = boardSpaces[spaceIndex];
  if (!space) return null;
  const color =
    space.kind === "city"
      ? ({
          brown: "#8b5e3c", "light-blue": "#6ec6ea", pink: "#d946a8",
          orange: "#f97316", red: "#dc2626", yellow: "#eab308",
          green: "#16a34a", "dark-blue": "#1d4ed8",
        } as Record<string, string>)[space.colorGroup] ?? "#94a3b8"
      : space.kind === "airport"
      ? "#475569"
      : "#0d9488";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-xs font-semibold transition-all ${
        selected
          ? "border-transparent text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
      style={selected ? { backgroundColor: color } : undefined}
      title={space.name}
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: selected ? "rgba(255,255,255,0.6)" : color }}
      />
      <span className="truncate max-w-[80px]">{space.name}</span>
    </button>
  );
}

// ── Player column header ──────────────────────────────────────────────────────

function PlayerHeader({ player, label, side }: { player: Player; label: string; side: "left" | "right" }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-t-xl px-3 py-2.5 ${side === "left" ? "flex-row" : "flex-row-reverse text-right"}`}
      style={{ backgroundColor: player.color + "18", borderBottom: `2px solid ${player.color}` }}
    >
      <TokenIcon token={player.token} color={player.color} size={28} label={player.tokenLabel} badge />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: player.color }}>
          {label}
        </p>
        <p className="truncate text-sm font-black text-slate-950">{player.name}</p>
        <p className="text-[10px] font-semibold text-slate-500">${player.cash.toLocaleString()} cash</p>
      </div>
    </div>
  );
}

// ── Pending trade view ────────────────────────────────────────────────────────

function PendingTradeView({
  state,
  dispatch,
  myPlayerId,
}: {
  state: GameState;
  dispatch: (action: GameAction) => void;
  myPlayerId?: string;
}) {
  const { trade } = state;
  if (!trade) return null;

  const initiator = state.players.find((p) => p.id === trade.initiatorPlayerId);
  const recipient = state.players.find((p) => p.id === trade.recipientPlayerId);

  const isInitiator = !myPlayerId || myPlayerId === trade.initiatorPlayerId;
  const isRecipient = myPlayerId === trade.recipientPlayerId;
  const isSpectator = myPlayerId && !isInitiator && !isRecipient;

  function descOffer(offer: TradeOffer) {
    const parts: string[] = [];
    if (offer.cash > 0) parts.push(`$${offer.cash.toLocaleString()}`);
    if (offer.propertySpaceIndices.length > 0) {
      parts.push(...offer.propertySpaceIndices.map((i) => boardSpaces[i]?.name ?? `#${i}`));
    }
    if (offer.getOutOfJailFreeCards > 0) parts.push(`${offer.getOutOfJailFreeCards}× GOJF`);
    return parts;
  }

  const initiatorItems = descOffer(trade.offerFromInitiator);
  const recipientItems = descOffer(trade.offerFromRecipient);

  return (
    <div className="overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-md">
      {/* Header */}
      <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Pending Trade</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-600">
          {initiator?.name} → {recipient?.name}
        </p>
      </div>

      {/* Two-column deal summary */}
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        {[
          { player: initiator, items: initiatorItems, label: "Gives" },
          { player: recipient, items: recipientItems, label: "Receives" },
        ].map(({ player, items, label }, i) => (
          <div key={i} className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              {player ? (
                <TokenIcon token={player.token} color={player.color} size={20} label={player.tokenLabel} badge />
              ) : null}
              <div>
                <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p>
                <p className="text-xs font-bold text-slate-800">{player?.name}</p>
              </div>
            </div>
            {items.length > 0 ? (
              <ul className="space-y-1">
                {items.map((item, j) => (
                  <li key={j} className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                    <span className="text-slate-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-slate-400 italic">Nothing</p>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="border-t border-slate-100 px-4 py-3">
        {isSpectator ? (
          <p className="text-xs text-slate-500 italic">Waiting for trade to be resolved…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {isRecipient && !isInitiator && (
              <>
                <button
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.97]"
                  onClick={() => dispatch({ type: "ACCEPT_TRADE", actorPlayerId: trade.recipientPlayerId })}
                >
                  Accept Trade
                </button>
                <button
                  className="rounded-lg bg-red-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-600 active:scale-[0.97]"
                  onClick={() => dispatch({ type: "DECLINE_TRADE", actorPlayerId: trade.recipientPlayerId })}
                >
                  Decline
                </button>
              </>
            )}
            {isInitiator && (
              <>
                {!isRecipient && (
                  <p className="self-center text-xs text-slate-500 italic">
                    Waiting for {recipient?.name} to respond…
                  </p>
                )}
                <button
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-[0.97]"
                  onClick={() => dispatch({ type: "CANCEL_TRADE", actorPlayerId: trade.initiatorPlayerId })}
                >
                  Cancel Offer
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Trade proposal form ───────────────────────────────────────────────────────

export function TradePanel({ state, dispatch, myPlayerId }: Props) {
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState<string>("");
  const [initiatorCash, setInitiatorCash] = useState(0);
  const [recipientCash, setRecipientCash] = useState(0);
  const [initiatorProps, setInitiatorProps] = useState<number[]>([]);
  const [recipientProps, setRecipientProps] = useState<number[]>([]);
  const [initiatorGOJF, setInitiatorGOJF] = useState(0);
  const [recipientGOJF, setRecipientGOJF] = useState(0);

  if (state.phase === "gameOver") return null;
  if (state.phase === "auction") return null;

  // Show pending trade to everyone
  if (state.trade) {
    return <PendingTradeView state={state} dispatch={dispatch} myPlayerId={myPlayerId} />;
  }

  // Who can propose?
  const currentPlayerId = state.players[state.currentPlayerIndex]?.id;
  const authorizedProposerId =
    state.phase === "bankruptcyPending" && state.bankruptcy
      ? state.bankruptcy.debtorPlayerId
      : currentPlayerId;
  const canPropose = !myPlayerId || myPlayerId === authorizedProposerId;

  const effectiveInitiatorId = myPlayerId ?? authorizedProposerId ?? "";
  const initiatorPlayer = state.players.find((p) => p.id === effectiveInitiatorId);
  const activePlayers = state.players.filter((p) => !p.isBankrupt && p.id !== effectiveInitiatorId);

  // Initialise default recipient
  const effectiveRecipientId = recipientId || activePlayers[0]?.id || "";
  const recipientPlayer = state.players.find((p) => p.id === effectiveRecipientId);

  function resetForm() {
    setInitiatorCash(0); setRecipientCash(0);
    setInitiatorProps([]); setRecipientProps([]);
    setInitiatorGOJF(0); setRecipientGOJF(0);
    setRecipientId("");
  }

  function toggleProp(idx: number, selected: number[], setSelected: (v: number[]) => void) {
    setSelected(selected.includes(idx) ? selected.filter((i) => i !== idx) : [...selected, idx]);
  }

  if (!open) {
    return (
      <button
        disabled={!canPropose}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-40 transition-all"
        onClick={() => { if (canPropose) setOpen(true); }}
        title={canPropose ? undefined : "Only the current player can propose a trade"}
      >
        <span className="flex items-center gap-2">
          <span className="text-base">🤝</span>
          Propose Trade
        </span>
      </button>
    );
  }

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
    effectiveInitiatorId && effectiveRecipientId
      ? validateTrade(state, effectiveInitiatorId, effectiveRecipientId, offerFromInitiator, offerFromRecipient)
      : { ok: false as const, reason: "Select a recipient" };

  function handlePropose() {
    if (!validation.ok || !effectiveInitiatorId || !effectiveRecipientId) return;
    dispatch({
      type: "PROPOSE_TRADE",
      actorPlayerId: effectiveInitiatorId,
      initiatorId: effectiveInitiatorId,
      recipientId: effectiveRecipientId,
      offerFromInitiator,
      offerFromRecipient,
    });
    setOpen(false);
    resetForm();
  }

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

  return (
    <div className="overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-md">
      {/* Modal header */}
      <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Propose Trade</p>
          <p className="text-xs font-semibold text-slate-500">Build a deal — both sides must agree</p>
        </div>
        <button
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-50"
          onClick={() => { setOpen(false); resetForm(); }}
        >
          ✕ Close
        </button>
      </div>

      {/* Recipient selector */}
      <div className="border-b border-slate-100 px-4 py-2.5 flex items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 shrink-0">Trade with</span>
        <select
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-semibold text-slate-800"
          value={effectiveRecipientId}
          onChange={(e) => {
            setRecipientId(e.target.value);
            setRecipientProps([]);
            setRecipientCash(0);
            setRecipientGOJF(0);
          }}
        >
          {activePlayers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Two-column trade form */}
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        {/* Initiator column */}
        <div className="flex flex-col">
          {initiatorPlayer ? (
            <PlayerHeader player={initiatorPlayer} label="You offer" side="left" />
          ) : null}
          <div className="flex-1 p-3 space-y-3">
            {/* Cash */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                Cash
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-400">$</span>
                <input
                  type="number" min={0} max={initiatorPlayer?.cash ?? 0}
                  value={initiatorCash}
                  onChange={(e) => setInitiatorCash(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-800"
                />
              </div>
            </div>
            {/* GOJF */}
            {(initiatorPlayer?.getOutOfJailFreeCards ?? 0) > 0 && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  Get Out of Jail Free ({initiatorPlayer?.getOutOfJailFreeCards})
                </label>
                <input
                  type="number" min={0} max={initiatorPlayer?.getOutOfJailFreeCards ?? 0}
                  value={initiatorGOJF}
                  onChange={(e) => setInitiatorGOJF(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-800"
                />
              </div>
            )}
            {/* Properties */}
            {initiatorOwnedIndices.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Properties
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {initiatorOwnedIndices.map((idx) => (
                    <PropertyChip
                      key={idx}
                      spaceIndex={idx}
                      selected={initiatorProps.includes(idx)}
                      onToggle={() => toggleProp(idx, initiatorProps, setInitiatorProps)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recipient column */}
        <div className="flex flex-col">
          {recipientPlayer ? (
            <PlayerHeader player={recipientPlayer} label="They offer" side="right" />
          ) : null}
          <div className="flex-1 p-3 space-y-3">
            {/* Cash */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                Cash
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-400">$</span>
                <input
                  type="number" min={0} max={recipientPlayer?.cash ?? 0}
                  value={recipientCash}
                  onChange={(e) => setRecipientCash(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-800"
                />
              </div>
            </div>
            {/* GOJF */}
            {(recipientPlayer?.getOutOfJailFreeCards ?? 0) > 0 && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  Get Out of Jail Free ({recipientPlayer?.getOutOfJailFreeCards})
                </label>
                <input
                  type="number" min={0} max={recipientPlayer?.getOutOfJailFreeCards ?? 0}
                  value={recipientGOJF}
                  onChange={(e) => setRecipientGOJF(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-800"
                />
              </div>
            )}
            {/* Properties */}
            {recipientOwnedIndices.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Properties
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {recipientOwnedIndices.map((idx) => (
                    <PropertyChip
                      key={idx}
                      spaceIndex={idx}
                      selected={recipientProps.includes(idx)}
                      onToggle={() => toggleProp(idx, recipientProps, setRecipientProps)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-3">
        {!validation.ok && (
          <p className="mb-2 text-xs font-semibold text-red-600">{validation.reason}</p>
        )}
        <div className="flex gap-2">
          <button
            disabled={!validation.ok}
            onClick={handlePropose}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-indigo-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 transition-all"
          >
            Send Offer
          </button>
          <button
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 active:scale-[0.97] transition-all"
            onClick={() => { setOpen(false); resetForm(); }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
