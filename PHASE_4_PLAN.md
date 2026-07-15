# Phase 4: Private Friends-Only Multiplayer Architecture

## Phase 4L — Premium Trade Negotiation Experience

Trade keeps its existing authoritative state machine and creditor-protected rules while using a dark navy/indigo negotiation shell. Metallic gold identifies primary trade actions; player and property colours remain factual identity accents. Draft, offer review, and debt-resolution modes use the same trade data and validation paths on desktop and mobile.

## Phase 4K — Creditor-Protected Debt Resolution Trading

When `bankruptcyPending` records a mandatory payment that the debtor cannot yet afford, trade validation switches from normal negotiation to debt resolution. A debtor may either transfer legally tradeable non-cash assets for incoming cash, or make a zero-cash asset-for-asset restructuring swap. Restructuring requires assets from both sides and may not reduce the protected recovery floor: the lesser of the debt and the debtor's guaranteed legal liquidation capacity before the swap. No speculative market or future-trade value is counted. Each proposal and acceptance is validated against projected legal liquidation (cash, legally sellable buildings, then eligible mortgages). The original creditor, amount, continuation and destination remain unchanged. Normal trading rejects empty and cash-only offers. This validation is shared by the reducer and RoomManager.

## Status: Phase 4C.1 COMPLETE (4A = planning, 4B.1 = room/lobby, 4B.2 = gameplay actions, 4B.3 = reconnect/LAN/QA, 4C.1 = deployment readiness)

---

## Phase 4C.1 — Deployment Readiness Status

### What was prepared

Full deployment readiness for Vercel (frontend) + Render (Socket.IO backend) without actual deployment.

### Deployment model

| Service | Host | Config |
|---|---|---|
| Next.js frontend | Vercel | Auto-deploys from `github.com/krishna31102004/monopoly` |
| Socket.IO server | Render | `render.yaml` Blueprint in repo root |

### GitHub repo

`https://github.com/krishna31102004/monopoly`

### Config files added

| File | Purpose |
|---|---|
| `render.yaml` | Render Blueprint — automates backend service creation |
| `DEPLOYMENT.md` | Full deployment guide with smoke test checklist |
| `server/corsHelpers.ts` | Pure CORS functions extracted from server for testability |
| `.env.example` | Updated with all env vars for local/LAN/production scenarios |

### Server changes

- Extracted `parseAllowedOrigins()` and `isAllowedOrigin()` into `server/corsHelpers.ts` (pure, side-effect-free, unit-testable).
- `server/index.ts` imports from `corsHelpers.ts`.
- Added `CLIENT_ORIGINS` env var support (comma-separated, takes priority over `CLIENT_ORIGIN`).
- Health endpoint now returns `{ ok: true, status: "healthy", rooms: N, env: "production" }`.
- Improved startup logging: shows port, env, and CORS mode.

### Env vars documented

**Vercel (frontend):** `NEXT_PUBLIC_SOCKET_URL`
**Render (backend):** `NODE_ENV`, `CLIENT_ORIGIN`, `CLIENT_ORIGINS` (optional), `PORT` (injected by platform)

### Tests added

`src/__tests__/deploymentConfig.test.ts` — 31 tests covering:
- `isAllowedOrigin` in dev mode (LAN IPs, localhost, blocking public IPs)
- `isAllowedOrigin` in production mode (allowlist accepts/rejects)
- `parseAllowedOrigins` env var parsing (single, multi, priority, trimming)
- `getSocketUrl` for production/local/LAN scenarios
- `render.yaml` content validation
- No public room listing exposed
- `package.json` required scripts present

### Known limitations

- Server restart loses all rooms (in-memory only).
- Render free tier sleeps after 15 min inactivity.
- No Redis adapter yet (single instance only).
- `sessionStorage` reconnect is per-tab.

### Next recommended task

**Phase 4C.2: Manual deployment and production smoke testing** — deploy the backend to Render, deploy the frontend to Vercel, set env vars, run the smoke test checklist from `DEPLOYMENT.md`.

---

## Phase 4C.2 — Manual Deployment Status

### Pre-deployment fix applied

Found and fixed a deployment blocker before attempting deployment:

- **Bug:** `render.yaml` had incorrect start command (`node --loader tsx/esm --tsconfig` is not valid node syntax; `--tsconfig` is a tsx CLI flag, not a node flag).
- **Bug:** Build command was `npm ci` — but with `NODE_ENV=production` set as a service env var on Render, `npm ci` skips devDependencies including `tsx` and `typescript`, causing start command to fail.
- **Fix:** Changed `render.yaml` build command to `npm ci --include=dev` (installs devDeps regardless of NODE_ENV) and start command to `npx tsx --tsconfig server/tsconfig.json server/index.ts`.
- **Verified locally:** Server starts, `/health` returns `{"ok":true,"status":"healthy",...}`, all 491 tests still pass.

### Deployment guide

See `DEPLOYMENT.md` for the full step-by-step manual guide including:
- Render backend setup via Blueprint or manual service
- Vercel frontend setup
- Env var configuration order
- CORS setup after both URLs are known
- Smoke test checklist

### Deployment order (critical — must follow this sequence)

1. Deploy Socket.IO backend on Render first.
2. Copy backend URL (e.g. `https://worldcities-monopoly-server.onrender.com`).
3. Set `NEXT_PUBLIC_SOCKET_URL=<backend-url>` in Vercel.
4. Deploy frontend on Vercel.
5. Copy frontend URL (e.g. `https://your-app.vercel.app`).
6. Set `CLIENT_ORIGIN=<frontend-url>` on Render backend.
7. Trigger Render redeploy/restart.
8. Run smoke tests.

### Known deployment limitations

- Render free tier sleeps after 15 min inactivity — first WebSocket connection after sleep takes 30–60 s.
- Server restart (new Render deploy) loses all active rooms — in-memory only.
- `tsx` is used at runtime on Render (JIT TypeScript compilation) — acceptable for private use; compile to JS for higher-traffic production.

### Next recommended task

**Phase 4D: production polish** — mobile UI refinements, room expiry UX ("server restarted, please create a new room"), optional QR code for invite links.

---

## Phase 4B.3 — Reconnect, LAN/Mobile Support, and Multiplayer QA

### Reconnect behavior

