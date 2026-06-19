import { createInitialGameState } from "@/lib/game/createInitialGameState";
import { gameReducer } from "@/lib/game/gameReducer";
import { validateTrade } from "@/lib/game/trade";
import { generateRoomCode } from "@/lib/multiplayer/roomCode";
import {
  buildInitialAgenda,
  advanceRollOffAgenda,
  getCurrentRollingGroup,
  isAgendaResolved,
  flattenAgenda,
  type RollOffAgendaItem,
  type RollOffEntry,
} from "@/lib/game/rollOff";
import type { RoomPlayer, RoomPublicView, RoomStatus, GameActionIntent, TradeDraftState } from "@/types/multiplayer";
import type { PlayerToken } from "@/types/player";
import type { GameState, GameAction, DiceRoll, GameRules, TradeOffer } from "@/types/game";
import { DEFAULT_RULES } from "@/types/game";

const EMPTY_TRADE_OFFER: TradeOffer = { cash: 0, propertySpaceIndices: [], getOutOfJailFreeCards: 0 };

export const MAX_PLAYERS = 6;
const INACTIVITY_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

type RollOffData = {
  rules: GameRules;
  agenda: RollOffAgendaItem[];
  currentRound: number;
  rollingThisRound: string[];
  roundRolls: Record<string, RollOffEntry>;
  resolvedOrder: string[] | null;
};

