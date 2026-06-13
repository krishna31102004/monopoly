// Pure CORS helpers — importable without starting the server (safe for tests).

const LAN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

// Parse the CLIENT_ORIGINS env var (comma-separated) plus the legacy single-value
// CLIENT_ORIGIN so both work. Returns null when neither is set (dev mode).
export function parseAllowedOrigins(): string[] | null {
  const multi = process.env.CLIENT_ORIGINS;
  const single = process.env.CLIENT_ORIGIN;
  if (multi) {
    const list = multi.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) return list;
  }
  if (single) return [single];
  return null; // no restriction → dev mode
}

// Decides whether a given request origin is allowed.
// allowList=null means dev mode: only localhost and RFC-1918 LAN IPs are permitted.
// allowList=string[] means production mode: only exact matches are permitted.
export function isAllowedOrigin(
  origin: string | undefined,
  allowList: string[] | null,
): boolean {
  if (!origin) return true; // no-origin requests (curl, server-to-server health checks)
  if (allowList) return allowList.includes(origin);
  return LAN_PATTERN.test(origin);
}
