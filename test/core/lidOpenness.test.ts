import { describe, expect, it } from "vitest";

import { BASELINE_OVER_RESTING_CEILING } from "../../src/core/rulerFit";
import {
  LID_OPENNESS_MAX_PLAUSIBLE,
  lidOpennessRatio,
  lidOpennessSentence,
} from "../../src/core/lidOpenness";

// Roadmap 12.7. The ratio of the current aperture to the frozen shut
// baseline: how open the lid sits right now as a fraction of the
// open-eye ruler the shut line is placed from. An instrument, exported
// and shown, never a verdict — 12.18 is the row that would earn a word
// about what it means.

describe("the lid openness ratio", () => {
  it("is the aperture over the frozen baseline when both are sound", () => {
    // 7 mm aperture against a 7 mm frozen baseline reads fully open.
    expect(lidOpennessRatio(7, 7)).toBe(1);
    // Half-open reads a half.
    expect(lidOpennessRatio(3.5, 7)).toBe(0.5);
  });

  it("reads a shut eye near a third, the instrument's known floor", () => {
    // The README records that the instrument reads a fully shut eye at
    // roughly a third of the open baseline, not zero, so a closing lid
    // walks the ratio down toward there rather than to 0.
    expect(lidOpennessRatio(2.31, 7)).toBeCloseTo(0.33, 2);
  });

  it("measures a fully shut zero aperture as zero, not as absence", () => {
    // Null-never-zero, from the other side: a measured 0 mm gap is a
    // real reading and reads 0, distinct from a frame that could not
    // be measured, which reads null below.
    expect(lidOpennessRatio(0, 7)).toBe(0);
  });
});

describe("the born-wrong-ruler refusal", () => {
  it("refuses when there is no frozen baseline to divide by", () => {
    expect(lidOpennessRatio(7, null)).toBeNull();
  });

  it("refuses a baseline that is zero or negative, an impossible ruler", () => {
    expect(lidOpennessRatio(7, 0)).toBeNull();
    expect(lidOpennessRatio(7, -1)).toBeNull();
  });

  it("refuses when the aperture was not measured this frame", () => {
    expect(lidOpennessRatio(null, 7)).toBeNull();
  });

  it("refuses a ratio past the plausibility ceiling: the ruler froze low", () => {
    // docs/shut-line-rule.txt (P2): a baseline that froze wrong-low
    // makes the ratio inflate past what an eyelid can do. Above the
    // ceiling the ruler is the likelier explanation, so the reading is
    // refused as null rather than published as a number nobody trusts.
    // Literal probes either side of 1.25 (roadmap 10.1c): a probe
    // derived from the constant would move with it and pin nothing.
    expect(lidOpennessRatio(1.24 * 7, 7)).toBeCloseTo(1.24, 5);
    expect(lidOpennessRatio(1.25 * 7, 7)).toBeCloseTo(1.25, 5);
    expect(lidOpennessRatio(1.26 * 7, 7)).toBeNull();
  });

  it("holds the ceiling at 1.25, the ruler-fit tolerance", () => {
    // The same 1.25 the ruler-fit ceiling uses (rulerFit.ts, from the
    // six-person validation round), read from the other direction. The
    // literal is here so moving the shared constant reddens this test.
    expect(LID_OPENNESS_MAX_PLAUSIBLE).toBe(1.25);
    expect(LID_OPENNESS_MAX_PLAUSIBLE).toBe(BASELINE_OVER_RESTING_CEILING);
  });
});

describe("the panel sentence", () => {
  it("states the openness as a percentage of the frozen baseline", () => {
    expect(lidOpennessSentence(0.85)).toBe(
      "Lid openness: 85% of the frozen open baseline",
    );
    expect(lidOpennessSentence(1)).toBe(
      "Lid openness: 100% of the frozen open baseline",
    );
  });

  it("says no valid measurement, not a number, when the ruler was refused", () => {
    expect(lidOpennessSentence(null)).toBe(
      "Lid openness: no valid measurement",
    );
  });
});
