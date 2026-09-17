import { describe, expect, it } from "vitest";

import {
  CALIBRATION_TARGETS,
  type CompletedTarget,
} from "../../src/core/calibrationCapture";
import {
  calibratedPoint,
  calibratedQuadrant,
  parseCalibrationProfile,
  pointWithinWindow,
  solveCalibration,
} from "../../src/core/calibrationProfile";
import { accumulate, emptyGrid } from "../../src/core/heatmap";
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

describe("parseCalibrationProfile, the reload boundary the store forgot", () => {
  // A stored profile re-enters the program changed — a format bump, a
  // half-written write, a person editing localStorage. The store used to
  // cast it with `JSON.parse(raw) as CalibrationProfile` and trust
  // whatever came back; this is the validated boundary that replaces the
  // cast, the same stance parseBlinkCalibration takes. Positivity is NOT
  // required: a slope is negative for the mirror flip and an intercept
  // can be either sign, so the check is shape and finiteness only.
  const good = {
    horizontal: { slope: -4, intercept: 0.5 },
    vertical: { slope: 5, intercept: 0 },
  };

  it("accepts a well-formed profile, negative slope and all", () => {
    expect(parseCalibrationProfile(JSON.stringify(good))).toEqual(good);
  });

  it("rejects non-JSON", () => {
    expect(parseCalibrationProfile("{not json")).toBeNull();
  });

  it("rejects a missing axis", () => {
    expect(
      parseCalibrationProfile(
        JSON.stringify({ horizontal: { slope: 1, intercept: 0 } }),
      ),
    ).toBeNull();
  });

  it("rejects a non-finite field, the shape the bare cast let through", () => {
    // The exact gap this closes: a value that PARSES but is the wrong
    // shape. A non-number slope used to sail through the cast and become
    // a gaze mapping that returns NaN for every point.
    expect(
      parseCalibrationProfile(
        '{"horizontal":{"slope":1,"intercept":0},"vertical":{"slope":"x","intercept":0}}',
      ),
    ).toBeNull();
  });

  it("rejects an axis that is not an object", () => {
    expect(
      parseCalibrationProfile(
        JSON.stringify({ horizontal: 1, vertical: { slope: 5, intercept: 0 } }),
      ),
    ).toBeNull();
  });
});

describe("one definition of on-window (roadmap 14.9b)", () => {
  // The audit's two-definitions finding: the export column judged the
  // RAW offset against the guessed zero-centred threshold while the
  // heatmap judged the CALIBRATED point against the unit square, so
  // one frame could leave the screen by one rule and dwell on it by
  // the other. With a profile there is now one boundary — the window
  // itself, the exact bound accumulate always enforced — and these
  // tests hold every consumer to it.

  it("the window's own edges, far edge inclusive", () => {
    expect(pointWithinWindow({ x: 0.5, y: 0.5 })).toBe(true);
    expect(pointWithinWindow({ x: 0, y: 0 })).toBe(true);
    // Exactly 1.0 is still the window's far edge — accumulate's own
    // boundary convention, restated here so the two cannot drift.
    expect(pointWithinWindow({ x: 1, y: 1 })).toBe(true);
    expect(pointWithinWindow({ x: 1.001, y: 0.5 })).toBe(false);
    expect(pointWithinWindow({ x: 0.5, y: -0.001 })).toBe(false);
  });

  it("the export, heatmap and quadrant definitions agree, point by point", () => {
    // The row's second Check clause, on a fixture spanning inside,
    // every edge, and outside on each axis.
    const fixture = [
      { x: 0.5, y: 0.5 },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: -0.2, y: 0.5 },
      { x: 0.5, y: 1.4 },
      { x: 1.05, y: -0.05 },
    ];
    for (const point of fixture) {
      const onWindow = pointWithinWindow(point);
      // The heatmap's decision: dwell accumulates exactly when the
      // point is on the window.
      const grid = accumulate(emptyGrid(), point);
      const accumulated = grid.cells.some((cell) => cell > 0);
      expect(accumulated, `heatmap at ${point.x},${point.y}`).toBe(onWindow);
      // The quadrant's decision: a named quadrant is only an answer
      // for a point that is on the window; the page words the other
      // case "outside the window" rather than naming a corner the
      // gaze does not occupy. calibratedQuadrant itself stays total —
      // this pins the APPLICABILITY rule the page and the export
      // share.
      if (onWindow) {
        expect([
          "top left",
          "top right",
          "bottom left",
          "bottom right",
        ]).toContain(calibratedQuadrant(point));
      }
    }
  });
});
