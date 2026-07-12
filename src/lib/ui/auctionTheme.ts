import { CITY_COLOR_HEX } from "@/lib/ui/propertyColors";
import type { BoardSpace, OwnableSpace } from "@/types/board";

export type AuctionTheme = {
  accentColor: string;
  accentTextColor: "#ffffff" | "#0f172a";
  borderColor: string;
  glowColor: string;
  bodyTintColor: string;
  mutedAccentColor: string;
  groupLabel: string;
  icon: string;
};

const FALLBACK_THEME: AuctionTheme = {
  accentColor: "#475569",
  accentTextColor: "#ffffff",
  borderColor: "#64748b",
  glowColor: "rgba(100, 116, 139, 0.20)",
  bodyTintColor: "rgba(100, 116, 139, 0.12)",
  mutedAccentColor: "rgba(100, 116, 139, 0.20)",
  groupLabel: "Property",
  icon: "◆",
};

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return `rgba(71, 85, 105, ${alpha})`;
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** Returns a contrast-safe foreground for a six-digit hexadecimal background. */
export function getReadableTextColor(backgroundHex: string): "#ffffff" | "#0f172a" {
  const normalized = backgroundHex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "#ffffff";
  const value = Number.parseInt(normalized, 16);
  const [red, green, blue] = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
    .map((channel) => {
      const component = channel / 255;
      return component <= 0.03928 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue > 0.46 ? "#0f172a" : "#ffffff";
}

function makeTheme(accentColor: string, groupLabel: string, icon: string): AuctionTheme {
  return {
    accentColor,
    accentTextColor: getReadableTextColor(accentColor),
    borderColor: accentColor,
    glowColor: hexToRgba(accentColor, 0.24),
    bodyTintColor: hexToRgba(accentColor, 0.12),
    mutedAccentColor: hexToRgba(accentColor, 0.22),
    groupLabel,
    icon,
  };
}

/** Pure property-aware visual theme; no game or auction state is read or changed. */
export function getAuctionTheme(space: BoardSpace | OwnableSpace | null | undefined): AuctionTheme {
  if (!space) return FALLBACK_THEME;
  if (space.kind === "city") return makeTheme(CITY_COLOR_HEX[space.colorGroup], `${space.country} Color Group`, "🏙️");
  if (space.kind === "airport") return makeTheme("#475569", "Airport Network", "✈️");
  if (space.kind === "utility") {
    return space.name === "Water Works"
      ? makeTheme("#0891b2", "Utilities", "💧")
      : makeTheme("#2563eb", "Utilities", "⚡");
  }
  return FALLBACK_THEME;
}