// Internal room representation (not sent to clients)
type InternalRoom = {
  roomId: string;
  roomCode: string;
  hostPlayerId: string;
  players: RoomPlayer[];
  socketIds: Map<string, string>; // playerId → socketId
  status: RoomStatus;
  gameState: GameState | null;
  rollOffData: RollOffData | null;
  createdAt: number;
  lastActivityAt: number;
  maxPlayers: number;
  tradeDraft: TradeDraftState | null;
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
    const ro = room.rollOffData;
    const rollOff = ro
      ? {
          round: ro.currentRound,
          rollingThisRound: ro.rollingThisRound,
          pendingPlayerIds: ro.rollingThisRound.filter((id) => !(id in ro.roundRolls)),
          rolls: ro.roundRolls,
          resolvedOrder: ro.resolvedOrder,
        }
      : null;
    return {
      roomCode: room.roomCode,
      status: room.status,
      players: room.players,
      maxPlayers: room.maxPlayers,
      takenTokens: room.players.filter((p) => p.connected).map((p) => p.token),
      rollOff,
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
      rollOffData: null,
      createdAt: now,
      lastActivityAt: now,
      maxPlayers: MAX_PLAYERS,
      tradeDraft: null,
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

    // Cannot join as a new player once roll-off or game is underway
    if (room.status === "rollOff" || room.status === "inGame" || room.status === "gameOver") {
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

  // ── Roll-off ──────────────────────────────────────────────────────────────

  /** Host triggers the roll-off phase. All active players must roll for turn order. */
  startRollOff(roomCode: string, playerId: string, rules?: GameRules): RoomResult<RoomPublicView> {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found." };
    if (room.hostPlayerId !== playerId) return { ok: false, error: "Only the host can start the game." };
    if (room.status !== "lobby") return { ok: false, error: "Game is not in lobby state." };

    const activePlayers = room.players.filter((p) => p.connected);
    if (activePlayers.length < 2) return { ok: false, error: "Need at least 2 players to start." };
    if (activePlayers.length > MAX_PLAYERS) return { ok: false, error: "Too many players." };

    const participantIds = activePlayers.map((p) => p.playerId);
    room.rollOffData = {
      rules: rules ?? DEFAULT_RULES,
      agenda: [{ kind: "tied", playerIds: participantIds }],
      currentRound: 1,
      rollingThisRound: participantIds,
      roundRolls: {},
      resolvedOrder: null,
    };
    room.status = "rollOff";
    this.touch(room);
    return { ok: true, value: this.toPublicView(room) };
  }

  /** A player rolls their dice for the roll-off. Server generates the dice value. */
  applyRollOffRoll(
    roomCode: string,
    playerId: string,
    dice: RollOffEntry,
  ): RoomResult<{ room: RoomPublicView; gameState: GameState | null }> {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found." };
    if (room.status !== "rollOff") return { ok: false, error: "Roll-off is not in progress." };
    const ro = room.rollOffData;
    if (!ro) return { ok: false, error: "No roll-off data." };
    if (ro.resolvedOrder) return { ok: false, error: "Roll-off is already complete." };

    // Validate the player belongs to the current rolling group
    if (!ro.rollingThisRound.includes(playerId)) {
      return { ok: false, error: "You are not in the current roll-off group." };
    }
    if (playerId in ro.roundRolls) {
      return { ok: false, error: "You have already rolled this round." };
    }

    ro.roundRolls[playerId] = dice;
    this.touch(room);

    // Check if the entire current group has rolled
    const allRolled = ro.rollingThisRound.every((id) => id in ro.roundRolls);
    if (!allRolled) {
      return { ok: true, value: { room: this.toPublicView(room), gameState: null } };
    }

    // Advance the agenda with this round's results
    const isFirstRound = ro.currentRound === 1;
    const newAgenda: RollOffAgendaItem[] = isFirstRound
      ? buildInitialAgenda(ro.rollingThisRound, ro.roundRolls)
      : advanceRollOffAgenda(ro.agenda, ro.roundRolls);

    if (isAgendaResolved(newAgenda)) {
      // All done — create the game with sorted players
      const resolvedOrder = flattenAgenda(newAgenda);
      ro.resolvedOrder = resolvedOrder;
      ro.agenda = newAgenda;

      const resolvedPlayers = resolvedOrder
        .map((id) => room.players.find((p) => p.playerId === id))
        .filter(Boolean) as RoomPlayer[];

      const startPlayers = resolvedPlayers.map((p) => ({
        id: p.playerId,
        name: p.displayName,
        token: p.token,
        tokenLabel: p.tokenLabel,
        color: p.color,
      }));

      const gameState = createInitialGameState(startPlayers, ro.rules);
      room.gameState = gameState;
      room.status = "inGame";
      this.touch(room);

      return { ok: true, value: { room: this.toPublicView(room), gameState } };
    }

    // Ties remain — advance to next round
    const nextGroup = getCurrentRollingGroup(newAgenda);
    ro.agenda = newAgenda;
    ro.currentRound += 1;
    ro.rollingThisRound = nextGroup;
    ro.roundRolls = {};

    return { ok: true, value: { room: this.toPublicView(room), gameState: null } };
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
      actorId = gs.auction.activePlayerIds[gs.auction.currentBidderIndex];
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
        // During bankruptcyPending, only the debtor may propose; otherwise only the current player
        const expectedProposerId =
          gs.phase === "bankruptcyPending" && gs.bankruptcy
            ? gs.bankruptcy.debtorPlayerId
            : actorId;
        if (playerId !== expectedProposerId) {
          return { ok: false, error: gs.phase === "bankruptcyPending" ? "Only the debtor can propose a trade during bankruptcy." : "Only the current player can propose a trade." };
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

    // Safety guard: no player should ever have negative cash after any action
    const negativeCashPlayer = newState.players.find((p) => !p.isBankrupt && p.cash < 0);
    if (negativeCashPlayer) {
      console.error(
        `[RoomManager] BUG: Player ${negativeCashPlayer.name} has negative cash ($${negativeCashPlayer.cash}) after action ${action.type}. Rejecting.`,
      );
      // Do not persist the bad state
      return { ok: false, error: "Internal error: negative cash detected. Please report this bug." };
    }

    room.gameState = newState;
    this.touch(room);

    // Drop a stale draft if the turn/phase moved on without it being submitted.
    if (room.tradeDraft && room.tradeDraft.proposerId !== this.expectedProposerId(newState)) {
      room.tradeDraft = null;
    }

    return { ok: true, value: newState };
  }

  // ── Live trade draft (room-level, ephemeral) ──────────────────────────────
  // The draft is never trusted from the client's claimed identity — every
  // method below takes the server-resolved `playerId` (looked up from the
  // socket) and re-derives the expected proposer from game state itself.

  private expectedProposerId(gs: GameState): string {
    return gs.phase === "bankruptcyPending" && gs.bankruptcy
      ? gs.bankruptcy.debtorPlayerId
      : gs.players[gs.currentPlayerIndex].id;
  }

  startTradeDraft(roomCode: string, playerId: string, recipientId: string): RoomResult<TradeDraftState> {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found." };
    if (!room.gameState) return { ok: false, error: "No game in progress." };
    const gs = room.gameState;

    const expected = this.expectedProposerId(gs);
    if (playerId !== expected) {
      return { ok: false, error: "Only the current player can start a trade." };
    }
    if (gs.trade) return { ok: false, error: "A trade is already pending." };
    if (room.tradeDraft) return { ok: false, error: "A trade draft is already in progress." };
    const recipient = gs.players.find((p) => p.id === recipientId);
    if (!recipient || recipient.isBankrupt || recipient.id === playerId) {
      return { ok: false, error: "Invalid trade recipient." };
    }

    const draft: TradeDraftState = {
      proposerId: playerId,
      recipientId,
      offerFromProposer: { ...EMPTY_TRADE_OFFER },
      offerFromRecipient: { ...EMPTY_TRADE_OFFER },
      updatedAt: Date.now(),
    };
    room.tradeDraft = draft;
    this.touch(room);
    return { ok: true, value: draft };
  }

  updateTradeDraft(
    roomCode: string,
    playerId: string,
    patch: { recipientId?: string; offerFromProposer?: TradeOffer; offerFromRecipient?: TradeOffer },
  ): RoomResult<TradeDraftState> {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found." };
    if (!room.tradeDraft) return { ok: false, error: "No trade draft in progress." };
    if (room.tradeDraft.proposerId !== playerId) {
      return { ok: false, error: "Only the proposer can edit this trade draft." };
    }

    const next: TradeDraftState = {
      ...room.tradeDraft,
      recipientId: patch.recipientId ?? room.tradeDraft.recipientId,
      offerFromProposer: patch.offerFromProposer ?? room.tradeDraft.offerFromProposer,
      offerFromRecipient: patch.offerFromRecipient ?? room.tradeDraft.offerFromRecipient,
      updatedAt: Date.now(),
    };
    room.tradeDraft = next;
    this.touch(room);
    return { ok: true, value: next };
  }

  cancelTradeDraft(roomCode: string, playerId: string): RoomResult<null> {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found." };
    if (!room.tradeDraft) return { ok: true, value: null };
    if (room.tradeDraft.proposerId !== playerId) {
      return { ok: false, error: "Only the proposer can cancel this trade draft." };
    }
    room.tradeDraft = null;
    this.touch(room);
    return { ok: true, value: null };
  }

  submitTradeDraft(roomCode: string, playerId: string): RoomResult<GameState> {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: "Room not found." };
    if (!room.tradeDraft) return { ok: false, error: "No trade draft in progress." };
    if (room.tradeDraft.proposerId !== playerId) {
      return { ok: false, error: "Only the proposer can submit this trade draft." };
    }
    if (!room.gameState) return { ok: false, error: "No game in progress." };

    const draft = room.tradeDraft;
    const check = validateTrade(
      room.gameState,
      draft.proposerId,
      draft.recipientId,
      draft.offerFromProposer,
      draft.offerFromRecipient,
    );
    if (!check.ok) return { ok: false, error: check.reason };

    const result = this.applyGameAction(
      roomCode,
      playerId,
      {
        type: "PROPOSE_TRADE",
        initiatorId: draft.proposerId,
        recipientId: draft.recipientId,
        offerFromInitiator: draft.offerFromProposer,
        offerFromRecipient: draft.offerFromRecipient,
      },
      null,
    );
    if (!result.ok) return result;

    room.tradeDraft = null;
    return result;
  }

  getTradeDraft(roomCode: string): TradeDraftState | null {
    return this.rooms.get(roomCode)?.tradeDraft ?? null;
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

  cleanupInactive(): string[] {
    const cutoff = Date.now() - INACTIVITY_TTL_MS;
    const removedCodes: string[] = [];
    for (const [code, room] of this.rooms) {
      if (room.lastActivityAt < cutoff) {
        this.rooms.delete(code);
        removedCodes.push(code);
      }
    }
    return removedCodes;
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
