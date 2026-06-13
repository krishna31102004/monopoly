import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── getSocketUrl() ─────────────────────────────────────────────────────────────
// We test the exported helper directly, with controlled env/window mocking.

describe("getSocketUrl — env var takes priority", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SOCKET_URL = "http://game.example.com:3001";
    delete process.env.NEXT_PUBLIC_SOCKET_PORT;
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    delete process.env.NEXT_PUBLIC_SOCKET_PORT;
    vi.restoreAllMocks();
  });

  it("returns NEXT_PUBLIC_SOCKET_URL when set", async () => {
    const { getSocketUrl } = await import("@/lib/socket");
    expect(getSocketUrl()).toBe("http://game.example.com:3001");
  });

  it("returns localhost URL when env var is not set and window is undefined", async () => {
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    const { getSocketUrl } = await import("@/lib/socket");
    // In Node (SSR), window is undefined → fallback
    expect(getSocketUrl()).toBe("http://localhost:3001");
  });
});

describe("getSocketUrl — LAN derivation from window.location", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    delete process.env.NEXT_PUBLIC_SOCKET_PORT;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up window mock
    if ("location" in global) {
      try {
        // @ts-expect-error restoring
        delete global.window;
      } catch (_) { /* ignore */ }
    }
  });

  function mockWindow(hostname: string) {
    Object.defineProperty(global, "window", {
      value: { location: { hostname } },
      writable: true,
      configurable: true,
    });
  }

  it("derives socket URL from LAN IP when window.location.hostname is a LAN IP", async () => {
    mockWindow("192.168.1.25");
    const { getSocketUrl } = await import("@/lib/socket");
    expect(getSocketUrl()).toBe("http://192.168.1.25:3001");
  });

  it("derives socket URL with hostname=localhost from window.location", async () => {
    mockWindow("localhost");
    const { getSocketUrl } = await import("@/lib/socket");
    expect(getSocketUrl()).toBe("http://localhost:3001");
  });

  it("uses NEXT_PUBLIC_SOCKET_PORT when set", async () => {
    process.env.NEXT_PUBLIC_SOCKET_PORT = "4000";
    mockWindow("10.0.0.5");
    const { getSocketUrl } = await import("@/lib/socket");
    expect(getSocketUrl()).toBe("http://10.0.0.5:4000");
  });

  it("env var still takes priority over window.location", async () => {
    process.env.NEXT_PUBLIC_SOCKET_URL = "http://explicit.example.com:3001";
    mockWindow("192.168.1.99");
    const { getSocketUrl } = await import("@/lib/socket");
    expect(getSocketUrl()).toBe("http://explicit.example.com:3001");
  });
});

// ── CORS allowlist logic ───────────────────────────────────────────────────────
// Test the regex pattern the server uses without importing server code (avoids side effects).

const LAN_CORS_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

function isAllowedOriginDev(origin: string | undefined): boolean {
  if (!origin) return true;
  return LAN_CORS_PATTERN.test(origin);
}

describe("LAN CORS origin allowlist", () => {
  it("allows localhost", () => {
    expect(isAllowedOriginDev("http://localhost:3000")).toBe(true);
  });

  it("allows 127.0.0.1", () => {
    expect(isAllowedOriginDev("http://127.0.0.1:3000")).toBe(true);
  });

  it("allows 192.168.x.x (LAN)", () => {
    expect(isAllowedOriginDev("http://192.168.1.25:3000")).toBe(true);
  });

  it("allows 10.x.x.x (LAN)", () => {
    expect(isAllowedOriginDev("http://10.0.1.5:3000")).toBe(true);
  });

  it("allows 172.16.x.x through 172.31.x.x (LAN)", () => {
    expect(isAllowedOriginDev("http://172.16.0.1:3000")).toBe(true);
    expect(isAllowedOriginDev("http://172.31.255.255:3000")).toBe(true);
  });

  it("blocks public IP addresses", () => {
    expect(isAllowedOriginDev("http://8.8.8.8:3000")).toBe(false);
    expect(isAllowedOriginDev("https://evil.example.com")).toBe(false);
  });

  it("allows undefined origin (server-to-server/curl)", () => {
    expect(isAllowedOriginDev(undefined)).toBe(true);
  });

  it("blocks 172.15.x.x (not in RFC-1918 range)", () => {
    expect(isAllowedOriginDev("http://172.15.0.1:3000")).toBe(false);
  });

  it("blocks 172.32.x.x (not in RFC-1918 range)", () => {
    expect(isAllowedOriginDev("http://172.32.0.1:3000")).toBe(false);
  });
});

// ── Package scripts ───────────────────────────────────────────────────────────
import { readFileSync } from "fs";
import { resolve } from "path";

describe("package.json scripts", () => {
  const pkg = JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf-8"),
  ) as { scripts: Record<string, string> };

  it("has dev:all script for localhost testing", () => {
    expect(pkg.scripts["dev:all"]).toBeTruthy();
  });

  it("has dev:lan script for LAN/mobile testing", () => {
    expect(pkg.scripts["dev:lan"]).toBeTruthy();
  });

  it("dev:lan script binds Next.js to 0.0.0.0", () => {
    expect(pkg.scripts["dev:lan"]).toContain("0.0.0.0");
  });
});
