# DEPLOYMENT.md — World Cities Monopoly

## 1. Deployment model

This project has **two separate deployable services**:

| Service | Technology | Host |
|---|---|---|
| Frontend | Next.js 15 (React 19) | **Vercel** |
| Multiplayer server | Socket.IO + Express (Node 20) | **Render** (recommended) |

The frontend is a static/SSR Next.js app. The multiplayer server is a long-lived Node.js process that holds in-memory room state and manages WebSocket connections.

## 2. Why frontend and Socket.IO server are separate

Vercel runs Next.js via serverless/edge functions. Serverless functions:
- Have no persistent memory between invocations.
- Cannot keep WebSocket connections alive.
- Would lose all room state on every request.

Socket.IO requires a **stateful, long-running process**. Render (and similar platforms like Railway or Fly.io) supports this model natively. The frontend on Vercel simply connects to the Socket.IO server via `NEXT_PUBLIC_SOCKET_URL`.

## 3. GitHub repo

```
https://github.com/krishna31102004/monopoly
```

Both Vercel and Render deploy directly from this repo. The same repo contains:
- `src/` — Next.js frontend
- `server/` — Socket.IO backend
- `render.yaml` — Render Blueprint config

## 4. Local dev commands

### Local pass-and-play only (no multiplayer server needed)
```bash
nvm use 20
npm run dev
# Open http://localhost:3000/play
```

### Local multiplayer (laptop only, both services)
```bash
nvm use 20
npm run dev:all
# Open http://localhost:3000
# Multiplayer server at http://localhost:3001
```

Set in `.env.local`:
```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

## 5. LAN / mobile testing

Run both services bound to all interfaces so phones/tablets can connect:
```bash
nvm use 20
npm run dev:lan
```

Find your Mac's local IP:
```bash
ipconfig getifaddr en0
# e.g. 192.168.1.25
```

On your phone/tablet, open:
```
http://192.168.1.25:3000
```

**No `.env.local` change needed** — when `NEXT_PUBLIC_SOCKET_URL` is unset, the browser derives the socket URL from the page hostname automatically (e.g. `http://192.168.1.25:3001`).

Requirements:
- All devices must be on the same Wi-Fi network.
- Mac firewall must allow incoming connections on ports 3000 and 3001 (System Settings → Network → Firewall → allow Node).

## 6. Backend deployment to Render

### Option A — Render Blueprint (recommended)

The repo contains `render.yaml` which automates the setup.

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click **New → Blueprint**
3. Connect the GitHub repo: `https://github.com/krishna31102004/monopoly`
4. Render reads `render.yaml` and creates the service automatically.
5. After creation, set the manual env vars in the Render dashboard (see §8).

### Option B — Manual Render web service

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click **New → Web Service**
3. Connect: `https://github.com/krishna31102004/monopoly`
4. Settings:
   - **Runtime:** Node
   - **Build command:** `npm ci`
   - **Start command:** `node --loader tsx/esm --tsconfig server/tsconfig.json server/index.ts`
   - **Node version:** 20
   - **Health check path:** `/health`
5. Add env vars (see §8).

### Alternative: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

Set env vars in the Railway dashboard.

### Alternative: Fly.io

```bash
fly launch
fly deploy
```

Requires a `Dockerfile` (not included by default; see §11 for notes).

## 7. Frontend deployment to Vercel

