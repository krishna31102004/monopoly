import { DESIGN_TOKENS } from "@/lib/ui/designTokens";

/** Presentation-only palette for auction actions and participant states. */
export const AUCTION_ACTION_TOKENS = {
  gold: DESIGN_TOKENS.action.gold,
  goldHover: DESIGN_TOKENS.action.goldHover,
  darkGold: DESIGN_TOKENS.action.goldDark,
  goldSoft: DESIGN_TOKENS.action.goldSoft,
  goldMedium: DESIGN_TOKENS.action.goldMedium,
  goldBorder: DESIGN_TOKENS.action.goldBorder,
  navy: DESIGN_TOKENS.surface.navy,
  raised: DESIGN_TOKENS.surface.navyRaised,
  raisedHover: DESIGN_TOKENS.surface.navyElevated,
  neutralBorder: DESIGN_TOKENS.border.neutral,
  highest: DESIGN_TOKENS.state.success,
  highestSoft: DESIGN_TOKENS.state.successSoft,
  passed: DESIGN_TOKENS.state.muted,
  urgent: "#DC2626",
} as const;
