import { describe, expect, it, vi } from "vitest";
import { copyText } from "@/lib/ui/clipboard";

type ClipboardEnvironment = Parameters<typeof copyText>[1];

function makeEnvironment(fallbackResult: boolean) {
  const textarea = { value: "", setAttribute: vi.fn(), style: {}, select: vi.fn(), remove: vi.fn() };
  return {
    textarea,
    environment: {
      document: { body: { appendChild: vi.fn() }, createElement: vi.fn(() => textarea), execCommand: vi.fn(() => fallbackResult) },
    },
  };
}

describe("clipboard helper", () => {
  it("reports success when the Clipboard API succeeds", async () => {
    const { environment } = makeEnvironment(false);
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    await expect(copyText("ROOM-1234", { ...environment, clipboard } as unknown as ClipboardEnvironment)).resolves.toBe(true);
    expect(environment.document.execCommand).not.toHaveBeenCalled();
  });

  it("uses and removes a textarea fallback after Clipboard API failure", async () => {
    const { environment, textarea } = makeEnvironment(true);
    const clipboard = { writeText: vi.fn().mockRejectedValue(new Error("denied")) };
    await expect(copyText("ROOM-1234", { ...environment, clipboard } as unknown as ClipboardEnvironment)).resolves.toBe(true);
    expect(environment.document.execCommand).toHaveBeenCalledWith("copy");
    expect(textarea.remove).toHaveBeenCalled();
  });

  it("returns failure when both copy methods fail", async () => {
    const { environment } = makeEnvironment(false);
    await expect(copyText("ROOM-1234", environment as unknown as ClipboardEnvironment)).resolves.toBe(false);
  });
});
