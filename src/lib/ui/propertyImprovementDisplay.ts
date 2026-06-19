/** Pure helper for property improvement display — testable without a DOM renderer. */

export type PropertyImprovementDisplay =
  | { kind: "none" }
  | { kind: "houses"; count: number; label: string }
  | { kind: "hotel"; label: string };

export function getPropertyImprovementDisplay(ownership: {
  houses: number;
  hasHotel: boolean;
}): PropertyImprovementDisplay {
  if (ownership.hasHotel) {
    return { kind: "hotel", label: "Hotel" };
  }
  if (ownership.houses > 0) {
    return {
      kind: "houses",
      count: ownership.houses,
      label: `${ownership.houses} house${ownership.houses > 1 ? "s" : ""}`,
    };
  }
  return { kind: "none" };
}
