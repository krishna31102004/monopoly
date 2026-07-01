"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import type {
  CreateRoomPayload,
  GameActionIntent,
  GameErrorPayload,
  GameStatePayload,
  JoinRoomPayload,
  PlayerEventPayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  RoomPublicView,
  RoomUpdatePayload,
  TradeDraftState,
  TradeDraftStartPayload,
  TradeDraftUpdatePayload,
  TradeDraftStatePayload,
} from "@/types/multiplayer";
import type { GameRules, GameState } from "@/types/game";

const SESSION_PLAYER_ID = "wc_playerId";
const SESSION_ROOM_CODE = "wc_roomCode";
const SESSION_PLAYER_NAME = "wc_playerName";
const SESSION_PLAYER_TOKEN = "wc_playerToken";
const SESSION_PLAYER_LABEL = "wc_playerLabel";
const SESSION_PLAYER_COLOR = "wc_playerColor";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export type RoomHookState = {
  status: ConnectionStatus;
  connected: boolean;
  connecting: boolean;
  room: RoomPublicView | null;
  myPlayerId: string | null;
  gameState: GameState | null;
  error: string | null;
  lastPlayerEvent: PlayerEventPayload | null;
  tradeDraft: TradeDraftState | null;
  rollOff: import("@/types/multiplayer").RollOffPublicView | null;
};

