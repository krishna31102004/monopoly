"use client";

import { useEffect, useRef } from "react";
import { getOwnership, getPropertyOwner } from "@/lib/game/ownership";
import {
  canBuyHouse,
  canSellHouse,
  canBuyHotel,
  canSellHotel,
  canMortgageProperty,
  canUnmortgageProperty,
} from "@/lib/game/propertyDevelopment";
import { canMortgageNow } from "@/lib/game/turnTimingRules";
import type { CityColorGroup, OwnableSpace } from "@/types/board";
import type { GameAction, GameState, PropertyOwnership } from "@/types/game";
import type { Player } from "@/types/player";

type PropertyCardModalProps = {
  space: OwnableSpace | null;
  players: Player[];
  ownerships: PropertyOwnership[];
  onClose: () => void;
  currentPlayer?: Player;
  dispatch?: (action: GameAction) => void;
  state?: GameState;
};

const colorLabels: Record<CityColorGroup, string> = {
  brown: "Brown · Mexico",
  "light-blue": "Light Blue · India",
  pink: "Pink · Germany",
  orange: "Orange · UAE",
  red: "Red · Italy",
  yellow: "Yellow · Australia",
  green: "Green · England",
  "dark-blue": "Dark Blue · USA",
};

const colorBarClasses: Record<CityColorGroup, string> = {
  brown: "bg-[#8b5e3c]",
  "light-blue": "bg-[#6ec6ea]",
  pink: "bg-[#d946a8]",
  orange: "bg-[#f97316]",
  red: "bg-[#dc2626]",
  yellow: "bg-[#eab308]",
  green: "bg-[#16a34a]",
  "dark-blue": "bg-[#1d4ed8]",
};

const colorTextClasses: Record<CityColorGroup, string> = {
  brown: "text-white",
  "light-blue": "text-slate-950",
  pink: "text-white",
  orange: "text-white",
  red: "text-white",
  yellow: "text-slate-950",
  green: "text-white",
  "dark-blue": "text-white",
};

