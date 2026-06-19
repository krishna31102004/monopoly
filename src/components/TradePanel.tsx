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

// ── Property chip ─────────────────────────────────────────────────────────────

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
      className={`relative flex items-center gap-0 rounded-md border text-left text-xs font-semibold transition-all duration-100 overflow-hidden ${
        selected
          ? "border-transparent shadow-sm ring-1 ring-white/50"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      } ${disabled ? "cursor-default opacity-70" : "cursor-pointer"}`}
      style={selected ? { backgroundColor: card.colorHex ?? "#94a3b8" } : undefined}
      title={`${card.name}${card.isMortgaged ? " — mortgaged" : ""}`}
    >
      <span
        className="inline-block w-1.5 shrink-0 self-stretch"
        style={{ backgroundColor: selected ? "rgba(255,255,255,0.4)" : (card.colorHex ?? "#94a3b8") }}
      />
      <span className={`flex items-center gap-1 px-2 py-1 ${selected ? "text-white" : ""}`}>
        <span className="truncate max-w-[72px] leading-tight">{card.name}</span>
        {card.isMortgaged && (
          <span className={`text-[9px] font-black ${selected ? "text-white/60" : "text-amber-500"}`}>M</span>
        )}
        {card.houses > 0 && card.houses < 5 && (
          <span className={`text-[9px] ${selected ? "text-white/70" : "text-emerald-600"}`}>{"▪".repeat(card.houses)}</span>
        )}
        {card.houses >= 5 && (
          <span className={`text-[9px] ${selected ? "text-white/70" : "text-red-500"}`}>★</span>
        )}
      </span>
    </button>
  );
}

// ── Money counter (cash input + before/after summary) ─────────────────────────

