// Types for the plain JavaScript arithmetic next door, kept in step
// with analysis/blinklab/stats.py by a committed table of cases.

/** Wilson's score interval as fractions, clamped to [0, 1]. */
export function wilsonInterval(
  successes: number,
  trials: number,
  confidence?: number,
): [number, number];

/** "79.7 to 86.9", the form a published sentence carries. */
export function intervalPercent(
  successes: number,
  trials: number,
  confidence?: number,
): string;
