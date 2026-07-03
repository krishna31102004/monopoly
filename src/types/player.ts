export type PlayerToken = "car" | "hat" | "ship" | "shoe" | "dog" | "cat";

export type Player = {
  id: string;
  name: string;
  token: PlayerToken;
  tokenLabel: string;
  color: string;
  cash: number;
  position: number;
  ownedCityIds: number[];
  ownedAirportIds: number[];
  ownedUtilityIds: number[];
  isInJail: boolean;
  jailTurns: number;
  getOutOfJailFreeCards: number;
  isBankrupt: boolean;
  consecutiveTurnTimeouts: number;
};
