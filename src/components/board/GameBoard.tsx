import { BoardSpace } from "@/components/board/BoardSpace";
import { getBoardGridPlacement } from "@/lib/board-grid";
import type { BoardSpace as BoardSpaceType, OwnableSpace } from "@/types/board";
import type { PropertyOwnership } from "@/types/game";
import type { Player } from "@/types/player";

type GameBoardProps = {
  spaces: BoardSpaceType[];
  players: Player[];
  ownerships?: PropertyOwnership[];
  onOpenProperty: (space: OwnableSpace) => void;
};

export function GameBoard({ spaces, players, ownerships = [], onOpenProperty }: GameBoardProps) {
  const playersByPosition = players.reduce<Record<number, Player[]>>((groups, player) => {
    groups[player.position] = [...(groups[player.position] ?? []), player];
    return groups;
  }, {});

  return (
    <div className="mx-auto w-full max-w-[min(94vw,calc(100vh-2rem),980px)] xl:max-w-[min(76vw,calc(100vh-2rem),980px)]">
      <div
        className="grid aspect-square grid-cols-11 grid-rows-11 overflow-hidden border-[3px] border-[var(--board-border)] bg-[var(--board-line)] shadow-[0_24px_80px_rgba(15,26,28,0.25)]"
        aria-label="World Cities game board"
      >
        {/* Board center */}
        <div className="col-start-2 col-span-9 row-start-2 row-span-9 flex flex-col items-center justify-center border border-[var(--board-border)] bg-[var(--board-paper)] p-4 text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500 sm:text-[11px]">
            Private Board Game
          </p>
          <h1 className="mt-1 text-xl font-black leading-none tracking-tight text-slate-950 sm:text-3xl lg:text-[2.6rem]">
            World Cities
          </h1>
          <div className="mt-2 flex gap-1 sm:gap-1.5">
            {["🇲🇽","🇮🇳","🇩🇪","🇦🇪","🇮🇹","🇦🇺","🇬🇧","🇺🇸"].map((flag) => (
              <span key={flag} className="text-sm sm:text-lg lg:text-xl" aria-hidden="true">{flag}</span>
            ))}
          </div>
          <p className="mt-2 hidden text-[10px] font-semibold leading-5 text-slate-500 sm:block sm:text-xs">
            Buy cities · Collect rent · Win the world
          </p>
        </div>

        {spaces.map((space) => (
          <BoardSpace
            key={space.index}
            space={space}
            players={playersByPosition[space.index] ?? []}
            allPlayers={players}
            ownerships={ownerships}
            style={getBoardGridPlacement(space.index)}
            onOpenProperty={onOpenProperty}
          />
        ))}
      </div>
    </div>
  );
}