- On socket `connect` event, the client checks `sessionStorage` for saved identity (`wc_playerId`, `wc_roomCode`, `wc_playerName`, `wc_playerToken`, `wc_playerLabel`, `wc_playerColor`).
- If identity is found and no room is loaded yet, the client automatically emits `room:reconnect` to re-attach to the room without requiring user action.
- The server handles `room:reconnect` via the same `joinRoom` logic (passing `playerId` as reconnect hint) and re-emits current room + game state to the reconnecting socket.
- If the room no longer exists (e.g. server restarted or 2-hour inactivity cleanup), the server returns a friendly error and the user can rejoin manually.
- `sessionStorage` is cleared on explicit `leaveRoom` or `room:ended` so stale identity does not cause spurious reconnects.

### LAN/mobile support

- **Socket URL derivation:** when `NEXT_PUBLIC_SOCKET_URL` is not set, the browser derives the socket URL from its own page hostname (e.g. `http://192.168.1.25:3001`). This means phones and tablets joining via `http://MAC_IP:3000` automatically connect to the correct socket server with zero config.
- **Next.js binding:** `npm run dev:lan` binds Next.js to `0.0.0.0` so any device on the network can reach the page.
- **Socket server binding:** the server always listens on `0.0.0.0` (all interfaces). LAN devices can reach it as long as Mac firewall allows it.
- **CORS:** when `CLIENT_ORIGIN` env is not set (dev mode), the server allows `localhost`, `127.0.0.1`, and all RFC-1918 private IP ranges (`192.168.x.x`, `10.x.x.x`, `172.16–31.x.x`). When `CLIENT_ORIGIN` is set (production), only that exact origin is allowed.
- **`getSocketUrl()`** is a named export from `src/lib/socket.ts` so the URL logic can be unit tested without side effects.

### Socket URL behavior summary

| Scenario | `NEXT_PUBLIC_SOCKET_URL` | Result |
|---|---|---|
| Laptop localhost | not set | derives from `localhost` → `http://localhost:3001` |
| Laptop localhost | set to `http://localhost:3001` | uses env var |
| Phone on LAN | not set | derives from page hostname, e.g. `http://192.168.1.25:3001` |
| Production | set to `https://game.example.com:3001` | uses env var |

### Scripts added

| Script | Command | Use |
|---|---|---|
| `dev:all` | concurrently runs Next + server | laptop localhost testing |
| `dev:lan` | concurrently runs Next (0.0.0.0) + server | LAN/phone/tablet testing |

### New socket events

| Event | Direction | Purpose |
|---|---|---|
| `room:reconnect` | Client → Server | Re-attach to room with saved identity |
| `game:requestSync` | Client → Server | Request latest game state (alias for room:requestSync game portion) |

### Connection status UI

- `GameLayoutMultiplayer` now receives `connectionStatus: ConnectionStatus` prop.
- Shows an amber "Reconnecting…" banner when `status === "reconnecting"`.
- Shows a red "Disconnected" banner with a "Request Sync" button when `status === "disconnected"`.
- Turn indicator includes a "Sync" button (calls `game:requestSync`) and "Leave" link.
- `useRoom` exposes `requestGameSync` (game state only) in addition to `requestSync` (room + game).

### Tests added

- `src/__tests__/multiplayerLanConfig.test.ts` — 16 tests covering `getSocketUrl()` behavior, LAN CORS regex, and package.json script presence.
- `src/__tests__/multiplayerReconnect.test.ts` — 18 tests covering lobby reconnect, in-game reconnect, duplicate identity, request sync consistency, and public view integrity.

### Known limitations

- **Server restart loses all rooms** — in-memory only. Players must create a new room after server restarts.
- **Mac firewall** — macOS may block incoming connections on port 3000/3001. Go to System Settings → Network → Firewall → allow Node connections.
- **Same-network requirement** — LAN mode only works when all devices are on the same Wi-Fi. VPN or different subnets will not work without `CLIENT_ORIGIN` and a hosted deployment.
- **SessionStorage scope** — reconnect identity is per-tab, not per-device. Opening the game in a new tab requires rejoining manually.

### How to test with phone/tablet on the same Wi-Fi

1. Find your Mac's local IP: `System Settings → Wi-Fi → Details` or run `ipconfig getifaddr en0` in Terminal.
2. Run `nvm use 20 && npm run dev:lan` (or `NEXT_PUBLIC_SOCKET_PORT=3001 npm run dev:lan`).
3. On the phone/tablet, open `http://YOUR_MAC_IP:3000` in the browser.
4. Create a room on one device, join from the other using the displayed room code.
5. No additional config needed — the socket URL is derived from the page host automatically.

### Next recommended task

**Phase 4C: Production deployment** — containerize the server, pick a hosting provider (Railway, Fly.io, Render), set `CLIENT_ORIGIN`, `NEXT_PUBLIC_SOCKET_URL`, and deploy. Or **Phase 4D: UX polish** — QR code for invite links, sound effects, animation.

---

## 1. Goal

Turn the finished local pass-and-play World Cities game into a **private, friends-only multiplayer game** that works from any modern device — laptop, phone, or tablet — with no strangers, no public matchmaking, and no accounts required.

Up to 6 players join the same game session using a private room code. All game state is server-authoritative. The existing local reducer is reused server-side with minimal changes.

---

## 2. Non-Goals (Phase 4B scope boundary)

The following are explicitly out of scope for Phase 4B:

| Out of scope | Reason |
|---|---|
| Public matchmaking / lobby browser | Private friends-only requirement |
| Persistent accounts / login | Friends use display names only |
| Database (Postgres/Supabase) | In-memory is enough for Phase 4B |
| Redis | Not needed until horizontal scaling |
| Spectator mode beyond refresh reconnect | Adds complexity; not required |
| Chat or reactions | Post-MVP feature |
| Optional house rules toggle | Post-MVP feature |
| Paid plans / limits | Private use only |
| Admin dashboard | Not needed for friends-only use |
| Mobile app / native build | Web browser on mobile is sufficient |

---

## 3. User Flow

### 3.1 Host creates a room

```
1. Host opens the site on any device
2. Clicks "Create Private Room"
3. Server generates a room code, e.g. MEXICO-4821
4. Server generates a shareable invite link, e.g. https://game.example.com/join/MEXICO-4821
5. UI shows:
   - Room code in large text (easy to read aloud)
   - Copy invite link button
   - QR code (for phone users to scan directly)
   - Waiting lobby with the host listed
6. Host shares the room code or link with friends via any channel (WhatsApp, iMessage, etc.)
```

### 3.2 Friend joins from any device

```
1. Friend opens the invite link on laptop, phone, or tablet
   OR
   Friend goes to the site homepage and taps "Join Room"
2. Friend enters:
   - Display name (required)
   - Token (pick from available tokens)
   - Room code (pre-filled if link was used)
3. Friend taps "Join"
4. Friend appears in the lobby on all connected devices
```

