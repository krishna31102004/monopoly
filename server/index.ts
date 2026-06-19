import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { RoomManager } from "../src/lib/multiplayer/rooms.js";
import { rollDice } from "../src/lib/game/dice.js";
import { parseAllowedOrigins, isAllowedOrigin } from "./corsHelpers.js";
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  GameActionPayload,
  TradeDraftStartPayload,
  TradeDraftUpdatePayload,
} from "../src/types/multiplayer.js";
import type { GameRules, GameState } from "../src/types/game.js";

const PORT = Number(process.env.PORT ?? 3001);
const NODE_ENV = process.env.NODE_ENV ?? "development";

const allowedOrigins = parseAllowedOrigins();

// Socket.IO (via the 'cors' package) calls origin as a Node-style callback:
// (origin, callback) => void. A plain boolean-returning function would leave
// the callback uncalled and cause every Socket.IO polling request to hang.
function corsCheck(
  origin: string | undefined,
  callback: (err: Error | null, allow: boolean) => void,
): void {
  callback(null, isAllowedOrigin(origin, allowedOrigins));
}

const app = express();

// Express CORS middleware — covers HTTP routes like /room/:code that the browser
// fetches directly (e.g. token-preview before joining). Socket.IO has its own
// CORS config below; both use the same allowed-origins logic.
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  if (isAllowedOrigin(origin, allowedOrigins)) {
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsCheck,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const rooms = new RoomManager();

// ── Auction turn timers (server-authoritative) ───────────────────────────────
const auctionTimers = new Map<string, NodeJS.Timeout>();

function clearAuctionTimer(roomCode: string): void {
  const existing = auctionTimers.get(roomCode);
  if (existing) {
    clearTimeout(existing);
    auctionTimers.delete(roomCode);
  }
}

function scheduleAuctionTimer(roomCode: string, gameState: GameState): void {
  clearAuctionTimer(roomCode);
  if (gameState.phase !== "auction" || !gameState.auction) return;

  const auction = gameState.auction;
  const delay = Math.max(0, auction.turnDeadlineAt - Date.now());
  const bidderId = auction.activePlayerIds[auction.currentBidderIndex];

  const timer = setTimeout(() => {
    // Guard against a stale timer firing after the auction state has already moved on.
    const latest = rooms.getGameState(roomCode);
    if (!latest || latest.phase !== "auction" || !latest.auction) return;
    if (latest.auction.turnDeadlineAt !== auction.turnDeadlineAt) return;

    const result = rooms.applyGameAction(roomCode, bidderId, { type: "PASS_AUCTION" }, null);
    if (result.ok) {
      io.to(roomCode).emit("game:state", { gameState: result.value });
      console.log(`[auction] auto-passed ${bidderId} in ${roomCode} (timeout)`);
      scheduleAuctionTimer(roomCode, result.value);
    }
  }, delay);

  auctionTimers.set(roomCode, timer);
}

// ── Inactivity cleanup every 5 minutes ───────────────────────────────────────
setInterval(() => {
  const removedCodes = rooms.cleanupInactive();
  for (const code of removedCodes) clearAuctionTimer(code);
  if (removedCodes.length > 0) console.log(`[cleanup] Removed ${removedCodes.length} inactive room(s).`);
}, 5 * 60 * 1000);

// ── HTTP routes ───────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "worldcities-monopoly-server",
    health: "/health",
    socket: "/socket.io",
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, status: "healthy", rooms: rooms.roomCount, env: NODE_ENV });
});

// Lightweight room preview — lets the join form show taken tokens before joining
app.get("/room/:code", (req, res) => {
  const room = rooms.getRoom(req.params.code.toUpperCase());
  if (!room) { res.status(404).json({ ok: false, error: "Room not found" }); return; }
  res.json({ ok: true, takenTokens: room.takenTokens, playerCount: room.players.filter(p => p.connected).length });
});

