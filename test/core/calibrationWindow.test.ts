import { describe, expect, it } from "vitest";

import { calibrationMetadataRows } from "../../src/core/sessionMetadata";

import { apertureMm } from "../../src/core/aperture";
import { baselineStep, startBaseline } from "../../src/core/baseline";
import { describeCalibrationWindow } from "../../src/core/calibrationWindow";
import {
  BASELINE_MEDIAN_CEILING_FACTOR,
  BASELINE_MEDIAN_PERCENTILE,
  BASELINE_PERCENTILE,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import { percentile } from "../../src/core/statistics";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";

// The window the ruler was born from, as a value.
//
// boundedBaseline has clipped silently since the freeze: on the dry
// run's macbookair session a handful of frames read to 10.35 mm
// against a window median of 7.51, the p90 followed them, and NOBODY
// COULD SEE IT until the Python side grew an over_resting check five
// days later, reading the exported per-second rows after the fact.
// The person saw nothing, and an export of that session still says
// nothing about its own birth today. This module makes the birth
// window a value: how many samples, where the middle was, where the
// top was, and whether the ceiling had to bind.

describe("describing the window a baseline is born from", () => {
  it("reports hand-checkable statistics", () => {
    // percentile's own tests pin p90 of 1..10 at 9 and p50 at 5, so
    // every number here is derivable without running anything.
    const window = describeCalibrationWindow([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(window).not.toBeNull();
    if (window === null) return;
    expect(window.sampleCount).toBe(10);
    expect(window.medianMm).toBe(5);
    expect(window.p90Mm).toBe(9);
    expect(window.spreadRatio).toBeCloseTo(1.8, 9);
    // 9 exceeds 5 * 1.25, so the ceiling binds and the ruler is born
    // at 6.25 rather than at the p90 the outliers dragged up.
    expect(window.ceilingBound).toBe(true);
    expect(window.baselineMm).toBeCloseTo(6.25, 9);
  });

  it("a steady eye has spread one and no ceiling", () => {
    const window = describeCalibrationWindow(
      Array.from({ length: 350 }, () => 7),
    );
    expect(window).not.toBeNull();
    if (window === null) return;
    expect(window.spreadRatio).toBeCloseTo(1, 9);
    expect(window.ceilingBound).toBe(false);
    expect(window.baselineMm).toBeCloseTo(7, 9);
  });

  it("reproduces the macbookair birth, the failure this exists for", () => {
    // The dry run's recorded shape: a window whose median read 7.51 mm
    // while a handful of frames near the start read up to 10.35, and
    // whose p90 followed the outliers. The ceiling clips the birth to
    // 7.51 * 1.25 = 9.3875 — still 1.35 times that session's resting
    // median of 6.93, which is why clipping is a guess wearing a
    // number's clothes and why refusal is the NEXT increment. This one
    // only makes the clip visible.
    const samples = [
      ...Array.from({ length: 89 }, () => 7.51),
      ...Array.from({ length: 11 }, () => 10.35),
    ];
    const window = describeCalibrationWindow(samples);
    expect(window).not.toBeNull();
    if (window === null) return;
    expect(window.p90Mm).toBeCloseTo(10.35, 9);
    expect(window.medianMm).toBeCloseTo(7.51, 9);
    expect(window.spreadRatio).toBeCloseTo(1.378, 3);
    expect(window.ceilingBound).toBe(true);
    expect(window.baselineMm).toBeCloseTo(9.3875, 4);
  });

  it("births exactly what boundedBaseline birthed, on any window", () => {
    // The identity pin: this refactor may move NO measured number.
    // The old formula is re-derived here from the plan's constants
    // rather than imported, which is the only arrangement in which
    // this test can disagree with the code.
    const windows = [
      [7, 7.1, 6.9, 7.3, 7.0, 7.2],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      Array.from({ length: 200 }, (_, i) => 6 + (i % 17) * 0.1),
      [...Array.from({ length: 89 }, () => 7.51), 10.35, 10.35],
    ];
    for (const samples of windows) {
      const wide = percentile(samples, BASELINE_PERCENTILE);
      const middle = percentile(samples, BASELINE_MEDIAN_PERCENTILE);
      const old =
        wide === null || middle === null
          ? wide
          : Math.min(wide, middle * BASELINE_MEDIAN_CEILING_FACTOR);
      expect(describeCalibrationWindow(samples)?.baselineMm).toBe(old);
    }
  });

  it("an empty window is null, never a zero-length ruler", () => {
    expect(describeCalibrationWindow([])).toBeNull();
  });

  it("describes the owner's own recorded face, through the real pipeline", () => {
    // 300 frames of session-01 through the same aperture path the page
    // runs. A real, healthy eye: the spread stays under the ceiling
    // and the ruler is born from the p90 unclipped. The pinned spread
    // is what this fixture measures today; if the aperture pipeline
    // legitimately changes, this number moves WITH it and the change
    // is visible here rather than silent.
    const session = loadSession01();
    const values: number[] = [];
    for (const frame of session.frames) {
      const mm = apertureMm(
        frameLandmarks(frame),
        RIGHT_EYE_EAR_INDICES,
        RIGHT_IRIS_RING_INDICES,
        1280,
        720,
      );
      if (mm !== null) values.push(mm);
    }
    const window = describeCalibrationWindow(values);
    expect(window).not.toBeNull();
    if (window === null) return;
    expect(window.sampleCount).toBe(values.length);
    expect(window.ceilingBound).toBe(false);
    expect(window.spreadRatio).toBeGreaterThan(1);
    expect(window.spreadRatio).toBeLessThan(BASELINE_MEDIAN_CEILING_FACTOR);
  });

  it("rides into the ready state, so the page and export can reach it", () => {
    let state = startBaseline(0);
    const samples = Array.from({ length: 350 }, () => 7);
    samples.forEach((value, index) => {
      state = baselineStep(state, index * 100, value);
    });
    expect(state.kind).toBe("ready");
    if (state.kind !== "ready") return;
    // 301, not 350: the birth happens at the step where the thirty
    // seconds elapse, and the 49 samples fed after it never enter,
    // because ready means FROZEN. The window describes exactly what
    // the ruler was born from, not everything the session ever saw.
    expect(state.window.sampleCount).toBe(301);
    // One ruler, one number: the window's account of the birth and
    // the state's own baseline must be the same value, or the export
    // would describe a birth the page did not use.
    expect(state.window.baselineMm).toBe(state.baselineMm);
  });
});

describe("the birth certificate in the export", () => {
  it("writes all three rows, whatever they say", () => {
    const rows = calibrationMetadataRows({
      sampleCount: 301,
      medianMm: 7.51,
      p90Mm: 10.35,
      spreadRatio: 1.3782,
      ceilingBound: true,
      baselineMm: 9.3875,
    });
    expect(rows).toEqual([
      "# calibration_samples: 301",
      "# calibration_spread_ratio: 1.378",
      "# calibration_ceiling_bound: true",
    ]);
  });

  it("a session whose ruler was never born writes nothing", () => {
    // Not "unknown": there was no calibration to describe, and the
    // per-second baselineMm column already shows the absence. Writing
    // unknown rows would invite a reader to look for a birth that
    // never happened.
    expect(calibrationMetadataRows(null)).toEqual([]);
  });
});
