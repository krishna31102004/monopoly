import { PlayerToken } from "@/components/board/PlayerToken";
import { getOwnerBadgeClassName, getOwnerBadgeLabel, isFullSetOwner } from "@/lib/ui/boardTilePresentation";
import { getBoardSpaceAnchorId } from "@/lib/ui/mobileLayoutHelpers";
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

/** Owner badge — fixed top-center placement over the color strip, showing the owner's full
 *  display name (not initials), never overlapping the city name, price, player tokens, or
 *  houses/hotels (which live in the tile's vertical center/footer). */
function OwnerNameBadge({ owner, spaceIndex }: { owner: Player; spaceIndex: number }) {
  const label = getOwnerBadgeLabel(owner.name);
  const className = getOwnerBadgeClassName(spaceIndex);
  return (
    <div
      title={`Owned by ${owner.name}`}
      className={className}
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
        border: "1px solid rgba(255,255,255,0.35)",
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
          letterSpacing: "0.02em",
          lineHeight: 1,
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

/** Premium hotel building SVG — replaces the plain red "H" marker. */
function HotelBuildingIcon({ size }: { size: number }) {
  const w = size;
  const h = Math.round(size * 0.72);
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 20 14"
      fill="none"
      aria-label="Hotel"
      role="img"
      style={{ display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" }}
    >
      {/* Sign/name board on top */}
      <rect x="7" y="0" width="6" height="2.5" rx="0.5" fill="#96281b" />
      {/* Roof band */}
      <rect x="1" y="2" width="18" height="2" rx="0.5" fill="#96281b" />
      {/* Building body */}
      <rect x="1" y="4" width="18" height="10" rx="1" fill="#c0392b" />
      {/* Windows row 1 */}
      <rect x="2.5" y="5.5" width="3.5" height="2.5" rx="0.4" fill="rgba(255,255,180,0.82)" />
      <rect x="8.25" y="5.5" width="3.5" height="2.5" rx="0.4" fill="rgba(255,255,180,0.82)" />
      <rect x="14" y="5.5" width="3.5" height="2.5" rx="0.4" fill="rgba(255,255,180,0.82)" />
      {/* Door + windows row 2 */}
      <rect x="2.5" y="9.5" width="3.5" height="2.5" rx="0.4" fill="rgba(255,255,180,0.65)" />
      <rect x="8.25" y="9" width="3.5" height="5" rx="0.4" fill="rgba(0,0,0,0.3)" />
      <rect x="14" y="9.5" width="3.5" height="2.5" rx="0.4" fill="rgba(255,255,180,0.65)" />
      {/* Highlight gloss */}
      <rect x="1" y="4" width="18" height="1.5" rx="0.5" fill="rgba(255,255,255,0.18)" />
    </svg>
  );
}

/** Houses and hotel indicator — bigger, cleaner shapes */
function PropertyBuildings({ ownership }: { ownership: PropertyOwnership }) {
  if (ownership.hasHotel) {
    return (
      <div className="flex justify-center py-px" title="Hotel">
        <HotelBuildingIcon size={Math.round(20)} />
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
              width: "clamp(7px,1.6vw,11px)",
              height: "clamp(7px,1.6vw,11px)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
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

  const isFullSet =
    space.kind === "city" && owner ? isFullSetOwner(space, ownerships, owner.id) : false;

  const content = (
    <>
      {/* Color strip for cities */}
      {space.kind === "city" ? (
        <span
          className={`board-tile-color-strip block shrink-0 border-b border-[var(--board-border)] ${colorGroupClasses[space.colorGroup]}`}
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

      {/* Owner pill badge — absolute, edge-attached, never disrupts layout flow */}
      {!isCorner && owner ? <OwnerNameBadge owner={owner} spaceIndex={space.index} /> : null}

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
    "flex flex-col text-center board-tile",
    canOpen
      ? "cursor-pointer transition-colors duration-100 hover:bg-amber-50 board-space-focus"
      : "",
    isFullSet ? "board-tile-fullset-glow" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (canOpen) {
    return (
      <button
        type="button"
        id={getBoardSpaceAnchorId(space.index)}
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
    <div id={getBoardSpaceAnchorId(space.index)} className={sharedClasses} style={style}>
      {content}
    </div>
  );
}
