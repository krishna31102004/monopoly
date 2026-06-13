import { TokenIcon } from "@/components/board/TokenIcon";
import type { Player } from "@/types/player";

type PlayerTokenProps = {
  players: Player[];
};

export function PlayerToken({ players }: PlayerTokenProps) {
  const count = Math.min(players.length, 6);
  // Token size shrinks when multiple tokens share a space
  const size = count <= 2 ? 18 : count <= 4 ? 14 : 11;

  return (
    <div
      className="mx-auto flex flex-wrap items-center justify-center"
      style={{ gap: 1, maxWidth: 72 }}
      aria-label="Players on this space"
    >
      {players.slice(0, 6).map((player) => (
        <TokenIcon
          key={player.id}
          token={player.token}
          color={player.color}
          size={size}
          label={`${player.name} (${player.tokenLabel})`}
          badge
        />
      ))}
    </div>
  );
}
