"use client";

import { useEffect, useRef, useState } from "react";
import { canOpenTradeNow } from "@/lib/game/turnTimingRules";
import { calculateGuaranteedDebtCapacity, calculateProjectedTradeState, getTradingMode } from "@/lib/game/trade";
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
import { UiIcon } from "@/components/ui/UiIcon";
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

// ── Stamp config ──────────────────────────────────────────────────────────────

const STAMP_CONFIGS: Record<TradeResultKind, { label: string; sub: string; icon: string; bg: string; border: string; text: string }> = {
  accepted: {
    label: "DEAL ACCEPTED",
    sub: "Assets have been exchanged.",
    icon: "✓",
    bg: "bg-emerald-950",
    border: "border-emerald-500",
    text: "text-emerald-400",
  },
  declined: {
    label: "DEAL DECLINED",
    sub: "The recipient declined the offer.",
    icon: "×",
    bg: "bg-red-950",
    border: "border-red-500",
    text: "text-red-400",
  },
  cancelled: {
    label: "OFFER CANCELLED",
    sub: "The proposer cancelled the offer.",
    icon: "—",
    bg: "bg-slate-900",
    border: "border-slate-600",
    text: "text-slate-400",
  },
};

// ── Result stamp modal — auto-dismisses after ~1.5 s ─────────────────────────

