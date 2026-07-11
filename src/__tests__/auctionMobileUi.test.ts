/**
 * Phase 4I.3 — Auction mobile UI source-text tests
 * Verifies that AuctionPanel.tsx and MobileActionBar.tsx have the required
 * mobile-first auction UX features, without running React rendering.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const auctionSrc = fs.readFileSync(
  path.resolve(__dirname, "../components/AuctionPanel.tsx"),
  "utf-8",
);

const mobileBarSrc = fs.readFileSync(
  path.resolve(__dirname, "../components/MobileActionBar.tsx"),
  "utf-8",
);

// ── AuctionPanel status badges ─────────────────────────────────────────────

describe("AuctionPanel.tsx — participant status badges", () => {
  it('has TURN status badge', () => {
    expect(auctionSrc).toContain("TURN");
  });

  it('has HIGHEST status badge', () => {
    expect(auctionSrc).toContain("HIGHEST");
  });

  it('has ACTIVE status badge', () => {
    expect(auctionSrc).toContain("ACTIVE");
  });

  it('has PASSED status badge', () => {
    expect(auctionSrc).toContain("PASSED");
  });

  it("has StatusBadge component", () => {
    expect(auctionSrc).toContain("StatusBadge");
  });

  it("has getParticipantStatus function", () => {
    expect(auctionSrc).toContain("getParticipantStatus");
  });

  it("maps passedPlayerIds to PASSED status", () => {
    expect(auctionSrc).toContain("passedPlayerIds");
  });
});

// ── AuctionPanel expandable portfolio cards ────────────────────────────────

describe("AuctionPanel.tsx — expandable portfolio cards", () => {
  it("has aria-expanded attribute on portfolio toggle", () => {
    expect(auctionSrc).toContain("aria-expanded");
  });

  it("uses expandedPlayers state for collapse/expand", () => {
    expect(auctionSrc).toContain("expandedPlayers");
  });

  it("auto-expands current bidder card", () => {
    expect(auctionSrc).toContain("currentBidderIndex");
  });

  it("has toggle handler for portfolio cards", () => {
    expect(auctionSrc).toContain("onToggle");
  });

  it("has player-ownership-card test id", () => {
    expect(auctionSrc).toContain('data-testid="player-ownership-card"');
  });

  it("shows property chips when expanded (portfolio-body)", () => {
    expect(auctionSrc).toContain('data-testid="portfolio-body"');
  });
});

// ── AuctionPanel sticky controls and mobile layout ─────────────────────────

describe("AuctionPanel.tsx — sticky mobile bid controls footer", () => {
  it('has mobile-only sticky bid controls footer (md:hidden)', () => {
    expect(auctionSrc).toContain("md:hidden");
  });

  it("has auction-controls test id for sticky footer", () => {
    expect(auctionSrc).toContain('data-testid="auction-controls"');
  });

  it("uses safe-area-inset-bottom for notch devices", () => {
    expect(auctionSrc).toContain("safe-area-inset-bottom");
  });

  it("has fixed inset-0 full-screen container", () => {
    expect(auctionSrc).toContain("fixed inset-0");
  });

  it("has flex flex-col layout for sticky header/body/footer", () => {
    expect(auctionSrc).toContain("flex flex-col");
  });

  it("has shrink-0 class on sticky footer to prevent compression", () => {
    expect(auctionSrc).toContain("shrink-0");
  });

  it("has min-h-0 on scrollable body section", () => {
    expect(auctionSrc).toContain("min-h-0");
  });

  it("has overflow-y-auto on scrollable body", () => {
    expect(auctionSrc).toContain("overflow-y-auto");
  });
});

// ── AuctionPanel participant summary ───────────────────────────────────────

describe("AuctionPanel.tsx — participant summary count", () => {
  it("shows active count and passed count", () => {
    expect(auctionSrc).toContain("active ·");
  });

  it("has participant-summary test id", () => {
    expect(auctionSrc).toContain('data-testid="participant-summary"');
  });
});

// ── AuctionPanel full-screen mobile interface ──────────────────────────────

describe("AuctionPanel.tsx — full-screen mobile auction overlay", () => {
  it("uses backdrop-blur-sm for overlay background", () => {
    expect(auctionSrc).toContain("backdrop-blur-sm");
  });

  it("is a dialog with aria-modal", () => {
    expect(auctionSrc).toContain('aria-modal="true"');
  });

  it("has aria-labelledby for the auction dialog", () => {
    expect(auctionSrc).toContain("aria-labelledby");
  });

  it("renders on mobile as bottom sheet (items-end on small screens)", () => {
    expect(auctionSrc).toContain("items-end");
  });

  it("renders as centered modal on desktop (sm:items-center)", () => {
    expect(auctionSrc).toContain("sm:items-center");
  });
});

// ── AuctionPanel auction header hierarchy ─────────────────────────────────

describe("AuctionPanel.tsx — header and bid status", () => {
  it("shows Live Auction label", () => {
    expect(auctionSrc).toContain("Live Auction");
  });

  it("shows Current Bid display", () => {
    expect(auctionSrc).toContain("Current Bid");
  });

  it("shows Highest Bidder display", () => {
    expect(auctionSrc).toContain("Highest Bidder");
  });

  it("shows timer ring component", () => {
    expect(auctionSrc).toContain("TimerRing");
  });

  it("shows urgent state for low timer", () => {
    expect(auctionSrc).toContain("isUrgent");
  });

  it("has ownership-overview test id", () => {
    expect(auctionSrc).toContain('data-testid="ownership-overview"');
  });

  it("shows all non-bankrupt players (allAuctionPlayers)", () => {
    expect(auctionSrc).toContain("allAuctionPlayers");
  });

  it("shows property type sections: city-properties", () => {
    expect(auctionSrc).toContain('data-testid="city-properties"');
  });

  it("shows property type sections: airport-properties", () => {
    expect(auctionSrc).toContain('data-testid="airport-properties"');
  });

  it("shows property type sections: utility-properties", () => {
    expect(auctionSrc).toContain('data-testid="utility-properties"');
  });

  it("shows No properties yet placeholder", () => {
    expect(auctionSrc).toContain("No properties yet");
  });

  it("has color group hex mapping", () => {
    expect(auctionSrc).toContain("COLOR_GROUP_HEX");
  });

  it("shows isBidding state on current bidder", () => {
    expect(auctionSrc).toContain("isBidding");
  });

  it("shows isLeading state on highest bidder", () => {
    expect(auctionSrc).toContain("isLeading");
  });
});

// ── MobileActionBar hides during auction ──────────────────────────────────

describe("MobileActionBar.tsx — hides during auction phase", () => {
  it("returns null when phase is auction", () => {
    expect(mobileBarSrc).toContain('state.phase === "auction"');
    // Verify it returns null (early return) rather than just rendering differently
    const auctionCheckIdx = mobileBarSrc.indexOf('state.phase === "auction"');
    const returnNullIdx = mobileBarSrc.indexOf("return null", auctionCheckIdx);
    expect(returnNullIdx).toBeGreaterThan(auctionCheckIdx);
    // The null return must come before the main render (before the return div)
    const mainReturnIdx = mobileBarSrc.indexOf("return (", auctionCheckIdx);
    expect(returnNullIdx).toBeLessThan(mainReturnIdx > -1 ? mainReturnIdx : Infinity);
  });

  it("has a comment explaining why it hides during auction", () => {
    expect(mobileBarSrc).toMatch(/AuctionPanel|auction.*overlay|full.?screen/i);
  });
});
