import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { RoomManager } from "../src/lib/multiplayer/rooms.js";
import { rollDice } from "../src/lib/game/dice.js";
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  GameActionPayload,
} from "../src/types/multiplayer.js";

const PORT = Number(process.env.PORT ?? 3001);
// Explicit CLIENT_ORIGIN env restricts CORS to a single origin (e.g. in production).
// When absent, the LAN-aware check below allows localhost and private IP ranges.
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? null;

// Allow localhost, 127.x, and RFC-1918 private IP ranges so phones/tablets on the
// same Wi-Fi can connect without having to know the host's IP in advance.
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // no-origin requests (server-to-server, curl, etc.)
  if (CLIENT_ORIGIN) return origin === CLIENT_ORIGIN;
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
    origin,
  );
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: isAllowedOrigin,
    methods: ["GET", "POST"],
  },
});

const rooms = new RoomManager();

// ── Inactivity cleanup every 5 minutes ───────────────────────────────────────
setInterval(() => {
  const removed = rooms.cleanupInactive();
  if (removed > 0) console.log(`[cleanup] Removed ${removed} inactive room(s).`);
}, 5 * 60 * 1000);

// ── Health check endpoint ─────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", rooms: rooms.roomCount });
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

  // ── room:startGame ───────────────────────────────────────────────────────
  socket.on("room:startGame", () => {
    try {
      const roomCode = rooms.getRoomCodeBySocketId(socket.id);
      const playerId = rooms.getPlayerIdBySocketId(socket.id);
      if (!roomCode || !playerId) {
        socket.emit("game:error", { message: "Not in a room." });
        return;
      }

      const result = rooms.startGame(roomCode, playerId);
      if (!result.ok) {
        socket.emit("game:error", { message: result.error });
        return;
      }

      const { room, gameState } = result.value;
      io.to(roomCode).emit("room:update", { room });
      io.to(roomCode).emit("game:state", { gameState });
      console.log(`[room] game started in ${roomCode}`);
    } catch (err) {
      console.error("[room:startGame] error:", err);
      socket.emit("game:error", { message: "Failed to start game." });
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
      console.log(`[game] ${action.type} by ${playerId} in ${roomCode}`);
    } catch (err) {
      console.error("[game:action] error:", err);
      socket.emit("game:error", { message: "Failed to apply game action." });
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

// Bind to 0.0.0.0 so the server is reachable from phones/tablets on the same LAN.
// On localhost-only runs this is harmless; firewall settings control external access.
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] World Cities multiplayer server running on port ${PORT}`);
  if (CLIENT_ORIGIN) {
    console.log(`[server] CORS restricted to ${CLIENT_ORIGIN}`);
  } else {
    console.log(`[server] CORS: localhost + private LAN IPs allowed (dev mode)`);
  }
});
