"use client";

import { useEffect, useRef, useState } from "react";
import { boardSpaces } from "@/data/board";
import { canOpenTradeNow } from "@/lib/game/turnTimingRules";
import {
  validateTradeDraft,
  getTradeModalRole,
  getTradeStatusBadgeText,
  classifyTradeResultFromLogMessage,
  getTradeSideListedValue,
  getAfterTradeCash,
  getTradePropertyCardPresentation,
  type TradeResultKind,
} from "@/lib/game/tradeHelpers";
import { TokenIcon } from "@/components/board/TokenIcon";
import type { GameAction, GameState, PropertyOwnership, TradeOffer } from "@/types/game";
import type { TradeDraftState, TradeDraftUpdatePayload } from "@/types/multiplayer";
import type { Player } from "@/types/player";

type Props = {
  state: GameState;
  dispatch: (action: GameAction) => void;
  myPlayerId?: string;
  tradeDraft?: TradeDraftState | null;
  onDraftStart?: (recipientId: string) => void;
  onDraftUpdate?: (patch: TradeDraftUpdatePayload) => void;
  onDraftCancel?: () => void;
  onDraftSubmit?: () => void;
};

const EMPTY_OFFER: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };

// ── Premium property chip ─────────────────────────────────────────────────────

function PropertyChip({
  spaceIndex,
  selected,
  onToggle,
  disabled,
  ownerships,
}: {
  spaceIndex: number;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  ownerships?: PropertyOwnership[];
}) {
  const card = getTradePropertyCardPresentation(spaceIndex, ownerships);
  if (!card) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative flex items-center gap-0 rounded-lg border text-left text-xs font-semibold transition-all duration-100 overflow-hidden ${
        selected
          ? "border-transparent shadow-md scale-[1.03] ring-2 ring-white/60"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm"
      } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      style={selected ? { backgroundColor: card.colorHex ?? "#94a3b8" } : undefined}
      title={`${card.name} — $${card.price}${card.isMortgaged ? " (mortgaged)" : ""}`}
    >
      {/* Color strip on the left */}
      <span
        className="inline-block w-2 shrink-0 self-stretch"
        style={{ backgroundColor: selected ? "rgba(255,255,255,0.35)" : (card.colorHex ?? "#94a3b8") }}
      />
      <span className={`flex items-center gap-1 px-2 py-1.5 ${selected ? "text-white" : ""}`}>
        <span className="text-[11px]">{card.icon}</span>
        <span className="truncate max-w-[80px] leading-tight">{card.name}</span>
        {card.isMortgaged && (
          <span className={`ml-0.5 text-[9px] font-black ${selected ? "text-white/70" : "text-amber-600"}`}>M</span>
        )}
        {card.houses > 0 && card.houses < 5 && (
          <span className={`ml-0.5 text-[9px] font-black ${selected ? "text-white/70" : "text-emerald-600"}`}>
            {"●".repeat(card.houses)}
          </span>
        )}
        {card.houses >= 5 && (
          <span className={`ml-0.5 text-[9px] font-black ${selected ? "text-white/70" : "text-red-600"}`}>★</span>
        )}
      </span>
    </button>
  );
}

// ── Deal tray — summarizes one side of the trade ──────────────────────────────

