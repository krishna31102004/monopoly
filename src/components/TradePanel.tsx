"use client";

import { useEffect, useRef, useState } from "react";
import { boardSpaces } from "@/data/board";
import { canOpenTradeNow } from "@/lib/game/turnTimingRules";
import {
  validateTradeDraft,
  getTradeModalRole,
  getTradeStatusBadgeText,
  classifyTradeResultFromLogMessage,
  type TradeResultKind,
} from "@/lib/game/tradeHelpers";
import { TokenIcon } from "@/components/board/TokenIcon";
import type { GameAction, GameState, TradeOffer } from "@/types/game";
import type { TradeDraftState, TradeDraftUpdatePayload } from "@/types/multiplayer";
import type { Player } from "@/types/player";

type Props = {
  state: GameState;
  dispatch: (action: GameAction) => void;
  myPlayerId?: string;
  /** Multiplayer-only: the live, server-synced trade draft (null in local mode). */
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
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-xs font-semibold transition-all duration-100 ${
        selected
          ? "border-transparent text-white shadow-sm scale-[1.02]"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm"
      } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
      style={selected ? { backgroundColor: color } : undefined}
      title={space.name}
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: selected ? "rgba(255,255,255,0.6)" : color }}
      />
      <span className="truncate max-w-[90px]">{space.name}</span>
    </button>
  );
}

// ── Player column header ──────────────────────────────────────────────────────

function PlayerHeader({
  player,
  label,
  side,
  locked,
}: {
  player: Player;
  label: string;
  side: "left" | "right";
  locked?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 ${side === "left" ? "flex-row" : "flex-row-reverse text-right"}`}
      style={{ backgroundColor: player.color + "16", borderBottom: `2px solid ${player.color}` }}
    >
      <TokenIcon token={player.token} color={player.color} size={28} label={player.tokenLabel} badge />
      <div className="min-w-0 flex-1">
        <p
          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide"
          style={{ color: player.color, justifyContent: side === "right" ? "flex-end" : "flex-start" }}
        >
          {side === "right" && locked ? <span title="Locked — recipient cannot edit">🔒</span> : null}
          {label}
          {side === "left" && locked ? <span title="Locked — only the proposer edits this side">🔒</span> : null}
        </p>
        <p className="truncate text-sm font-black text-slate-950">{player.name}</p>
        <p className="text-[10px] font-semibold text-slate-500">${player.cash.toLocaleString()} cash</p>
      </div>
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

/** Brief, dismiss-on-timeout banner shown to everyone right after a trade resolves. */
function TradeResultBanner({ kind, onDismiss }: { kind: TradeResultKind; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div
      className={`mb-2 rounded-xl border px-3 py-2 text-xs font-bold shadow-sm ${RESULT_BANNER_STYLES[kind]}`}
      role="status"
    >
      {RESULT_BANNER_TEXT[kind]}
    </div>
  );
}

function descOffer(offer: TradeOffer) {
  const parts: string[] = [];
  if (offer.cash > 0) parts.push(`$${offer.cash.toLocaleString()}`);
  if (offer.propertySpaceIndices.length > 0) {
    parts.push(...offer.propertySpaceIndices.map((i) => boardSpaces[i]?.name ?? `#${i}`));
  }
  if (offer.getOutOfJailFreeCards > 0) parts.push(`${offer.getOutOfJailFreeCards}× GOJF`);
  return parts;
}

// ── Modal shell (matches AuctionPanel's premium modal design) ──────────────────

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
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-indigo-300 bg-white shadow-[0_32px_100px_rgba(15,23,42,0.35)] sm:rounded-2xl"
      >
        <div className="border-b border-indigo-200 bg-indigo-100 px-5 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700">
              {statusLabel}
            </p>
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
                  className="rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
          <h2 id="trade-title" className="mt-0.5 text-xl font-black text-slate-950">
            {title}
          </h2>
          {subtitle ? <p className="text-xs font-semibold text-indigo-700">{subtitle}</p> : null}
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer ? <div className="shrink-0 border-t border-slate-100 px-5 py-3.5">{footer}</div> : null}
      </section>
    </div>
  );
}

