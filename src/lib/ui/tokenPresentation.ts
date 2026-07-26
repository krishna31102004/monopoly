import type { PlayerToken } from "@/types/player";

/** Presentation metadata layered over the existing, protocol-safe token IDs. */
export const TOKEN_PRESENTATION: ReadonlyArray<{
  token: PlayerToken;
  tokenLabel: string;
  displayName: string;
  color: string;
}> = [
  { token: "car", tokenLabel: "CAR", displayName: "Roadster", color: "#ef4444" },
  { token: "hat", tokenLabel: "HAT", displayName: "Top Hat", color: "#2563eb" },
  { token: "ship", tokenLabel: "SHP", displayName: "Ocean Liner", color: "#16a34a" },
  { token: "shoe", tokenLabel: "SHO", displayName: "Traveler", color: "#ca8a04" },
  { token: "dog", tokenLabel: "DOG", displayName: "Terrier", color: "#7c3aed" },
  { token: "cat", tokenLabel: "CAT", displayName: "Cat", color: "#0891b2" },
] as const;

export function getTokenPresentation(token: PlayerToken) {
  return TOKEN_PRESENTATION.find((entry) => entry.token === token);
}
