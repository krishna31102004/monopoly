import { createInitialGameState } from "@/lib/game/createInitialGameState";
import { gameReducer } from "@/lib/game/gameReducer";
import { generateRoomCode } from "@/lib/multiplayer/roomCode";
import type { RoomPlayer, RoomPublicView, RoomStatus, GameActionIntent } from "@/types/multiplayer";
import type { PlayerToken } from "@/types/player";
import type { GameState, GameAction, DiceRoll, GameRules } from "@/types/game";

export const MAX_PLAYERS = 6;
const INACTIVITY_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Internal room representation (not sent to clients)
type InternalRoom = {
  roomId: string;
  roomCode: string;
  hostPlayerId: string;
  players: RoomPlayer[];
  socketIds: Map<string, string>; // playerId → socketId
  status: RoomStatus;
  gameState: GameState | null;
  createdAt: number;
  lastActivityAt: number;
  maxPlayers: number;
};

export type CreateRoomInput = {
  displayName: string;
  token: PlayerToken;
  tokenLabel: string;
  color: string;
};

export type JoinRoomInput = {
  roomCode: string;
  displayName: string;
  token: PlayerToken;
  tokenLabel: string;
  color: string;
  playerId?: string;
};

export type RoomResult<T> = { ok: true; value: T } | { ok: false; error: string };

export class RoomManager {
  private rooms = new Map<string, InternalRoom>();

  private generateUniqueCode(): string {
    let code: string;
    let attempts = 0;
    do {
      code = generateRoomCode();
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);
    return code;
  }