function MoneyCounter({
  value,
  max,
  onChange,
  disabled,
  playerCash,
  cashReceived,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  playerCash: number;
  cashReceived: number;
}) {
  const invalid = value > max;
  const afterTrade = getAfterTradeCash(playerCash, value, cashReceived);

  return (
    <div className="space-y-1.5">
      {/* Cash input — text-based to avoid browser spinner */}
      <div
        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 transition-colors ${
          invalid
            ? "border-red-300 bg-red-50"
            : disabled
            ? "border-slate-100 bg-slate-50"
            : "border-slate-200 bg-white focus-within:border-indigo-400"
        }`}
      >
        <span className={`text-sm font-black leading-none ${invalid ? "text-red-500" : "text-slate-400"}`}>$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value === 0 ? "" : String(value)}
          placeholder="0"
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            onChange(raw === "" ? 0 : Math.max(0, parseInt(raw, 10)));
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-black text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-300 disabled:text-slate-400"
        />
      </div>
      {/* Compact cash summary row */}
      <div className="flex items-center justify-between text-[10px] leading-tight">
        <span className="text-slate-400">Available ${playerCash.toLocaleString()}</span>
        {invalid ? (
          <span className="font-bold text-red-500">Exceeds balance</span>
        ) : (
          <span className="text-slate-500">
            After{" "}
            <span className="font-bold text-slate-700">
              {afterTrade.valid ? `$${afterTrade.amount.toLocaleString()}` : "—"}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Deal tray ─────────────────────────────────────────────────────────────────

function DealTray({
  offer,
  ownerships,
}: {
  offer: TradeOffer;
  ownerships?: PropertyOwnership[];
}) {
  const isEmpty = offer.cash === 0 && offer.propertySpaceIndices.length === 0 && offer.getOutOfJailFreeCards === 0;

  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-2 min-h-[36px]">
      {isEmpty ? (
        <p className="text-[11px] italic text-slate-300">Nothing selected</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 items-center">
          {offer.cash > 0 && (
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-700">
              ${offer.cash.toLocaleString()}
            </span>
          )}
          {offer.propertySpaceIndices.map((idx) => {
            const card = getTradePropertyCardPresentation(idx, ownerships);
            if (!card) return null;
            return (
              <span
                key={idx}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: card.colorHex ?? "#94a3b8" }}
              >
                <span className="truncate max-w-[64px]">{card.name}</span>
              </span>
            );
          })}
          {offer.getOutOfJailFreeCards > 0 && (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              {offer.getOutOfJailFreeCards}× GOJF
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Trade side panel ──────────────────────────────────────────────────────────

function TradeSidePanel({
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
  const listedValue = getTradeSideListedValue(offer, ownerships);

  return (
    <div className="flex flex-col min-w-0 p-3 space-y-3">
      {/* Player header */}
      <div className="flex items-center gap-2">
        <TokenIcon token={player.token} color={player.color} size={26} label={player.tokenLabel} badge />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-900">{player.name}</p>
          <p className="text-[10px] font-semibold" style={{ color: player.color }}>
            {!editable && "🔒 "}
            {label}
          </p>
        </div>
      </div>

      {/* Cash */}
      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Cash</p>
        <MoneyCounter
          value={offer.cash}
          max={player.cash}
          onChange={onCashChange}
          disabled={!editable}
          playerCash={player.cash}
          cashReceived={cashReceived}
        />
      </div>

      {/* GOJF — only when player has cards */}
      {(player.getOutOfJailFreeCards ?? 0) > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
            🎟 GOJF ({player.getOutOfJailFreeCards} available)
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={offer.getOutOfJailFreeCards === 0 ? "" : String(offer.getOutOfJailFreeCards)}
            placeholder="0"
            disabled={!editable}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              onGOJFChange(raw === "" ? 0 : Math.max(0, parseInt(raw, 10)));
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
      )}

      {/* Deal tray */}
      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Deal tray</p>
        <DealTray offer={offer} ownerships={ownerships} />
      </div>

      {/* Available assets */}
      {ownedIndices.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            {editable ? "Properties — tap to add/remove" : "Properties"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ownedIndices.map((idx) => (
              <PropertyChip
                key={idx}
                spaceIndex={idx}
                selected={selectedSet.has(idx)}
                onToggle={() => onToggleProp(idx)}
                disabled={!editable}
                ownerships={ownerships}
              />
            ))}
          </div>
        </div>
      )}

      {/* Listed value — bottom summary */}
      <div className="mt-auto pt-1 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
        <span>Listed value</span>
        <span className="font-black text-slate-600">${listedValue.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ── Result banner ─────────────────────────────────────────────────────────────

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
      ? "bg-emerald-500 text-white"
      : statusBadge?.tone === "pending"
      ? "bg-indigo-500 text-white"
      : "bg-white/20 text-white";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-[2px] sm:items-center"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-title"
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-indigo-400/30 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.4)] sm:rounded-2xl"
      >
        {/* Header — compact */}
        <div className="bg-indigo-900 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">{statusLabel}</p>
              <h2 id="trade-title" className="text-base font-black text-white leading-tight truncate">{title}</h2>
              {subtitle ? <p className="text-[10px] text-indigo-400 mt-0.5">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {statusBadge ? (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${badgeClass}`}>
                  {statusBadge.text}
                </span>
              ) : null}
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-indigo-700 bg-indigo-800/60 px-2 py-1 text-[11px] font-bold text-indigo-300 hover:bg-indigo-700"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer ? (
          <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-4 py-3">{footer}</div>
        ) : null}
      </section>
    </div>
  );
}

// ── Two-sided trade layout ────────────────────────────────────────────────────

function TwoSideLayout({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    // Mobile: stacked. Desktop: two equal columns with a divider + small ⇄ badge.
    <div className="relative grid grid-cols-1 sm:grid-cols-2 divide-y divide-slate-100 sm:divide-y-0 sm:divide-x">
      <div className="min-w-0">{left}</div>
      {/* ⇄ badge overlaid on the column divider (desktop only) */}
      <div className="absolute left-1/2 top-4 -translate-x-1/2 z-10 hidden sm:flex">
        <span className="rounded-full bg-white border border-slate-200 px-1.5 py-0.5 text-[11px] font-black text-indigo-500 shadow-sm">
          ⇄
        </span>
      </div>
      <div className="min-w-0">{right}</div>
    </div>
  );
}