### 3.3 Lobby

```
- All connected players are listed
- Each player sees their own token highlighted
- Host sees "Start Game" button (disabled until ≥2 players)
- Host sees "Remove Player" option per player
- Non-hosts see "Waiting for host to start..."
- Max 6 players; Join is rejected if room is full
- Host can click "Cancel Room" to dissolve
```

### 3.4 Game in progress

```
- All players see the same board state
- Current player's name + color is highlighted on all devices
- Only the current player sees active Roll Dice / End Turn buttons
- Non-current players see their controls as read-only or hidden
- All game log entries appear on all devices in real time
- Trade proposals are sent to the recipient; recipient sees an alert
- Bankruptcy panel shows only on the bankrupt player's device and host
- Auction bids are visible to all; bid controls visible to eligible bidders only
```

### 3.5 Reconnect / refresh

```
1. Player refreshes or loses connection
2. Server marks player as "disconnected" but keeps their state
3. Player returns to the site, enters same name + room code
4. Server matches by playerId stored in browser (sessionStorage or cookie)
5. Server sends current gameState to reconnecting client
6. Player resumes seamlessly
7. If player does not return within N minutes (e.g. 15 min), host can kick them
```

### 3.6 Game over / room end

```
1. Last player remaining wins — server broadcasts gameOver state
2. All players see the winner banner
3. Host can click "New Game" → returns all players to lobby
4. Host can click "End Room" → disconnects all players, room is destroyed
5. Room is also auto-destroyed after 2 hours of inactivity
```

---

## 4. Multiplayer UX

### 4.1 Join flow UX

| Screen | URL | Purpose |
|---|---|---|
| Home | `/` | "Create Room" + "Join Room" entry points |
| Create room | `/create` or modal | Generates code, shows QR + link |
| Join room | `/join/[code]` or `/join` | Pre-fills code from URL, asks name + token |
| Lobby | `/room/[code]` | Waiting room, player list, start button |
| Game | `/room/[code]/game` | Full game board + sidebar |
| Game over | Same URL, overlay | Winner banner + "New Game" / "End Room" |

### 4.2 Turn visibility rules

| Player type | Roll Dice | End Turn | Buy/Decline | Jail Panel | Auction Bid | Trade Controls | Bankruptcy Panel |
|---|---|---|---|---|---|---|---|
| Current player | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (if bankrupt) |
| Other players | ❌ | ❌ | ❌ | ❌ | ✅ (own bid) | ✅ (own trades) | ❌ |
| All players | View board | View log | View state | — | View bids | View accepted | View all |

### 4.3 Player identification

- Each player's browser stores a `playerId` token in `sessionStorage` on join
- Reconnect uses `playerId` + `roomCode` to re-authenticate
- No password, no login, no email
- `playerId` is a server-generated UUID, not user-controlled

---

## 5. Mobile and Responsive Multiplayer Requirements

### 5.1 Layout targets

| Breakpoint | Target devices | Layout behavior |
|---|---|---|
| `< 640px` | Phones (portrait) | Single-column; board scales to viewport width; sidebar becomes bottom panel |
| `640–1024px` | Phones (landscape), tablets | Board + compact sidebar side by side |
| `> 1024px` | Laptops, tablets (landscape) | Full two-column layout (current desktop layout) |

### 5.2 Phone-specific requirements

- **Board zoom/scroll**: Board should render at reduced scale on small screens; player can pinch-zoom or scroll. Consider a fixed mini-map or simplified board for < 640px.
- **Touch targets**: All action buttons (Roll Dice, Buy, Bid, End Turn) must be at least 44×44px on mobile.
- **Bottom action sheet**: On phones, active panels (LandingAction, Bankruptcy, Trade, Auction) should appear as a bottom sheet that slides up, not a sidebar.
- **"Your Turn" indicator**: Large, prominent toast or banner at the top of the screen when it becomes a player's turn, visible for 3–5 seconds.
- **Current player highlight**: In the player list, the active player's row is prominently highlighted on all devices.
- **QR code invite**: The room creation screen generates a QR code using a lightweight library (e.g. `qrcode` npm package). Player on a phone can scan directly without typing the code.
- **Invite link deep link**: Opening `/join/MEXICO-4821` on any device auto-populates the room code field.
- **No keyboard-heavy flows**: Beyond entering name and optional room code, all actions are tap/click-based.

### 5.3 Reconnect on mobile

- Mobile browsers may kill the WebSocket connection on sleep or app-switch
- Socket.IO automatic reconnect handles this; client re-emits `game:requestSync` on reconnect
- UI shows a "Reconnecting…" overlay on disconnect; dismisses automatically on restore

---

## 6. Server-Authoritative Design

### 6.1 Core principle

The server is the single source of truth. Clients are dumb renderers.

```
Client                           Server
──────                           ──────
User clicks "Roll Dice"  ──→    Validate: correct player? correct phase?
                                Roll dice server-side
                                Run gameReducer(state, { type: "ROLL_DICE", dice })
                                Update roomState.gameState
                         ←──    Broadcast game:state to all room clients
Client renders new state
```

### 6.2 Reusing the existing reducer

The local `gameReducer` is a pure function `(GameState, GameAction) => GameState`. It has no side effects and no I/O. It can be imported and run directly on the server with zero changes.

The one modification needed: **dice rolling is moved to the server**. The client sends `{ type: "ROLL_DICE_REQUEST" }` (no dice payload). The server generates the dice, then calls `gameReducer(state, { type: "ROLL_DICE", dice: serverRolledDice })`.

### 6.3 What the client sends (action intents)

```typescript
// Client sends INTENT, never state or dice
type ClientGameIntent =
  | { type: "ROLL_DICE_REQUEST" }          // server rolls dice
  | { type: "BUY_PROPERTY" }
  | { type: "DECLINE_PROPERTY" }
  | { type: "PLACE_BID"; amount: number }
  | { type: "PASS_AUCTION" }
  | { type: "END_TURN" }
  | { type: "PAY_JAIL_FEE" }
  | { type: "USE_JAIL_CARD" }
  | { type: "ROLL_IN_JAIL_REQUEST" }       // server rolls dice
  | { type: "BUY_HOUSE"; spaceIndex: number }
  | { type: "SELL_HOUSE"; spaceIndex: number }
  | { type: "BUY_HOTEL"; spaceIndex: number }
  | { type: "SELL_HOTEL"; spaceIndex: number }
  | { type: "MORTGAGE_PROPERTY"; spaceIndex: number }
  | { type: "UNMORTGAGE_PROPERTY"; spaceIndex: number }
  | { type: "PROPOSE_TRADE"; initiatorId: string; recipientId: string; offerFromInitiator: TradeOffer; offerFromRecipient: TradeOffer }
  | { type: "ACCEPT_TRADE" }
  | { type: "DECLINE_TRADE" }
  | { type: "CANCEL_TRADE" }
  | { type: "DECLARE_BANKRUPTCY" }
  | { type: "RESOLVE_BANKRUPTCY_IF_SOLVENT" };
```