// ── Socket.IO event handlers ──────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  // ── room:create ─────────────────────────────────────────────────────────
  socket.on("room:create", (payload: CreateRoomPayload) => {
    try {
      if (!payload?.displayName?.trim()) {
        socket.emit("game:error", { message: "Display name is required." });
        return;
      }
      const { playerId, room } = rooms.createRoom(payload, socket.id);
      socket.join(room.roomCode);
      socket.emit("room:created", { playerId, room });
      console.log(`[room] created ${room.roomCode} by ${payload.displayName}`);
    } catch (err) {
      console.error("[room:create] error:", err);
      socket.emit("game:error", { message: "Failed to create room." });
    }
  });

  // ── room:join ────────────────────────────────────────────────────────────
  socket.on("room:join", (payload: JoinRoomPayload) => {
    try {
      const result = rooms.joinRoom(payload, socket.id);
      if (!result.ok) {
        socket.emit("game:error", { message: result.error });
        return;
      }
      const { playerId, room } = result.value;
      socket.join(room.roomCode);
      socket.emit("room:joined", { playerId, room });
      // Notify all others in room of updated lobby
      socket.to(room.roomCode).emit("room:update", { room });
      io.to(room.roomCode).emit("player:connected", {
        playerId,
        displayName: room.players.find((p) => p.playerId === playerId)?.displayName ?? "",
      });
      console.log(`[room] ${payload.displayName} joined ${room.roomCode}`);

      // If game in progress, send current game state to reconnecting player
      const gameState = rooms.getGameState(room.roomCode);
      if (gameState) {
        socket.emit("game:state", { gameState });
      }
      const draft = rooms.getTradeDraft(room.roomCode);
      if (draft) {
        socket.emit("trade:draftState", { draft });
      }
    } catch (err) {
      console.error("[room:join] error:", err);
      socket.emit("game:error", { message: "Failed to join room." });
    }
  });

  // ── room:leave ───────────────────────────────────────────────────────────
  socket.on("room:leave", () => {
    const roomCode = rooms.getRoomCodeBySocketId(socket.id);
    const playerId = rooms.getPlayerIdBySocketId(socket.id);
    if (roomCode && playerId) {
      rooms.playerLeft(roomCode, playerId);
      const room = rooms.getRoom(roomCode);
      if (room) {
        io.to(roomCode).emit("room:update", { room });
      }
      socket.leave(roomCode);
    }
  });

  // ── room:startGame ── now starts the roll-off phase ─────────────────────
  socket.on("room:startGame", (payload?: { rules?: GameRules }) => {
    try {
      const roomCode = rooms.getRoomCodeBySocketId(socket.id);
      const playerId = rooms.getPlayerIdBySocketId(socket.id);
      if (!roomCode || !playerId) {
        socket.emit("game:error", { message: "Not in a room." });
        return;
      }

      const result = rooms.startRollOff(roomCode, playerId, payload?.rules);
      if (!result.ok) {
        socket.emit("game:error", { message: result.error });
        return;
      }

      io.to(roomCode).emit("room:update", { room: result.value });
      console.log(`[room] roll-off started in ${roomCode}`);
    } catch (err) {
      console.error("[room:startGame] error:", err);
      socket.emit("game:error", { message: "Failed to start game." });
    }
  });

  // ── rolloff:roll ─────────────────────────────────────────────────────────
  socket.on("rolloff:roll", () => {
    try {
      const roomCode = rooms.getRoomCodeBySocketId(socket.id);
      const playerId = rooms.getPlayerIdBySocketId(socket.id);
      if (!roomCode || !playerId) {
        socket.emit("game:error", { message: "Not in a room." });
        return;
      }

      // Server generates dice — clients never supply values
      const d = rollDice();
      const dice = { die1: d.die1, die2: d.die2, total: d.die1 + d.die2 };
      const result = rooms.applyRollOffRoll(roomCode, playerId, dice);
      if (!result.ok) {
        socket.emit("game:error", { message: result.error });
        return;
      }

      io.to(roomCode).emit("room:update", { room: result.value.room });
      if (result.value.room.rollOff?.gameReady) {
        console.log(`[room] roll-off resolved, awaiting host begin in ${roomCode}`);
      }
    } catch (err) {
      console.error("[rolloff:roll] error:", err);
      socket.emit("game:error", { message: "Failed to apply roll-off roll." });
    }
  });

  // ── rolloff:beginGame ─────────────────────────────────────────────────────
  socket.on("rolloff:beginGame", () => {
    try {
      const roomCode = rooms.getRoomCodeBySocketId(socket.id);
      const playerId = rooms.getPlayerIdBySocketId(socket.id);
      if (!roomCode || !playerId) {
        socket.emit("game:error", { message: "Not in a room." });
        return;
      }

      const result = rooms.beginRollOffGame(roomCode, playerId);
      if (!result.ok) {
        socket.emit("game:error", { message: result.error });
        return;
      }

      io.to(roomCode).emit("room:update", { room: result.value.room });
      io.to(roomCode).emit("game:state", { gameState: result.value.gameState });
      scheduleAuctionTimer(roomCode, result.value.gameState);
      console.log(`[room] roll-off game begun in ${roomCode}`);
    } catch (err) {
      console.error("[rolloff:beginGame] error:", err);
      socket.emit("game:error", { message: "Failed to begin game." });
    }
  });

  // ── game:action ──────────────────────────────────────────────────────────
  socket.on("game:action", (payload: GameActionPayload) => {
    try {
      const { playerId, action } = payload ?? {};
      if (!playerId || !action?.type) {
        socket.emit("game:error", { message: "Malformed action payload." });
        return;
      }

      const roomCode = rooms.getRoomCodeBySocketId(socket.id);
      if (!roomCode) {
        socket.emit("game:error", { message: "Not in a room." });
        return;
      }

      // Roll dice server-side for dice actions
      const needsDice = action.type === "ROLL_DICE" || action.type === "ROLL_IN_JAIL";
      const serverDice = needsDice ? rollDice() : null;

      const result = rooms.applyGameAction(roomCode, playerId, action, serverDice);
      if (!result.ok) {
        socket.emit("game:error", { message: result.error });
        return;
      }

      // Broadcast updated state to all players in the room
      io.to(roomCode).emit("game:state", { gameState: result.value });
      scheduleAuctionTimer(roomCode, result.value);
      console.log(`[game] ${action.type} by ${playerId} in ${roomCode}`);
    } catch (err) {
      console.error("[game:action] error:", err);
      socket.emit("game:error", { message: "Failed to apply game action." });
    }
  });

  // ── trade:draftStart ─────────────────────────────────────────────────────
  // The server never trusts a client-supplied actor id — playerId is resolved
  // from the socket's room membership, just like every other action.
  socket.on("trade:draftStart", (payload: TradeDraftStartPayload) => {
    try {
      const roomCode = rooms.getRoomCodeBySocketId(socket.id);
      const playerId = rooms.getPlayerIdBySocketId(socket.id);
      if (!roomCode || !playerId) {
        socket.emit("game:error", { message: "Not in a room." });
        return;
      }
      const result = rooms.startTradeDraft(roomCode, playerId, payload?.recipientId);
      if (!result.ok) {
        socket.emit("game:error", { message: result.error });
        return;
      }
      io.to(roomCode).emit("trade:draftState", { draft: result.value });
    } catch (err) {
      console.error("[trade:draftStart] error:", err);
      socket.emit("game:error", { message: "Failed to start trade draft." });
    }
  });

  // ── trade:draftUpdate ────────────────────────────────────────────────────
  socket.on("trade:draftUpdate", (payload: TradeDraftUpdatePayload) => {
    try {
      const roomCode = rooms.getRoomCodeBySocketId(socket.id);
      const playerId = rooms.getPlayerIdBySocketId(socket.id);
      if (!roomCode || !playerId) {
        socket.emit("game:error", { message: "Not in a room." });
        return;
      }
      const result = rooms.updateTradeDraft(roomCode, playerId, payload ?? {});
      if (!result.ok) {
        socket.emit("game:error", { message: result.error });
        return;
      }
      io.to(roomCode).emit("trade:draftState", { draft: result.value });
    } catch (err) {
      console.error("[trade:draftUpdate] error:", err);
      socket.emit("game:error", { message: "Failed to update trade draft." });
    }
  });

  // ── trade:draftCancel ────────────────────────────────────────────────────
  socket.on("trade:draftCancel", () => {
    try {
      const roomCode = rooms.getRoomCodeBySocketId(socket.id);
      const playerId = rooms.getPlayerIdBySocketId(socket.id);
      if (!roomCode || !playerId) {
        socket.emit("game:error", { message: "Not in a room." });
        return;
      }
      // If a counter-trade was in progress, also clear it from game state.
      const gs = rooms.getGameState(roomCode);
      const hadCounter = gs?.counterTrade != null;
      const result = rooms.cancelTradeDraft(roomCode, playerId);
      if (!result.ok) {
        socket.emit("game:error", { message: result.error });
        return;
      }
      io.to(roomCode).emit("trade:draftState", { draft: null });
      if (hadCounter) {
        const cancelResult = rooms.applyGameAction(roomCode, playerId, { type: "CANCEL_COUNTER_TRADE" }, null);
        if (cancelResult.ok) {
          io.to(roomCode).emit("game:state", { gameState: cancelResult.value });
        }
      }
    } catch (err) {
      console.error("[trade:draftCancel] error:", err);
      socket.emit("game:error", { message: "Failed to cancel trade draft." });
    }
  });

  // ── trade:counter ────────────────────────────────────────────────────────
  // Recipient of a pending offer clicks Counter Offer: clears the pending
  // trade, flips proposer/recipient, and starts an empty counter draft.
  socket.on("trade:counter", () => {
    try {
      const roomCode = rooms.getRoomCodeBySocketId(socket.id);
      const playerId = rooms.getPlayerIdBySocketId(socket.id);
      if (!roomCode || !playerId) {
        socket.emit("game:error", { message: "Not in a room." });
        return;
      }
      // Dispatch COUNTER_TRADE — clears pending trade, sets counterTrade in game state.
      const counterResult = rooms.applyGameAction(roomCode, playerId, { type: "COUNTER_TRADE" }, null);
      if (!counterResult.ok) {
        socket.emit("game:error", { message: counterResult.error });
        return;
      }
      const newGs = counterResult.value;
      if (!newGs.counterTrade) {
        socket.emit("game:error", { message: "Counter trade state missing after action." });
        return;
      }
      // Start an empty draft for the counter-proposer (the original recipient).
      const draftResult = rooms.startCounterTradeDraft(
        roomCode,
        newGs.counterTrade.allowedProposerId,
        newGs.counterTrade.allowedRecipientId,
      );
      // Broadcast updated game state (pending trade cleared) + new draft.
      io.to(roomCode).emit("game:state", { gameState: newGs });
      io.to(roomCode).emit("trade:draftState", { draft: draftResult.ok ? draftResult.value : null });
      console.log(`[trade] counter by ${playerId} in ${roomCode}`);
    } catch (err) {
      console.error("[trade:counter] error:", err);
      socket.emit("game:error", { message: "Failed to start counter-offer." });
    }
  });

  // ── trade:draftSubmit ────────────────────────────────────────────────────
  socket.on("trade:draftSubmit", () => {
    try {
      const roomCode = rooms.getRoomCodeBySocketId(socket.id);
      const playerId = rooms.getPlayerIdBySocketId(socket.id);
      if (!roomCode || !playerId) {
        socket.emit("game:error", { message: "Not in a room." });
        return;
      }
      const result = rooms.submitTradeDraft(roomCode, playerId);
      if (!result.ok) {
        socket.emit("game:error", { message: result.error });
        return;
      }
      io.to(roomCode).emit("trade:draftState", { draft: null });
      io.to(roomCode).emit("game:state", { gameState: result.value });
      console.log(`[trade] draft submitted by ${playerId} in ${roomCode}`);
    } catch (err) {
      console.error("[trade:draftSubmit] error:", err);
      socket.emit("game:error", { message: "Failed to submit trade draft." });
    }
  });

  // ── room:reconnect ───────────────────────────────────────────────────────
  // Explicit reconnect event: client sends saved identity to re-attach to a room.
  socket.on(
    "room:reconnect",
    (payload: { roomCode: string; playerId: string; displayName: string; token: string; tokenLabel: string; color: string }) => {
      try {
        if (!payload?.roomCode || !payload?.playerId) {
          socket.emit("game:error", { message: "Missing reconnect identity." });
          return;
        }
        const result = rooms.joinRoom(
          {
            roomCode: payload.roomCode,
            playerId: payload.playerId,
            displayName: payload.displayName,
            token: payload.token as import("../src/types/player.js").PlayerToken,
            tokenLabel: payload.tokenLabel,
            color: payload.color,
          },
          socket.id,
        );
        if (!result.ok) {
          socket.emit("game:error", { message: result.error });
          return;
        }
        const { room } = result.value;
        socket.join(room.roomCode);
        socket.emit("room:joined", { playerId: payload.playerId, room });
        socket.to(room.roomCode).emit("room:update", { room });
        io.to(room.roomCode).emit("player:connected", {
          playerId: payload.playerId,
          displayName: payload.displayName,
        });
        const gameState = rooms.getGameState(room.roomCode);
        if (gameState) socket.emit("game:state", { gameState });
        console.log(`[room] ${payload.displayName} reconnected to ${room.roomCode}`);
      } catch (err) {
        console.error("[room:reconnect] error:", err);
        socket.emit("game:error", { message: "Reconnect failed." });
      }
    },
  );

  // ── room:requestSync ─────────────────────────────────────────────────────
  socket.on("room:requestSync", () => {
    const roomCode = rooms.getRoomCodeBySocketId(socket.id);
    if (!roomCode) {
      socket.emit("game:error", { message: "Not in a room." });
      return;
    }
    const room = rooms.getRoom(roomCode);
    if (room) socket.emit("room:update", { room });
    const gameState = rooms.getGameState(roomCode);
    if (gameState) socket.emit("game:state", { gameState });
    const draft = rooms.getTradeDraft(roomCode);
    if (draft) socket.emit("trade:draftState", { draft });
  });

  // ── game:requestSync ─────────────────────────────────────────────────────
  socket.on("game:requestSync", () => {
    const roomCode = rooms.getRoomCodeBySocketId(socket.id);
    if (!roomCode) {
      socket.emit("game:error", { message: "Not in a room." });
      return;
    }
    const gameState = rooms.getGameState(roomCode);
    if (gameState) {
      socket.emit("game:state", { gameState });
    } else {
      socket.emit("game:error", { message: "No game in progress." });
    }
  });

  // ── disconnect ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const info = rooms.playerDisconnected(socket.id);
    if (info) {
      const room = rooms.getRoom(info.roomCode);
      if (room) {
        io.to(info.roomCode).emit("room:update", { room });
        io.to(info.roomCode).emit("player:disconnected", {
          playerId: info.playerId,
          displayName: info.displayName,
        });
      }
      console.log(`[socket] ${info.displayName} disconnected from ${info.roomCode}`);
    }
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

// Bind to 0.0.0.0 so the server is reachable from phones/tablets on the same LAN
// and from Render/Railway/Fly.io which expect the process to bind all interfaces.
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] World Cities multiplayer server`);
  console.log(`[server] env=${NODE_ENV}  port=${PORT}`);
  if (allowedOrigins) {
    console.log(`[server] CORS allowlist: ${allowedOrigins.join(", ")}`);
  } else {
    console.log(`[server] CORS: dev mode — localhost + private LAN IPs`);
  }
});
