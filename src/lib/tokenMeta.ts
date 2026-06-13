import type { PlayerToken } from "@/types/player";

const TOKEN_KEYS: PlayerToken[] = ["car", "hat", "ship", "shoe", "dog", "cat"];

export function hasTokenIcon(token: string): token is PlayerToken {
  return TOKEN_KEYS.includes(token as PlayerToken);
}
