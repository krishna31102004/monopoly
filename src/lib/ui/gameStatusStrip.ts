import type { GameState } from "@/types/game";

export type GameStatusPhaseLabel =
  | "Roll"
  | "Move"
  | "Action"
  | "Auction"
  | "Trade"
  | "Payment Required"
  | "Game Over";

/** Maps the reducer's internal phase to a short, human-facing status word for the strip. */
export function getGameStatusPhaseLabel(state: GameState): GameStatusPhaseLabel {
  switch (state.phase) {
    case "gameOver":
      return "Game Over";
    case "bankruptcyPending":
      return "Payment Required";
    case "auction":
      return "Auction";
    case "awaitingPurchaseDecision":
    case "awaitingJailDecision":
      return "Action";
    case "readyToRoll":
      return "Roll";
    case "turnComplete":
      return "Move";
    default:
      return "Action";
  }
}

export type GameStatusStripInfo = {
  roomCode: string | null;
  myName: string | null;
  currentPlayerName: string;
  phaseLabel: GameStatusPhaseLabel;
  isMultiplayer: boolean;
  connectionStatus: "connected" | "reconnecting" | "disconnected" | null;
};

export type GameStatusStripParams = {
  state: GameState;
  isMultiplayer: boolean;
  roomCode?: string | null;
  myName?: string | null;
  connectionStatus?: "connected" | "reconnecting" | "disconnected" | null;
};

/** Builds the slim top status strip's display data — pure, so it's testable without rendering
 *  the component. Never includes a room code in local (non-multiplayer) mode. */
export function getGameStatusStripInfo(params: GameStatusStripParams): GameStatusStripInfo {
  const { state, isMultiplayer, roomCode = null, myName = null, connectionStatus = null } = params;
  const currentPlayer = state.players[state.currentPlayerIndex];
  return {
    roomCode: isMultiplayer ? roomCode : null,
    myName: isMultiplayer ? myName : null,
    currentPlayerName: currentPlayer?.name ?? "",
    phaseLabel: getGameStatusPhaseLabel(state),
    isMultiplayer,
    connectionStatus: isMultiplayer ? connectionStatus : null,
  };
}
