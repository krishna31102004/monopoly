import { getBoardSpaceByIndex } from "@/data/board";
import { getOwnedSpaceIds } from "@/lib/game/ownership";
import type { BoardSpace } from "@/types/board";
import type { PropertyOwnership } from "@/types/game";
import type { Player } from "@/types/player";

type PlayerPanelProps = {
  player: Player;
  spaces: BoardSpace[];
  ownerships: PropertyOwnership[];
  isCurrentPlayer?: boolean;
};

function getAssetNames(ids: number[], spaces: BoardSpace[]) {
  return ids
    .map((id) => spaces.find((space) => space.index === id)?.name)
    .filter(Boolean)
    .join(", ");
}

export function PlayerPanel({
  player,
  spaces,
  ownerships,
  isCurrentPlayer = false,
}: PlayerPanelProps) {
  const position = getBoardSpaceByIndex(player.position);
  const ownedSpaceIds = getOwnedSpaceIds(ownerships, player.id);
  const ownedCities = ownedSpaceIds.filter(
    (i) => getBoardSpaceByIndex(i).kind === "city",
  );
  const ownedAirports = ownedSpaceIds.filter(
    (i) => getBoardSpaceByIndex(i).kind === "airport",
  );
  const ownedUtilities = ownedSpaceIds.filter(
    (i) => getBoardSpaceByIndex(i).kind === "utility",
  );
  const cityNames = getAssetNames(ownedCities, spaces);
  const airportNames = getAssetNames(ownedAirports, spaces);
  const utilityNames = getAssetNames(ownedUtilities, spaces);
  const ownedAssetCount = ownedSpaceIds.length;

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
        isCurrentPlayer
          ? "border-slate-950 shadow-[0_0_0_2px_rgba(15,23,42,0.12)]"
          : "border-slate-200"
      } ${player.isBankrupt ? "opacity-50" : ""}`}
      style={isCurrentPlayer ? { borderLeftWidth: 4, borderLeftColor: player.color } : {}}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white text-[11px] font-black text-white shadow"
          style={{ backgroundColor: player.color }}
        >
          {player.tokenLabel.slice(0, 3)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-black text-slate-950">{player.name}</h3>
            {isCurrentPlayer ? (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white"
                style={{ backgroundColor: player.color }}
              >
                Turn
              </span>
            ) : null}
            {player.isBankrupt ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-red-700">
                Bankrupt
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs font-semibold text-slate-500">{position.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-black text-slate-950">${player.cash.toLocaleString()}</p>
          <p className="text-[10px] font-semibold text-slate-400">{ownedAssetCount} assets</p>
        </div>
      </div>

      {/* Stats */}
      <div className="border-t border-slate-100 px-3 py-2">
        <div className="grid grid-cols-2 gap-1.5">
          <MiniStat label="Jail" value={player.isInJail ? "In Jail 🔒" : "Free"} warn={player.isInJail} />
          <MiniStat label="Jail cards" value={String(player.getOutOfJailFreeCards)} />
        </div>
      </div>

      {/* Assets */}
      {ownedAssetCount > 0 ? (
        <div className="border-t border-slate-100 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Properties</p>
          <div className="mt-1.5 space-y-1">
            {cityNames ? (
              <p className="text-xs leading-4 text-slate-700">
                <span className="font-bold text-slate-500">Cities: </span>
                {cityNames}
              </p>
            ) : null}
            {airportNames ? (
              <p className="text-xs leading-4 text-slate-700">
                <span className="font-bold text-slate-500">Airports: </span>
                {airportNames}
              </p>
            ) : null}
            {utilityNames ? (
              <p className="text-xs leading-4 text-slate-700">
                <span className="font-bold text-slate-500">Utilities: </span>
                {utilityNames}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-100 px-3 py-2">
          <p className="text-xs font-semibold text-slate-400">No properties owned</p>
        </div>
      )}
    </article>
  );
}

function MiniStat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-xs font-black ${warn ? "text-red-700" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}
