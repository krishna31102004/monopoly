import { describe, it, expect } from "vitest";
import { getPropertyImprovementDisplay } from "@/lib/ui/propertyImprovementDisplay";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const boardSpaceSource = readFileSync(
  fileURLToPath(new URL("../components/board/BoardSpace.tsx", import.meta.url)),
  "utf-8",
);

describe("getPropertyImprovementDisplay", () => {
  it("returns none when no houses or hotel", () => {
    expect(getPropertyImprovementDisplay({ houses: 0, hasHotel: false })).toEqual({ kind: "none" });
  });

  it("returns houses display for 1-4 houses", () => {
    for (let count = 1; count <= 4; count++) {
      const result = getPropertyImprovementDisplay({ houses: count, hasHotel: false });
      expect(result.kind).toBe("houses");
      if (result.kind === "houses") {
        expect(result.count).toBe(count);
        expect(result.label).toContain(String(count));
      }
    }
  });

  it("returns hotel display when hasHotel is true", () => {
    const result = getPropertyImprovementDisplay({ houses: 0, hasHotel: true });
    expect(result.kind).toBe("hotel");
    if (result.kind === "hotel") {
      expect(result.label).toBe("Hotel");
    }
  });

  it("hotel label does not contain plain 'H' as the whole label", () => {
    const result = getPropertyImprovementDisplay({ houses: 0, hasHotel: true });
    if (result.kind === "hotel") {
      expect(result.label).not.toBe("H");
    }
  });

  it("hotel kind is distinct from houses kind", () => {
    const hotel = getPropertyImprovementDisplay({ houses: 0, hasHotel: true });
    const houses = getPropertyImprovementDisplay({ houses: 4, hasHotel: false });
    expect(hotel.kind).not.toBe(houses.kind);
  });
});

describe("hotel SVG icon in BoardSpace source", () => {
  it("renders an SVG hotel building (not plain H text) for hotel display", () => {
    expect(boardSpaceSource).toContain("HotelBuildingIcon");
    expect(boardSpaceSource).toContain("<svg");
    expect(boardSpaceSource).toContain('aria-label="Hotel"');
  });

  it("hotel marker does not use H as the primary content", () => {
    // The SVG building uses rect elements for windows/walls, not a plain H glyph
    const hotelBlock = boardSpaceSource.slice(
      boardSpaceSource.indexOf("function HotelBuildingIcon"),
      boardSpaceSource.indexOf("function PropertyBuildings"),
    );
    expect(hotelBlock).not.toMatch(/>H</);
    expect(hotelBlock).toContain("<rect");
  });

  it("hotel has window elements (premium visual detail)", () => {
    const hotelBlock = boardSpaceSource.slice(
      boardSpaceSource.indexOf("function HotelBuildingIcon"),
      boardSpaceSource.indexOf("function PropertyBuildings"),
    );
    // Multiple rects for building structure
    const rectCount = (hotelBlock.match(/<rect/g) ?? []).length;
    expect(rectCount).toBeGreaterThanOrEqual(4);
  });

  it("house display still renders small green squares", () => {
    const housesBlock = boardSpaceSource.slice(
      boardSpaceSource.indexOf("function PropertyBuildings"),
      boardSpaceSource.indexOf("export function BoardSpace"),
    );
    expect(housesBlock).toContain("ownership.houses");
    expect(housesBlock).toContain("#27ae60");
  });

  it("hotel is displayed when hasHotel is true", () => {
    expect(boardSpaceSource).toContain("ownership.hasHotel");
    expect(boardSpaceSource).toContain("HotelBuildingIcon");
  });

  it("hotel title/aria is present so assistive tech understands it is a hotel", () => {
    expect(boardSpaceSource).toContain('"Hotel"');
  });

  it("owner badge rendering is unaffected (still checks owner in canOpen branch)", () => {
    expect(boardSpaceSource).toContain("OwnerNameBadge");
    expect(boardSpaceSource).toContain("owner.name");
  });

  it("mortgage overlay rendering is unaffected", () => {
    expect(boardSpaceSource).toContain("MortgageOverlay");
    expect(boardSpaceSource).toContain("ownership?.isMortgaged");
  });
});