export function PropertyCardModal({
  space,
  players,
  ownerships,
  onClose,
  currentPlayer,
  dispatch,
  state,
}: PropertyCardModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!space) return;
    closeButtonRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, space]);

  if (!space) return null;

  const owner = getPropertyOwner(ownerships, players, space.index);
  const ownership = getOwnership(ownerships, space.index);
  const isMortgaged = ownership?.isMortgaged ?? false;

  // Property management: city-only actions (houses/hotels)
  const isCityOwner =
    currentPlayer != null && owner?.id === currentPlayer.id && space.kind === "city";
  // Mortgage/unmortgage applies to all ownable space kinds
  const isAnyPropOwner =
    currentPlayer != null &&
    owner?.id === currentPlayer.id &&
    (space.kind === "city" || space.kind === "airport" || space.kind === "utility");
  const stateForChecks = {
    ownerships,
    bankHouses: state?.bankHouses ?? 32,
    bankHotels: state?.bankHotels ?? 12,
  };
  const timingGate = state && currentPlayer ? canMortgageNow(state, currentPlayer.id) : null;
  const timingBlocked = timingGate !== null && !timingGate.ok;
  const timingReason = timingGate && !timingGate.ok ? timingGate.reason : undefined;

  function withTiming<T extends { ok: boolean; reason?: string }>(check: T | null): T | null {
    if (!check) return check;
    if (timingBlocked) return { ...check, ok: false, reason: timingReason } as T;
    return check;
  }

  const buyHouseCheck = withTiming(
    isCityOwner && currentPlayer && dispatch
      ? canBuyHouse(stateForChecks, space.index, currentPlayer)
      : null,
  );
  const sellHouseCheck = withTiming(
    isCityOwner && currentPlayer && dispatch
      ? canSellHouse(stateForChecks, space.index, currentPlayer)
      : null,
  );
  const buyHotelCheck = withTiming(
    isCityOwner && currentPlayer && dispatch
      ? canBuyHotel(stateForChecks, space.index, currentPlayer)
      : null,
  );
  const sellHotelCheck = withTiming(
    isCityOwner && currentPlayer && dispatch
      ? canSellHotel(stateForChecks, space.index, currentPlayer)
      : null,
  );
  const mortgageCheck = withTiming(
    isAnyPropOwner && currentPlayer && dispatch
      ? canMortgageProperty(stateForChecks, space.index, currentPlayer)
      : null,
  );
  const unmortgageCheck = withTiming(
    isAnyPropOwner && currentPlayer && dispatch
      ? canUnmortgageProperty(stateForChecks, space.index, currentPlayer)
      : null,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-[2px] sm:items-center"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-card-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_32px_100px_rgba(15,23,42,0.3)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* City color header */}
        {space.kind === "city" ? (
          <div className={`relative px-5 pt-5 pb-4 ${colorBarClasses[space.colorGroup]}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] opacity-80 ${colorTextClasses[space.colorGroup]}`}>
                  {colorLabels[space.colorGroup]}
                </p>
                <h2
                  id="property-card-title"
                  className={`mt-0.5 text-2xl font-black leading-tight ${colorTextClasses[space.colorGroup]}`}
                >
                  {space.name}
                </h2>
                <p className={`mt-1 text-sm font-bold opacity-90 ${colorTextClasses[space.colorGroup]}`}>
                  {space.country}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-bold transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-white/50 ${colorTextClasses[space.colorGroup]} border-current opacity-70`}
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className={`text-3xl font-black ${colorTextClasses[space.colorGroup]}`}>
                ${space.price}
              </span>
              {isMortgaged ? (
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                  Mortgaged
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 pt-5 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {space.kind === "airport" ? "Airport" : "Utility"}
              </p>
              <h2 id="property-card-title" className="mt-0.5 text-2xl font-black text-slate-950">
                {space.name}
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-950"
            >
              ✕
            </button>
          </div>
        )}

        <div className="p-5">
          {/* Owner banner */}
          <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 ${owner ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-200"}`}>
            <span className="text-sm">
              {owner ? "🏠" : "🏳️"}
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Owner</p>
              <p className={`text-sm font-black ${owner ? "text-emerald-800" : "text-slate-500"}`}>
                {owner ? owner.name : "Unowned"}
                {isMortgaged ? " (Mortgaged)" : ""}
              </p>
            </div>
          </div>

          {timingBlocked && (isCityOwner || isAnyPropOwner) ? (
            <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800">
              {timingReason}
            </div>
          ) : null}

          {space.kind === "city" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <InfoItem label="House cost" value={`$${space.houseCost}`} />
                <InfoItem label="Mortgage" value={`$${space.mortgageValue}`} />
              </div>

              {/* Current status */}
              {ownership ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-black text-slate-600">
                    {ownership.hasHotel
                      ? "Hotel"
                      : ownership.houses > 0
                        ? `${ownership.houses} house${ownership.houses === 1 ? "" : "s"}`
                        : "No improvements"}
                  </span>
                  {ownership.isMortgaged ? (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-black text-amber-700">
                      Mortgaged
                    </span>
                  ) : null}
                </div>
              ) : null}

              {/* Management buttons (only if current player owns this property) */}
              {isCityOwner && dispatch ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Manage Property
                    </h3>
                    {state && (
                      <span className="text-[10px] text-slate-400">
                        Bank: {state.bankHouses} houses · {state.bankHotels} hotels
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ManageButton
                      label="Buy House"
                      disabled={!buyHouseCheck?.ok}
                      title={buyHouseCheck?.ok ? undefined : (!buyHouseCheck ? undefined : buyHouseCheck.reason)}
                      onClick={() => dispatch({ type: "BUY_HOUSE", spaceIndex: space.index })}
                    />
                    <ManageButton
                      label="Sell House"
                      disabled={!sellHouseCheck?.ok}
                      title={sellHouseCheck?.ok ? undefined : (!sellHouseCheck ? undefined : sellHouseCheck.reason)}
                      onClick={() => dispatch({ type: "SELL_HOUSE", spaceIndex: space.index })}
                    />
                    <ManageButton
                      label="Buy Hotel"
                      disabled={!buyHotelCheck?.ok}
                      title={buyHotelCheck?.ok ? undefined : (!buyHotelCheck ? undefined : buyHotelCheck.reason)}
                      onClick={() => dispatch({ type: "BUY_HOTEL", spaceIndex: space.index })}
                    />
                    <ManageButton
                      label="Sell Hotel"
                      disabled={!sellHotelCheck?.ok}
                      title={sellHotelCheck?.ok ? undefined : (!sellHotelCheck ? undefined : sellHotelCheck.reason)}
                      onClick={() => dispatch({ type: "SELL_HOTEL", spaceIndex: space.index })}
                    />
                    <ManageButton
                      label="Mortgage"
                      disabled={!mortgageCheck?.ok}
                      title={mortgageCheck?.ok ? `Get $${space.mortgageValue}` : (!mortgageCheck ? undefined : mortgageCheck.reason)}
                      onClick={() => dispatch({ type: "MORTGAGE_PROPERTY", spaceIndex: space.index })}
                    />
                    <ManageButton
                      label={`Unmortgage ($${space.mortgageValue + Math.ceil(space.mortgageValue / 10)})`}
                      disabled={!unmortgageCheck?.ok}
                      title={unmortgageCheck?.ok ? undefined : (!unmortgageCheck ? undefined : unmortgageCheck.reason)}
                      onClick={() => dispatch({ type: "UNMORTGAGE_PROPERTY", spaceIndex: space.index })}
                    />
                  </div>
                </div>
              ) : null}

              <h3 className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Rent Table
              </h3>
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                {[
                  ["Base rent", space.rent[0]],
                  ["Full color group", space.rent[0] ? space.rent[0] * 2 : "—"],
                  ["With 1 house", space.rent[1]],
                  ["With 2 houses", space.rent[2]],
                  ["With 3 houses", space.rent[3]],
                  ["With 4 houses", space.rent[4]],
                  ["With hotel", space.rent[5]],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-b-0"
                  >
                    <span className="text-sm font-semibold text-slate-600">{label}</span>
                    <span className="text-sm font-black text-slate-950">${value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {space.kind === "airport" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <InfoItem label="Price" value={`$${space.price}`} />
                <InfoItem label="Mortgage" value={`$${space.mortgageValue}`} />
              </div>

              {ownership?.isMortgaged ? (
                <div className="mt-3">
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-black text-amber-700">
                    Mortgaged
                  </span>
                </div>
              ) : null}

              <h3 className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Rent by Airports Owned
              </h3>
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                {space.rentByOwnedCount.map((rent, index) => (
                  <div
                    key={rent}
                    className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-b-0"
                  >
                    <span className="text-sm font-semibold text-slate-600">
                      {index + 1} airport{index === 0 ? "" : "s"} owned
                    </span>
                    <span className="text-sm font-black text-slate-950">${rent}</span>
                  </div>
                ))}
              </div>

              {isAnyPropOwner && dispatch ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Manage Property
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <ManageButton
                      label="Mortgage"
                      disabled={!mortgageCheck?.ok}
                      title={mortgageCheck?.ok ? `Get $${space.mortgageValue}` : (mortgageCheck?.reason ?? undefined)}
                      onClick={() => dispatch({ type: "MORTGAGE_PROPERTY", spaceIndex: space.index })}
                    />
                    <ManageButton
                      label={`Unmortgage ($${space.mortgageValue + Math.ceil(space.mortgageValue / 10)})`}
                      disabled={!unmortgageCheck?.ok}
                      title={unmortgageCheck?.ok ? undefined : (unmortgageCheck?.reason ?? undefined)}
                      onClick={() => dispatch({ type: "UNMORTGAGE_PROPERTY", spaceIndex: space.index })}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {space.kind === "utility" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <InfoItem label="Price" value={`$${space.price}`} />
                <InfoItem label="Mortgage" value={`$${space.mortgageValue}`} />
              </div>

              {ownership?.isMortgaged ? (
                <div className="mt-3">
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-black text-amber-700">
                    Mortgaged
                  </span>
                </div>
              ) : null}

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Rent Rule
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">{space.rentRule}</p>
              </div>

              {isAnyPropOwner && dispatch ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Manage Property
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <ManageButton
                      label="Mortgage"
                      disabled={!mortgageCheck?.ok}
                      title={mortgageCheck?.ok ? `Get $${space.mortgageValue}` : (mortgageCheck?.reason ?? undefined)}
                      onClick={() => dispatch({ type: "MORTGAGE_PROPERTY", spaceIndex: space.index })}
                    />
                    <ManageButton
                      label={`Unmortgage ($${space.mortgageValue + Math.ceil(space.mortgageValue / 10)})`}
                      disabled={!unmortgageCheck?.ok}
                      title={unmortgageCheck?.ok ? undefined : (unmortgageCheck?.reason ?? undefined)}
                      onClick={() => dispatch({ type: "UNMORTGAGE_PROPERTY", spaceIndex: space.index })}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-black text-slate-950">{value}</dd>
    </div>
  );
}

function ManageButton({
  label,
  disabled,
  title,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}
