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
  style: React.CSSProperties;
  onOpenProperty: (space: OwnableSpace) => void;
};

function isOwnable(space: BoardSpaceType): space is OwnableSpace {
  return space.kind === "city" || space.kind === "airport" || space.kind === "utility";
}

/** Shorten long space names for board display. Full name stays in modal. */
function boardDisplayName(space: BoardSpaceType): string {
  if (space.kind === "airport") {
    // Strip " Airport" and " International" suffixes for brevity
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

/** Small colored owner badge in the top-right of the space */
function OwnerBadge({ owner }: { owner: Player }) {
  return (
    <span
      className="absolute right-0.5 top-0.5 flex h-[clamp(10px,2vw,14px)] w-[clamp(10px,2vw,14px)] items-center justify-center rounded-full text-white shadow-sm"
      style={{
        backgroundColor: owner.color,
        fontSize: "clamp(5px,0.8vw,7px)",
        fontWeight: 900,
        lineHeight: 1,
      }}
      title={`Owned by ${owner.name} (${owner.tokenLabel})`}
    >
      {owner.tokenLabel.slice(0, 2)}
    </span>
  );
}

/** Small house/hotel indicator row for city spaces */
function ImprovementDots({ ownership }: { ownership: PropertyOwnership }) {
  if (ownership.hasHotel) {
    return (
      <div className="flex justify-center">
        <span
          className="flex items-center justify-center rounded-sm bg-red-600 text-white"
          style={{
            width: "clamp(8px,1.8vw,12px)",
            height: "clamp(5px,1.2vw,8px)",
            fontSize: "clamp(4px,0.7vw,6px)",
            fontWeight: 900,
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
      <div className="flex justify-center gap-px">
        {Array.from({ length: ownership.houses }).map((_, i) => (
          <span
            key={i}
            className="rounded-sm bg-emerald-600"
            style={{
              width: "clamp(4px,1vw,6px)",
              height: "clamp(4px,1vw,6px)",
            }}
            title={`${ownership.houses} house${ownership.houses > 1 ? "s" : ""}`}
          />
        ))}
      </div>
    );
  }
  return null;
}

export function BoardSpace({ space, players, allPlayers = [], ownerships = [], style, onOpenProperty }: BoardSpaceProps) {
  const isCorner = [0, 10, 20, 30].includes(space.index);
  const canOpen = isOwnable(space);

  // Ownership lookup
  const ownership = canOpen
    ? ownerships.find((o) => o.spaceIndex === space.index)
    : undefined;
  const owner = ownership?.ownerId
    ? allPlayers.find((p) => p.id === ownership.ownerId)
    : undefined;

  const displayName = boardDisplayName(space);

  const content = (
    <>
      {space.kind === "city" ? (
        <span
          className={`block shrink-0 border-b border-[var(--board-border)] ${colorGroupClasses[space.colorGroup]}`}
          style={{ height: isCorner ? "0" : "clamp(8px, 22%, 14px)" }}
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

      {/* Owner badge (top-right corner) */}
      {owner ? <OwnerBadge owner={owner} /> : null}

      <div className="flex min-h-0 flex-1 flex-col items-center justify-between gap-0.5 p-0.5 sm:p-1">
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
              className="max-w-full break-words text-center font-black leading-tight text-slate-950"
              style={{ fontSize: "clamp(5px, 1.05vw, 10px)", wordBreak: "break-word" }}
            >
              {displayName}
            </span>
          ) : null}

          {!isCorner && (space.kind === "city" || space.kind === "airport" || space.kind === "utility") ? (
            <span
              className="font-bold text-slate-500"
              style={{ fontSize: "clamp(5px, 0.9vw, 9px)" }}
            >
              ${space.price}
            </span>
          ) : null}

          {/* House/hotel indicators — cities only */}
          {!isCorner && space.kind === "city" && ownership ? (
            <ImprovementDots ownership={ownership} />
          ) : null}
        </div>

        <div className="w-full" style={{ minHeight: "clamp(12px, 18%, 20px)" }}>
          {players.length > 0 ? <PlayerToken players={players} /> : null}
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