### 6.4 Server validation before running reducer

```typescript
function validateIntent(intent: ClientGameIntent, playerId: string, room: Room): string | null {
  if (room.status !== "inGame") return "Game not in progress";
  const state = room.gameState!;
  const currentPlayer = state.players[state.currentPlayerIndex];

  // Actions that only the current player can send
  const currentPlayerOnlyActions = new Set([
    "ROLL_DICE_REQUEST", "BUY_PROPERTY", "DECLINE_PROPERTY",
    "END_TURN", "PAY_JAIL_FEE", "USE_JAIL_CARD", "ROLL_IN_JAIL_REQUEST",
    "BUY_HOUSE", "SELL_HOUSE", "BUY_HOTEL", "SELL_HOTEL",
    "MORTGAGE_PROPERTY", "UNMORTGAGE_PROPERTY",
    "DECLARE_BANKRUPTCY", "RESOLVE_BANKRUPTCY_IF_SOLVENT",
  ]);

  if (currentPlayerOnlyActions.has(intent.type)) {
    if (currentPlayer.id !== playerId) return "Not your turn";
  }

  // PLACE_BID and PASS_AUCTION: sender must be in activeBidderIds
  if (intent.type === "PLACE_BID" || intent.type === "PASS_AUCTION") {
    if (!state.auction?.activeBidderIds.includes(playerId)) return "Not an active bidder";
  }

  // PROPOSE_TRADE: sender must be initiatorId
  if (intent.type === "PROPOSE_TRADE") {
    if (intent.initiatorId !== playerId) return "Trade initiator mismatch";
  }

  if (state.phase === "gameOver") return "Game is over";

  return null; // valid
}
```

---

## 7. Room Lifecycle

### 7.1 Room state shape

```typescript
type RoomStatus = "lobby" | "inGame" | "gameOver" | "ended";

type RoomPlayer = {
  playerId: string;           // server-generated UUID
  displayName: string;
  token: PlayerToken;
  tokenLabel: string;
  color: string;
  socketId: string | null;    // null when disconnected
  connected: boolean;
  joinedAt: string;           // ISO timestamp
};

type Room = {
  roomId: string;             // internal UUID
  roomCode: string;           // e.g. "MEXICO-4821" — user-visible
  inviteLink: string;         // e.g. "https://game.example.com/join/MEXICO-4821"
  hostPlayerId: string;
  players: RoomPlayer[];      // in join order; max 6
  status: RoomStatus;
  gameState: GameState | null;// null during lobby
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  maxPlayers: number;         // 6
  takenTokens: PlayerToken[];
};
```

### 7.2 Room storage (Phase 4B)

```typescript
// In-memory Map on the server process
const rooms = new Map<string, Room>();

// Cleanup: run every 5 minutes, remove rooms inactive > 2 hours
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, room] of rooms) {
    if (new Date(room.lastActivityAt).getTime() < cutoff) {
      rooms.delete(id);
    }
  }
}, 5 * 60 * 1000);
```

**Why in-memory is enough for Phase 4B:**
- Private friend groups are small (≤6 players)
- Sessions are short (1–3 hours per game)
- Friends will reconnect quickly if the server restarts; they can just start a new room
- No need for persistence across server restarts at this scale
- Avoids database setup complexity for the first multiplayer version

**What is lost if the server restarts:** All in-progress rooms and their game state. Friends would need to start a new room. This is acceptable for a small private game.

**When to add Supabase/Postgres:** When you want games to survive server restarts, or players want to resume a game the next day. Add it in Phase 4C or later.

**When to add Redis:** When you need multiple server instances (horizontal scaling). Not needed until traffic justifies multiple Socket.IO server pods. For a friends-only game, a single server process will handle all rooms easily.

### 7.3 Room code generation

```typescript
// Option A: memorable two-word + number style
const WORD_A = ["MEXICO", "DELHI", "LONDON", "DUBAI", "TOKYO", "PARIS", "ROME", "SYDNEY"];
const WORD_B = ["GAME", "ROOM", "PLAY", "CLUB", "CITY", "TEAM", "ZONE", "CREW"];

function generateRoomCode(): string {
  const wordA = WORD_A[Math.floor(Math.random() * WORD_A.length)];
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  return `${wordA}-${num}`;  // e.g. LONDON-4821
}

// Ensure uniqueness: retry if code already taken (collision is rare)
function createUniqueRoomCode(rooms: Map<string, Room>): string {
  let code: string;
  do { code = generateRoomCode(); } while (rooms.has(code));
  return code;
}
```

---

## 8. Socket Events

### 8.1 Client → Server events

```typescript
// room:create
// Payload: host info; server creates room and returns code
socket.emit("room:create", {
  displayName: string;
  token: PlayerToken;
  tokenLabel: string;
  color: string;
});

// room:join
// Payload: join info + room code
socket.emit("room:join", {
  roomCode: string;          // e.g. "LONDON-4821"
  displayName: string;
  token: PlayerToken;
  tokenLabel: string;
  color: string;
  playerId?: string;         // present if reconnecting
});

// room:leave
// Payload: none (socket identity is sufficient)
socket.emit("room:leave");

// room:startGame
// Host only; server validates
socket.emit("room:startGame");

// room:end
// Host only; destroys room
socket.emit("room:end");

// game:action
// Sends an action intent; server validates, runs reducer, broadcasts result
socket.emit("game:action", {
  intent: ClientGameIntent;
});

// game:requestSync
// Client asks for current state (used after reconnect)
socket.emit("game:requestSync");
```

### 8.2 Server → Client events

