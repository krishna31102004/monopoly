import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

// Exported so tests and components can verify the derived URL.
export function getSocketUrl(): string {
  // Explicit env var always wins — set this for hosted/production deployments.
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  // In the browser, derive from the page's hostname so LAN/mobile access works:
  // e.g. page opened at http://192.168.1.25:3000 → socket at http://192.168.1.25:3001
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    const port =
      (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOCKET_PORT) ||
      "3001";
    return `http://${hostname}:${port}`;
  }
  // SSR fallback (never used for real connections — socket only connects client-side).
  return "http://localhost:3001";
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl(), { autoConnect: false });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
