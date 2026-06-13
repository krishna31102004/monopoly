import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Import server helpers (pure functions, no side effects) ──────────────────
// corsHelpers.ts contains only pure functions — no httpServer.listen() side effect.

async function loadServerHelpers() {
  vi.resetModules();
  return import("../../server/corsHelpers.js");
}

// ── CORS helpers ──────────────────────────────────────────────────────────────

describe("isAllowedOrigin — dev mode (no allowlist)", () => {
  it("allows localhost", async () => {
    const { isAllowedOrigin } = await loadServerHelpers();
    expect(isAllowedOrigin("http://localhost:3000", null)).toBe(true);
  });

  it("allows 127.0.0.1", async () => {
    const { isAllowedOrigin } = await loadServerHelpers();
    expect(isAllowedOrigin("http://127.0.0.1:3000", null)).toBe(true);
  });

  it("allows private LAN IP (192.168.x.x)", async () => {
    const { isAllowedOrigin } = await loadServerHelpers();
    expect(isAllowedOrigin("http://192.168.1.25:3000", null)).toBe(true);
  });

  it("allows private LAN IP (10.x.x.x)", async () => {
    const { isAllowedOrigin } = await loadServerHelpers();
    expect(isAllowedOrigin("http://10.0.0.5:3000", null)).toBe(true);
  });

  it("blocks public IP in dev mode", async () => {
    const { isAllowedOrigin } = await loadServerHelpers();
    expect(isAllowedOrigin("http://8.8.8.8:3000", null)).toBe(false);
  });

  it("blocks unknown HTTPS origin in dev mode", async () => {
    const { isAllowedOrigin } = await loadServerHelpers();
    expect(isAllowedOrigin("https://evil.example.com", null)).toBe(false);
  });

  it("allows undefined origin (curl / server-to-server)", async () => {
    const { isAllowedOrigin } = await loadServerHelpers();
    expect(isAllowedOrigin(undefined, null)).toBe(true);
  });
});

describe("isAllowedOrigin — production allowlist", () => {
  it("accepts configured Vercel origin", async () => {
    const { isAllowedOrigin } = await loadServerHelpers();
    const allowList = ["https://monopoly-game.vercel.app"];
    expect(isAllowedOrigin("https://monopoly-game.vercel.app", allowList)).toBe(true);
  });

  it("rejects unrelated origin when allowlist is set", async () => {
    const { isAllowedOrigin } = await loadServerHelpers();
    const allowList = ["https://monopoly-game.vercel.app"];
    expect(isAllowedOrigin("https://other-site.com", allowList)).toBe(false);
  });

  it("rejects localhost when production allowlist is set", async () => {
    const { isAllowedOrigin } = await loadServerHelpers();
    const allowList = ["https://monopoly-game.vercel.app"];
    expect(isAllowedOrigin("http://localhost:3000", allowList)).toBe(false);
  });

  it("accepts multiple origins from CLIENT_ORIGINS", async () => {
    const { isAllowedOrigin } = await loadServerHelpers();
    const allowList = ["https://monopoly-game.vercel.app", "https://monopoly.example.com"];
    expect(isAllowedOrigin("https://monopoly.example.com", allowList)).toBe(true);
  });

  it("still allows undefined origin even in production mode", async () => {
    const { isAllowedOrigin } = await loadServerHelpers();
    const allowList = ["https://monopoly-game.vercel.app"];
    expect(isAllowedOrigin(undefined, allowList)).toBe(true);
  });
});

describe("parseAllowedOrigins — env var parsing", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.CLIENT_ORIGIN;
    delete process.env.CLIENT_ORIGINS;
  });
  afterEach(() => {
    delete process.env.CLIENT_ORIGIN;
    delete process.env.CLIENT_ORIGINS;
  });

  it("returns null when neither env var is set (dev mode)", async () => {
    const { parseAllowedOrigins } = await loadServerHelpers();
    expect(parseAllowedOrigins()).toBeNull();
  });

  it("returns single-item array from CLIENT_ORIGIN", async () => {
    process.env.CLIENT_ORIGIN = "https://monopoly-game.vercel.app";
    const { parseAllowedOrigins } = await loadServerHelpers();
    expect(parseAllowedOrigins()).toEqual(["https://monopoly-game.vercel.app"]);
  });

  it("parses comma-separated CLIENT_ORIGINS", async () => {
    process.env.CLIENT_ORIGINS = "https://app.vercel.app,https://monopoly.example.com";
    const { parseAllowedOrigins } = await loadServerHelpers();
    expect(parseAllowedOrigins()).toEqual([
      "https://app.vercel.app",
      "https://monopoly.example.com",
    ]);
  });

  it("CLIENT_ORIGINS takes priority over CLIENT_ORIGIN", async () => {
    process.env.CLIENT_ORIGIN = "https://old.example.com";
    process.env.CLIENT_ORIGINS = "https://new.example.com";
    const { parseAllowedOrigins } = await loadServerHelpers();
    expect(parseAllowedOrigins()).toEqual(["https://new.example.com"]);
  });

  it("trims whitespace from CLIENT_ORIGINS entries", async () => {
    process.env.CLIENT_ORIGINS = " https://a.example.com , https://b.example.com ";
    const { parseAllowedOrigins } = await loadServerHelpers();
    expect(parseAllowedOrigins()).toEqual(["https://a.example.com", "https://b.example.com"]);
  });
});