```typescript
// room:created — sent to host after creating room
socket.emit("room:created", {
  roomCode: string;
  inviteLink: string;
  playerId: string;          // host's assigned playerId; persist in sessionStorage
  room: RoomPublicView;      // lobby-safe view of room (no internal IDs)
});

// room:joined — sent to joining player only
socket.emit("room:joined", {
  playerId: string;          // assigned playerId; persist in sessionStorage
  room: RoomPublicView;
});

// room:update — broadcast to all in room when lobby changes
io.to(roomCode).emit("room:update", {
  room: RoomPublicView;
});

// game:state — broadcast after every reducer action
io.to(roomCode).emit("game:state", {
  gameState: GameState;
});

// game:error — sent to the sender only when action is rejected
socket.emit("game:error", {
  message: string;           // human-readable rejection reason
  intent: ClientGameIntent;  // echoed back so client can clean up UI
});

// player:connected — broadcast when a player reconnects
io.to(roomCode).emit("player:connected", {
  playerId: string;
  displayName: string;
});

// player:disconnected — broadcast when a player drops
io.to(roomCode).emit("player:disconnected", {
  playerId: string;
  displayName: string;
});

// room:ended — broadcast when host ends room
io.to(roomCode).emit("room:ended", {
  reason: "host_ended" | "inactivity";
});
```

### 8.3 `RoomPublicView` shape

```typescript
type RoomPublicView = {
  roomCode: string;
  inviteLink: string;
  status: RoomStatus;
  players: Array<{
    playerId: string;
    displayName: string;
    token: PlayerToken;
    tokenLabel: string;
    color: string;
    connected: boolean;
    isHost: boolean;
  }>;
  maxPlayers: number;
  takenTokens: PlayerToken[];
};
```

---

## 9. State Synchronization

### 9.1 Full state broadcast (Phase 4B approach)

For Phase 4B, the server broadcasts the **full `GameState`** after every action. This is simple and correct:

```
Player sends game:action
→ Server validates
→ Server runs reducer: newState = gameReducer(currentState, action)
→ room.gameState = newState
→ room.updatedAt = now
→ io.to(roomCode).emit("game:state", { gameState: newState })
→ All clients replace their local state with the received state
```

**Why full broadcast is fine for Phase 4B:**
- `GameState` is a JSON object, typically 5–20 KB
- At most 6 clients per room
- Actions happen at human speed (dice rolls, button clicks)
- No need for delta sync or operational transforms at this scale

**When to switch to delta sync:** Only if games get large (many log entries, many ownerships) and bandwidth becomes measurable. Not needed for initial multiplayer.

### 9.2 Client-side state management (multiplayer mode)

In multiplayer mode, the client no longer drives state via `useReducer`. Instead:

```typescript
// Multiplayer client replaces local reducer with socket-driven state
const [gameState, setGameState] = useState<GameState | null>(null);
const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

socket.on("game:state", ({ gameState }) => {
  setGameState(gameState);
});

// Dispatch sends an intent to server, does not mutate local state
function dispatch(intent: ClientGameIntent) {
  socket.emit("game:action", { intent });
}
```

### 9.3 Optimistic updates (optional, later)

For Phase 4B: **no optimistic updates**. Client waits for server broadcast before rendering new state. This keeps the model simple and avoids conflicts.

Optimistic updates can be added in Phase 4C if latency becomes noticeable (e.g. > 300ms round-trip).

---

## 10. Reconnection Plan

### 10.1 playerId persistence

```typescript
// On room:created or room:joined, client stores playerId
sessionStorage.setItem("wc_playerId", data.playerId);
sessionStorage.setItem("wc_roomCode", data.room.roomCode);

// On page load, check for stored session
const savedPlayerId = sessionStorage.getItem("wc_playerId");
const savedRoomCode = sessionStorage.getItem("wc_roomCode");
if (savedPlayerId && savedRoomCode) {
  socket.emit("room:join", { roomCode: savedRoomCode, playerId: savedPlayerId, ... });
}
```

### 10.2 Server reconnect handling

```typescript
socket.on("room:join", (data) => {
  const room = rooms.get(data.roomCode);
  if (!room) { return socket.emit("game:error", { message: "Room not found" }); }

  // Reconnect: existing playerId
  if (data.playerId) {
    const existing = room.players.find(p => p.playerId === data.playerId);
    if (existing) {
      existing.socketId = socket.id;
      existing.connected = true;
      socket.join(data.roomCode);
      socket.emit("room:joined", { playerId: data.playerId, room: toPublicView(room) });
      if (room.gameState) {
        socket.emit("game:state", { gameState: room.gameState });
      }
      io.to(data.roomCode).emit("player:connected", { playerId: data.playerId, displayName: existing.displayName });
      return;
    }
  }

  // New player join (lobby only)
  // ... validation, add to room, broadcast room:update
});
```

### 10.3 Disconnect handling

```typescript
socket.on("disconnect", () => {
  for (const room of rooms.values()) {
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) {
      player.connected = false;
      player.socketId = null;
      io.to(room.roomCode).emit("player:disconnected", {
        playerId: player.playerId,
        displayName: player.displayName,
      });
      room.lastActivityAt = new Date().toISOString();

      // If host disconnects during lobby, promote next player or dissolve
      // If host disconnects during game, keep game paused briefly;
      // if all players disconnect, mark room inactive for cleanup
    }
  }
});
```

### 10.4 Mobile reconnect behavior

- Socket.IO's default reconnect with exponential backoff handles WiFi/LTE switching
- Client shows "Reconnecting…" overlay (non-blocking) while `socket.connected === false`
- On reconnect, client re-emits `game:requestSync` to ensure it has latest state
- If `sessionStorage` is cleared (private browsing), player must re-enter name + room code

---

## 11. Validation and Security Rules

### 11.1 Server must reject

| Condition | Rejection message |
|---|---|
| Room code not found | "Room not found" |
| Room is full (≥6 players) | "Room is full" |
| Token already taken by another player | "Token already taken" |
| Duplicate active playerId joining | "Already in this room" |
| Action from non-current player | "Not your turn" |
| Action in wrong phase | Handled by reducer returning same state |
| Invalid room code format | "Invalid room code" |
| Action after game over | "Game is over" |
| Client-supplied dice result | Intent system prevents this by design |
| game:action during lobby | "Game not in progress" |
| room:startGame from non-host | "Only the host can start the game" |
| room:startGame with < 2 players | "Need at least 2 players to start" |
| room:end from non-host | "Only the host can end the room" |

### 11.2 Dice always server-side

The client intent `ROLL_DICE_REQUEST` carries no dice payload. The server generates:

