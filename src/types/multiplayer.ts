import type { GameState } from "@/types/game";
import type { PlayerToken } from "@/types/player";

export type RoomStatus = "lobby" | "inGame" | "gameOver" | "ended";

export type RoomPlayer = {
  playerId: string;
  displayName: string;
  token: PlayerToken;
  tokenLabel: string;
  color: string;
  connected: boolean;
  isHost: boolean;
  joinedAt: string;
};

export type RoomPublicView = {
  roomCode: string;
  status: RoomStatus;
  players: RoomPlayer[];
  maxPlayers: number;
  takenTokens: PlayerToken[];
};

// ── Client → Server event payloads ───────────────────────────────────────────

export type CreateRoomPayload = {
  displayName: string;
  token: PlayerToken;
  tokenLabel: string;
  color: string;
};

export type JoinRoomPayload = {
  roomCode: string;
  displayName: string;
  token: PlayerToken;
  tokenLabel: string;
  color: string;
  playerId?: string; // present when reconnecting
};

// ── Server → Client event payloads ───────────────────────────────────────────

export type RoomCreatedPayload = {
  playerId: string;
  room: RoomPublicView;
};

export type RoomJoinedPayload = {
  playerId: string;
  room: RoomPublicView;
};

export type RoomUpdatePayload = {
  room: RoomPublicView;
};

export type GameStatePayload = {
  gameState: GameState;
};

export type GameErrorPayload = {
  message: string;
};

export type PlayerEventPayload = {
  playerId: string;
  displayName: string;
};

export type RoomEndedPayload = {
  reason: "host_ended" | "inactivity";
};

// ── game:action payload (Client → Server) ────────────────────────────────────
// Dice-rolling actions omit the dice — the server rolls them authoritatively.
// System-only actions (START_GAME, RESET_GAME, LOAD_GAME) are not sent over the socket.
export type GameActionIntent =
  | { type: "ROLL_DICE" }
  | { type: "ROLL_IN_JAIL" }
  | { type: "BUY_PROPERTY" }
  | { type: "DECLINE_PROPERTY" }
  | { type: "PLACE_BID"; amount: number }
  | { type: "PASS_AUCTION" }
  | { type: "END_TURN" }
  | { type: "PAY_JAIL_FEE" }
  | { type: "USE_JAIL_CARD" }
  | { type: "BUY_HOUSE"; spaceIndex: number }
  | { type: "SELL_HOUSE"; spaceIndex: number }
  | { type: "BUY_HOTEL"; spaceIndex: number }
  | { type: "SELL_HOTEL"; spaceIndex: number }
  | { type: "MORTGAGE_PROPERTY"; spaceIndex: number }
  | { type: "UNMORTGAGE_PROPERTY"; spaceIndex: number }
  | { type: "PROPOSE_TRADE"; initiatorId: string; recipientId: string; offerFromInitiator: import("@/types/game").TradeOffer; offerFromRecipient: import("@/types/game").TradeOffer }
  | { type: "ACCEPT_TRADE" }
  | { type: "DECLINE_TRADE" }
  | { type: "CANCEL_TRADE" }
  | { type: "DECLARE_BANKRUPTCY" }
  | { type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" };

export type GameActionPayload = {
  playerId: string;
  action: GameActionIntent;
};
