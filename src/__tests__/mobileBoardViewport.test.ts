// GameBoard's mobile viewport behavior is verified via source text (no DOM renderer available)
// plus the pure scroll-offset/anchor-id helpers it depends on, which are unit tested directly.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getBoardSpaceAnchorId } from "@/lib/ui/mobileLayoutHelpers";

const gameBoardSource = readFileSync(
  fileURLToPath(new URL("../components/board/GameBoard.tsx", import.meta.url)),
  "utf-8",
);

const boardSpaceSource = readFileSync(
  fileURLToPath(new URL("../components/board/BoardSpace.tsx", import.meta.url)),
  "utf-8",
);

describe("mobile board viewport", () => {
  it("mobile board uses a scrollable viewport (overflow-auto) that becomes static on desktop", () => {
    expect(gameBoardSource).toContain("overflow-auto");
    expect(gameBoardSource).toContain("sm:overflow-visible");
  });

  it("desktop does not force the mobile scroll behavior — it scales responsively instead", () => {
    expect(gameBoardSource).toContain("sm:w-full");
    expect(gameBoardSource).toContain("sm:max-w-");
  });

  it("board has a readable mobile minimum size via MOBILE_BOARD_SIZE_PX", () => {
    expect(gameBoardSource).toContain("MOBILE_BOARD_SIZE_PX");
    expect(gameBoardSource).toContain("w-[840px]");
  });

  it("renders a Find Me / Find Current Player control on mobile", () => {
    expect(gameBoardSource).toContain("handleFindMe");
    expect(gameBoardSource).toContain("Find me");
  });

  it("Find Me control is mobile-only (sm:hidden) so it never appears on desktop", () => {
    const findMeBlock = gameBoardSource.slice(gameBoardSource.indexOf("Find Me button"));
    expect(findMeBlock).toContain("sm:hidden");
  });

  it("space anchor helper maps valid indices for all 40 spaces", () => {
    for (let i = 0; i < 40; i++) {
      expect(getBoardSpaceAnchorId(i)).toBe(`board-space-${i}`);
    }
  });

  it("BoardSpace applies the anchor id helper so Find Current Player can target a real DOM node", () => {
    expect(boardSpaceSource).toContain("getBoardSpaceAnchorId");
    expect(boardSpaceSource).toContain("id={getBoardSpaceAnchorId(space.index)}");
  });
});
