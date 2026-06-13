export type MovementResult = {
  from: number;
  to: number;
  passedGo: boolean;
};

export function moveAroundBoard(from: number, steps: number): MovementResult {
  const rawPosition = from + steps;

  return {
    from,
    to: rawPosition % 40,
    passedGo: rawPosition >= 40,
  };
}