function TradeResultStamp({ kind, onDismiss }: { kind: TradeResultKind; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 1600);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const cfg = STAMP_CONFIGS[kind];
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-[2px]"
      role="status"
      aria-live="assertive"
    >
      <div
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 ${cfg.border} ${cfg.bg} px-12 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.6)]`}
      >
        <span className="text-4xl">{cfg.icon}</span>
        <p className={`text-xl font-black tracking-[0.15em] uppercase ${cfg.text}`}>{cfg.label}</p>
        <p className="text-sm text-slate-400">{cfg.sub}</p>
      </div>
    </div>
  );
}

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
      className={`relative flex min-h-11 w-full items-center gap-0 overflow-hidden rounded-md border text-left text-xs font-semibold transition-all duration-100 xl:min-h-0 xl:w-auto ${
        selected
          ? "border-transparent shadow-sm ring-1 ring-white/50"
          : "border-slate-600 bg-[#182235] text-slate-100 hover:border-[#C6A15B]/70 hover:bg-[#202C42]"
      } ${disabled ? "cursor-default opacity-70" : "cursor-pointer"}`}
      style={selected ? { backgroundColor: card.colorHex ?? "#94a3b8" } : undefined}
      title={`${card.name}${card.isMortgaged ? " — mortgaged" : ""}`}
    >
      <span
        className="inline-block w-1.5 shrink-0 self-stretch"
        style={{ backgroundColor: selected ? "rgba(255,255,255,0.4)" : (card.colorHex ?? "#94a3b8") }}
      />
      <span className={`flex min-w-0 flex-1 items-center gap-2 px-2 py-1 ${selected ? "text-white" : "text-slate-100"}`}>
        <span className="min-w-0 flex-1 truncate leading-tight xl:max-w-[72px]">{card.name}</span>
        {card.isMortgaged && (
          <span className={`shrink-0 text-[9px] font-black ${selected ? "text-white/70" : "text-amber-300"}`}>Mortgaged</span>
        )}
        {card.houses > 0 && card.houses < 5 && (
          <span className={`shrink-0 text-[9px] ${selected ? "text-white/80" : "text-emerald-300"}`}>{card.houses} house{card.houses === 1 ? "" : "s"}</span>
        )}
        {card.houses >= 5 && (
          <span className={`shrink-0 text-[9px] ${selected ? "text-white/80" : "text-rose-300"}`}>Hotel</span>
        )}
      </span>
    </button>
  );
}

// ── Money counter ─────────────────────────────────────────────────────────────

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
      <div
        className={`flex min-h-11 items-center gap-1 rounded-lg border px-2.5 py-0 transition-colors xl:min-h-0 xl:py-1.5 ${
          invalid
          ? "border-rose-400/70 bg-rose-500/10"
            : disabled
            ? "border-slate-700 bg-slate-900/50"
            : "border-slate-600 bg-[#182235] focus-within:border-[#C6A15B]"
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
          className="min-h-11 min-w-0 flex-1 bg-transparent text-sm font-black text-slate-100 outline-none placeholder:font-normal placeholder:text-slate-500 disabled:text-slate-500 xl:min-h-0"
        />
      </div>
      <div className="flex items-center justify-between text-[10px] leading-tight">
        <span className="text-slate-400">Available ${playerCash.toLocaleString()}</span>
        {invalid ? (
          <span className="font-bold text-red-500">Exceeds balance</span>
        ) : (
            <span className="text-slate-400">
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
    <div className="rounded-lg border border-dashed border-slate-600 bg-[#182235] px-2.5 py-2 min-h-[52px]">
      {isEmpty ? (
        <p className="text-[11px] italic text-slate-400">No assets selected · choose holdings below.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 items-center">
          {offer.cash > 0 && (
            <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-black text-emerald-300">
              CASH · ${offer.cash.toLocaleString()}
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

// ── Trade side panel (editable draft mode) ────────────────────────────────────

function TradeSidePanel({
  player,
  offer,
  cashReceived,
  ownedIndices,
  label,
  editable,
  allowCash = editable,
  allowAssets = editable,
  allowGOJF = editable,
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
  allowCash?: boolean;
  allowAssets?: boolean;
  allowGOJF?: boolean;
  ownerships: PropertyOwnership[];
  onCashChange: (v: number) => void;
  onToggleProp: (idx: number) => void;
  onGOJFChange: (v: number) => void;
}) {
  const selectedSet = new Set(offer.propertySpaceIndices);
  const listedValue = getTradeSideListedValue(offer, ownerships);

  return (
      <div className="flex min-w-0 flex-col space-y-3 bg-[#0F172A] p-3">
      {/* Player header */}
      <div className="flex items-center gap-2">
        <TokenIcon token={player.token} color={player.color} size={26} label={player.tokenLabel} badge />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-100">{player.name}</p>
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
          disabled={!allowCash}
          playerCash={player.cash}
          cashReceived={cashReceived}
        />
      </div>

      {/* GOJF */}
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
            disabled={!allowGOJF}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              onGOJFChange(raw === "" ? 0 : Math.max(0, parseInt(raw, 10)));
            }}
            className="min-h-11 w-full rounded-lg border border-slate-600 bg-[#182235] px-2.5 py-1.5 text-sm font-semibold text-slate-100 outline-none focus:border-[#C6A15B] disabled:bg-slate-900 disabled:text-slate-500 xl:min-h-0"
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
          <div className="grid gap-2 xl:flex xl:flex-wrap xl:gap-1.5">
            {ownedIndices.map((idx) => (
              <PropertyChip
                key={idx}
                spaceIndex={idx}
                selected={selectedSet.has(idx)}
                onToggle={() => onToggleProp(idx)}
                disabled={!allowAssets}
                ownerships={ownerships}
              />
            ))}
          </div>
        </div>
      )}

      {/* Listed value */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-700 pt-1 text-[10px] text-slate-400">
        <span>Listed value</span>
        <span className="font-black text-slate-200">${listedValue.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ── Contract-mode side (read-only, shown after Send Offer) ────────────────────

function ContractSide({
  player,
  offer,
  ownerships,
  label,
}: {
  player: Player;
  offer: TradeOffer;
  ownerships: PropertyOwnership[];
  label: string;
}) {
  const listedValue = getTradeSideListedValue(offer, ownerships);
  const isEmpty = offer.cash === 0 && offer.propertySpaceIndices.length === 0 && offer.getOutOfJailFreeCards === 0;

  return (
    <div className="flex min-w-0 flex-col space-y-3 bg-[#0F172A] p-3">
      {/* Player header */}
      <div className="flex items-center gap-2">
        <TokenIcon token={player.token} color={player.color} size={26} label={player.tokenLabel} badge />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-100">{player.name}</p>
          <p className="text-[10px] font-semibold" style={{ color: player.color }}>{label}</p>
        </div>
      </div>

      {/* Offer summary */}
      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Offer</p>
        {isEmpty ? (
          <p className="text-[11px] italic text-slate-400">Nothing</p>
        ) : (
          <div className="space-y-1">
            {offer.cash > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5">
                <span className="text-sm font-black text-emerald-300">${offer.cash.toLocaleString()}</span>
                <span className="text-[10px] text-slate-400">cash</span>
              </div>
            )}
            {offer.propertySpaceIndices.map((idx) => {
              const card = getTradePropertyCardPresentation(idx, ownerships);
              if (!card) return null;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                  style={{ backgroundColor: (card.colorHex ?? "#94a3b8") + "18", borderLeft: `3px solid ${card.colorHex ?? "#94a3b8"}` }}
                >
                  <span className="truncate text-[11px] font-semibold text-slate-100">{card.name}</span>
                  <span className="ml-auto text-[10px] text-slate-400">${card.price}</span>
                </div>
              );
            })}
            {offer.getOutOfJailFreeCards > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-1.5">
            <span className="text-[11px] font-semibold text-slate-100">{offer.getOutOfJailFreeCards}× GOJF card</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Listed value */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-700 pt-1 text-[10px] text-slate-400">
        <span>Listed value</span>
        <span className="font-black text-slate-200">${listedValue.toLocaleString()}</span>
      </div>
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
      ? "border border-[#C6A15B]/60 bg-slate-950/40 text-[#D8BA72]"
      : statusBadge?.tone === "pending"
      ? "border border-slate-400/30 bg-slate-950/35 text-slate-100"
      : "border border-slate-300/20 bg-slate-950/25 text-slate-100";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-[2px] xl:items-center xl:p-3"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-title"
        className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[var(--wc-radius-large)] border border-[#C6A15B]/45 bg-[#0F172A] shadow-[0_24px_80px_rgba(0,0,0,0.58)] xl:max-h-[94vh] xl:rounded-[var(--wc-radius-large)]"
      >
        <div className="shrink-0 border-b border-[#C6A15B]/45 bg-gradient-to-b from-[#312E81] to-[#0F172A] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#D8BA72]">{statusLabel}</p>
              <h2 id="trade-title" className="text-base font-black text-white leading-tight truncate">{title}</h2>
              {subtitle ? <p className="mt-0.5 text-[10px] text-slate-300">{subtitle}</p> : null}
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
                  aria-label="Close trade"
                  className="wc-icon-button rounded-md border border-slate-500/50 bg-slate-950/35 text-[11px] font-bold text-slate-200 hover:bg-slate-800"
                >
                  <UiIcon name="close" size={18} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="wc-sticky-footer shrink-0 border-slate-700 bg-[#182235] px-4 py-3">{footer}</div>
        ) : null}
      </section>
    </div>
  );
}

// ── Two-sided grid layout ─────────────────────────────────────────────────────

function TwoSideLayout({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="relative grid grid-cols-1 divide-y divide-slate-700 xl:grid-cols-2 xl:divide-x xl:divide-y-0">
      <div className="min-w-0">{left}</div>
      <div className="absolute left-1/2 top-4 z-10 hidden -translate-x-1/2 xl:flex">
        <span className="rounded-full border border-[#C6A15B]/55 bg-[#0F172A] px-1.5 py-0.5 text-[11px] font-black text-[#D8BA72] shadow-sm">
          ⇄
        </span>
      </div>
      <div className="min-w-0">{right}</div>
    </div>
  );
}


// ── Local trade form ──────────────────────────────────────────────────────────

function LocalTradeForm({ state, dispatch, myPlayerId }: Props) {
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState<string>("");
  const [initiatorCash, setInitiatorCash] = useState(0);
  const [recipientCash, setRecipientCash] = useState(0);
  const [initiatorProps, setInitiatorProps] = useState<number[]>([]);
  const [recipientProps, setRecipientProps] = useState<number[]>([]);
  const [initiatorGOJF, setInitiatorGOJF] = useState(0);
  const [recipientGOJF, setRecipientGOJF] = useState(0);
  const [debtTradeMode, setDebtTradeMode] = useState<"cash" | "swap">("cash");

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
  const tradingMode = getTradingMode(state);
  const isDebtResolution = tradingMode.type === "debt-resolution";
  const isAssetSwap = isDebtResolution && debtTradeMode === "swap";

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
  const projected = isDebtResolution && effectiveInitiatorId && effectiveRecipientId
    ? calculateProjectedTradeState(state, effectiveInitiatorId, effectiveRecipientId, offerFromInitiator, offerFromRecipient)
    : null;
  const projectedCash = projected?.players.find((player) => player.id === effectiveInitiatorId)?.cash ?? null;
  const capacity = projected && isDebtResolution && effectiveInitiatorId
    ? calculateGuaranteedDebtCapacity(projected, effectiveInitiatorId)
    : null;

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
      statusLabel={isDebtResolution ? "Debt Resolution Trade" : "Trade Negotiation"}
      statusBadge={{ text: getTradeStatusBadgeText({ hasDraft: true, hasPendingTrade: false, isProposer: true }), tone: "live" }}
      title="Build a Deal"
      subtitle={isDebtResolution ? "Liquidate your assets for cash while protecting the outstanding payment." : "Both sides must agree before the trade goes through"}
      onClose={() => { setOpen(false); resetForm(); }}
      footer={
        <>
          {!validation.ok && <p className="mb-2 text-xs font-semibold text-red-600">{validation.reason}</p>}
          <div className="flex gap-2">
            <button disabled={!validation.ok} onClick={handlePropose}
              className="rounded-lg border border-[#8A6A32] bg-[#C6A15B] px-4 py-2 text-sm font-black text-[#0F172A] shadow-sm hover:bg-[#D8BA72] active:scale-[0.97] disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500">
              Send Offer
            </button>
            <button onClick={() => { setOpen(false); resetForm(); }}
              className="rounded-lg border border-slate-600 bg-[#182235] px-4 py-2 text-sm font-bold text-slate-200 hover:bg-[#202C42] active:scale-[0.97]">
              Cancel
            </button>
          </div>
        </>
      }
    >
      <div className="flex items-center gap-2.5 border-b border-slate-700 bg-[#182235] px-4 py-2">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-400 shrink-0">Trade with</span>
        <select
          className="flex-1 rounded-md border border-slate-600 bg-[#202C42] px-2 py-1 text-sm font-semibold text-slate-100 outline-none focus:border-[#C6A15B]"
          value={effectiveRecipientId}
          onChange={(e) => { setRecipientId(e.target.value); setRecipientProps([]); setRecipientCash(0); setRecipientGOJF(0); }}
        >
          {activePlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {isDebtResolution && state.bankruptcy && initiatorPlayer && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
          <span className="font-black">You owe ${state.bankruptcy.amountOwed.toLocaleString()}</span> · Current cash: ${initiatorPlayer.cash.toLocaleString()} · Shortfall: ${(state.bankruptcy.amountOwed - initiatorPlayer.cash).toLocaleString()}
          {capacity && <span className="block mt-1 text-[11px]">After trade: ${projectedCash?.toLocaleString()} cash · legal building sales: ${capacity.legalBuildingSaleProceeds.toLocaleString()} · mortgage capacity: ${capacity.remainingMortgageProceeds.toLocaleString()} · guaranteed funds: ${capacity.totalGuaranteedFunds.toLocaleString()}</span>}
        </div>
      )}
      {isDebtResolution && (
        <div className="flex gap-2 border-b border-slate-700 bg-[#182235] px-4 py-2">
          <button type="button" onClick={() => { setDebtTradeMode("cash"); setRecipientProps([]); setRecipientGOJF(0); }} className={`rounded border px-2 py-1 text-xs font-bold ${!isAssetSwap ? "border-[#C6A15B] bg-[#C6A15B] text-[#0F172A]" : "border-slate-600 bg-[#202C42] text-slate-300"}`}>RAISE CASH</button>
          <button type="button" onClick={() => { setDebtTradeMode("swap"); setInitiatorCash(0); setRecipientCash(0); }} className={`rounded border px-2 py-1 text-xs font-bold ${isAssetSwap ? "border-[#C6A15B] bg-[#C6A15B] text-[#0F172A]" : "border-slate-600 bg-[#202C42] text-slate-300"}`}>SWAP ASSETS</button>
          {isAssetSwap && <span className="self-center text-[11px] text-slate-500">Exchange assets without moving cash.</span>}
        </div>
      )}
      <TwoSideLayout
        left={initiatorPlayer ? (
          <TradeSidePanel player={initiatorPlayer} offer={offerFromInitiator} cashReceived={recipientCash}
            ownedIndices={initiatorOwnedIndices} label="gives" editable={true} ownerships={state.ownerships}
            onCashChange={setInitiatorCash}
            onToggleProp={(idx) => toggleProp(idx, initiatorProps, setInitiatorProps)}
            onGOJFChange={setInitiatorGOJF} allowCash={!isDebtResolution} />
        ) : <div className="p-3 text-xs text-slate-400">No player</div>}
        right={recipientPlayer ? (
          <TradeSidePanel player={recipientPlayer} offer={offerFromRecipient} cashReceived={initiatorCash}
            ownedIndices={recipientOwnedIndices} label="gives" editable={true} ownerships={state.ownerships}
            onCashChange={setRecipientCash}
            onToggleProp={(idx) => toggleProp(idx, recipientProps, setRecipientProps)}
            onGOJFChange={setRecipientGOJF} allowCash={!isDebtResolution} allowAssets={!isDebtResolution || isAssetSwap} allowGOJF={!isDebtResolution || isAssetSwap} />
        ) : <div className="p-3 text-xs text-slate-400">No recipient</div>}
      />
    </TradeModalShell>
  );
}

// ── Live draft modal (multiplayer) ────────────────────────────────────────────

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
  const isSpectator = role === "spectator" || role === "none";
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

  const statusBadgeText = getTradeStatusBadgeText({ hasDraft: true, hasPendingTrade: false, isProposer });

  return (
    <TradeModalShell
      statusLabel="Trade Negotiation"
      statusBadge={{ text: statusBadgeText, tone: "live" }}
      title={`${proposer?.name ?? "Proposer"} ↔ ${recipient?.name ?? "Recipient"}`}
      subtitle={
        isSpectator
          ? `Watching live draft · Only ${proposer?.name ?? "the proposer"} can edit`
          : isProposer
          ? "Your edits update for everyone in real time"
          : `Watching ${proposer?.name ?? "the proposer"} build this offer`
      }
      onClose={isProposer ? onDraftCancel : undefined}
      footer={
        isProposer ? (
          <>
            {!validation.ok && <p className="mb-2 text-xs font-semibold text-red-600">{validation.reason}</p>}
            <div className="flex gap-2">
              <button disabled={!validation.ok} onClick={onDraftSubmit}
              className="rounded-lg border border-[#8A6A32] bg-[#C6A15B] px-4 py-2 text-sm font-black text-[#0F172A] shadow-sm hover:bg-[#D8BA72] active:scale-[0.97] disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500">
                Send Offer
              </button>
              <button onClick={onDraftCancel}
                className="rounded-lg border border-slate-600 bg-[#182235] px-4 py-2 text-sm font-bold text-slate-200 hover:bg-[#202C42] active:scale-[0.97]">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs font-semibold text-slate-500 italic">
            {isSpectator
              ? `Read-only view · Only ${proposer?.name ?? "the proposer"} can edit or send this offer.`
              : `Only ${proposer?.name ?? "the proposer"} can edit or send this offer.`}
          </p>
        )
      }
    >
      {isProposer && (
        <div className="flex items-center gap-2.5 border-b border-slate-700 bg-[#182235] px-4 py-2">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400 shrink-0">Trade with</span>
          <select
            className="flex-1 rounded-md border border-slate-600 bg-[#202C42] px-2 py-1 text-sm font-semibold text-slate-100 outline-none focus:border-[#C6A15B]"
            value={draft.recipientId}
            onChange={(e) => onDraftUpdate({ recipientId: e.target.value, offerFromRecipient: { ...EMPTY_OFFER } })}
          >
            {otherCandidates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      <TwoSideLayout
        left={proposer ? (
          <TradeSidePanel player={proposer} offer={draft.offerFromProposer} cashReceived={draft.offerFromRecipient.cash}
            ownedIndices={proposerOwnedIndices} label="gives" editable={isProposer} ownerships={state.ownerships}
            onCashChange={(v) => onDraftUpdate({ offerFromProposer: { ...draft.offerFromProposer, cash: v } })}
            onToggleProp={(idx) => toggleProp(idx, "offerFromProposer")}
            onGOJFChange={(v) => onDraftUpdate({ offerFromProposer: { ...draft.offerFromProposer, getOutOfJailFreeCards: v } })} />
        ) : null}
        right={recipient ? (
          <TradeSidePanel player={recipient} offer={draft.offerFromRecipient} cashReceived={draft.offerFromProposer.cash}
            ownedIndices={recipientOwnedIndices} label="gives" editable={isProposer} ownerships={state.ownerships}
            onCashChange={(v) => onDraftUpdate({ offerFromRecipient: { ...draft.offerFromRecipient, cash: v } })}
            onToggleProp={(idx) => toggleProp(idx, "offerFromRecipient")}
            onGOJFChange={(v) => onDraftUpdate({ offerFromRecipient: { ...draft.offerFromRecipient, getOutOfJailFreeCards: v } })} />
        ) : null}
      />
    </TradeModalShell>
  );
}

// ── Pending trade / contract mode ─────────────────────────────────────────────

function PendingTradeView({ state, dispatch, myPlayerId }: Props) {
  const { trade } = state;
  if (!trade) return null;

  const initiator = state.players.find((p) => p.id === trade.initiatorPlayerId);
  const recipient = state.players.find((p) => p.id === trade.recipientPlayerId);
  const isInitiator = !myPlayerId || myPlayerId === trade.initiatorPlayerId;
  const isRecipient = myPlayerId === trade.recipientPlayerId;
  const isSpectator = Boolean(myPlayerId) && !isInitiator && !isRecipient;

  const initiatorValue = getTradeSideListedValue(trade.offerFromInitiator, state.ownerships);
  const recipientValue = getTradeSideListedValue(trade.offerFromRecipient, state.ownerships);

  return (
    <TradeModalShell
      statusLabel="Trade Offer"
      statusBadge={{
        text: getTradeStatusBadgeText({ hasDraft: false, hasPendingTrade: true, isProposer: isInitiator, recipientName: recipient?.name }),
        tone: "pending",
      }}
      title={isRecipient && !isInitiator ? `Offer from ${initiator?.name ?? "?"}` : `${initiator?.name ?? "?"} → ${recipient?.name ?? "?"}`}
      subtitle={
        isSpectator
          ? `Watching trade offer · Only ${recipient?.name ?? "the recipient"} can respond`
          : isRecipient && !isInitiator
          ? "Review the offer carefully. Accept or decline."
          : isInitiator && !isRecipient
          ? `Waiting for ${recipient?.name ?? "the recipient"} to respond…`
          : undefined
      }
      footer={
        isSpectator ? (
          <p className="text-xs text-slate-500 italic">
            Spectator view — only {recipient?.name ?? "the recipient"} can accept or decline.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {isRecipient && !isInitiator && (
              <>
                <button
                  className="rounded-lg border border-emerald-500/60 bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-100 shadow-sm hover:bg-emerald-500/25 active:scale-[0.97]"
                  onClick={() => dispatch({ type: "ACCEPT_TRADE", actorPlayerId: trade.recipientPlayerId })}
                >
                  Accept Trade
                </button>
                <button
                  className="rounded-lg border border-rose-500/60 bg-[#182235] px-4 py-2 text-sm font-bold text-rose-300 hover:bg-rose-500/10 active:scale-[0.97]"
                  onClick={() => dispatch({ type: "DECLINE_TRADE", actorPlayerId: trade.recipientPlayerId })}
                >
                  Decline
                </button>
              </>
            )}
            {isInitiator && !isRecipient && (
              <button
                className="rounded-lg border border-slate-600 bg-[#182235] px-4 py-2 text-sm font-bold text-slate-200 hover:bg-[#202C42] active:scale-[0.97]"
                onClick={() => dispatch({ type: "CANCEL_TRADE", actorPlayerId: trade.initiatorPlayerId })}
              >
                Cancel Offer
              </button>
            )}
          </div>
        )
      }
    >
      {/* Contract-mode two-column read-only view */}
      <TwoSideLayout
        left={initiator ? (
          <ContractSide player={initiator} offer={trade.offerFromInitiator} ownerships={state.ownerships} label="gives" />
        ) : null}
        right={recipient ? (
          <ContractSide player={recipient} offer={trade.offerFromRecipient} ownerships={state.ownerships} label="gives" />
        ) : null}
      />
      {/* Value comparison strip */}
      <div className="flex items-center justify-between border-t border-slate-700 bg-[#182235] px-4 py-2 text-[10px] text-slate-400">
        <span>{initiator?.name}: <span className="font-black text-slate-100">${initiatorValue.toLocaleString()}</span></span>
        <span className="text-slate-500">vs</span>
        <span>{recipient?.name}: <span className="font-black text-slate-100">${recipientValue.toLocaleString()}</span></span>
      </div>
    </TradeModalShell>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function TradePanel(props: Props) {
  const { state, dispatch, myPlayerId, tradeDraft, onDraftStart, onDraftUpdate, onDraftCancel, onDraftSubmit } = props;

  // Track when a trade/draft was open and then closed — detect result from newest log entry.
  // Logs are prepended (index 0 = newest), so always use [0].
  const wasOpenRef = useRef(false);
  const lastSeenLogIdRef = useRef<string | undefined>(undefined);
  const [resultStamp, setResultStamp] = useState<TradeResultKind | null>(null);

  const isOpenNow = Boolean(state.trade) || Boolean(tradeDraft);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpenNow;

    if (wasOpen && !isOpenNow) {
      const newest = state.gameLog[0];
      // Only show stamp if this is a new log entry we haven't shown a stamp for
      if (newest && newest.message !== lastSeenLogIdRef.current) {
        const kind = classifyTradeResultFromLogMessage(newest.message);
        if (kind) {
          lastSeenLogIdRef.current = newest.message;
          setResultStamp(kind);
        }
      }
    }
  }, [isOpenNow, state.gameLog]);

  if (resultStamp) {
    return <TradeResultStamp kind={resultStamp} onDismiss={() => setResultStamp(null)} />;
  }

  if (state.phase === "gameOver") return null;

  if (state.trade) {
    return <PendingTradeView state={state} dispatch={dispatch} myPlayerId={myPlayerId} />;
  }

  const isMultiplayerDraftMode = onDraftStart !== undefined;

  if (isMultiplayerDraftMode) {
    if (tradeDraft) {
      return (
        <LiveDraftModal
          state={state} myPlayerId={myPlayerId} draft={tradeDraft}
          onDraftUpdate={onDraftUpdate ?? (() => {})}
          onDraftCancel={onDraftCancel ?? (() => {})}
          onDraftSubmit={onDraftSubmit ?? (() => {})}
        />
      );
    }

    const currentPlayerId = state.players[state.currentPlayerIndex]?.id;
    const authorizedProposerId = state.phase === "bankruptcyPending" && state.bankruptcy ? state.bankruptcy.debtorPlayerId : currentPlayerId;
    const timingGate = canOpenTradeNow(state, myPlayerId ?? authorizedProposerId ?? "");
    const canPropose = myPlayerId === authorizedProposerId && timingGate.ok;
    const candidates = state.players.filter((p) => !p.isBankrupt && p.id !== myPlayerId);

    return (
      <div>
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

  return <LocalTradeForm {...props} />;
}
