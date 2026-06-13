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
} from "../src/types/multiplayer.js";

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
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsCheck,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const rooms = new RoomManager();

// ── Inactivity cleanup every 5 minutes ───────────────────────────────────────
setInterval(() => {
  const removed = rooms.cleanupInactive();
  if (removed > 0) console.log(`[cleanup] Removed ${removed} inactive room(s).`);
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
