import { PlayerToken } from "@/components/board/PlayerToken";
import type {
  BoardSpace as BoardSpaceType,
  CityColorGroup,
  OwnableSpace,
} from "@/types/board";
import type { PropertyOwnership } from "@/types/game";
import type { Player } from "@/types/player";

const colorGroupClasses: Record<CityColorGroup, string> = {
  brown: "bg-[#8b5e3c]",
  "light-blue": "bg-[#6ec6ea]",
  pink: "bg-[#d946a8]",
  orange: "bg-[#f97316]",
  red: "bg-[#dc2626]",
  yellow: "bg-[#eab308]",
  green: "bg-[#16a34a]",
  "dark-blue": "bg-[#1d4ed8]",
};

type BoardSpaceProps = {
  space: BoardSpaceType;
  players: Player[];
  allPlayers?: Player[];
  ownerships?: PropertyOwnership[];
  landingPlayerIds?: Set<string>;
  style: React.CSSProperties;
  onOpenProperty: (space: OwnableSpace) => void;
};

function isOwnable(space: BoardSpaceType): space is OwnableSpace {
  return space.kind === "city" || space.kind === "airport" || space.kind === "utility";
}

function boardDisplayName(space: BoardSpaceType): string {
  if (space.kind === "airport") {
    return space.name
      .replace(" International Airport", "")
      .replace(" Airport", "");
  }
  return space.name;
}

function SpecialMarker({ space }: { space: BoardSpaceType }) {
  switch (space.kind) {
    case "go":
      return (
        <>
          <span className="text-[11px] font-black text-emerald-700 sm:text-sm">GO</span>
          <span className="text-[7px] font-bold text-emerald-600 sm:text-[9px]">COLLECT $200</span>
        </>
      );
    case "jail":
      return (
        <>
          <span className="text-[8px] font-black text-slate-600 sm:text-[10px]">JUST</span>
          <span className="text-[8px] font-black text-slate-600 sm:text-[10px]">VISITING</span>
          <span className="mt-0.5 text-[10px] sm:text-sm">🏛️</span>
        </>
      );
    case "free-parking":
      return (
        <>
          <span className="text-[10px] sm:text-sm">🅿️</span>
          <span className="text-[7px] font-black text-slate-600 sm:text-[9px]">FREE</span>
          <span className="text-[7px] font-black text-slate-600 sm:text-[9px]">PARKING</span>
        </>
      );
    case "go-to-jail":
      return (
        <>
          <span className="text-[10px] sm:text-sm">👮</span>
          <span className="text-[7px] font-black text-red-700 sm:text-[9px]">GO TO</span>
          <span className="text-[7px] font-black text-red-700 sm:text-[9px]">JAIL</span>
        </>
      );
    case "chance":
      return (
        <>
          <span className="text-[14px] font-black text-amber-600 sm:text-xl">?</span>
          <span className="text-[7px] font-bold text-slate-500 sm:text-[9px]">CHANCE</span>
        </>
      );
    case "community-chest":
      return (
        <>
          <span className="text-[10px] sm:text-sm">📦</span>
          <span className="text-[7px] font-bold text-slate-500 sm:text-[9px]">COMM.</span>
          <span className="text-[7px] font-bold text-slate-500 sm:text-[9px]">CHEST</span>
        </>
      );
    case "tax":
      return (
        <>
          <span className="text-[9px] font-black text-red-700 sm:text-xs">TAX</span>
          <span className="text-[8px] font-black text-red-600 sm:text-[10px]">${space.amount}</span>
        </>
      );
    default:
      return null;
  }
}

/** Diagonal stripe overlay indicating a mortgaged property. Sits above color strip, below text content. */
function MortgageOverlay() {
  return (
    <div
      aria-label="Mortgaged"
      role="img"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 4,
        pointerEvents: "none",
        background:
          "repeating-linear-gradient(-45deg, transparent 0px, transparent 5px, rgba(139,0,0,0.14) 5px, rgba(139,0,0,0.14) 6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "inherit",
      }}
    >
      <span
        style={{
          transform: "rotate(-28deg)",
          fontSize: "clamp(4px, 0.8vw, 7px)",
          fontWeight: 900,
          color: "rgba(139,0,0,0.72)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: "rgba(255,255,255,0.82)",
          padding: "1px clamp(2px, 0.4vw, 4px)",
          borderRadius: "2px",
          whiteSpace: "nowrap",
          lineHeight: 1.3,
          boxShadow: "0 0 0 1px rgba(139,0,0,0.18)",
        }}
      >
        MORTGAGED
      </span>
    </div>
  );
}