```typescript
import { rollDice } from "@/lib/game/dice"; // the existing pure function

socket.on("game:action", ({ intent }) => {
  if (intent.type === "ROLL_DICE_REQUEST") {
    const dice = rollDice(); // server-generated
    const action: GameAction = { type: "ROLL_DICE", dice };
    const newState = gameReducer(room.gameState!, action);
    // broadcast newState
  }
});
```

### 11.3 Rate limiting (Phase 4B: simple)

- No more than 1 action per player per 100ms (drop extra events with no error)
- No more than 10 room:create per IP per minute (simple in-memory counter)
- Socket.IO built-in connection limits can be set for the server

### 11.4 Privacy

- Room codes are not listed anywhere publicly
- No API endpoint returns a list of rooms
- Invite links use only the room code in the path — no sensitive data in URL
- Player display names are ephemeral; not stored after room ends
- `playerId` UUIDs are meaningless outside the room context

---

## 12. Deployment Options

### 12.1 Phase 4B: Simple single-server deployment

```
┌─────────────────────────────────────────────────┐
│  Single VPS or container                         │
│                                                  │
│  Next.js frontend (port 3000)                    │
│  Socket.IO + Express server (port 3001)          │
│  In-memory room store (Map)                      │
└─────────────────────────────────────────────────┘
             ↑ reverse proxy ↓
         nginx / Caddy (handles HTTPS + WSS)
```

**Recommended providers:**
- **Render.com** (free tier → $7/mo) — simple Node.js service, supports WebSockets natively
- **Railway.app** — simple deploy from GitHub, WebSocket support
- **Fly.io** — global edge, good for low-latency; more complex setup

**Frontend:** Vercel (Next.js) or same server as Socket.IO service.

### 12.2 Domain and HTTPS

- HTTPS is required for modern browsers on non-localhost
- WSS (WebSocket Secure) is required for Socket.IO over HTTPS
- Use Caddy or nginx reverse proxy to terminate TLS
- Let's Encrypt (via Caddy automatic) for free TLS certificates

### 12.3 Phase 4C+: When to scale

| Trigger | Solution |
|---|---|
| Server restarts lose games | Add Supabase/Postgres to persist room state |
| Multiple server instances needed | Add Redis adapter for Socket.IO pub/sub |
| Games get long (days) | Add database + auth |
| Public release | Add rate limiting, DDoS protection (Cloudflare) |

### 12.4 Environment variables needed

```env
# Server
PORT=3001
CLIENT_ORIGIN=https://game.example.com
ROOM_INACTIVITY_TIMEOUT_MS=7200000  # 2 hours

# Frontend
NEXT_PUBLIC_SOCKET_URL=https://api.game.example.com
NEXT_PUBLIC_INVITE_BASE_URL=https://game.example.com
```

---

## 13. Phase 4B Implementation Plan

The implementation should proceed in this order:

### Step 1: Socket.IO server setup
- `server/` directory at repo root (separate from `src/`)
- `server/index.ts` — Express + Socket.IO bootstrap
- `server/rooms.ts` — in-memory room Map + Room types
- `server/roomCode.ts` — room code generator
- `server/gameLoop.ts` — intent validation + reducer invocation

### Step 2: Shared types
- `src/types/multiplayer.ts` — `RoomPublicView`, `RoomPlayer`, `ClientGameIntent`, socket event payload types
- These are shared between frontend and server (both TypeScript)

### Step 3: Frontend socket layer
- `src/lib/socket.ts` — singleton Socket.IO client instance
- `src/hooks/useRoom.ts` — React hook: room state, dispatch function, connection status
- `src/hooks/useGameSocket.ts` — listens for `game:state`, provides `sendIntent`

### Step 4: UI routing + screens
- `/` — Home screen: "Create Room" + "Join Room" buttons
- `/join/[code]` — Join screen: name + token + room code form
- `/room/[code]` — Lobby + game (single route, mode switches based on room.status)

### Step 5: Replace local GameLayout with multiplayer GameLayout
- `GameLayoutMultiplayer` reads state from socket, not useReducer
- `dispatch` sends `game:action` to server, not to local reducer
- Preserve local `GameLayout` for offline/dev use

### Step 6: Mobile responsive improvements
- Bottom sheet panel for phones (action panels slide up from bottom)
- "Your Turn" toast notification
- QR code component on lobby/create screen
- Board scale CSS for small viewports

### Step 7: Integration tests
- Playwright or Vitest browser tests for critical flows (see Section 16)

### Step 8: Deploy
- Deploy Socket.IO server to Render/Railway
- Deploy Next.js to Vercel
- Configure CORS + WSS

---

## 14. Phase 4C QA Plan

After Phase 4B is deployed:

### Manual QA checklist

- [ ] Host creates room on laptop; friend joins on iPhone via QR code
- [ ] Friend joins on Android phone via invite link
- [ ] All 6 player tokens shown in lobby from 3 different devices
- [ ] Host starts game; all devices show same board state
- [ ] Only current player's Roll Dice button is active on their device
- [ ] Other players' Roll Dice is hidden or disabled
- [ ] Dice rolled on one device appears on all devices within 1 second
- [ ] Buying a property updates all devices immediately
- [ ] Rent payment shows on all devices
- [ ] Trade proposal: recipient sees notification on their device
- [ ] Bankruptcy panel shows correctly on debtor's device only
- [ ] iPhone rotates to landscape — board still visible and usable
- [ ] iPhone refreshes — reconnects and sees current state
- [ ] Player walks away for 15 minutes — marked disconnected; game continues
- [ ] Player returns — reconnects; sees current state
- [ ] Game over: all devices show winner banner
- [ ] Host clicks New Game — all devices return to lobby

### Automated tests to add in Phase 4C

- `server/__tests__/rooms.test.ts` — unit tests for room create/join/leave/cleanup
- `server/__tests__/validation.test.ts` — intent validation edge cases
- `server/__tests__/gameLoop.test.ts` — reducer integration on server
- `e2e/lobby.test.ts` — Playwright: create room, join from second client, start game
- `e2e/reconnect.test.ts` — Playwright: disconnect client, reconnect, verify state sync
- `e2e/mobile.test.ts` — Playwright + mobile viewport: lobby and join flow

---

