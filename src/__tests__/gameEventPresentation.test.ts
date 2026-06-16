import { describe, it, expect } from "vitest";
import {
  classifyGameEvent,
  getGameEventBannerFromLogEntry,
  getEventBannerPlacement,
  shouldShowAuctionBanner,
  type GameEventKind,
} from "@/lib/ui/gameEventPresentation";
import type { GameLogEntry } from "@/types/game";

function entry(message: string): GameLogEntry {
  return { id: "log-1", message, createdAt: new Date().toISOString() };
}

describe("classifyGameEvent", () => {
  it("classifies a property purchase", () => {
    expect(classifyGameEvent("kb bought Bengaluru for $120.")).toBe("purchase");
  });

  it("classifies a rent payment", () => {
    expect(classifyGameEvent("ansh paid kb $400 rent for JFK Airport. (railroad rent)")).toBe("rent");
  });

  it("classifies a tax payment", () => {
    expect(classifyGameEvent("kb paid $200 for Income Tax.")).toBe("tax");
  });

  it("classifies a Free Parking pot collection", () => {
    expect(classifyGameEvent("ansh landed on Free Parking and collected the pot of $500!")).toBe(
      "freeParkingCollect",
    );
  });

  it("classifies an auction start", () => {
    expect(classifyGameEvent("kb declined to buy JFK Airport. Auction started.")).toBe("auctionStart");
  });

  it("classifies an auction win", () => {
    expect(classifyGameEvent("ansh won JFK Airport at auction for $180.")).toBe("auctionWin");
  });

  it("classifies a no-bid auction", () => {
    expect(classifyGameEvent("No one bid on JFK Airport. It remains unowned.")).toBe("auctionNoBid");
  });

  it("classifies an accepted trade", () => {
    expect(classifyGameEvent("Trade accepted: kb gave $100 to ansh in exchange for nothing.")).toBe(
      "tradeAccepted",
    );
  });

  it("classifies a declined trade", () => {
    expect(classifyGameEvent("ansh declined the trade.")).toBe("tradeDeclined");
  });

  it("classifies a cancelled trade", () => {
    expect(classifyGameEvent("kb cancelled the trade.")).toBe("tradeCancelled");
  });

  it("classifies a pending debt", () => {
    expect(classifyGameEvent("kb cannot pay and must resolve bankruptcy.")).toBe("debtPending");
  });

  it("classifies a resolved bankruptcy payment", () => {
    expect(classifyGameEvent("kb paid $850 and resolved the debt.")).toBe("bankruptcyResolved");
  });

  it("returns null for irrelevant/noisy log entries", () => {
    expect(classifyGameEvent("kb's turn begins.")).toBeNull();
    expect(classifyGameEvent("kb landed on Bengaluru. You own this property.")).toBeNull();
    expect(classifyGameEvent(undefined)).toBeNull();
    expect(classifyGameEvent(null)).toBeNull();
  });
});

describe("getGameEventBannerFromLogEntry", () => {
  it("creates a purchase banner from a purchase log", () => {
    const banner = getGameEventBannerFromLogEntry(entry("kb bought Bengaluru for $120."));
    expect(banner).not.toBeNull();
    expect(banner?.kind).toBe("purchase");
    expect(banner?.text).toBe("kb bought Bengaluru for $120.");
    expect(banner?.tone).toBe("success");
  });

  it("creates a rent/payment banner from a rent log", () => {
    const banner = getGameEventBannerFromLogEntry(entry("ansh paid kb $400 rent for JFK Airport."));
    expect(banner?.kind).toBe("rent");
  });

  it("creates a tax banner from a tax log", () => {
    const banner = getGameEventBannerFromLogEntry(entry("kb paid $200 for Luxury Tax."));
    expect(banner?.kind).toBe("tax");
  });

  it("creates a pot-collection banner from a Free Parking log", () => {
    const banner = getGameEventBannerFromLogEntry(entry("ansh landed on Free Parking and collected the pot of $500!"));
    expect(banner?.kind).toBe("freeParkingCollect");
  });

  it("creates a trade banner from a trade-accepted log", () => {
    const banner = getGameEventBannerFromLogEntry(entry("Trade accepted: kb gave $100 to ansh in exchange for nothing."));
    expect(banner?.kind).toBe("tradeAccepted");
  });

  it("creates a payment-required banner from a debt-pending log", () => {
    const banner = getGameEventBannerFromLogEntry(entry("kb cannot pay and must resolve bankruptcy."));
    expect(banner?.kind).toBe("debtPending");
    expect(banner?.tone).toBe("danger");
  });

  it("returns null for irrelevant log entries so the banner doesn't get noisy", () => {
    expect(getGameEventBannerFromLogEntry(entry("kb's turn begins."))).toBeNull();
    expect(getGameEventBannerFromLogEntry(null)).toBeNull();
    expect(getGameEventBannerFromLogEntry(undefined)).toBeNull();
  });

  it("never places a banner over the board's top edge — only the safe board-center zone", () => {
    const banner = getGameEventBannerFromLogEntry(entry("kb bought Bengaluru for $120."));
    expect(banner?.placement).toBe("board-center");
    expect(banner?.placement).not.toBe("board-top-edge");
  });
});

describe("getEventBannerPlacement", () => {
  const kinds: GameEventKind[] = [
    "purchase",
    "rent",
    "tax",
    "freeParkingCollect",
    "auctionStart",
    "auctionWin",
    "auctionNoBid",
    "tradeAccepted",
    "tradeDeclined",
    "tradeCancelled",
    "debtPending",
    "bankruptcyResolved",
  ];

  it("returns a safe placement (never board-top-edge) for every event kind", () => {
    for (const kind of kinds) {
      expect(getEventBannerPlacement(kind)).toBe("board-center");
      expect(getEventBannerPlacement(kind)).not.toBe("board-top-edge");
    }
  });
});

describe("shouldShowAuctionBanner", () => {
  it("is true for auction start, win, and no-bid log entries", () => {
    expect(shouldShowAuctionBanner(entry("kb declined to buy JFK Airport. Auction started."))).toBe(true);
    expect(shouldShowAuctionBanner(entry("ansh won JFK Airport at auction for $180."))).toBe(true);
    expect(shouldShowAuctionBanner(entry("No one bid on JFK Airport. It remains unowned."))).toBe(true);
  });

  it("is false for unrelated log entries", () => {
    expect(shouldShowAuctionBanner(entry("kb bought Bengaluru for $120."))).toBe(false);
    expect(shouldShowAuctionBanner(null)).toBe(false);
  });
});
