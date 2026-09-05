import { describe, expect, it } from "vitest";

import {
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
  LEFT_EYE_EAR_INDICES,
  LEFT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import { apertureMm } from "../../src/core/aperture";
import {
  STILLNESS_FRACTION,
  apertureNoiseStats,
  consecutiveKeptDeltas,
  stillnessMask,
} from "../../src/core/apertureNoise";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.7a. Every millimetre the page prints rides apertureMm,
// and until now no committed number said how much that measurement
// wobbles when nothing happens. The stats here are pure and pinned on
// hand-built series; the last test recomputes the committed floor
// from the fixture and holds docs/aperture-noise-floor.txt to it, so
// the published wobble number can never drift from the code that
// measures it. The prediction was committed before any of these
// numbers existed — commit order is the proof.

describe("the stillness mask", () => {
  it("keeps steady frames and excludes a blink dip by the committed rule", () => {
    // Median of the non-null values is 8; 75% of it is 6. The dip to 3
    // is a blink and goes; the null is unmeasured and goes.
    const mask = stillnessMask([8, 8.2, 3, 7.9, null, 8.1]);
    expect(mask).toEqual([true, true, false, true, false, true]);
  });

  it("uses each series' own median, not a fixed line", () => {
    // A uniformly small aperture is a small face, not one long blink.
    expect(stillnessMask([2, 2.1, 1.9, 2])).toEqual([true, true, true, true]);
  });
});

describe("consecutive kept deltas", () => {
  it("measures exactly the steps between kept neighbours", () => {
    const deltas = consecutiveKeptDeltas(
      [8, 8.5, 7.9, 8.0],
      [true, true, true, true],
    );
    expect(deltas).toEqual([0.5, 0.6, 0.1].map((d) => expect.closeTo(d, 10)));
  });

  it("never bridges an excluded frame", () => {
    // 8 -> (blink, excluded) -> 8.4: counting 0.4 across the gap would
    // smuggle the blink's recovery back into the floor.
    const deltas = consecutiveKeptDeltas(
      [8, 3, 8.4, 8.4],
      [true, false, true, true],
    );
    expect(deltas).toEqual([0]);
  });
});

describe("the assembled statistics", () => {
  it("computes exact medians and exclusion counts on a hand-built pair", () => {
    const left = [8, 8, 8, 8, 8, 8, 8, 8, 8, 3];
    const right = [7, 7, 7, 7, 7, 7, 7, 7, 7, 7];
    const stats = apertureNoiseStats(left, right);
    expect(stats.keptFrames).toBe(9);
    expect(stats.excludedFrames).toBe(1);
    expect(stats.left.medianDeltaMm).toBe(0);
    expect(stats.right.p95DeltaMm).toBe(0);
    expect(stats.crossEye.medianMm).toBe(1);
  });

  it("returns null statistics rather than numbers when nothing is kept", () => {
    const stats = apertureNoiseStats([null, null], [null, null]);
    expect(stats.keptFrames).toBe(0);
    expect(stats.left.medianDeltaMm).toBeNull();
    expect(stats.crossEye.medianMm).toBeNull();
  });
});

describe("the committed floor, recomputed from the fixture", () => {
  it("docs/aperture-noise-floor.txt states what the pipeline measures", () => {
    const session = loadSession01();
    const left: (number | null)[] = [];
    const right: (number | null)[] = [];
    for (const frame of session.frames) {
      const face = frameLandmarks(frame);
      left.push(
        apertureMm(
          face,
          LEFT_EYE_EAR_INDICES,
          LEFT_IRIS_RING_INDICES,
          1280,
          720,
        ),
      );
      right.push(
        apertureMm(
          face,
          RIGHT_EYE_EAR_INDICES,
          RIGHT_IRIS_RING_INDICES,
          1280,
          720,
        ),
      );
    }
    const stats = apertureNoiseStats(left, right);
    const doc = readRepoFile("docs/aperture-noise-floor.txt", repoRoot());

    expect(doc).toContain("THE FLOOR, MEASURED");
    const pin = (label: string, value: number | null) => {
      expect(value, label).not.toBeNull();
      expect(doc, label).toContain(`${label} ${(value as number).toFixed(3)}`);
    };
    pin("left median delta mm:", stats.left.medianDeltaMm);
    pin("left p95 delta mm:", stats.left.p95DeltaMm);
    pin("right median delta mm:", stats.right.medianDeltaMm);
    pin("right p95 delta mm:", stats.right.p95DeltaMm);
    pin("cross-eye median mm:", stats.crossEye.medianMm);
    pin("cross-eye p95 mm:", stats.crossEye.p95Mm);
    expect(doc).toContain(`kept frames: ${String(stats.keptFrames)} of 300`);
    // The committed exclusion rule and the code's constant are one.
    expect(STILLNESS_FRACTION).toBe(0.75);
    expect(doc).toContain("75 percent");
  });
});