## 15. Known Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| WebSocket blocked by corporate/school firewall | Low (friends-only use case) | Socket.IO falls back to HTTP long-polling automatically |
| Server restart loses room state | Medium | Acceptable for Phase 4B; add Postgres in Phase 4C if needed |
| Race condition: two clients send action simultaneously | Low | Server processes actions serially per room (single-threaded Node.js event loop) |
| Mobile browser kills WebSocket in background | Medium | Socket.IO reconnect + `game:requestSync` on reconnect |
| Token collision in room | Very low | Server enforces unique tokens per room; client shows available tokens only |
| Room code collision | Very low | Retry logic in `createUniqueRoomCode` |
| Memory leak from abandoned rooms | Low | Inactivity cleanup every 5 minutes |
| Player impersonation (fake playerId) | Low (friends-only) | PlayerId is server-generated; could add signed JWT in Phase 4C if needed |
| Board too small on phone portrait | Medium | CSS scale + scroll; consider simplified phone board view in Phase 4C |
| Latency feels slow on mobile data | Low (actions are infrequent) | Full state broadcast is small; should be < 100ms on 4G |

---

## 16. Testing Plan

### 16.1 Server unit tests (Vitest, Node)

```
server/__tests__/rooms.test.ts
  ✓ creates room with unique code
  ✓ rejects join when room full (>6 players)
  ✓ rejects duplicate token in same room
  ✓ reconnects existing playerId to room
  ✓ marks player disconnected on socket disconnect
  ✓ cleans up inactive rooms after timeout
  ✓ rejects startGame from non-host
  ✓ rejects startGame with <2 players
  ✓ rejects game:action during lobby
  ✓ rejects game:action after gameOver

server/__tests__/validation.test.ts
  ✓ rejects action from wrong player (not current player)
  ✓ rejects ROLL_DICE_REQUEST with dice payload (intent system)
  ✓ rejects PLACE_BID from non-bidder
  ✓ rejects PROPOSE_TRADE with mismatched initiatorId
  ✓ accepts valid action from current player

server/__tests__/gameLoop.test.ts
  ✓ server rolls dice, runs reducer, broadcasts result
  ✓ ROLL_DICE_REQUEST generates different dice each run
  ✓ invalid intent returns game:error to sender only
  ✓ valid intent broadcasts game:state to all room clients
```

### 16.2 Client integration tests (Vitest, Node)

```
src/__tests__/multiplayerSocket.test.ts
  ✓ useRoom hook initializes with null state
  ✓ sendIntent emits game:action to socket
  ✓ socket game:state event updates hook state
  ✓ socket room:update event updates room view
  ✓ reconnect flow: savedPlayerId triggers room:join with playerId
```

### 16.3 End-to-end tests (Playwright)

```
e2e/lobby.test.ts
  ✓ host creates room, sees room code and QR
  ✓ second browser joins via invite link
  ✓ both browsers show same player list
  ✓ host starts game; both see game board
  ✓ current player roll dice; both see result
  ✓ non-current player cannot roll

e2e/reconnect.test.ts
  ✓ player refreshes mid-game and sees current state
  ✓ player marked disconnected while away; marked reconnected on return

e2e/mobile.test.ts (Playwright mobile viewport)
  ✓ join screen renders correctly at 390×844 (iPhone 14)
  ✓ lobby renders correctly on mobile
  ✓ Roll Dice button is tap-target sized (≥44px)
  ✓ game board visible at mobile viewport
  ✓ "Your Turn" indicator visible on turn change
```

### 16.4 Existing tests

All 387 existing local game tests continue to pass unchanged. The multiplayer layer is additive; it does not modify the local reducer or game logic.

---

## Summary

| Aspect | Phase 4B plan |
|---|---|
| Max players | 6 |
| Join method | Room code + invite link + QR code |
| Server tech | Node.js + Socket.IO + Express |
| State store | In-memory Map (Phase 4B) |
| State sync | Full `GameState` broadcast after every action |
| Dice | Server-side always |
| Reconnect | sessionStorage playerId + `game:requestSync` |
| Mobile | Responsive CSS + bottom sheet panels + QR code |
| Deployment | Render/Railway (server) + Vercel (frontend) |
| Database | Not in Phase 4B; add in Phase 4C if needed |
| Redis | Not in Phase 4B; add if horizontal scaling needed |
| Privacy | Room code only; no public room list; no accounts |

---

## Phase 4B.1: Room and Lobby Foundation Status ✅

### What was implemented

#### Dependency cleanup
- Removed `node_modules_broken_1781334976/` (corrupted reinstall artifact that was causing Vitest to scan third-party test files)
- After removal: all 387 existing tests pass cleanly with no third-party noise

#### New packages installed (exact versions)
- `express@5.2.1` — HTTP server
- `socket.io@4.8.3` — WebSocket server
- `socket.io-client@4.8.3` — WebSocket client (Next.js frontend)
- `tsx@4.22.4` (dev) — run TypeScript server directly in dev
- `@types/express@5.0.6` (dev) — Express types
- `concurrently@10.0.3` (dev) — run Next + server in parallel

#### Server files added (`server/`)
- `server/index.ts` — Express + Socket.IO server; handles `room:create`, `room:join`, `room:leave`, `room:startGame`, `room:requestSync`, `disconnect`; in-memory room store; 5-minute inactivity cleanup; health check at `/health`
- `server/tsconfig.json` — server-specific TypeScript config with `@/` path alias

#### Shared types added (`src/types/multiplayer.ts`)
- `RoomStatus`, `RoomPlayer`, `RoomPublicView`
- Socket payload types: `CreateRoomPayload`, `JoinRoomPayload`, `RoomCreatedPayload`, `RoomJoinedPayload`, `RoomUpdatePayload`, `GameStatePayload`, `GameErrorPayload`, `PlayerEventPayload`, `RoomEndedPayload`

#### Room manager (`src/lib/multiplayer/`)
- `roomCode.ts` — generates `WORD-NNNN` format codes (e.g. `LONDON-4821`); `isValidRoomCodeFormat()` validator
- `rooms.ts` — `RoomManager` class: `createRoom`, `joinRoom` (with reconnect support), `playerDisconnected`, `playerLeft`, `startGame`, `getRoom`, `getGameState`, `getRoomCodeBySocketId`, `getPlayerIdBySocketId`, `cleanupInactive`, `setLastActivityAt` (test helper)

#### Frontend socket layer
- `src/lib/socket.ts` — singleton `socket.io-client` instance; lazy-init, SSR-safe
- `src/hooks/useRoom.ts` — React hook managing all room socket state (connected, room, myPlayerId, gameState, error); exposes `createRoom`, `joinRoom`, `leaveRoom`, `startGame`, `requestSync`, `clearError`

