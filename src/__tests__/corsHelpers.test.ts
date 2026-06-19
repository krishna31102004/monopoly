import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parseAllowedOrigins, isAllowedOrigin } from "../../server/corsHelpers";

// ── isAllowedOrigin ───────────────────────────────────────────────────────────

describe("isAllowedOrigin — production mode (allowList set)", () => {
  const allowList = ["https://monopoly-blue-eta.vercel.app"];

  it("allows the exact production Vercel origin", () => {
    expect(isAllowedOrigin("https://monopoly-blue-eta.vercel.app", allowList)).toBe(true);
  });

  it("blocks a different Vercel app", () => {
    expect(isAllowedOrigin("https://other-app.vercel.app", allowList)).toBe(false);
  });

  it("blocks localhost in production mode (not in allowList)", () => {
    expect(isAllowedOrigin("http://localhost:3000", allowList)).toBe(false);
  });

  it("blocks http variant of the production domain (must be https)", () => {
    expect(isAllowedOrigin("http://monopoly-blue-eta.vercel.app", allowList)).toBe(false);
  });

  it("allows requests with no origin (server-to-server, curl)", () => {
    expect(isAllowedOrigin(undefined, allowList)).toBe(true);
  });

  it("allows multiple origins when allowList has multiple entries", () => {
    const multi = [
      "https://monopoly-blue-eta.vercel.app",
      "https://preview.vercel.app",
    ];
    expect(isAllowedOrigin("https://monopoly-blue-eta.vercel.app", multi)).toBe(true);
    expect(isAllowedOrigin("https://preview.vercel.app", multi)).toBe(true);
    expect(isAllowedOrigin("https://unknown.vercel.app", multi)).toBe(false);
  });
});

describe("isAllowedOrigin — dev mode (allowList=null)", () => {
  it("allows localhost:3000", () => {
    expect(isAllowedOrigin("http://localhost:3000", null)).toBe(true);
  });

  it("allows localhost:3001", () => {
    expect(isAllowedOrigin("http://localhost:3001", null)).toBe(true);
  });

  it("allows 127.0.0.1", () => {
    expect(isAllowedOrigin("http://127.0.0.1:3000", null)).toBe(true);
  });

  it("allows LAN IP 192.168.x.x", () => {
    expect(isAllowedOrigin("http://192.168.1.42:3000", null)).toBe(true);
  });

  it("blocks the production Vercel domain in dev mode", () => {
    // In dev mode, Vercel domain is NOT allowed (only localhost/LAN)
    expect(isAllowedOrigin("https://monopoly-blue-eta.vercel.app", null)).toBe(false);
  });

  it("blocks an arbitrary public domain in dev mode", () => {
    expect(isAllowedOrigin("https://example.com", null)).toBe(false);
  });

  it("allows no-origin requests in dev mode", () => {
    expect(isAllowedOrigin(undefined, null)).toBe(true);
  });
});

// ── parseAllowedOrigins ───────────────────────────────────────────────────────

