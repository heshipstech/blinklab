import type { Fixation } from "./fixation";
import { mean, percentile } from "./statistics";

// From events to a distribution: 5.7 made fixations, this summarizes
// them. Four numbers over a window of fixations, enough to tell
// reading (many, short) from staring (few, long) at a glance.
export type FixationStats = {
  count: number;
  meanMs: number;
  medianMs: number;
  longestMs: number;
};

export function fixationStats(
  fixations: readonly Fixation[],
): FixationStats | null {
  const durations = fixations.map((f) => f.endMs - f.startMs);
  const meanMs = mean(durations);
  // Median by the house nearest rank convention, same as the 5.4b
  // calibration medians: for an even count, the lower middle value.
  const medianMs = percentile(durations, 50);
  if (meanMs === null || medianMs === null) {
    return null;
  }
  let longestMs = 0;
  for (const duration of durations) {
    longestMs = Math.max(longestMs, duration);
  }
  return { count: durations.length, meanMs, medianMs, longestMs };
}