function DealTray({
  offer,
  ownerships,
  playerCash,
  cashReceived,
  label,
  color,
  isEmpty: noProps,
}: {
  offer: TradeOffer;
  ownerships?: PropertyOwnership[];
  playerCash: number;
  cashReceived: number;
  label: string;
  color: string;
  isEmpty?: boolean;
}) {
  const sideSummary = getTradeSideListedValue(offer, ownerships);
  const afterTrade = getAfterTradeCash(playerCash, offer.cash, cashReceived);
  const trayEmpty = offer.cash === 0 && offer.propertySpaceIndices.length === 0 && offer.getOutOfJailFreeCards === 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      <div
        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white"
        style={{ backgroundColor: color }}
      >
        {label}
      </div>
      <div className="px-3 py-2.5 space-y-1 min-h-[56px]">
        {trayEmpty ? (
          <p className="text-[11px] italic text-slate-400">Nothing selected yet</p>
        ) : (
          <>
            {offer.cash > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-emerald-700">${offer.cash.toLocaleString()}</span>
                <span className="text-[10px] text-slate-400">cash</span>
              </div>
            )}
            {offer.propertySpaceIndices.map((idx) => {
              const card = getTradePropertyCardPresentation(idx, ownerships);
              if (!card) return null;
              return (
                <div key={idx} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: card.colorHex ?? "#94a3b8" }}
                  />
                  <span className="text-[11px] font-semibold text-slate-700 truncate">{card.name}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">${card.price}</span>
                </div>
              );
            })}
            {offer.getOutOfJailFreeCards > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">🎟</span>
                <span className="text-[11px] font-semibold text-slate-700">
                  {offer.getOutOfJailFreeCards}× GOJF card
                </span>
              </div>
            )}
          </>
        )}
      </div>
      {/* Cash summary footer */}
      <div className="border-t border-slate-200 bg-white px-3 py-2 space-y-0.5">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>Listed value</span>
          <span className="font-bold text-slate-700">${sideSummary.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>Cash after trade</span>
          {afterTrade.valid ? (
            <span className="font-bold text-slate-700">${afterTrade.amount.toLocaleString()}</span>
          ) : (
            <span className="font-bold text-red-600">Not enough cash</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Enhanced cash input ───────────────────────────────────────────────────────

function CashInput({
  value,
  max,
  onChange,
  disabled,
  playerCash,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  playerCash: number;
}) {
  const invalid = value > max;
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
        Cash offered
      </label>
      <div
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 transition-colors ${
          invalid
            ? "border-red-400 bg-red-50"
            : disabled
            ? "border-slate-200 bg-slate-100"
            : "border-slate-200 bg-white focus-within:border-indigo-400"
        }`}
      >
        <span className={`text-base font-black ${invalid ? "text-red-500" : "text-slate-400"}`}>$</span>
        <input
          type="number"
          min={0}
          max={max}
          value={value || ""}
          placeholder="0"
          disabled={disabled}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="min-w-0 flex-1 bg-transparent text-base font-black text-slate-900 outline-none placeholder:text-slate-300 disabled:text-slate-400"
        />
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-400">Balance: ${playerCash.toLocaleString()}</span>
        {invalid && <span className="font-bold text-red-600">Exceeds balance</span>}
      </div>
    </div>
  );
}

// ── Player column header ──────────────────────────────────────────────────────

function PlayerHeader({
  player,
  label,
  locked,
}: {
  player: Player;
  label: string;
  locked?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-3"
      style={{ backgroundColor: player.color + "14", borderBottom: `2px solid ${player.color}` }}
    >
      <TokenIcon token={player.token} color={player.color} size={30} label={player.tokenLabel} badge />
      <div className="min-w-0 flex-1">
        <p
          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide"
          style={{ color: player.color }}
        >
          {locked && <span title="Locked — only the proposer edits this side">🔒</span>}
          {label}
        </p>
        <p className="truncate text-sm font-black text-slate-950">{player.name}</p>
      </div>
    </div>
  );
}

// ── Center exchange column ────────────────────────────────────────────────────

function ExchangeColumn() {
  return (
    <div className="hidden sm:flex flex-col items-center justify-center shrink-0 w-10 gap-2 py-4">
      <div className="h-full w-px bg-slate-200" />
      <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-1 text-sm font-black text-indigo-600 shadow-sm">
        ⇄
      </span>
      <div className="h-full w-px bg-slate-200" />
    </div>
  );
}

const RESULT_BANNER_STYLES: Record<TradeResultKind, string> = {
  accepted: "border-emerald-300 bg-emerald-50 text-emerald-700",
  declined: "border-red-300 bg-red-50 text-red-700",
  cancelled: "border-slate-300 bg-slate-50 text-slate-600",
};

const RESULT_BANNER_TEXT: Record<TradeResultKind, string> = {
  accepted: "✅ Trade accepted — assets have been exchanged.",
  declined: "Trade declined.",
  cancelled: "Trade cancelled.",
};

function TradeResultBanner({ kind, onDismiss }: { kind: TradeResultKind; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [onDismiss]);
  return (
    <div className={`mb-2 rounded-xl border px-3 py-2 text-xs font-bold shadow-sm ${RESULT_BANNER_STYLES[kind]}`} role="status">
      {RESULT_BANNER_TEXT[kind]}
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function TradeModalShell({
  statusLabel,
  statusBadge,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  statusLabel: string;
  statusBadge?: { text: string; tone: "live" | "pending" | "neutral" };
  title: string;
  subtitle?: string;
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const badgeClass =
    statusBadge?.tone === "live"
      ? "bg-emerald-600 text-white"
      : statusBadge?.tone === "pending"
      ? "bg-indigo-600 text-white"
      : "bg-slate-200 text-slate-600";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-[2px] sm:items-center"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-title"
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-indigo-300 bg-white shadow-[0_32px_100px_rgba(15,23,42,0.35)] sm:rounded-2xl"
      >
        <div className="border-b border-indigo-200 bg-gradient-to-r from-indigo-900 via-indigo-700 to-indigo-900 px-5 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200">{statusLabel}</p>
            <div className="flex items-center gap-2">
              {statusBadge ? (
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${badgeClass}`}>
                  {statusBadge.text}
                </span>
              ) : null}
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-indigo-500 bg-indigo-800/50 px-2 py-1 text-xs font-bold text-indigo-200 hover:bg-indigo-700"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
          <h2 id="trade-title" className="mt-1 text-xl font-black text-white">{title}</h2>
          {subtitle ? <p className="text-xs font-semibold text-indigo-300">{subtitle}</p> : null}
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">{footer}</div> : null}
      </section>
    </div>
  );
}