// ── Pending trade offer rows ──────────────────────────────────────────────────

function descOffer(offer: TradeOffer) {
  const parts: string[] = [];
  if (offer.cash > 0) parts.push(`$${offer.cash.toLocaleString()}`);
  if (offer.propertySpaceIndices.length > 0) {
    parts.push(...offer.propertySpaceIndices.map((i) => boardSpaces[i]?.name ?? `#${i}`));
  }
  if (offer.getOutOfJailFreeCards > 0) parts.push(`${offer.getOutOfJailFreeCards}× GOJF`);
  return parts;
}

// ── Local-mode trade form ─────────────────────────────────────────────────────

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

  function toggleProp(idx: number, sel: number[], setSel: (v: number[]) => void) {
    setSel(sel.includes(idx) ? sel.filter((i) => i !== idx) : [...sel, idx]);
  }

  if (!open) {
    return (
      <div>
        <button
          disabled={!canPropose}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => { if (canPropose) setOpen(true); }}
          title={canPropose ? undefined : !timingGate.ok ? timingGate.reason : "Only the current player can propose a trade"}
        >
          <span className="flex items-center gap-2"><span className="text-base">🤝</span>Propose Trade</span>
        </button>
        {!timingGate.ok && (
          <p className="mt-1 px-1 text-[11px] font-semibold text-amber-700">{timingGate.reason}</p>
        )}
      </div>
    );
  }

  const offerFromInitiator: TradeOffer = { cash: initiatorCash, propertySpaceIndices: initiatorProps, getOutOfJailFreeCards: initiatorGOJF };
  const offerFromRecipient: TradeOffer = { cash: recipientCash, propertySpaceIndices: recipientProps, getOutOfJailFreeCards: recipientGOJF };

  const validation =
    effectiveInitiatorId && effectiveRecipientId
      ? validateTradeDraft(state, effectiveInitiatorId, effectiveRecipientId, offerFromInitiator, offerFromRecipient)
      : { ok: false as const, reason: "Select a recipient" };

  function handlePropose() {
    if (!validation.ok || !effectiveInitiatorId || !effectiveRecipientId) return;
    dispatch({ type: "PROPOSE_TRADE", actorPlayerId: effectiveInitiatorId, initiatorId: effectiveInitiatorId, recipientId: effectiveRecipientId, offerFromInitiator, offerFromRecipient });
    setOpen(false);
    resetForm();
  }

  const initiatorOwnedIndices = initiatorPlayer ? [...initiatorPlayer.ownedCityIds, ...initiatorPlayer.ownedAirportIds, ...initiatorPlayer.ownedUtilityIds] : [];
  const recipientOwnedIndices = recipientPlayer ? [...recipientPlayer.ownedCityIds, ...recipientPlayer.ownedAirportIds, ...recipientPlayer.ownedUtilityIds] : [];

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
            <button disabled={!validation.ok} onClick={handlePropose}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-indigo-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
              Send Offer
            </button>
            <button onClick={() => { setOpen(false); resetForm(); }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 active:scale-[0.97]">
              Cancel
            </button>
          </div>
        </>
      }
    >
      {/* Recipient selector */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50 px-4 py-2">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-400 shrink-0">Trade with</span>
        <select
          className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800"
          value={effectiveRecipientId}
          onChange={(e) => { setRecipientId(e.target.value); setRecipientProps([]); setRecipientCash(0); setRecipientGOJF(0); }}
        >
          {activePlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <TwoSideLayout
        left={initiatorPlayer ? (
          <TradeSidePanel
            player={initiatorPlayer} offer={offerFromInitiator} cashReceived={recipientCash}
            ownedIndices={initiatorOwnedIndices} label="gives" editable={true}
            ownerships={state.ownerships}
            onCashChange={setInitiatorCash}
            onToggleProp={(idx) => toggleProp(idx, initiatorProps, setInitiatorProps)}
            onGOJFChange={setInitiatorGOJF}
          />
        ) : <div className="p-3 text-xs text-slate-400">No player</div>}
        right={recipientPlayer ? (
          <TradeSidePanel
            player={recipientPlayer} offer={offerFromRecipient} cashReceived={initiatorCash}
            ownedIndices={recipientOwnedIndices} label="gives" editable={true}
            ownerships={state.ownerships}
            onCashChange={setRecipientCash}
            onToggleProp={(idx) => toggleProp(idx, recipientProps, setRecipientProps)}
            onGOJFChange={setRecipientGOJF}
          />
        ) : <div className="p-3 text-xs text-slate-400">No recipient</div>}
      />
    </TradeModalShell>
  );
}

