import { DESIGN_TOKENS } from "@/lib/ui/designTokens";

/** Shared presentation tokens for the trade negotiation surface. */
export const TRADE_VISUAL_TOKENS = {
  shell: DESIGN_TOKENS.surface.navy,
  raised: DESIGN_TOKENS.surface.navyRaised,
  raisedHover: DESIGN_TOKENS.surface.navyElevated,
  indigo: "#312E81",
  gold: DESIGN_TOKENS.action.gold,
  goldHover: DESIGN_TOKENS.action.goldHover,
  goldSoft: DESIGN_TOKENS.action.goldSoft,
  goldBorder: "rgba(198, 161, 91, 0.45)",
  text: DESIGN_TOKENS.text.onDark,
  secondaryText: DESIGN_TOKENS.text.secondaryOnDark,
  mutedText: DESIGN_TOKENS.text.mutedOnDark,
  neutralBorder: "rgba(148, 163, 184, 0.24)",
  success: "#22C55E",
  decline: "#EF4444",
  warning: "#F59E0B",
  neutral: "#64748B",
} as const;