// ── Trade side column ─────────────────────────────────────────────────────────

function TradeSideColumn({
  player,
  offer,
  cashReceived,
  ownedIndices,
  label,
  editable,
  ownerships,
  onCashChange,
  onToggleProp,
  onGOJFChange,
}: {
  player: Player;
  offer: TradeOffer;
  cashReceived: number;
  ownedIndices: number[];
  label: string;
  editable: boolean;
  ownerships: PropertyOwnership[];
  onCashChange: (v: number) => void;
  onToggleProp: (idx: number) => void;
  onGOJFChange: (v: number) => void;
}) {
  const selectedSet = new Set(offer.propertySpaceIndices);
  const unselected = ownedIndices.filter((i) => !selectedSet.has(i));
  const selected = ownedIndices.filter((i) => selectedSet.has(i));

  return (
    <div className="flex flex-col min-w-0">
      <PlayerHeader player={player} label={label} locked={!editable} />

      <div className="flex-1 p-4 space-y-4">
        {/* Cash input */}
        <CashInput
          value={offer.cash}
          max={player.cash}
          onChange={onCashChange}
          disabled={!editable}
          playerCash={player.cash}
        />

        {/* GOJF */}
        {(player.getOutOfJailFreeCards ?? 0) > 0 && (
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
              🎟 GOJF Cards ({player.getOutOfJailFreeCards} available)
            </label>
            <input
              type="number"
              min={0}
              max={player.getOutOfJailFreeCards ?? 0}
              value={offer.getOutOfJailFreeCards || ""}
              placeholder="0"
              disabled={!editable}
              onChange={(e) => onGOJFChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
            />
          </div>
        )}

        {/* Selected properties (deal tray) */}
        <DealTray
          offer={offer}
          ownerships={ownerships}
          playerCash={player.cash}
          cashReceived={cashReceived}
          label={`${player.name} offers`}
          color={player.color}
        />

        {/* Available properties */}
        {ownedIndices.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {editable ? "Tap to add / remove" : "Properties"}
            </p>
            {/* Available (not yet in tray) */}
            {unselected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {unselected.map((idx) => (
                  <PropertyChip
                    key={idx}
                    spaceIndex={idx}
                    selected={false}
                    onToggle={() => onToggleProp(idx)}
                    disabled={!editable}
                    ownerships={ownerships}
                  />
                ))}
              </div>
            )}
            {/* Selected (already in tray) — shown subtly */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((idx) => (
                  <PropertyChip
                    key={idx}
                    spaceIndex={idx}
                    selected={true}
                    onToggle={() => onToggleProp(idx)}
                    disabled={!editable}
                    ownerships={ownerships}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pending trade description helper ──────────────────────────────────────────

function descOffer(offer: TradeOffer) {
  const parts: string[] = [];
  if (offer.cash > 0) parts.push(`$${offer.cash.toLocaleString()}`);
  if (offer.propertySpaceIndices.length > 0) {
    parts.push(...offer.propertySpaceIndices.map((i) => boardSpaces[i]?.name ?? `#${i}`));
  }
  if (offer.getOutOfJailFreeCards > 0) parts.push(`${offer.getOutOfJailFreeCards}× GOJF`);
  return parts;
}

// ── Local-mode trade form ────────────────────────────────────────────────────

function LocalTradeForm({ state, dispatch, myPlayerId }: Props) {
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState<string>("");
  const [initiatorCash, setInitiatorCash] = useState(0);
  const [recipientCash, setRecipientCash] = useState(0);
  const [initiatorProps, setInitiatorProps] = useState<number[]>([]);
  const [recipientProps, setRecipientProps] = useState<number[]>([]);
  const [initiatorGOJF, setInitiatorGOJF] = useState(0);
  const [recipientGOJF, setRecipientGOJF] = useState(0);

  const currentPlayerId = state.players[state.currentPlayerIndex]?.id;
  const authorizedProposerId =
    state.phase === "bankruptcyPending" && state.bankruptcy
      ? state.bankruptcy.debtorPlayerId
      : currentPlayerId;

  const effectiveInitiatorId = myPlayerId ?? authorizedProposerId ?? "";
  const timingGate = canOpenTradeNow(state, effectiveInitiatorId);
  const canPropose = (!myPlayerId || myPlayerId === authorizedProposerId) && timingGate.ok;
  const initiatorPlayer = state.players.find((p) => p.id === effectiveInitiatorId);
  const activePlayers = state.players.filter((p) => !p.isBankrupt && p.id !== effectiveInitiatorId);

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
      <div>
        <button
          disabled={!canPropose}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 shadow-sm transition-all duration-100 hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => { if (canPropose) setOpen(true); }}
          title={canPropose ? undefined : !timingGate.ok ? timingGate.reason : "Only the current player can propose a trade"}
        >
          <span className="flex items-center gap-2">
            <span className="text-base">🤝</span>
            Propose Trade
          </span>
        </button>
        {!timingGate.ok ? (
          <p className="mt-1 px-1 text-[11px] font-semibold text-amber-700">{timingGate.reason}</p>
        ) : null}
      </div>
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
      ? validateTradeDraft(state, effectiveInitiatorId, effectiveRecipientId, offerFromInitiator, offerFromRecipient)
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

  const initiatorOwnedIndices = initiatorPlayer
    ? [...initiatorPlayer.ownedCityIds, ...initiatorPlayer.ownedAirportIds, ...initiatorPlayer.ownedUtilityIds]
    : [];
  const recipientOwnedIndices = recipientPlayer
    ? [...recipientPlayer.ownedCityIds, ...recipientPlayer.ownedAirportIds, ...recipientPlayer.ownedUtilityIds]
    : [];

  return (
    <TradeModalShell
      statusLabel="Trade Negotiation"
      statusBadge={{ text: getTradeStatusBadgeText({ hasDraft: true, hasPendingTrade: false, isProposer: true }), tone: "live" }}
      title="Build a Deal"
      subtitle="Both sides must agree before the trade goes through"
      onClose={() => { setOpen(false); resetForm(); }}
      footer={
        <>
          {!validation.ok && <p className="mb-2 text-xs font-semibold text-red-600">{validation.reason}</p>}
          <div className="flex gap-2">
            <button
              disabled={!validation.ok}
              onClick={handlePropose}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition-all duration-100 hover:bg-indigo-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              Send Offer
            </button>
            <button
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition-all duration-100 hover:bg-slate-50 active:scale-[0.97]"
              onClick={() => { setOpen(false); resetForm(); }}
            >
              Cancel
            </button>
          </div>
        </>
      }
    >
      {/* Recipient selector */}
      <div className="border-b border-slate-100 px-4 py-2.5 flex items-center gap-3 bg-slate-50">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 shrink-0">Trade with</span>
        <select
          className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800"
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

      {/* Two-sided layout with center exchange indicator */}
      <div className="flex sm:divide-x divide-slate-100">
        {initiatorPlayer ? (
          <TradeSideColumn
            player={initiatorPlayer}
            offer={offerFromInitiator}
            cashReceived={recipientCash}
            ownedIndices={initiatorOwnedIndices}
            label={`${initiatorPlayer.name} gives`}
            editable={true}
            ownerships={state.ownerships}
            onCashChange={setInitiatorCash}
            onToggleProp={(idx) => toggleProp(idx, initiatorProps, setInitiatorProps)}
            onGOJFChange={setInitiatorGOJF}
          />
        ) : null}

        <ExchangeColumn />

        {recipientPlayer ? (
          <TradeSideColumn
            player={recipientPlayer}
            offer={offerFromRecipient}
            cashReceived={initiatorCash}
            ownedIndices={recipientOwnedIndices}
            label={`${recipientPlayer.name} gives`}
            editable={true}
            ownerships={state.ownerships}
            onCashChange={setRecipientCash}
            onToggleProp={(idx) => toggleProp(idx, recipientProps, setRecipientProps)}
            onGOJFChange={setRecipientGOJF}
          />
        ) : null}
      </div>
    </TradeModalShell>
  );
}

// ── Multiplayer: live draft modal ─────────────────────────────────────────────

function LiveDraftModal({
  state,
  myPlayerId,
  draft,
  onDraftUpdate,
  onDraftCancel,
  onDraftSubmit,
}: {
  state: GameState;
  myPlayerId?: string;
  draft: TradeDraftState;
  onDraftUpdate: (patch: TradeDraftUpdatePayload) => void;
  onDraftCancel: () => void;
  onDraftSubmit: () => void;
}) {
  const role = getTradeModalRole(myPlayerId, draft);
  const isProposer = role === "proposer";
  const proposer = state.players.find((p) => p.id === draft.proposerId);
  const recipient = state.players.find((p) => p.id === draft.recipientId);
  const otherCandidates = state.players.filter((p) => !p.isBankrupt && p.id !== draft.proposerId);

  const proposerOwnedIndices = proposer
    ? [...proposer.ownedCityIds, ...proposer.ownedAirportIds, ...proposer.ownedUtilityIds]
    : [];
  const recipientOwnedIndices = recipient
    ? [...recipient.ownedCityIds, ...recipient.ownedAirportIds, ...recipient.ownedUtilityIds]
    : [];

  const validation = validateTradeDraft(
    state,
    draft.proposerId,
    draft.recipientId,
    draft.offerFromProposer,
    draft.offerFromRecipient,
  );

  function toggleProp(idx: number, side: "offerFromProposer" | "offerFromRecipient") {
    if (!isProposer) return;
    const offer = draft[side];
    const next = offer.propertySpaceIndices.includes(idx)
      ? offer.propertySpaceIndices.filter((i) => i !== idx)
      : [...offer.propertySpaceIndices, idx];
    onDraftUpdate({ [side]: { ...offer, propertySpaceIndices: next } });
  }

  return (
    <TradeModalShell
      statusLabel="Trade Negotiation"
      statusBadge={{
        text: getTradeStatusBadgeText({ hasDraft: true, hasPendingTrade: false, isProposer }),
        tone: "live",
      }}
      title={`${proposer?.name ?? "Proposer"} ↔ ${recipient?.name ?? "Recipient"}`}
      subtitle={isProposer ? "Your edits update for everyone in real time" : "Watching the proposer build this offer"}
      onClose={isProposer ? onDraftCancel : undefined}
      footer={
        isProposer ? (
          <>
            {!validation.ok && <p className="mb-2 text-xs font-semibold text-red-600">{validation.reason}</p>}
            <div className="flex gap-2">
              <button
                disabled={!validation.ok}
                onClick={onDraftSubmit}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition-all duration-100 hover:bg-indigo-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                Send Offer
              </button>
              <button
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition-all duration-100 hover:bg-slate-50 active:scale-[0.97]"
                onClick={onDraftCancel}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs font-semibold text-slate-500 italic">
            Only {proposer?.name ?? "the proposer"} can edit or send this offer.
          </p>
        )
      }
    >
      {/* Recipient selector — proposer only */}
      {isProposer && (
        <div className="border-b border-slate-100 px-4 py-2.5 flex items-center gap-3 bg-slate-50">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 shrink-0">Trade with</span>
          <select
            className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800"
            value={draft.recipientId}
            onChange={(e) =>
              onDraftUpdate({ recipientId: e.target.value, offerFromRecipient: { ...EMPTY_OFFER } })
            }
          >
            {otherCandidates.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Two-sided layout */}
      <div className="flex sm:divide-x divide-slate-100">
        {proposer ? (
          <TradeSideColumn
            player={proposer}
            offer={draft.offerFromProposer}
            cashReceived={draft.offerFromRecipient.cash}
            ownedIndices={proposerOwnedIndices}
            label={`${proposer.name} gives`}
            editable={isProposer}
            ownerships={state.ownerships}
            onCashChange={(v) => onDraftUpdate({ offerFromProposer: { ...draft.offerFromProposer, cash: v } })}
            onToggleProp={(idx) => toggleProp(idx, "offerFromProposer")}
            onGOJFChange={(v) => onDraftUpdate({ offerFromProposer: { ...draft.offerFromProposer, getOutOfJailFreeCards: v } })}
          />
        ) : null}

        <ExchangeColumn />

        {recipient ? (
          <TradeSideColumn
            player={recipient}
            offer={draft.offerFromRecipient}
            cashReceived={draft.offerFromProposer.cash}
            ownedIndices={recipientOwnedIndices}
            label={`${recipient.name} gives`}
            editable={isProposer}
            ownerships={state.ownerships}
            onCashChange={(v) => onDraftUpdate({ offerFromRecipient: { ...draft.offerFromRecipient, cash: v } })}
            onToggleProp={(idx) => toggleProp(idx, "offerFromRecipient")}
            onGOJFChange={(v) => onDraftUpdate({ offerFromRecipient: { ...draft.offerFromRecipient, getOutOfJailFreeCards: v } })}
          />
        ) : null}
      </div>
    </TradeModalShell>
  );
}

// ── Pending trade view ────────────────────────────────────────────────────────

function PendingTradeView({ state, dispatch, myPlayerId }: Props) {
  const { trade } = state;
  if (!trade) return null;

  const initiator = state.players.find((p) => p.id === trade.initiatorPlayerId);
  const recipient = state.players.find((p) => p.id === trade.recipientPlayerId);

  const isInitiator = !myPlayerId || myPlayerId === trade.initiatorPlayerId;
  const isRecipient = myPlayerId === trade.recipientPlayerId;
  const isSpectator = myPlayerId && !isInitiator && !isRecipient;

  const initiatorItems = descOffer(trade.offerFromInitiator);
  const recipientItems = descOffer(trade.offerFromRecipient);
  const initiatorValue = getTradeSideListedValue(trade.offerFromInitiator, state.ownerships);
  const recipientValue = getTradeSideListedValue(trade.offerFromRecipient, state.ownerships);

  return (
    <TradeModalShell
      statusLabel="Trade Negotiation"
      statusBadge={{
        text: getTradeStatusBadgeText({
          hasDraft: false,
          hasPendingTrade: true,
          isProposer: isInitiator,
          recipientName: recipient?.name,
        }),
        tone: "pending",
      }}
      title={`${initiator?.name ?? "?"} → ${recipient?.name ?? "?"}`}
      footer={
        isSpectator ? (
          <p className="text-xs text-slate-500 italic">
            Watching trade negotiation. Only {recipient?.name ?? "the recipient"} can respond.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {isRecipient && !isInitiator && (
              <>
                <button
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-100 hover:bg-emerald-700 active:scale-[0.97]"
                  onClick={() => dispatch({ type: "ACCEPT_TRADE", actorPlayerId: trade.recipientPlayerId })}
                >
                  Accept Trade
                </button>
                <button
                  className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-100 hover:bg-red-600 active:scale-[0.97]"
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
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-all duration-100 hover:bg-slate-50 active:scale-[0.97]"
                  onClick={() => dispatch({ type: "CANCEL_TRADE", actorPlayerId: trade.initiatorPlayerId })}
                >
                  Cancel Offer
                </button>
              </>
            )}
          </div>
        )
      }
    >
      <div className="flex sm:divide-x divide-slate-100">
        {[
          { player: initiator, items: initiatorItems, value: initiatorValue, label: "Gives" },
          { player: recipient, items: recipientItems, value: recipientValue, label: "Receives" },
        ].map(({ player, items, value, label }, i) => (
          <div key={i} className="flex-1 min-w-0 p-4">
            <div className="flex items-center gap-2 mb-3">
              {player ? <TokenIcon token={player.token} color={player.color} size={22} label={player.tokenLabel} badge /> : null}
              <div>
                <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p>
                <p className="text-sm font-black text-slate-800">{player?.name}</p>
              </div>
            </div>
            {items.length > 0 ? (
              <ul className="space-y-1.5 mb-3">
                {items.map((item, j) => (
                  <li key={j} className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                    <span className="text-slate-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-[11px] text-slate-400 italic">Nothing</p>
            )}
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[10px]">
              <span className="text-slate-400">Listed value: </span>
              <span className="font-black text-slate-700">${value.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </TradeModalShell>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function TradePanel(props: Props) {
  const { state, dispatch, myPlayerId, tradeDraft, onDraftStart, onDraftUpdate, onDraftCancel, onDraftSubmit } = props;

  const wasOpenRef = useRef(false);
  const [resultBanner, setResultBanner] = useState<TradeResultKind | null>(null);
  const isOpenNow = Boolean(state.trade) || Boolean(tradeDraft);
  useEffect(() => {
    if (wasOpenRef.current && !isOpenNow) {
      const lastMessage = state.gameLog[0]?.message;
      const kind = classifyTradeResultFromLogMessage(lastMessage);
      if (kind) setResultBanner(kind);
    }
    wasOpenRef.current = isOpenNow;
  }, [isOpenNow, state.gameLog]);

  const banner = resultBanner ? (
    <TradeResultBanner kind={resultBanner} onDismiss={() => setResultBanner(null)} />
  ) : null;

  if (state.phase === "gameOver") return banner;

  if (state.trade) {
    return (
      <>
        {banner}
        <PendingTradeView state={state} dispatch={dispatch} myPlayerId={myPlayerId} />
      </>
    );
  }

  const isMultiplayerDraftMode = onDraftStart !== undefined;

  if (isMultiplayerDraftMode) {
    if (tradeDraft) {
      return (
        <>
          {banner}
          <LiveDraftModal
            state={state}
            myPlayerId={myPlayerId}
            draft={tradeDraft}
            onDraftUpdate={onDraftUpdate ?? (() => {})}
            onDraftCancel={onDraftCancel ?? (() => {})}
            onDraftSubmit={onDraftSubmit ?? (() => {})}
          />
        </>
      );
    }

    const currentPlayerId = state.players[state.currentPlayerIndex]?.id;
    const authorizedProposerId =
      state.phase === "bankruptcyPending" && state.bankruptcy
        ? state.bankruptcy.debtorPlayerId
        : currentPlayerId;
    const timingGate = canOpenTradeNow(state, myPlayerId ?? authorizedProposerId ?? "");
    const canPropose = myPlayerId === authorizedProposerId && timingGate.ok;
    const candidates = state.players.filter((p) => !p.isBankrupt && p.id !== myPlayerId);

    return (
      <div>
        {banner}
        <button
          disabled={!canPropose || candidates.length === 0}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 shadow-sm transition-all duration-100 hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => { if (canPropose && candidates[0]) onDraftStart(candidates[0].id); }}
          title={canPropose ? undefined : !timingGate.ok ? timingGate.reason : "Only the current player can propose a trade"}
        >
          <span className="flex items-center gap-2">
            <span className="text-base">🤝</span>
            Propose Trade
          </span>
        </button>
        {!timingGate.ok ? (
          <p className="mt-1 px-1 text-[11px] font-semibold text-amber-700">{timingGate.reason}</p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {banner}
      <LocalTradeForm {...props} />
    </>
  );
}