// ── Multiplayer: live draft modal ─────────────────────────────────────────────

function LiveDraftModal({
  state, myPlayerId, draft, onDraftUpdate, onDraftCancel, onDraftSubmit,
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

  const proposerOwnedIndices = proposer ? [...proposer.ownedCityIds, ...proposer.ownedAirportIds, ...proposer.ownedUtilityIds] : [];
  const recipientOwnedIndices = recipient ? [...recipient.ownedCityIds, ...recipient.ownedAirportIds, ...recipient.ownedUtilityIds] : [];

  const validation = validateTradeDraft(state, draft.proposerId, draft.recipientId, draft.offerFromProposer, draft.offerFromRecipient);

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
      statusBadge={{ text: getTradeStatusBadgeText({ hasDraft: true, hasPendingTrade: false, isProposer }), tone: "live" }}
      title={`${proposer?.name ?? "Proposer"} ↔ ${recipient?.name ?? "Recipient"}`}
      subtitle={isProposer ? "Your edits update for everyone in real time" : "Watching the proposer build this offer"}
      onClose={isProposer ? onDraftCancel : undefined}
      footer={
        isProposer ? (
          <>
            {!validation.ok && <p className="mb-2 text-xs font-semibold text-red-600">{validation.reason}</p>}
            <div className="flex gap-2">
              <button disabled={!validation.ok} onClick={onDraftSubmit}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-indigo-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
                Send Offer
              </button>
              <button onClick={onDraftCancel}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 active:scale-[0.97]">
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
      {isProposer && (
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50 px-4 py-2">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400 shrink-0">Trade with</span>
          <select
            className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800"
            value={draft.recipientId}
            onChange={(e) => onDraftUpdate({ recipientId: e.target.value, offerFromRecipient: { ...EMPTY_OFFER } })}
          >
            {otherCandidates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <TwoSideLayout
        left={proposer ? (
          <TradeSidePanel
            player={proposer} offer={draft.offerFromProposer} cashReceived={draft.offerFromRecipient.cash}
            ownedIndices={proposerOwnedIndices} label="gives" editable={isProposer}
            ownerships={state.ownerships}
            onCashChange={(v) => onDraftUpdate({ offerFromProposer: { ...draft.offerFromProposer, cash: v } })}
            onToggleProp={(idx) => toggleProp(idx, "offerFromProposer")}
            onGOJFChange={(v) => onDraftUpdate({ offerFromProposer: { ...draft.offerFromProposer, getOutOfJailFreeCards: v } })}
          />
        ) : null}
        right={recipient ? (
          <TradeSidePanel
            player={recipient} offer={draft.offerFromRecipient} cashReceived={draft.offerFromProposer.cash}
            ownedIndices={recipientOwnedIndices} label="gives" editable={isProposer}
            ownerships={state.ownerships}
            onCashChange={(v) => onDraftUpdate({ offerFromRecipient: { ...draft.offerFromRecipient, cash: v } })}
            onToggleProp={(idx) => toggleProp(idx, "offerFromRecipient")}
            onGOJFChange={(v) => onDraftUpdate({ offerFromRecipient: { ...draft.offerFromRecipient, getOutOfJailFreeCards: v } })}
          />
        ) : null}
      />
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

  function OfferSide({ player, items, value, label }: { player: Player | undefined; items: string[]; value: number; label: string }) {
    return (
      <div className="flex-1 min-w-0 p-3 space-y-2">
        <div className="flex items-center gap-2">
          {player ? <TokenIcon token={player.token} color={player.color} size={20} label={player.tokenLabel} badge /> : null}
          <div>
            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="text-sm font-black text-slate-800">{player?.name}</p>
          </div>
        </div>
        {items.length > 0 ? (
          <ul className="space-y-1">
            {items.map((item, j) => (
              <li key={j} className="flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                <span className="text-slate-300">•</span>{item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-slate-400 italic">Nothing</p>
        )}
        <div className="text-[10px] text-slate-400">
          Listed value <span className="font-black text-slate-600">${value.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  return (
    <TradeModalShell
      statusLabel="Trade Negotiation"
      statusBadge={{
        text: getTradeStatusBadgeText({ hasDraft: false, hasPendingTrade: true, isProposer: isInitiator, recipientName: recipient?.name }),
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
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.97]"
                  onClick={() => dispatch({ type: "ACCEPT_TRADE", actorPlayerId: trade.recipientPlayerId })}>
                  Accept Trade
                </button>
                <button className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-600 active:scale-[0.97]"
                  onClick={() => dispatch({ type: "DECLINE_TRADE", actorPlayerId: trade.recipientPlayerId })}>
                  Decline
                </button>
              </>
            )}
            {isInitiator && (
              <>
                {!isRecipient && <p className="self-center text-xs text-slate-500 italic">Waiting for {recipient?.name} to respond…</p>}
                <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 active:scale-[0.97]"
                  onClick={() => dispatch({ type: "CANCEL_TRADE", actorPlayerId: trade.initiatorPlayerId })}>
                  Cancel Offer
                </button>
              </>
            )}
          </div>
        )
      }
    >
      <div className="flex divide-x divide-slate-100">
        <OfferSide player={initiator} items={initiatorItems} value={initiatorValue} label="Gives" />
        <OfferSide player={recipient} items={recipientItems} value={recipientValue} label="Receives" />
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
    return <>{banner}<PendingTradeView state={state} dispatch={dispatch} myPlayerId={myPlayerId} /></>;
  }

  const isMultiplayerDraftMode = onDraftStart !== undefined;

  if (isMultiplayerDraftMode) {
    if (tradeDraft) {
      return (
        <>{banner}
          <LiveDraftModal
            state={state} myPlayerId={myPlayerId} draft={tradeDraft}
            onDraftUpdate={onDraftUpdate ?? (() => {})}
            onDraftCancel={onDraftCancel ?? (() => {})}
            onDraftSubmit={onDraftSubmit ?? (() => {})}
          />
        </>
      );
    }

    const currentPlayerId = state.players[state.currentPlayerIndex]?.id;
    const authorizedProposerId = state.phase === "bankruptcyPending" && state.bankruptcy ? state.bankruptcy.debtorPlayerId : currentPlayerId;
    const timingGate = canOpenTradeNow(state, myPlayerId ?? authorizedProposerId ?? "");
    const canPropose = myPlayerId === authorizedProposerId && timingGate.ok;
    const candidates = state.players.filter((p) => !p.isBankrupt && p.id !== myPlayerId);

    return (
      <div>
        {banner}
        <button
          disabled={!canPropose || candidates.length === 0}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => { if (canPropose && candidates[0]) onDraftStart(candidates[0].id); }}
          title={canPropose ? undefined : !timingGate.ok ? timingGate.reason : "Only the current player can propose a trade"}
        >
          <span className="flex items-center gap-2"><span className="text-base">🤝</span>Propose Trade</span>
        </button>
        {!timingGate.ok && <p className="mt-1 px-1 text-[11px] font-semibold text-amber-700">{timingGate.reason}</p>}
      </div>
    );
  }

  return <>{banner}<LocalTradeForm {...props} /></>;
}