#### Frontend UI components (`src/components/multiplayer/`)
- `HomeScreen.tsx` — landing page: Play Local / Create Private Room / Join a Room
- `TokenPicker.tsx` — 6-token selector with taken-token disabled state
- `RoomLobby.tsx` — shared lobby: room code, copy invite link, player list with connection status, host Start Game button, waiting message for non-hosts
- `CreateRoom.tsx` — create room flow: name + token form → room created → lobby
- `JoinRoom.tsx` — join flow: room code + name + token → joined → lobby

#### App routes added
- `/` → `HomeScreen` (replaces direct local game entry)
- `/play` → local `GameLayout` (existing offline game, unchanged)
- `/create` → `CreateRoom`
- `/join` → `JoinRoom` (blank code)
- `/join/[code]` → `JoinRoom` (pre-filled code from URL)
- `/room/[code]` → `JoinRoom` (deep-link entry point; same pre-fill behavior)

#### Environment config
- `.env.local` — `NEXT_PUBLIC_SOCKET_URL=http://localhost:3001`

#### New package scripts
- `server:dev` — `tsx --tsconfig server/tsconfig.json server/index.ts`
- `dev:all` — `concurrently` running Next.js + server together

### Socket events implemented

| Event | Direction | Purpose |
|---|---|---|
| `room:create` | C→S | Host creates a room |
| `room:join` | C→S | Player joins (or reconnects to) a room |
| `room:leave` | C→S | Player leaves room |
| `room:startGame` | C→S | Host starts game |
| `room:requestSync` | C→S | Client asks for current state (reconnect) |
| `room:created` | S→C | Sent to host with room code + playerId |
| `room:joined` | S→C | Sent to joining player with room + playerId |
| `room:update` | S→C | Broadcast to all in room on lobby change |
| `game:state` | S→C | Broadcast initial game state after start |
| `game:error` | S→C | Sent to sender when action rejected |
| `player:connected` | S→C | Broadcast on reconnect |
| `player:disconnected` | S→C | Broadcast on disconnect |
| `room:ended` | S→C | Broadcast when room is dissolved |

### Tests added
- `src/__tests__/multiplayerRooms.test.ts` — 28 tests covering:
  - Room code format generation and validation
  - `createRoom`: room code uniqueness, lobby status, host assignment
  - `joinRoom`: valid/invalid code, empty name, max 6 players, duplicate token, token availability
  - `startGame`: host-only, min 2 players, valid game state created, room view fields
  - Disconnect/leave: playerDisconnected marks disconnected, unknown socket returns null
  - Reconnect: existing playerId re-connects successfully
  - Cleanup: active rooms not removed, expired rooms removed via `setLastActivityAt`

### Commands run (Node 20)

```bash
nvm use 20
npm run typecheck   # ✅ pass
npm run lint        # ✅ pass
npm run build       # ✅ pass (all 6 routes built)
npm test            # ✅ 415/415 tests, 18 files
```

### Test counts

| Phase | Tests | Files |
|---|---|---|
| Before Phase 4B.1 | 387 | 17 |
| After Phase 4B.1  | 415 | 18 |

### How to run local mode

```bash
nvm use 20
npm run dev        # starts Next.js at http://localhost:3000
# Then open http://localhost:3000/play for the local offline game
```

### How to run multiplayer server + lobby

```bash
nvm use 20
npm run dev:all    # starts Next.js (port 3000) + Socket.IO server (port 3001) together
# OR run separately:
# Terminal 1: npm run dev
# Terminal 2: npm run server:dev

# Then open http://localhost:3000 for the home screen
# Click "Create Private Room" or "Join a Room"
```

### Known limitations
- Full gameplay action sync (dice, buy, rent, etc.) not yet wired over socket — Phase 4B.2
- Multiplayer game screen after start shows a placeholder; actual game board is Phase 4B.2
- No QR code generation yet (placeholder noted; `qrcode` library to be added in Phase 4B.2)
- Server does not persist rooms across restarts (in-memory; expected for Phase 4B)
- `/room/[code]` deep-link currently shows join form; will show live game in Phase 4B.2
- No rate limiting beyond Socket.IO connection limits (acceptable for private friend use)
- Host cannot kick players yet (Phase 4B.2 scope)

### Next recommended task

**Phase 4B.2: Server-authoritative gameplay actions**
- Wire all game actions (dice, buy, rent, etc.) through Socket.IO
- Replace local `GameLayout` with multiplayer `GameLayoutMultiplayer` for rooms
- Server-side dice rolling
- Full game state broadcast after every action
- Add QR code generation for lobby invite

## Phase 4E.2: Premium Player Panel Redesign Status ✅

Redesigned `PlayerPanel.tsx` into a premium "board-game card" style: dominant
glowing/gradient styling + "Now Playing" strip for the current player, status
chips (TURN/ONLINE/IN JAIL/DEBT/BANKRUPT/TRADING/AUCTION, bankrupt suppresses
the rest), a compact "Free"/jail-card chip vs. a dramatic "Attempt N/3" panel
when jailed, color-grouped property chips (★ full-set highlight) plus
distinct airport/utility chip styling, a relative wealth bar, and a
click-to-expand portfolio detail section (houses/hotels/mortgaged counts).
Pure decision logic extracted to `src/lib/game/playerPanelHelpers.ts` for
testability (no DOM library available in this repo, consistent with the
`tradeHelpers.ts` precedent from 4E.1). Wired `isOnline`/trade/auction/debt
flags into both `GameLayout.tsx` (local) and `GameLayoutMultiplayer.tsx`.

Tests: added `src/__tests__/playerPanelHelpers.test.ts` (18 tests). Full
suite: 838/838 passing, typecheck/lint/build clean.

## Phase 4E.3: Consistent Premium Player Card System Status ✅

Fixed the inconsistency from 4E.2: the expand state defaulted to
`isCurrentPlayer`, so the current-player card silently rendered with the
portfolio-detail section open while every other card rendered closed —
making the cards look like two different components instead of one design
with stronger emphasis. All cards now default to collapsed via a single
exported constant (`PLAYER_CARD_DEFAULT_EXPANDED` in
`playerPanelHelpers.ts`) and expose the same explicit `Details ▾/▴` toggle
button. The current-player card keeps the same section skeleton — only the
border/glow, background gradient, and "Now Playing" strip differ. Removed
the global "Online" pill from the multiplayer player-panel section header
(`GameLayoutMultiplayer.tsx`) since it duplicated the new per-player ONLINE
status chip.

Tests: added `src/__tests__/playerCardPresentation.test.ts` and
`src/__tests__/playerPanelUi.test.ts` (skeleton-consistency, status-chip
dedup, and per-kind portfolio chip coverage). Full suite: 856/856 passing,
typecheck/lint/build clean.