describe("parseAllowedOrigins — env var parsing", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CLIENT_ORIGINS;
    delete process.env.CLIENT_ORIGIN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns null when neither env var is set (dev mode)", () => {
    expect(parseAllowedOrigins()).toBeNull();
  });

  it("parses CLIENT_ORIGINS single value", () => {
    process.env.CLIENT_ORIGINS = "https://monopoly-blue-eta.vercel.app";
    expect(parseAllowedOrigins()).toEqual(["https://monopoly-blue-eta.vercel.app"]);
  });

  it("parses CLIENT_ORIGINS comma-separated list", () => {
    process.env.CLIENT_ORIGINS = "https://monopoly-blue-eta.vercel.app,https://preview.vercel.app";
    const result = parseAllowedOrigins();
    expect(result).toContain("https://monopoly-blue-eta.vercel.app");
    expect(result).toContain("https://preview.vercel.app");
    expect(result).toHaveLength(2);
  });

  it("trims whitespace in CLIENT_ORIGINS list", () => {
    process.env.CLIENT_ORIGINS = "https://monopoly-blue-eta.vercel.app , https://preview.vercel.app";
    const result = parseAllowedOrigins();
    expect(result).toContain("https://monopoly-blue-eta.vercel.app");
    expect(result).toContain("https://preview.vercel.app");
  });

  it("falls back to CLIENT_ORIGIN when CLIENT_ORIGINS is not set", () => {
    process.env.CLIENT_ORIGIN = "https://monopoly-blue-eta.vercel.app";
    expect(parseAllowedOrigins()).toEqual(["https://monopoly-blue-eta.vercel.app"]);
  });

  it("CLIENT_ORIGINS takes precedence over CLIENT_ORIGIN", () => {
    process.env.CLIENT_ORIGINS = "https://monopoly-blue-eta.vercel.app";
    process.env.CLIENT_ORIGIN = "https://other.vercel.app";
    const result = parseAllowedOrigins();
    expect(result).toEqual(["https://monopoly-blue-eta.vercel.app"]);
    expect(result).not.toContain("https://other.vercel.app");
  });

  it("render.yaml CLIENT_ORIGINS value allows production origin", () => {
    // This mirrors what render.yaml sets
    process.env.CLIENT_ORIGINS = "https://monopoly-blue-eta.vercel.app";
    const list = parseAllowedOrigins();
    expect(isAllowedOrigin("https://monopoly-blue-eta.vercel.app", list)).toBe(true);
  });

  it("production mode: Vercel blocks localhost (origin must be in list)", () => {
    process.env.CLIENT_ORIGINS = "https://monopoly-blue-eta.vercel.app";
    const list = parseAllowedOrigins();
    // localhost not in production allowList — that's expected and correct
    expect(isAllowedOrigin("http://localhost:3000", list)).toBe(false);
  });
});

// ── Server source assertions ──────────────────────────────────────────────────

import { readFileSync } from "fs";
import { join } from "path";
const serverSrc = readFileSync(join(process.cwd(), "server/index.ts"), "utf-8");

describe("server/index.ts — CORS and error handling source assertions", () => {
  it("has Express CORS middleware (app.use)", () => {
    expect(serverSrc).toMatch(/app\.use/);
  });

  it("Express middleware sets Access-Control-Allow-Origin", () => {
    expect(serverSrc).toMatch(/Access-Control-Allow-Origin/);
  });

  it("trade:draftCancel handler has try/catch", () => {
    expect(serverSrc).toMatch(/trade:draftCancel[\s\S]{0,200}try\s*\{/);
  });

  it("trade:draftStart handler has try/catch", () => {
    expect(serverSrc).toMatch(/trade:draftStart[\s\S]{0,200}try\s*\{/);
  });

  it("trade:draftUpdate handler has try/catch", () => {
    expect(serverSrc).toMatch(/trade:draftUpdate[\s\S]{0,200}try\s*\{/);
  });

  it("trade:draftSubmit handler has try/catch", () => {
    expect(serverSrc).toMatch(/trade:draftSubmit[\s\S]{0,200}try\s*\{/);
  });

  it("Socket.IO cors uses corsCheck callback", () => {
    expect(serverSrc).toMatch(/origin:\s*corsCheck/);
  });

  it("uses parseAllowedOrigins and isAllowedOrigin from corsHelpers", () => {
    expect(serverSrc).toMatch(/parseAllowedOrigins/);
    expect(serverSrc).toMatch(/isAllowedOrigin/);
  });

  it("does not expose trade:counter socket event (counter-offer removed)", () => {
    expect(serverSrc).not.toMatch(/trade:counter/);
  });

  it("does not call rooms.dispatchAction (method does not exist, regression guard)", () => {
    expect(serverSrc).not.toMatch(/rooms\.dispatchAction/);
  });
});

describe("render.yaml — production CORS config", () => {
  const yaml = readFileSync(join(process.cwd(), "render.yaml"), "utf-8");

  it("sets CLIENT_ORIGINS env var in render.yaml", () => {
    expect(yaml).toMatch(/CLIENT_ORIGINS/);
  });

  it("includes the production Vercel domain in CLIENT_ORIGINS", () => {
    expect(yaml).toMatch(/monopoly-blue-eta\.vercel\.app/);
  });

  it("does not use sync:false for CLIENT_ORIGINS (it is hardcoded, not manual)", () => {
    // The value should be set directly, not as sync:false (which would require manual entry)
    const clientOriginsSection = yaml.match(/CLIENT_ORIGINS[\s\S]{0,200}/)?.[0] ?? "";
    expect(clientOriginsSection).not.toMatch(/sync:\s*false/);
  });
});
