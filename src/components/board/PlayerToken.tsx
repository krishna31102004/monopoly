import { TokenIcon } from "@/components/board/TokenIcon";
import type { Player } from "@/types/player";

type PlayerTokenProps = {
  players: Player[];
  landingPlayerIds?: Set<string>;
};

export function PlayerToken({ players, landingPlayerIds }: PlayerTokenProps) {
  const count = Math.min(players.length, 6);
  const size = count <= 2 ? 18 : count <= 4 ? 14 : 11;

  return (
    <div
      className="mx-auto flex flex-wrap items-center justify-center"
      style={{ gap: 1, maxWidth: 72 }}
      aria-label="Players on this space"
    >
      {players.slice(0, 6).map((player) => {
        const isLanding = landingPlayerIds?.has(player.id) ?? false;
        return (
          <span
            key={player.id}
            style={isLanding ? { animation: `token-land 240ms cubic-bezier(0.36,0.07,0.19,0.97)` } : undefined}
          >
            <TokenIcon
              token={player.token}
              color={player.color}
              size={size}
              label={`${player.name} (${player.tokenLabel})`}
              badge
            />
          </span>
        );
      })}
    </div>
  );
}
