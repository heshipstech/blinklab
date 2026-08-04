import { describe, expect, it } from "vitest";

import type { Fixation } from "../../src/core/fixation";
import { fixationStats } from "../../src/core/fixationStats";

// Builders keep the fixtures honest: only durations should matter to
// the statistics, so starts and centroids vary freely.
function fixation(startMs: number, durationMs: number): Fixation {
  return {
    startMs,
    endMs: startMs + durationMs,
    centroid: { horizontal: startMs / 10000, vertical: -startMs / 20000 },
  };
}

describe("fixationStats", () => {
  it("refuses an empty window with null, never fake zeros", () => {
    expect(fixationStats([])).toBeNull();
  });

  it("reports a single fixation as all four numbers at once", () => {
    const stats = fixationStats([fixation(500, 200)]);
    expect(stats).toEqual({
      count: 1,
      meanMs: 200,
      medianMs: 200,
      longestMs: 200,
    });
  });

  it("aggregates a known set exactly, unordered input welcome", () => {
    const stats = fixationStats([
      fixation(9000, 300),
      fixation(0, 100),
      fixation(5000, 400),
      fixation(2000, 200),
    ]);
    // Median follows the house nearest rank convention: for an even
    // count it is the lower middle value, here 200, not 250.
    expect(stats).toEqual({
      count: 4,
      meanMs: 250,
      medianMs: 200,
      longestMs: 400,
    });
  });

  it("takes the true middle of an odd count", () => {
    const stats = fixationStats([
      fixation(0, 120),
      fixation(1000, 300),
      fixation(3000, 180),
    ]);
    expect(stats).toEqual({
      count: 3,
      meanMs: 200,
      medianMs: 180,
      longestMs: 300,
    });
  });

  it("ignores where fixations sit, durations are the only input", () => {
    const near = [fixation(0, 150), fixation(200, 250)];
    const far = [fixation(60000, 150), fixation(90000, 250)];
    expect(fixationStats(near)).toEqual(fixationStats(far));
  });
});