// ── Local-mode: classic inline propose button + form (no live sync needed) ────

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
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm transition-all duration-100 hover:bg-indigo-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              Send Offer
            </button>
            <button
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-all duration-100 hover:bg-slate-50 active:scale-[0.97]"
              onClick={() => { setOpen(false); resetForm(); }}
            >
              Cancel
            </button>
          </div>
        </>
      }
    >
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

      <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="flex flex-col">
          {initiatorPlayer ? <PlayerHeader player={initiatorPlayer} label={`${initiatorPlayer.name} gives`} side="left" /> : null}
          <div className="flex-1 p-3 space-y-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Cash</label>
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
            {initiatorOwnedIndices.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Properties</label>
                <div className="flex flex-wrap gap-1.5">
                  {initiatorOwnedIndices.map((idx) => (
                    <PropertyChip key={idx} spaceIndex={idx} selected={initiatorProps.includes(idx)} onToggle={() => toggleProp(idx, initiatorProps, setInitiatorProps)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          {recipientPlayer ? <PlayerHeader player={recipientPlayer} label={`${recipientPlayer.name} gives`} side="right" /> : null}
          <div className="flex-1 p-3 space-y-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Cash</label>
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
            {recipientOwnedIndices.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Properties</label>
                <div className="flex flex-wrap gap-1.5">
                  {recipientOwnedIndices.map((idx) => (
                    <PropertyChip key={idx} spaceIndex={idx} selected={recipientProps.includes(idx)} onToggle={() => toggleProp(idx, recipientProps, setRecipientProps)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TradeModalShell>
  );
}

// ── Multiplayer: live draft modal (synced via socket) ───────────────────────────

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
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm transition-all duration-100 hover:bg-indigo-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                Send Offer
              </button>
              <button
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-all duration-100 hover:bg-slate-50 active:scale-[0.97]"
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
      {isProposer ? (
        <div className="border-b border-slate-100 px-4 py-2.5 flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 shrink-0">Trade with</span>
          <select
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-semibold text-slate-800"
            value={draft.recipientId}
            onChange={(e) =>
              onDraftUpdate({
                recipientId: e.target.value,
                offerFromRecipient: { ...EMPTY_OFFER },
              })
            }
          >
            {otherCandidates.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="flex flex-col">
          {proposer ? <PlayerHeader player={proposer} label={`${proposer.name} gives`} side="left" /> : null}
          <div className="flex-1 p-3 space-y-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Cash</label>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-400">$</span>
                <input
                  type="number" min={0} max={proposer?.cash ?? 0}
                  disabled={!isProposer}
                  value={draft.offerFromProposer.cash}
                  onChange={(e) =>
                    onDraftUpdate({ offerFromProposer: { ...draft.offerFromProposer, cash: Math.max(0, parseInt(e.target.value) || 0) } })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-800 disabled:opacity-60"
                />
              </div>
            </div>
            {(proposer?.getOutOfJailFreeCards ?? 0) > 0 && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  Get Out of Jail Free ({proposer?.getOutOfJailFreeCards})
                </label>
                <input
                  type="number" min={0} max={proposer?.getOutOfJailFreeCards ?? 0}
                  disabled={!isProposer}
                  value={draft.offerFromProposer.getOutOfJailFreeCards}
                  onChange={(e) =>
                    onDraftUpdate({ offerFromProposer: { ...draft.offerFromProposer, getOutOfJailFreeCards: Math.max(0, parseInt(e.target.value) || 0) } })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-800 disabled:opacity-60"
                />
              </div>
            )}
            {proposerOwnedIndices.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Properties</label>
                <div className="flex flex-wrap gap-1.5">
                  {proposerOwnedIndices.map((idx) => (
                    <PropertyChip
                      key={idx}
                      spaceIndex={idx}
                      selected={draft.offerFromProposer.propertySpaceIndices.includes(idx)}
                      onToggle={() => toggleProp(idx, "offerFromProposer")}
                      disabled={!isProposer}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          {recipient ? <PlayerHeader player={recipient} label={`${recipient.name} gives`} side="right" locked /> : null}
          <div className="flex-1 p-3 space-y-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Cash</label>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-400">$</span>
                <input
                  type="number" min={0} max={recipient?.cash ?? 0}
                  disabled={!isProposer}
                  value={draft.offerFromRecipient.cash}
                  onChange={(e) =>
                    onDraftUpdate({ offerFromRecipient: { ...draft.offerFromRecipient, cash: Math.max(0, parseInt(e.target.value) || 0) } })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-800 disabled:opacity-60"
                />
              </div>
            </div>
            {(recipient?.getOutOfJailFreeCards ?? 0) > 0 && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  Get Out of Jail Free ({recipient?.getOutOfJailFreeCards})
                </label>
                <input
                  type="number" min={0} max={recipient?.getOutOfJailFreeCards ?? 0}
                  disabled={!isProposer}
                  value={draft.offerFromRecipient.getOutOfJailFreeCards}
                  onChange={(e) =>
                    onDraftUpdate({ offerFromRecipient: { ...draft.offerFromRecipient, getOutOfJailFreeCards: Math.max(0, parseInt(e.target.value) || 0) } })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-800 disabled:opacity-60"
                />
              </div>
            )}
            {recipientOwnedIndices.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Properties</label>
                <div className="flex flex-wrap gap-1.5">
                  {recipientOwnedIndices.map((idx) => (
                    <PropertyChip
                      key={idx}
                      spaceIndex={idx}
                      selected={draft.offerFromRecipient.propertySpaceIndices.includes(idx)}
                      onToggle={() => toggleProp(idx, "offerFromRecipient")}
                      disabled={!isProposer}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TradeModalShell>
  );
}

// ── Pending (already-proposed) trade view — shown to everyone ───────────────────

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
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all duration-100 hover:bg-emerald-700 active:scale-[0.97]"
                  onClick={() => dispatch({ type: "ACCEPT_TRADE", actorPlayerId: trade.recipientPlayerId })}
                >
                  Accept Trade
                </button>
                <button
                  className="rounded-lg bg-red-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all duration-100 hover:bg-red-600 active:scale-[0.97]"
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
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-all duration-100 hover:bg-slate-50 active:scale-[0.97]"
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
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        {[
          { player: initiator, items: initiatorItems, label: "Gives" },
          { player: recipient, items: recipientItems, label: "Receives" },
        ].map(({ player, items, label }, i) => (
          <div key={i} className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              {player ? <TokenIcon token={player.token} color={player.color} size={20} label={player.tokenLabel} badge /> : null}
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
    </TradeModalShell>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function TradePanel(props: Props) {
  const { state, dispatch, myPlayerId, tradeDraft, onDraftStart, onDraftUpdate, onDraftCancel, onDraftSubmit } = props;

  // Detect a trade/draft that just resolved (was open, is now gone) so everyone
  // in the room — including spectators — sees a brief accepted/declined/cancelled
  // banner instead of the modal just silently vanishing.
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

  // Already-proposed pending trade always takes priority — visible to everyone.
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
