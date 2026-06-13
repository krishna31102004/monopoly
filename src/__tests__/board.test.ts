import { describe, it, expect } from "vitest";
import { boardSpaces, getBoardSpaceByIndex } from "@/data/board";
import type { CityProperty, AirportProperty } from "@/types/board";

describe("Board data", () => {
  it("has exactly 40 spaces", () => {
    expect(boardSpaces).toHaveLength(40);
  });

  it("has indices 0 through 39 with no duplicates", () => {
    const indices = boardSpaces.map((s) => s.index);
    expect(new Set(indices).size).toBe(40);
    expect(Math.min(...indices)).toBe(0);
    expect(Math.max(...indices)).toBe(39);
  });

  it("space 0 is GO", () => {
    const space = getBoardSpaceByIndex(0);
    expect(space.kind).toBe("go");
    expect(space.name).toBe("GO");
  });

  it("space 10 is Jail / Just Visiting", () => {
    const space = getBoardSpaceByIndex(10);
    expect(space.kind).toBe("jail");
  });

  it("space 20 is Free Parking", () => {
    const space = getBoardSpaceByIndex(20);
    expect(space.kind).toBe("free-parking");
  });

  it("space 30 is Go To Jail", () => {
    const space = getBoardSpaceByIndex(30);
    expect(space.kind).toBe("go-to-jail");
  });

  it("Chance spaces are at 7, 22, 36", () => {
    const chanceIndices = boardSpaces.filter((s) => s.kind === "chance").map((s) => s.index);
    expect(chanceIndices).toEqual([7, 22, 36]);
  });

  it("Community Chest spaces are at 2, 17, 33", () => {
    const ccIndices = boardSpaces.filter((s) => s.kind === "community-chest").map((s) => s.index);
    expect(ccIndices).toEqual([2, 17, 33]);
  });

  it("Tax spaces are at 4 (Income Tax $200) and 38 (Luxury Tax)", () => {
    const taxSpaces = boardSpaces.filter((s) => s.kind === "tax");
    const indices = taxSpaces.map((s) => s.index);
    expect(indices).toContain(4);
    expect(indices).toContain(38);
  });

  it("Electric Company is at 12, Water Works at 28", () => {
    const ec = getBoardSpaceByIndex(12);
    const ww = getBoardSpaceByIndex(28);
    expect(ec.kind).toBe("utility");
    expect(ec.name).toContain("Electric");
    expect(ww.kind).toBe("utility");
    expect(ww.name).toContain("Water");
  });

  it("Airports are at 5, 15, 25, 35", () => {
    const airportIndices = boardSpaces.filter((s) => s.kind === "airport").map((s) => s.index);
    expect(airportIndices).toEqual([5, 15, 25, 35]);
  });

  it("airports are named correctly", () => {
    const airports = boardSpaces.filter((s) => s.kind === "airport");
    const names = airports.map((s) => s.name);
    expect(names).toContain("JFK Airport");
    expect(names).toContain("Heathrow Airport");
    expect(names).toContain("Dubai International Airport");
    expect(names).toContain("Changi Airport");
  });

  it("Mexico group: Guadalajara, Cancún", () => {
    const cities = boardSpaces.filter(
      (s): s is CityProperty => s.kind === "city" && s.country === "Mexico",
    );
    const names = cities.map((c) => c.name);
    expect(names).toContain("Guadalajara");
    expect(names).toContain("Cancún");
    expect(cities.every((c) => c.colorGroup === "brown")).toBe(true);
  });

  it("India group: Mumbai, Delhi, Bengaluru", () => {
    const cities = boardSpaces.filter(
      (s): s is CityProperty => s.kind === "city" && s.country === "India",
    );
    const names = cities.map((c) => c.name);
    expect(names).toContain("Mumbai");
    expect(names).toContain("Delhi");
    expect(names).toContain("Bengaluru");
    expect(cities.every((c) => c.colorGroup === "light-blue")).toBe(true);
  });

  it("Germany group: Hamburg, Munich, Berlin", () => {
    const cities = boardSpaces.filter(
      (s): s is CityProperty => s.kind === "city" && s.country === "Germany",
    );
    const names = cities.map((c) => c.name);
    expect(names).toContain("Hamburg");
    expect(names).toContain("Munich");
    expect(names).toContain("Berlin");
    expect(cities.every((c) => c.colorGroup === "pink")).toBe(true);
  });

  it("UAE group: Sharjah, Abu Dhabi, Dubai", () => {
    const cities = boardSpaces.filter(
      (s): s is CityProperty => s.kind === "city" && s.country === "UAE",
    );
    const names = cities.map((c) => c.name);
    expect(names).toContain("Sharjah");
    expect(names).toContain("Abu Dhabi");
    expect(names).toContain("Dubai");
    expect(cities.every((c) => c.colorGroup === "orange")).toBe(true);
  });

  it("Italy group: Naples, Milan, Rome", () => {
    const cities = boardSpaces.filter(
      (s): s is CityProperty => s.kind === "city" && s.country === "Italy",
    );
    const names = cities.map((c) => c.name);
    expect(names).toContain("Naples");
    expect(names).toContain("Milan");
    expect(names).toContain("Rome");
    expect(cities.every((c) => c.colorGroup === "red")).toBe(true);
  });

  it("Australia group: Brisbane, Melbourne, Sydney", () => {
    const cities = boardSpaces.filter(
      (s): s is CityProperty => s.kind === "city" && s.country === "Australia",
    );
    const names = cities.map((c) => c.name);
    expect(names).toContain("Brisbane");
    expect(names).toContain("Melbourne");
    expect(names).toContain("Sydney");
    expect(cities.every((c) => c.colorGroup === "yellow")).toBe(true);
  });

  it("England group: Manchester, Liverpool, London", () => {
    const cities = boardSpaces.filter(
      (s): s is CityProperty => s.kind === "city" && s.country === "England",
    );
    const names = cities.map((c) => c.name);
    expect(names).toContain("Manchester");
    expect(names).toContain("Liverpool");
    expect(names).toContain("London");
    expect(cities.every((c) => c.colorGroup === "green")).toBe(true);
  });

  it("USA group: San Francisco, New York", () => {
    const cities = boardSpaces.filter(
      (s): s is CityProperty => s.kind === "city" && s.country === "USA",
    );
    const names = cities.map((c) => c.name);
    expect(names).toContain("San Francisco");
    expect(names).toContain("New York");
    expect(cities.every((c) => c.colorGroup === "dark-blue")).toBe(true);
  });

  it("all ownable spaces have valid prices > 0", () => {
    const ownables = boardSpaces.filter(
      (s) => s.kind === "city" || s.kind === "airport" || s.kind === "utility",
    );
    for (const space of ownables) {
      const price = (space as CityProperty | AirportProperty).price;
      expect(price).toBeGreaterThan(0);
    }
  });

  it("all city properties have a 6-element rent table", () => {
    const cities = boardSpaces.filter((s): s is CityProperty => s.kind === "city");
    for (const city of cities) {
      expect(city.rent).toHaveLength(6);
      expect(city.rent.every((r) => r > 0)).toBe(true);
    }
  });

  it("all airports have railroad-style rent [25, 50, 100, 200]", () => {
    const airports = boardSpaces.filter((s): s is AirportProperty => s.kind === "airport");
    for (const airport of airports) {
      expect(airport.rentByOwnedCount).toEqual([25, 50, 100, 200]);
    }
  });

  it("getBoardSpaceByIndex returns the correct space", () => {
    for (let i = 0; i < 40; i++) {
      expect(getBoardSpaceByIndex(i).index).toBe(i);
    }
  });

  it("total of 22 city properties", () => {
    const cities = boardSpaces.filter((s) => s.kind === "city");
    expect(cities).toHaveLength(22);
  });
});