/** Pill badge absolutely positioned over the color strip — does not affect layout flow. */
function OwnerNameBadge({ owner }: { owner: Player }) {
  const label = owner.name.length > 5 ? owner.name.slice(0, 4) + "…" : owner.name;
  return (
    <div
      title={`Owned by ${owner.name}`}
      style={{
        position: "absolute",
        top: "2px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 8,
        backgroundColor: owner.color,
        borderRadius: "999px",
        padding: "1px clamp(2px, 0.5vw, 4px)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.3)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        maxWidth: "85%",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          fontSize: "clamp(4px, 0.7vw, 7px)",
          fontWeight: 900,
          color: "#fff",
          letterSpacing: "0.04em",
          lineHeight: 1,
          textTransform: "uppercase",
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/** Houses and hotel indicator — bigger, cleaner shapes */
function PropertyBuildings({ ownership }: { ownership: PropertyOwnership }) {
  if (ownership.hasHotel) {
    return (
      <div className="flex justify-center py-px">
        <span
          className="flex items-center justify-center rounded font-black text-white shadow-sm"
          style={{
            backgroundColor: "#c0392b",
            width: "clamp(10px,2.2vw,16px)",
            height: "clamp(7px,1.5vw,11px)",
            fontSize: "clamp(4px,0.8vw,7px)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
          title="Hotel"
        >
          H
        </span>
      </div>
    );
  }
  if (ownership.houses > 0) {
    return (
      <div className="flex justify-center gap-px py-px">
        {Array.from({ length: ownership.houses }).map((_, i) => (
          <span
            key={i}
            className="rounded-sm"
            style={{
              backgroundColor: "#27ae60",
              width: "clamp(5px,1.2vw,8px)",
              height: "clamp(5px,1.2vw,8px)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
            title={`${ownership.houses} house${ownership.houses > 1 ? "s" : ""}`}
          />
        ))}
      </div>
    );
  }
  return null;
}

export function BoardSpace({ space, players, allPlayers = [], ownerships = [], landingPlayerIds, style, onOpenProperty }: BoardSpaceProps) {
  const isCorner = [0, 10, 20, 30].includes(space.index);
  const canOpen = isOwnable(space);

  const ownership = canOpen
    ? ownerships.find((o) => o.spaceIndex === space.index)
    : undefined;
  const owner = ownership?.ownerId
    ? allPlayers.find((p) => p.id === ownership.ownerId)
    : undefined;

  const displayName = boardDisplayName(space);

  const content = (
    <>
      {/* Color strip for cities */}
      {space.kind === "city" ? (
        <span
          className={`block shrink-0 border-b border-[var(--board-border)] ${colorGroupClasses[space.colorGroup]}`}
          style={{ height: isCorner ? "0" : "clamp(11px, 24%, 18px)" }}
        />
      ) : null}

      {space.kind === "airport" ? (
        <span
          className="block shrink-0 border-b border-[var(--board-border)] bg-slate-700"
          style={{ height: "clamp(6px, 18%, 12px)" }}
        />
      ) : null}

      {space.kind === "utility" ? (
        <span
          className="block shrink-0 border-b border-[var(--board-border)] bg-teal-600"
          style={{ height: "clamp(6px, 18%, 12px)" }}
        />
      ) : null}

      {/* Mortgage overlay — diagonal stripes, sits below text/tokens via z-index */}
      {!isCorner && ownership?.isMortgaged ? <MortgageOverlay /> : null}

      {/* Owner pill badge — absolute over color strip, never disrupts layout flow */}
      {!isCorner && owner ? <OwnerNameBadge owner={owner} /> : null}

      {/* z-index:5 ensures all text/icons paint above the mortgage overlay (z-index:4) */}
      <div className="relative z-[5] flex min-h-0 flex-1 flex-col items-center justify-between gap-0.5 p-0.5 sm:p-1">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5">
          {isCorner ? (
            <div className="flex flex-col items-center gap-0.5">
              <SpecialMarker space={space} />
            </div>
          ) : null}

          {!isCorner && (space.kind === "chance" || space.kind === "community-chest" || space.kind === "tax" || space.kind === "go") ? (
            <div className="flex flex-col items-center gap-0.5">
              <SpecialMarker space={space} />
            </div>
          ) : null}

          {!isCorner && space.kind === "airport" ? (
            <span className="text-[8px] font-black text-slate-700 sm:text-[10px]">✈</span>
          ) : null}

          {!isCorner && space.kind === "utility" ? (
            <span className="text-[8px] font-black text-teal-700 sm:text-[10px]">
              {space.name.includes("Electric") ? "⚡" : "💧"}
            </span>
          ) : null}

          {!isCorner ? (
            <span
              className="max-w-full text-center font-black leading-tight text-slate-950"
              style={{ fontSize: "clamp(8px, 1.1vw, 11px)", overflowWrap: "break-word", hyphens: "auto" }}
            >
              {displayName}
            </span>
          ) : null}

          {!isCorner && (space.kind === "city" || space.kind === "airport" || space.kind === "utility") ? (
            <span
              className="font-bold text-slate-500"
              style={{ fontSize: "clamp(7px, 1vw, 10px)" }}
            >
              ${space.price}
            </span>
          ) : null}

          {/* House/hotel indicators — cities only */}
          {!isCorner && space.kind === "city" && ownership ? (
            <PropertyBuildings ownership={ownership} />
          ) : null}
        </div>

        <div className="relative z-[10] w-full" style={{ minHeight: "clamp(12px, 18%, 20px)" }}>
          {players.length > 0 ? <PlayerToken players={players} landingPlayerIds={landingPlayerIds} /> : null}
        </div>
      </div>
    </>
  );

  const sharedClasses = [
    "relative min-w-0 overflow-hidden border border-[var(--board-border)] bg-[var(--board-paper)]",
    "flex flex-col text-center",
    canOpen
      ? "cursor-pointer transition-colors duration-100 hover:bg-amber-50 board-space-focus"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (canOpen) {
    return (
      <button
        type="button"
        className={sharedClasses}
        style={style}
        onClick={() => onOpenProperty(space)}
        aria-label={`Open ${space.name} property card`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={sharedClasses} style={style}>
      {content}
    </div>
  );
}
