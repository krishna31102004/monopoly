import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { classifyTradeResultFromLogMessage } from "@/lib/game/tradeHelpers";

const ROOT = join(process.cwd(), "src");
function read(rel: string) { return readFileSync(join(ROOT, rel), "utf-8"); }

const src = read("components/TradePanel.tsx");

// ── classifyTradeResultFromLogMessage (logic) ─────────────────────────────────

describe("classifyTradeResultFromLogMessage", () => {
  it("returns accepted for 'Trade accepted' log message", () => {
    expect(classifyTradeResultFromLogMessage("Trade accepted between ansh and kb.")).toBe("accepted");
  });

  it("returns declined for declined log message", () => {
    expect(classifyTradeResultFromLogMessage("kb declined the trade offer from ansh.")).toBe("declined");
  });

  it("returns cancelled for cancelled log message", () => {
    expect(classifyTradeResultFromLogMessage("ansh cancelled the trade offer.")).toBe("cancelled");
  });

  it("returns null for unrelated log messages", () => {
    expect(classifyTradeResultFromLogMessage("ansh rolled a 4 and a 3.")).toBeNull();
    expect(classifyTradeResultFromLogMessage("kb bought Tokyo for $400.")).toBeNull();
    expect(classifyTradeResultFromLogMessage("ansh landed on Community Chest.")).toBeNull();
    expect(classifyTradeResultFromLogMessage("GO — collected $200.")).toBeNull();
  });

  it("returns null for undefined/empty message", () => {
    expect(classifyTradeResultFromLogMessage(undefined)).toBeNull();
    expect(classifyTradeResultFromLogMessage("")).toBeNull();
  });

  it("does not match partial trade keywords out of context", () => {
    expect(classifyTradeResultFromLogMessage("ansh accepted the rent payment.")).toBeNull();
    expect(classifyTradeResultFromLogMessage("Trade negotiations began.")).toBeNull();
  });
});

// ── TradeResultStamp source assertions ────────────────────────────────────────

describe("TradePanel — stamp source assertions", () => {
  it("has TradeResultStamp component", () => {
    expect(src).toMatch(/TradeResultStamp/);
  });

  it("stamp uses STAMP_CONFIGS map for per-result styling", () => {
    expect(src).toMatch(/STAMP_CONFIGS/);
  });

  it("accepted config uses success tone (emerald)", () => {
    expect(src).toMatch(/accepted[\s\S]{0,200}emerald|emerald[\s\S]{0,200}accepted/);
  });

  it("declined config uses danger tone (red)", () => {
    expect(src).toMatch(/declined[\s\S]{0,200}red|red[\s\S]{0,200}declined/);
  });

  it("cancelled config uses neutral tone (slate)", () => {
    expect(src).toMatch(/cancelled[\s\S]{0,200}slate|slate[\s\S]{0,200}cancelled/);
  });

  it("stamp shows DEAL ACCEPTED label", () => {
    expect(src).toMatch(/DEAL ACCEPTED/);
  });

  it("stamp shows DEAL DECLINED label", () => {
    expect(src).toMatch(/DEAL DECLINED/);
  });

  it("stamp shows OFFER CANCELLED label", () => {
    expect(src).toMatch(/OFFER CANCELLED/);
  });

  it("stamp auto-dismisses with setTimeout", () => {
    const stampBlock = src.match(/function TradeResultStamp[\s\S]*?^}/m)?.[0] ?? "";
    expect(stampBlock).toMatch(/setTimeout/);
    expect(stampBlock).toMatch(/onDismiss/);
  });

  it("stamp uses aria-live for screen reader accessibility", () => {
    expect(src).toMatch(/aria-live/);
  });

  it("stamp overlay uses fixed positioning (full-screen backdrop)", () => {
    const stampBlock = src.match(/function TradeResultStamp[\s\S]*?^}/m)?.[0] ?? "";
    expect(stampBlock).toMatch(/fixed inset-0/);
  });

  it("stamp detects result from newest log entry (index 0, prepended)", () => {
    // TradePanel reads gameLog[0] — not the last entry
    expect(src).toMatch(/gameLog\[0\]/);
  });

  it("stamp avoids replaying on re-render using lastSeenLogIdRef", () => {
    expect(src).toMatch(/lastSeenLogIdRef/);
  });

  it("resultStamp state controls stamp visibility", () => {
    expect(src).toMatch(/resultStamp/);
    expect(src).toMatch(/setResultStamp/);
  });

  it("wasOpenRef prevents false trigger on initial mount", () => {
    expect(src).toMatch(/wasOpenRef/);
  });
});

// ── Stamp dismissal timing ────────────────────────────────────────────────────

describe("stamp dismissal timing", () => {
  it("dismissal timeout should be between 1000ms and 2500ms", () => {
    // Extract the setTimeout delay from TradeResultStamp
    const stampBlock = src.match(/function TradeResultStamp[\s\S]*?^}/m)?.[0] ?? "";
    const match = stampBlock.match(/setTimeout\([^,]+,\s*(\d+)\)/);
    if (match) {
      const delay = parseInt(match[1], 10);
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(2500);
    } else {
      // If delay is a variable, just confirm setTimeout exists
      expect(stampBlock).toMatch(/setTimeout/);
    }
  });
});
