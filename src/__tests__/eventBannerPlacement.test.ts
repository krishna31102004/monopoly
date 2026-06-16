// Vitest in this repo cannot parse JSX from "use client" .tsx components in .test.ts files
// (no DOM testing library installed), so the event banner's placement is verified through its
// underlying helper rather than rendering GameEventBanner/GameBoard directly.
import { describe, it, expect } from "vitest";
import { getGameEventBannerFromLogEntry, getEventBannerPlacement } from "@/lib/ui/gameEventPresentation";
import type { GameLogEntry } from "@/types/game";

function entry(message: string): GameLogEntry {
  return { id: "log-1", message, createdAt: new Date().toISOString() };
}

describe("event banner placement", () => {
  it("purchase event banner uses a safe placement, not the top-row board edge", () => {
    const banner = getGameEventBannerFromLogEntry(entry("kb bought Bengaluru for $120."));
    expect(banner?.placement).toBe("board-center");
    expect(banner?.placement).not.toBe("board-top-edge");
  });

  it("rent/payment event banner uses a safe placement", () => {
    const banner = getGameEventBannerFromLogEntry(entry("ansh paid kb $400 rent for JFK Airport."));
    expect(banner?.placement).toBe("board-center");
  });

  it("card-related event banners use a safe placement", () => {
    const banner = getGameEventBannerFromLogEntry(entry("kb cannot pay and must resolve bankruptcy."));
    expect(banner?.placement).toBe("board-center");
  });

  it("auction event banners use a safe placement", () => {
    const start = getGameEventBannerFromLogEntry(entry("kb declined to buy JFK Airport. Auction started."));
    const win = getGameEventBannerFromLogEntry(entry("ansh won JFK Airport at auction for $180."));
    const noBid = getGameEventBannerFromLogEntry(entry("No one bid on JFK Airport. It remains unowned."));
    expect(start?.placement).toBe("board-center");
    expect(win?.placement).toBe("board-center");
    expect(noBid?.placement).toBe("board-center");
  });

  it("trade event banners use a safe placement (also relevant for mobile, which reuses the same helper)", () => {
    const banner = getGameEventBannerFromLogEntry(entry("Trade accepted: kb gave $100 to ansh in exchange for nothing."));
    expect(banner?.placement).toBe("board-center");
  });

  it("getEventBannerPlacement never returns the unsafe board-top-edge zone", () => {
    expect(getEventBannerPlacement("purchase")).not.toBe("board-top-edge");
    expect(getEventBannerPlacement("debtPending")).not.toBe("board-top-edge");
    expect(getEventBannerPlacement("auctionWin")).not.toBe("board-top-edge");
  });
});