1. Go to [https://vercel.com](https://vercel.com)
2. Click **Add New → Project**
3. Import from GitHub: `https://github.com/krishna31102004/monopoly`
4. Framework preset: **Next.js** (detected automatically)
5. Add env vars (see §8):
   - `NEXT_PUBLIC_SOCKET_URL=https://your-socket-server.onrender.com`
6. Click **Deploy**.

The `/play` route (local pass-and-play) works even without the socket server — it uses the local game reducer and localStorage.

## 8. Required environment variables

### Vercel (frontend)

| Variable | Value | Required |
|---|---|---|
| `NEXT_PUBLIC_SOCKET_URL` | `https://your-socket-server.onrender.com` | Yes — for multiplayer |

### Render / Railway / Fly (Socket.IO backend)

| Variable | Value | Required |
|---|---|---|
| `NODE_ENV` | `production` | Yes |
| `CLIENT_ORIGIN` | `https://your-app.vercel.app` | Yes — restricts CORS |
| `CLIENT_ORIGINS` | Comma-separated list | Optional — if you have multiple frontend URLs |
| `PORT` | Injected by platform | Do not set manually |

`CLIENT_ORIGINS` takes priority over `CLIENT_ORIGIN` if both are set.

## 9. CORS setup

The server has three CORS modes:

| Mode | Trigger | Allowed origins |
|---|---|---|
| Dev (default) | Neither `CLIENT_ORIGIN` nor `CLIENT_ORIGINS` set | `localhost`, `127.0.0.1`, RFC-1918 LAN IPs |
| Single-origin production | `CLIENT_ORIGIN=https://your-app.vercel.app` | Only that exact origin |
| Multi-origin production | `CLIENT_ORIGINS=https://a.vercel.app,https://b.com` | All listed origins |

**Always set `CLIENT_ORIGIN` or `CLIENT_ORIGINS` in production** to prevent unauthorized clients from connecting.

## 10. Deployment order and smoke test checklist

Deploy in this order:

1. **Deploy the Socket.IO backend first** (Render/Railway/Fly).
2. Copy the backend URL (e.g. `https://worldcities-monopoly-server.onrender.com`).
3. **Set `NEXT_PUBLIC_SOCKET_URL`** in Vercel to the backend URL.
4. **Deploy the frontend** to Vercel.
5. Copy the Vercel frontend URL (e.g. `https://your-app.vercel.app`).
6. **Set `CLIENT_ORIGIN`** on the backend (Render dashboard) to the Vercel URL.
7. **Redeploy or restart the backend** so the new `CLIENT_ORIGIN` takes effect.

### Smoke test checklist

- [ ] `https://your-socket-server.onrender.com/health` returns `{"ok":true,"status":"healthy",...}`
- [ ] Vercel frontend loads at `https://your-app.vercel.app`
- [ ] `/play` (local pass-and-play) works with no server
- [ ] `/create` — host creates a room, gets a code
- [ ] `/join/ROOM-CODE` — second player joins from a different browser/device
- [ ] Both players see the lobby
- [ ] Host starts the game — game board appears for both players
- [ ] Each player can take actions on their turn; other player's board updates live
- [ ] Refresh a browser tab — game state reconnects automatically
- [ ] Leave a room — both players return to home screen

## 11. Known limitations

- **Server restart loses all rooms** — room state is in-memory only. If Render restarts the dyno (e.g. for a new deploy or free-tier sleep), all active games are lost. Players must create a new room.
- **Render free tier sleeps** — the free plan spins down after 15 minutes of inactivity. The first WebSocket connection after sleep may take 30–60 seconds. Upgrade to a paid plan for always-on.
- **Single server instance** — horizontal scaling is not supported without a Redis adapter for Socket.IO. Each server process holds its own room state. Sticky sessions or a single replica must be used.
- **No persistence across deploys** — same as server restart. Future fix: database-backed room state.
- **Session reconnect is tab-scoped** — identity is stored in `sessionStorage` (per tab, cleared on tab close). Opening a new tab requires rejoining manually.

## 12. Future upgrade path

### Add room persistence (database)

Replace the in-memory `Map<string, InternalRoom>` in `RoomManager` with a database-backed store (e.g. Supabase/Postgres or PlanetScale/MySQL).

Minimal changes needed:
- `createRoom`, `joinRoom`, `startGame`, `applyGameAction` become async.
- Add a database client in `server/`.
- Set `DATABASE_URL` env var on Render.

### Add horizontal scaling (Redis)

Replace Socket.IO's in-memory pubsub with the `@socket.io/redis-adapter`:
```bash
npm install @socket.io/redis-adapter redis
```
Set `REDIS_URL` on Render. This allows multiple server instances behind a load balancer.

### Custom domain

1. Add domain in Vercel project settings.
2. Update `CLIENT_ORIGIN` on Render to the custom domain.
3. Update `NEXT_PUBLIC_SOCKET_URL` in Vercel if server also gets a custom domain.