export function useRoom() {
  const [state, setState] = useState<RoomHookState>({
    status: "disconnected",
    connected: false,
    connecting: false,
    room: null,
    myPlayerId: null,
    gameState: null,
    error: null,
    lastPlayerEvent: null,
    tradeDraft: null,
    rollOff: null,
  });

  // Keep a ref to current state for use inside socket callbacks without stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const socket = getSocket();

    setState((s) => ({ ...s, status: "connecting", connecting: true }));

    socket.on("connect", () => {
      setState((s) => ({ ...s, status: "connected", connected: true, connecting: false, error: null }));

      // Auto-reconnect: if we have saved identity and no current room, try to rejoin
      const savedRoomCode = sessionStorage.getItem(SESSION_ROOM_CODE);
      const savedPlayerId = sessionStorage.getItem(SESSION_PLAYER_ID);
      const savedName = sessionStorage.getItem(SESSION_PLAYER_NAME);
      const savedToken = sessionStorage.getItem(SESSION_PLAYER_TOKEN);
      const savedLabel = sessionStorage.getItem(SESSION_PLAYER_LABEL);
      const savedColor = sessionStorage.getItem(SESSION_PLAYER_COLOR);

      if (
        savedRoomCode &&
        savedPlayerId &&
        savedName &&
        savedToken &&
        !stateRef.current.room
      ) {
        socket.emit("room:reconnect", {
          roomCode: savedRoomCode,
          playerId: savedPlayerId,
          displayName: savedName,
          token: savedToken,
          tokenLabel: savedLabel ?? savedToken.toUpperCase(),
          color: savedColor ?? "#64748b",
        });
      }
    });

    socket.on("disconnect", () => {
      setState((s) => ({
        ...s,
        status: s.room ? "reconnecting" : "disconnected",
        connected: false,
      }));
    });

    socket.on("connect_error", (err: Error) => {
      setState((s) => ({
        ...s,
        status: "disconnected",
        connected: false,
        connecting: false,
        error: `Cannot reach server: ${err.message}`,
      }));
    });

    socket.on("room:created", (data: RoomCreatedPayload) => {
      sessionStorage.setItem(SESSION_PLAYER_ID, data.playerId);
      sessionStorage.setItem(SESSION_ROOM_CODE, data.room.roomCode);
      setState((s) => ({ ...s, myPlayerId: data.playerId, room: data.room, rollOff: data.room.rollOff ?? null, error: null }));
    });

    socket.on("room:joined", (data: RoomJoinedPayload) => {
      sessionStorage.setItem(SESSION_PLAYER_ID, data.playerId);
      sessionStorage.setItem(SESSION_ROOM_CODE, data.room.roomCode);
      setState((s) => ({ ...s, myPlayerId: data.playerId, room: data.room, rollOff: data.room.rollOff ?? null, error: null }));
    });

    socket.on("room:update", (data: RoomUpdatePayload) => {
      setState((s) => ({
        ...s,
        room: data.room,
        rollOff: data.room.rollOff ?? null,
      }));
    });

    socket.on("game:state", (data: GameStatePayload) => {
      setState((s) => ({ ...s, gameState: data.gameState }));
    });

    socket.on("game:error", (data: GameErrorPayload) => {
      setState((s) => ({ ...s, error: data.message }));
    });

    socket.on("trade:draftState", (data: TradeDraftStatePayload) => {
      setState((s) => ({ ...s, tradeDraft: data.draft }));
    });

    socket.on("player:connected", (data: PlayerEventPayload) => {
      setState((s) => ({ ...s, lastPlayerEvent: data }));
    });

    socket.on("player:disconnected", (data: PlayerEventPayload) => {
      setState((s) => ({ ...s, lastPlayerEvent: data }));
    });

    socket.on("room:ended", () => {
      setState((s) => ({ ...s, room: null, gameState: null, tradeDraft: null }));
      sessionStorage.removeItem(SESSION_PLAYER_ID);
      sessionStorage.removeItem(SESSION_ROOM_CODE);
      sessionStorage.removeItem(SESSION_PLAYER_NAME);
      sessionStorage.removeItem(SESSION_PLAYER_TOKEN);
      sessionStorage.removeItem(SESSION_PLAYER_LABEL);
      sessionStorage.removeItem(SESSION_PLAYER_COLOR);
    });

    socket.connect();

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("room:created");
      socket.off("room:joined");
      socket.off("room:update");
      socket.off("game:state");
      socket.off("game:error");
      socket.off("trade:draftState");
      socket.off("player:connected");
      socket.off("player:disconnected");
      socket.off("room:ended");
      socket.disconnect();
    };
  }, []);

  const createRoom = useCallback((payload: CreateRoomPayload) => {
    setState((s) => ({ ...s, error: null }));
    // Save identity for reconnect
    sessionStorage.setItem(SESSION_PLAYER_NAME, payload.displayName);
    sessionStorage.setItem(SESSION_PLAYER_TOKEN, payload.token);
    sessionStorage.setItem(SESSION_PLAYER_LABEL, payload.tokenLabel);
    sessionStorage.setItem(SESSION_PLAYER_COLOR, payload.color);
    getSocket().emit("room:create", payload);
  }, []);

  const joinRoom = useCallback((payload: JoinRoomPayload) => {
    setState((s) => ({ ...s, error: null }));
    // Save identity for reconnect
    sessionStorage.setItem(SESSION_PLAYER_NAME, payload.displayName);
    sessionStorage.setItem(SESSION_PLAYER_TOKEN, payload.token);
    sessionStorage.setItem(SESSION_PLAYER_LABEL, payload.tokenLabel);
    sessionStorage.setItem(SESSION_PLAYER_COLOR, payload.color);
    getSocket().emit("room:join", payload);
  }, []);

  const leaveRoom = useCallback(() => {
    getSocket().emit("room:leave");
    setState((s) => ({ ...s, room: null, gameState: null }));
    sessionStorage.removeItem(SESSION_PLAYER_ID);
    sessionStorage.removeItem(SESSION_ROOM_CODE);
    sessionStorage.removeItem(SESSION_PLAYER_NAME);
    sessionStorage.removeItem(SESSION_PLAYER_TOKEN);
    sessionStorage.removeItem(SESSION_PLAYER_LABEL);
    sessionStorage.removeItem(SESSION_PLAYER_COLOR);
  }, []);

  const startGame = useCallback((rules?: GameRules) => {
    getSocket().emit("room:startGame", rules ? { rules } : undefined);
  }, []);

  const rollForOrder = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
    getSocket().emit("rolloff:roll");
  }, []);

  const beginRollOffGame = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
    getSocket().emit("rolloff:beginGame");
  }, []);

  const requestSync = useCallback(() => {
    getSocket().emit("room:requestSync");
  }, []);

  const requestGameSync = useCallback(() => {
    getSocket().emit("game:requestSync");
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const sendAction = useCallback(
    (action: GameActionIntent) => {
      const playerId = stateRef.current.myPlayerId;
      if (!playerId) return;
      setState((s) => ({ ...s, error: null }));
      getSocket().emit("game:action", { playerId, action });
    },
    [],
  );

  const startTradeDraft = useCallback((payload: TradeDraftStartPayload) => {
    setState((s) => ({ ...s, error: null }));
    getSocket().emit("trade:draftStart", payload);
  }, []);

  const updateTradeDraft = useCallback((payload: TradeDraftUpdatePayload) => {
    getSocket().emit("trade:draftUpdate", payload);
  }, []);

  const cancelTradeDraft = useCallback(() => {
    getSocket().emit("trade:draftCancel");
  }, []);

  const submitTradeDraft = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
    getSocket().emit("trade:draftSubmit");
  }, []);

  const forfeitGame = useCallback(() => {
    getSocket().emit("game:forfeit");
    setState((s) => ({ ...s, room: null, gameState: null }));
    sessionStorage.removeItem(SESSION_PLAYER_ID);
    sessionStorage.removeItem(SESSION_ROOM_CODE);
    sessionStorage.removeItem(SESSION_PLAYER_NAME);
    sessionStorage.removeItem(SESSION_PLAYER_TOKEN);
    sessionStorage.removeItem(SESSION_PLAYER_LABEL);
    sessionStorage.removeItem(SESSION_PLAYER_COLOR);
  }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    leaveRoom,
    forfeitGame,
    startGame,
    rollForOrder,
    beginRollOffGame,
    requestSync,
    requestGameSync,
    clearError,
    sendAction,
    startTradeDraft,
    updateTradeDraft,
    cancelTradeDraft,
    submitTradeDraft,
  };
}
