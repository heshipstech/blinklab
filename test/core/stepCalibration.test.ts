import { describe, expect, it } from "vitest";

import {
  CALIBRATION_QUANTUM_S,
  INEXACT_LANDING_TOLERANCE,
  calibrateStep,
  checkLandings,
  landingRefusal,
  steppingMetadataRows,
  variableRateRefusal,
} from "../../src/core/stepCalibration";

// The September audit's critical finding (docs/stepper-honesty.txt):
// one short gap among the calibration frames set a step shorter than
// the clip's period, every later target inside a frame already showing
// was measured again under an invented timestamp, and a 20 fps clip
// reported 40 fps through the 25 fps refusal. These are the rules that
// make an inexact landing a fact and a non-multiple gap a refusal.

describe("calibrateStep, the period from the first frames' own times", () => {
  it("calibrates equal gaps to that gap", () => {
    const times = [0, 1, 2, 3, 4, 5].map((k) => k / 30);
    const result = calibrateStep(times);
    expect(result.kind).toBe("calibrated");
    if (result.kind !== "calibrated") throw new Error("expected calibrated");
    expect(result.periodSeconds).toBeCloseTo(1 / 30, 9);
    expect(result.smallestGapSeconds).toBeCloseTo(1 / 30, 9);
    expect(result.frames).toBe(6);
  });

  it("calibrates a 33/34 ms alternation to the MEAN period, not the smallest gap", () => {
    // A 29.97 fps clip with millisecond timestamps. The smallest gap
    // under-reads the period by half a millisecond, and a schedule
    // built on it drifts a frame every ninety.
    const times = [0, 0.033, 0.067, 0.1, 0.134, 0.167, 0.201];
    const result = calibrateStep(times);
    if (result.kind !== "calibrated") throw new Error("expected calibrated");
    expect(result.periodSeconds).toBeCloseTo(0.201 / 6, 9);
    expect(result.smallestGapSeconds).toBeCloseTo(0.033, 9);
  });

  it("treats a skipped probe as a whole multiple and keeps the period", () => {
    // WebKit on a Linux runner skipped half the probes: the gap it saw
    // was two intervals, never less than one.
    const times = [0, 1 / 30, 3 / 30, 4 / 30, 5 / 30];
    const result = calibrateStep(times);
    if (result.kind !== "calibrated") throw new Error("expected calibrated");
    expect(result.periodSeconds).toBeCloseTo(1 / 30, 9);
  });

  it("refuses a gap that is not a whole multiple of the smallest, by name", () => {
    // 40 ms frames with one 25 ms gap: 40 / 25 is 1.6, ten milliseconds
    // from any whole number. That is what a variable frame rate looks
    // like from the first frames, and it is refused before the first
    // frame is measured rather than stepped at 25 ms.
    const times = [0, 0.04, 0.08, 0.105, 0.145];
    const result = calibrateStep(times);
    expect(result.kind).toBe("variableRate");
    if (result.kind !== "variableRate") throw new Error("expected a refusal");
    expect(result.smallestGapSeconds).toBeCloseTo(0.025, 9);
    expect(result.offendingGapSeconds).toBeCloseTo(0.04, 9);
  });

  it("cannot tell a half-period glitch from a skipped probe, and says so", () => {
    // 40 ms gaps ARE whole multiples of a 20 ms glitch. This calibrates
    // at 20 ms; the landing check downstream refuses the run, because
    // half its targets land inside frames already showing. Pinned so
    // the limit is a stated one, not a surprise.
    const times = [0, 0.04, 0.08, 0.1, 0.14, 0.18];
    const result = calibrateStep(times);
    if (result.kind !== "calibrated") throw new Error("expected calibrated");
    expect(result.periodSeconds).toBeCloseTo(0.02, 9);
  });

  it("accepts a residual of exactly the quantum and refuses one beyond it", () => {
    expect(CALIBRATION_QUANTUM_S).toBe(0.0015);
    expect(calibrateStep([0, 0.033, 0.0675]).kind).toBe("calibrated");
    expect(calibrateStep([0, 0.033, 0.0676]).kind).toBe("variableRate");
  });

  it("is too few with fewer than two frames", () => {
    expect(calibrateStep([])).toEqual({ kind: "tooFew", frames: 0 });
    expect(calibrateStep([1.7])).toEqual({ kind: "tooFew", frames: 1 });
  });

  it("refuses an implausible smallest gap: a microsecond, a second, or no advance", () => {
    expect(calibrateStep([0, 0.0005]).kind).toBe("implausible");
    expect(calibrateStep([0, 1.5]).kind).toBe("implausible");
    expect(calibrateStep([0, 0.033, 0.033]).kind).toBe("implausible");
    const result = calibrateStep([0, 1.5]);
    if (result.kind !== "implausible") throw new Error("expected implausible");
    expect(result.smallestGapSeconds).toBe(1.5);
  });
});

describe("checkLandings, how many frames had no time of their own", () => {
  it("pins the tolerance at its literal boundary", () => {
    // Two in a hundred is luck; three is the step being wrong. The
    // literal probes are the point (audit finding F-018): a test that
    // derived them from the constant would pass at any value.
    expect(INEXACT_LANDING_TOLERANCE).toBe(0.02);
    expect(checkLandings(100, 2).kind).toBe("ok");
    expect(checkLandings(100, 3).kind).toBe("inexactLandings");
  });

  it("does not fire on an empty run, which is a different failure", () => {
    expect(checkLandings(0, 0).kind).toBe("ok");
  });

  it("carries both counts when it refuses", () => {
    // The reproduced case: a 200 frame clip at 20 fps with one short
    // gap sought 399 frames, 199 of them the same frame again.
    const check = checkLandings(399, 199);
    expect(check).toEqual({
      kind: "inexactLandings",
      sought: 399,
      inexact: 199,
    });
  });

  it("names both counts and the cause in the refusal, and nothing for ok", () => {
    const text = landingRefusal(checkLandings(399, 199));
    expect(text).toContain("199 of 399");
    expect(text).toContain("variable frame rate");
    expect(text).toContain("constant frame rate");
    expect(landingRefusal(checkLandings(100, 0))).toBe("");
  });
});

describe("variableRateRefusal, what to tell the operator", () => {
  it("names the two gaps in milliseconds and the cause", () => {
    const result = calibrateStep([0, 0.04, 0.08, 0.105, 0.145]);
    if (result.kind !== "variableRate") throw new Error("expected a refusal");
    const text = variableRateRefusal(result);
    expect(text).toContain("25.0 ms");
    expect(text).toContain("40.0 ms");
    expect(text).toContain("variable frame rate");
    expect(text).toContain("constant frame rate MP4");
  });
});

describe("steppingMetadataRows, the file says what it is", () => {
  it("writes nothing for a session that was not stepped", () => {
    expect(steppingMetadataRows(null)).toEqual([]);
  });

  it("writes the interval, the frames sought and the inexact landings", () => {
    expect(
      steppingMetadataRows({
        frameIntervalSeconds: 1 / 30,
        framesSought: 399,
        inexactLandings: 199,
      }),
    ).toEqual([
      "# frame_interval_s: 0.033333",
      "# frames_sought: 399",
      "# inexact_landings: 199",
    ]);
  });

  it("says unknown for an interval that was never established", () => {
    expect(
      steppingMetadataRows({
        frameIntervalSeconds: null,
        framesSought: 0,
        inexactLandings: 0,
      })[0],
    ).toBe("# frame_interval_s: unknown");
  });
});
