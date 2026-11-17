// Blueprint helper (pure, UI side): arrows for a recipe's push on a trait. (The run designer's graph-walk helpers went
// with the run designer.)

/** ▲▲▲ / ▼ arrows for a change in a trait (0 arrows below 0.01). */
export function arrows(d: number): string {
  const a = Math.abs(d);
  const n = a >= 0.06 ? 3 : a >= 0.025 ? 2 : a >= 0.008 ? 1 : 0;
  return (d > 0 ? '▲' : '▼').repeat(n);
}