// ── Socket URL (frontend) ─────────────────────────────────────────────────────

describe("getSocketUrl — production and local scenarios", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    delete process.env.NEXT_PUBLIC_SOCKET_PORT;
    // ensure window is undefined (Node/SSR environment)
    if ("window" in global) {
      try { delete (global as Record<string, unknown>).window; } catch (_) { /* ignore */ }
    }
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    delete process.env.NEXT_PUBLIC_SOCKET_PORT;
    vi.restoreAllMocks();
  });

  it("uses NEXT_PUBLIC_SOCKET_URL when set (production scenario)", async () => {
    process.env.NEXT_PUBLIC_SOCKET_URL = "https://worldcities-server.onrender.com";
    const { getSocketUrl } = await import("@/lib/socket");
    expect(getSocketUrl()).toBe("https://worldcities-server.onrender.com");
  });

  it("uses localhost fallback in SSR/Node context", async () => {
    const { getSocketUrl } = await import("@/lib/socket");
    expect(getSocketUrl()).toBe("http://localhost:3001");
  });

  it("derives from window.location.hostname for LAN scenario", async () => {
    Object.defineProperty(global, "window", {
      value: { location: { hostname: "192.168.1.25" } },
      writable: true,
      configurable: true,
    });
    const { getSocketUrl } = await import("@/lib/socket");
    expect(getSocketUrl()).toBe("http://192.168.1.25:3001");
  });
});

// ── render.yaml ───────────────────────────────────────────────────────────────

describe("render.yaml deployment config", () => {
  const yaml = readFileSync(resolve(process.cwd(), "render.yaml"), "utf-8");

  it("exists", () => {
    expect(yaml.length).toBeGreaterThan(0);
  });

  it("specifies Node 20", () => {
    expect(yaml).toContain('"20"');
  });

  it("references the health check path", () => {
    expect(yaml).toContain("/health");
  });

  it("sets NODE_ENV to production", () => {
    expect(yaml).toContain("production");
  });

  it("marks CLIENT_ORIGIN as requiring manual setup", () => {
    expect(yaml).toContain("CLIENT_ORIGIN");
  });
});

// ── No public room listing ────────────────────────────────────────────────────

import { RoomManager } from "@/lib/multiplayer/rooms";

describe("RoomManager — no public room listing", () => {
  it("does not expose a getAll() or listRooms() method", () => {
    const mgr = new RoomManager();
    expect(typeof (mgr as unknown as Record<string, unknown>).getAll).toBe("undefined");
    expect(typeof (mgr as unknown as Record<string, unknown>).listRooms).toBe("undefined");
    expect(typeof (mgr as unknown as Record<string, unknown>).getAllRooms).toBe("undefined");
  });

  it("roomCount reports count without exposing room details", () => {
    const mgr = new RoomManager();
    mgr.createRoom(
      { displayName: "Alice", token: "car", tokenLabel: "CAR", color: "#ef4444" },
      "s1",
    );
    expect(mgr.roomCount).toBe(1);
    // roomCount is just a number — no room codes, no player info
    expect(typeof mgr.roomCount).toBe("number");
  });
});

// ── package.json scripts ──────────────────────────────────────────────────────

describe("package.json — deployment scripts", () => {
  const pkg = JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf-8"),
  ) as { scripts: Record<string, string>; engines?: Record<string, string> };

  it("has a build script", () => {
    expect(pkg.scripts.build).toBeTruthy();
  });

  it("has dev:all for local laptop testing", () => {
    expect(pkg.scripts["dev:all"]).toBeTruthy();
  });

  it("has dev:lan for LAN/mobile testing", () => {
    expect(pkg.scripts["dev:lan"]).toBeTruthy();
  });

  it("has a server:dev script", () => {
    expect(pkg.scripts["server:dev"]).toBeTruthy();
  });
});