  private generatePlayerId(): string {
    return `p-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  }

  private touch(room: InternalRoom): void {
    room.lastActivityAt = Date.now();
  }

  private toPublicView(room: InternalRoom): RoomPublicView {
    return {
      roomCode: room.roomCode,
      status: room.status,
      players: room.players,
      maxPlayers: room.maxPlayers,
      takenTokens: room.players.filter((p) => p.connected).map((p) => p.token),
    };
  }

  // ── Room creation ─────────────────────────────────────────────────────────

  createRoom(input: CreateRoomInput, socketId: string): { playerId: string; room: RoomPublicView } {
    const playerId = this.generatePlayerId();
    const roomCode = this.generateUniqueCode();
    const now = Date.now();

    const host: RoomPlayer = {
      playerId,
      displayName: input.displayName.trim(),
      token: input.token,
      tokenLabel: input.tokenLabel,
      color: input.color,
      connected: true,
      isHost: true,
      joinedAt: new Date(now).toISOString(),
    };

    const socketIds = new Map<string, string>();
    socketIds.set(playerId, socketId);

    const room: InternalRoom = {
      roomId: `room-${now}-${Math.random().toString(36).slice(2, 6)}`,
      roomCode,
      hostPlayerId: playerId,
      players: [host],
      socketIds,
      status: "lobby",
      gameState: null,
      createdAt: now,
      lastActivityAt: now,
      maxPlayers: MAX_PLAYERS,
    };

    this.rooms.set(roomCode, room);
    return { playerId, room: this.toPublicView(room) };
  }

  // ── Join room ─────────────────────────────────────────────────────────────

  joinRoom(input: JoinRoomInput, socketId: string): RoomResult<{ playerId: string; room: RoomPublicView }> {
    const code = input.roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: "Room not found. Check the code and try again." };
    if (room.status === "ended") return { ok: false, error: "This room has ended." };

    const trimmedName = input.displayName.trim();
    if (!trimmedName) return { ok: false, error: "Display name cannot be empty." };

    // Reconnect: existing playerId provided
    if (input.playerId) {
      const existing = room.players.find((p) => p.playerId === input.playerId);
      if (existing) {
        existing.connected = true;
        room.socketIds.set(existing.playerId, socketId);
        this.touch(room);
        return { ok: true, value: { playerId: existing.playerId, room: this.toPublicView(room) } };
      }
      // playerId not found in room — fall through to new join (session may have reset)
    }

    // Cannot join in-progress game as new player
    if (room.status === "inGame" || room.status === "gameOver") {
      return { ok: false, error: "Game is already in progress." };
    }

    // Room full
    const activePlayers = room.players.filter((p) => p.connected);
    if (activePlayers.length >= room.maxPlayers) {
      return { ok: false, error: `Room is full (max ${room.maxPlayers} players).` };
    }

    // Token taken by connected player
    const tokenTaken = room.players.some((p) => p.connected && p.token === input.token);
    if (tokenTaken) return { ok: false, error: "That token is already taken. Choose another." };

    const playerId = this.generatePlayerId();
    const player: RoomPlayer = {
      playerId,
      displayName: trimmedName,
      token: input.token,
      tokenLabel: input.tokenLabel,
      color: input.color,
      connected: true,
      isHost: false,
      joinedAt: new Date().toISOString(),
    };

    room.players.push(player);
    room.socketIds.set(playerId, socketId);
    this.touch(room);
    return { ok: true, value: { playerId, room: this.toPublicView(room) } };
  }

  // ── Leave / disconnect ────────────────────────────────────────────────────

  playerDisconnected(socketId: string): { roomCode: string; playerId: string; displayName: string } | null {
    for (const room of this.rooms.values()) {
      for (const [pid, sid] of room.socketIds) {
        if (sid === socketId) {
          const player = room.players.find((p) => p.playerId === pid);
          if (player) {
            player.connected = false;
            room.socketIds.delete(pid);
            this.touch(room);
            return { roomCode: room.roomCode, playerId: pid, displayName: player.displayName };
          }
        }
      }
    }
    return null;
  }

  playerLeft(roomCode: string, playerId: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    const player = room.players.find((p) => p.playerId === playerId);
    if (player) {
      player.connected = false;
      room.socketIds.delete(playerId);
      this.touch(room);
    }
    return true;
  }

  // ── Start game ────────────────────────────────────────────────────────────

  startGame(roomCode: string, playerId: string, rules?: GameRules): RoomResult<{ room: RoomPublicView; gameState: GameState }> {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found." };
    if (room.hostPlayerId !== playerId) return { ok: false, error: "Only the host can start the game." };
    if (room.status !== "lobby") return { ok: false, error: "Game is not in lobby state." };

    const activePlayers = room.players.filter((p) => p.connected);
    if (activePlayers.length < 2) return { ok: false, error: "Need at least 2 players to start." };
    if (activePlayers.length > MAX_PLAYERS) return { ok: false, error: "Too many players." };

    const startPlayers = activePlayers.map((p) => ({
      id: p.playerId,
      name: p.displayName,
      token: p.token,
      tokenLabel: p.tokenLabel,
      color: p.color,
    }));

    const gameState = createInitialGameState(startPlayers, rules);
    room.gameState = gameState;
    room.status = "inGame";
    this.touch(room);

    return { ok: true, value: { room: this.toPublicView(room), gameState } };
  }

  // ── Apply game action (server-authoritative) ──────────────────────────────

  applyGameAction(
    roomCode: string,
    playerId: string,
    intent: GameActionIntent,
    serverDice: DiceRoll | null,
  ): RoomResult<GameState> {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found." };
    if (room.status !== "inGame") return { ok: false, error: "Game is not in progress." };
    if (!room.gameState) return { ok: false, error: "No game state found." };

    const gs = room.gameState;
    const currentPlayer = gs.players[gs.currentPlayerIndex];

    // During auction, the current bidder acts; during bankruptcy, the debtor acts;
    // all other phases require it to be the current player's turn.
    let actorId: string;
    if (gs.phase === "auction" && gs.auction) {
      actorId = gs.auction.currentAuctionBidderId;
    } else if (gs.phase === "bankruptcyPending" && gs.bankruptcy) {
      actorId = gs.bankruptcy.debtorPlayerId;
    } else {
      actorId = currentPlayer.id;
    }

    // Trade actions have custom per-role authorization (not just turn order).
    // Server injects actorPlayerId from socket identity so the reducer can validate.
    const isTradeAction =
      intent.type === "PROPOSE_TRADE" ||
      intent.type === "ACCEPT_TRADE" ||
      intent.type === "DECLINE_TRADE" ||
      intent.type === "CANCEL_TRADE";

    let action: GameAction;

    if (isTradeAction) {
      if (intent.type === "PROPOSE_TRADE") {
        if (playerId !== actorId) {
          return { ok: false, error: "Only the current player can propose a trade." };
        }
        if (playerId !== intent.initiatorId) {
          return { ok: false, error: "You can only propose a trade as yourself." };
        }
        action = { ...intent, actorPlayerId: playerId };
      } else if (intent.type === "ACCEPT_TRADE") {
        if (!gs.trade) return { ok: false, error: "No trade is pending." };
        if (playerId !== gs.trade.recipientPlayerId) {
          return { ok: false, error: "Only the trade recipient can accept." };
        }
        action = { type: "ACCEPT_TRADE", actorPlayerId: playerId };
      } else if (intent.type === "DECLINE_TRADE") {
        if (!gs.trade) return { ok: false, error: "No trade is pending." };
        if (playerId !== gs.trade.recipientPlayerId) {
          return { ok: false, error: "Only the trade recipient can decline." };
        }
        action = { type: "DECLINE_TRADE", actorPlayerId: playerId };
      } else {
        // CANCEL_TRADE
        if (!gs.trade) return { ok: false, error: "No trade is pending." };
        if (playerId !== gs.trade.initiatorPlayerId) {
          return { ok: false, error: "Only the trade initiator can cancel." };
        }
        action = { type: "CANCEL_TRADE", actorPlayerId: playerId };
      }
    } else {
      if (playerId !== actorId) {
        return { ok: false, error: "It is not your turn." };
      }

      // Build the authoritative GameAction (inject server dice where needed)
      if (intent.type === "ROLL_DICE") {
        if (!serverDice) return { ok: false, error: "Server dice missing." };
        action = { type: "ROLL_DICE", dice: serverDice };
      } else if (intent.type === "ROLL_IN_JAIL") {
        if (!serverDice) return { ok: false, error: "Server dice missing." };
        action = { type: "ROLL_IN_JAIL", dice: serverDice };
      } else {
        action = intent as GameAction;
      }
    }

    const newState = gameReducer(gs, action);
    room.gameState = newState;
    this.touch(room);
    return { ok: true, value: newState };
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  getRoom(roomCode: string): RoomPublicView | null {
    const room = this.rooms.get(roomCode);
    return room ? this.toPublicView(room) : null;
  }

  getGameState(roomCode: string): GameState | null {
    return this.rooms.get(roomCode)?.gameState ?? null;
  }

  getRoomCodeBySocketId(socketId: string): string | null {
    for (const room of this.rooms.values()) {
      if ([...room.socketIds.values()].includes(socketId)) return room.roomCode;
    }
    return null;
  }

  getPlayerIdBySocketId(socketId: string): string | null {
    for (const room of this.rooms.values()) {
      for (const [pid, sid] of room.socketIds) {
        if (sid === socketId) return pid;
      }
    }
    return null;
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  cleanupInactive(): number {
    const cutoff = Date.now() - INACTIVITY_TTL_MS;
    let removed = 0;
    for (const [code, room] of this.rooms) {
      if (room.lastActivityAt < cutoff) {
        this.rooms.delete(code);
        removed++;
      }
    }
    return removed;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  // For testing: directly set a room's lastActivityAt to simulate inactivity
  setLastActivityAt(roomCode: string, timestamp: number): void {
    const room = this.rooms.get(roomCode);
    if (room) room.lastActivityAt = timestamp;
  }

  // Expose raw rooms only for testing
  getRawRoom(roomCode: string): InternalRoom | undefined {
    return this.rooms.get(roomCode);
  }
}
