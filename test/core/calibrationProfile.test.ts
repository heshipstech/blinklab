import { describe, expect, it } from "vitest";

import {
  CALIBRATION_TARGETS,
  type CompletedTarget,
} from "../../src/core/calibrationCapture";
import {
  calibratedPoint,
  calibratedQuadrant,
  solveCalibration,
} from "../../src/core/calibrationProfile";
import type { IrisOffset } from "../../src/core/gazeOffset";
import { screenQuadrant } from "../../src/core/gazeQuadrant";

// The ground truth the solver must recover, written as the world
// works: screen position turns into an iris offset. Horizontal
// carries the mirror, looking toward screen LEFT reads POSITIVE
// (image right), so the true slope from offset back to screen is
// negative. Vertical carries a camera-above bias: even the top row
// reads slightly downward, every vertical offset is positive.
const TRUE_HORIZONTAL = { slope: -4, intercept: 0.5 };
const TRUE_VERTICAL = { slope: 5, intercept: 0 };

function trueOffset(target: { x: number; y: number }): IrisOffset {
  return {
    horizontal: (target.x - TRUE_HORIZONTAL.intercept) / TRUE_HORIZONTAL.slope,
    vertical: (target.y - TRUE_VERTICAL.intercept) / TRUE_VERTICAL.slope,
  };
}

// Five samples per dot, symmetric noise, so the median sample is the
// exact true offset and recovery can be asserted tightly.
const NOISE = [-0.004, -0.002, 0, 0.002, 0.004];

function syntheticCapture(): CompletedTarget[] {
  return CALIBRATION_TARGETS.map((target) => ({
    target,
    samples: NOISE.map((noise) => ({
      horizontal: trueOffset(target).horizontal + noise,
      vertical: trueOffset(target).vertical + noise,
    })),
  }));
}

describe("solveCalibration, the least squares fit", () => {
  it("recovers the mapping that generated the samples", () => {
    const profile = solveCalibration(syntheticCapture());
    expect(profile).not.toBeNull();
    expect(profile?.horizontal.slope).toBeCloseTo(TRUE_HORIZONTAL.slope, 6);
    expect(profile?.horizontal.intercept).toBeCloseTo(
      TRUE_HORIZONTAL.intercept,
      6,
    );
    expect(profile?.vertical.slope).toBeCloseTo(TRUE_VERTICAL.slope, 6);
    expect(profile?.vertical.intercept).toBeCloseTo(TRUE_VERTICAL.intercept, 6);
  });

  it("maps each dot's true offset back onto that dot", () => {
    const profile = solveCalibration(syntheticCapture());
    if (profile === null) throw new Error("profile must solve");
    for (const target of CALIBRATION_TARGETS) {
      const point = calibratedPoint(profile, trueOffset(target));
      expect(point.x).toBeCloseTo(target.x, 6);
      expect(point.y).toBeCloseTo(target.y, 6);
    }
  });

  it("learns the mirror flip from the data, no hand-written sign", () => {
    const profile = solveCalibration(syntheticCapture());
    expect(profile?.horizontal.slope).toBeLessThan(0);
  });

  it("survives one wild outlier sample, the median holds", () => {
    const capture = syntheticCapture();
    const first = capture[0];
    if (first === undefined) throw new Error("capture must have targets");
    const middle = first.samples[2];
    if (middle === undefined) throw new Error("target must have samples");
    first.samples[2] = { ...middle, horizontal: middle.horizontal + 5 };
    const profile = solveCalibration(capture);
    // The median steps to a neighbouring sample, nothing more. A mean
    // would have been dragged a full unit by the same outlier.
    expect(profile?.horizontal.slope).toBeCloseTo(TRUE_HORIZONTAL.slope, 1);
    expect(profile?.vertical.slope).toBeCloseTo(TRUE_VERTICAL.slope, 6);
  });

  it("skips a target with no samples and still solves from the rest", () => {
    const capture = syntheticCapture();
    const fifth = capture[4];
    if (fifth === undefined) throw new Error("capture must have targets");
    capture[4] = { ...fifth, samples: [] };
    const profile = solveCalibration(capture);
    expect(profile?.horizontal.slope).toBeCloseTo(TRUE_HORIZONTAL.slope, 6);
    expect(profile?.vertical.slope).toBeCloseTo(TRUE_VERTICAL.slope, 6);
  });

  it("refuses an empty capture", () => {
    expect(solveCalibration([])).toBeNull();
  });

  it("refuses a single dot, one point cannot define a line", () => {
    const capture = syntheticCapture().slice(0, 1);
    expect(solveCalibration(capture)).toBeNull();
  });

  it("refuses a frozen iris, identical offsets everywhere", () => {
    const frozen: IrisOffset = { horizontal: 0.02, vertical: 0.02 };
    const capture = CALIBRATION_TARGETS.map((target) => ({
      target,
      samples: [frozen, frozen, frozen],
    }));
    expect(solveCalibration(capture)).toBeNull();
  });

  it("refuses when only one axis varies, a profile needs both", () => {
    const capture = CALIBRATION_TARGETS.map((target) => ({
      target,
      samples: [{ horizontal: trueOffset(target).horizontal, vertical: 0.02 }],
    }));
    expect(solveCalibration(capture)).toBeNull();
  });
});

describe("calibratedQuadrant, classification after the cure", () => {
  const CORNERS = [
    { target: { x: 0.1, y: 0.1 }, quadrant: "top left" },
    { target: { x: 0.9, y: 0.1 }, quadrant: "top right" },
    { target: { x: 0.1, y: 0.9 }, quadrant: "bottom left" },
    { target: { x: 0.9, y: 0.9 }, quadrant: "bottom right" },
  ] as const;

  it("names every corner correctly through the profile", () => {
    const profile = solveCalibration(syntheticCapture());
    if (profile === null) throw new Error("profile must solve");
    for (const { target, quadrant } of CORNERS) {
      const point = calibratedPoint(profile, trueOffset(target));
      expect(calibratedQuadrant(point)).toBe(quadrant);
    }
  });

  it("cures the camera-above bias that fools the uncalibrated split", () => {
    // Under this bias every vertical offset is positive, so the
    // zero-split classifier calls both TOP corners "bottom". The
    // calibrated classifier, using the same samples, gets them right.
    const profile = solveCalibration(syntheticCapture());
    if (profile === null) throw new Error("profile must solve");
    for (const { target, quadrant } of CORNERS) {
      if (!quadrant.startsWith("top")) continue;
      const offset = trueOffset(target);
      expect(screenQuadrant(offset).startsWith("bottom")).toBe(true);
      expect(calibratedQuadrant(calibratedPoint(profile, offset))).toBe(
        quadrant,
      );
    }
  });

  it("counts exactly the centre as top left, the boundary convention", () => {
    expect(calibratedQuadrant({ x: 0.5, y: 0.5 })).toBe("top left");
    expect(calibratedQuadrant({ x: 0.51, y: 0.51 })).toBe("bottom right");
  });
});
