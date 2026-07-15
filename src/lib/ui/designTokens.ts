/**
 * Shared presentation values for the premium UI. These are intentionally
 * semantic: property identity continues to live in propertyColors.ts.
 */
export const DESIGN_TOKENS = {
  surface: {
    midnight: "#07101F",
    navy: "#0F172A",
    navyRaised: "#182235",
    navyElevated: "#202C42",
    navyHover: "#28354D",
    overlay: "rgba(7, 16, 31, 0.78)",
    ivory: "#F6F1E8",
    ivoryRaised: "#FBF8F2",
    paper: "#FFFDF8",
    paperBorder: "#DDD5C8",
    boardFrame: "#34291C",
  },
  action: {
    gold: "#C6A15B",
    goldHover: "#D8BA72",
    goldDark: "#8A6A32",
    goldSoft: "rgba(198, 161, 91, 0.12)",
    goldMedium: "rgba(198, 161, 91, 0.20)",
    goldBorder: "rgba(198, 161, 91, 0.55)",
  },
  state: {
    success: "#22C55E",
    successSoft: "rgba(34, 197, 94, 0.10)",
    danger: "#EF4444",
    dangerSoft: "rgba(239, 68, 68, 0.12)",
    warning: "#F59E0B",
    warningSoft: "rgba(245, 158, 11, 0.12)",
    info: "#3B82F6",
    infoSoft: "rgba(59, 130, 246, 0.12)",
    muted: "#64748B",
  },
  text: {
    onDark: "#F8FAFC",
    secondaryOnDark: "#CBD5E1",
    mutedOnDark: "#94A3B8",
    onLight: "#0F172A",
  },
  border: {
    neutral: "rgba(148, 163, 184, 0.25)",
    neutralSubtle: "rgba(148, 163, 184, 0.16)",
  },
  spacing: {
    page: "clamp(1rem, 3vw, 2rem)",
    panel: "1.25rem",
    card: "1rem",
    section: "1.5rem",
    control: "0.75rem",
    inline: "0.5rem",
    mobileSafeArea: "max(1rem, env(safe-area-inset-bottom))",
  },
  radius: {
    small: "0.375rem",
    medium: "0.625rem",
    large: "0.875rem",
    full: "9999px",
  },
  motion: {
    fast: "150ms",
    panel: "240ms",
    event: "750ms",
    easing: "cubic-bezier(0.2, 0, 0, 1)",
  },
} as const;

export type DesignTokenGroup = keyof typeof DESIGN_TOKENS;

/** Returns a contrast-safe foreground for a hexadecimal accent color. */
export function getDesignReadableTextColor(backgroundHex: string): "#0F172A" | "#FFFFFF" {
  const normalized = backgroundHex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#FFFFFF";

  const channels = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];

  return luminance > 0.42 ? "#0F172A" : "#FFFFFF";
}
