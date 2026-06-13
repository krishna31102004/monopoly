import type { Player } from "@/types/player";

type PlayerTokenProps = {
  players: Player[];
};

export function PlayerToken({ players }: PlayerTokenProps) {
  return (
    <div className="mx-auto grid max-w-[72px] grid-cols-3 gap-[2px]" aria-label="Players on this space">
      {players.slice(0, 6).map((player) => (
        <span
          key={player.id}
          title={player.name}
          className="flex aspect-square min-w-0 items-center justify-center rounded-full border-[1.5px] border-white font-black leading-none text-white shadow"
          style={{
            backgroundColor: player.color,
            fontSize: "clamp(4px, 0.7vw, 7px)",
          }}
          aria-label={`${player.name} token`}
        >
          {player.tokenLabel.slice(0, 2)}
        </span>
      ))}
    </div>
  );
}
