import { describe, expect, it } from "vitest";

import { apertureMm } from "../../src/core/aperture";
import { personalThresholdMm } from "../../src/core/baseline";
import { blinkStep, initialBlinkState } from "../../src/core/blink";
import { analyzeClosing, shapeWindowStartMs } from "../../src/core/blinkShape";
import { describeCalibrationWindow } from "../../src/core/calibrationWindow";
import {
  armLineClosureFraction,
  closureCompleteness,
  closureFraction,
} from "../../src/core/closureCompleteness";
import {
  APERTURE_HYSTERESIS_FRACTION,
  LEFT_EYE_EAR_INDICES,
  LEFT_IRIS_RING_INDICES,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import { mergedApertureMm } from "../../src/core/crossEyeGate";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";

// One blink from a lid resting exactly at the frozen baseline down to
// `minMm` and back, through the real detector and the real shape
// reader: whether blinkStep counted it, and the label the same shape
// earns. Samples 100 ms apart, so the closure lasts 100 ms and neither
// the duration ceiling nor the refractory period can refuse it — only
// depth decides.
function detectorAndLabel(
  baselineMm: number,
  blinkLineMm: number,
  minMm: number,
): { counted: boolean; label: ReturnType<typeof closureCompleteness> } {
  const trace = [
    { timestampMs: 0, apertureMm: baselineMm },
    { timestampMs: 100, apertureMm: minMm },
    { timestampMs: 200, apertureMm: baselineMm },
  ];
  let state = initialBlinkState;
  for (const sample of trace) {
    state = blinkStep(
      state,
      sample.timestampMs,
      sample.apertureMm,
      blinkLineMm,
    );
  }
  const shape = analyzeClosing(trace.slice(0, 2));
  const fraction = closureFraction(shape?.amplitudeMm ?? null, baselineMm);
  return {
    counted: state.blinkCount === 1,
    label: closureCompleteness(fraction, blinkLineMm, baselineMm),
  };
}

describe("closureFraction, amplitude over the frozen baseline", () => {
  it("is the share of the open eye the lid covered", () => {
    expect(closureFraction(4, 8)).toBe(0.5);
    expect(closureFraction(8, 8)).toBe(1);
    expect(closureFraction(2, 8)).toBe(0.25);
  });

  it("reads alike on two faces where the absolute grey line cannot", () => {
    // 1.5 mm, the table's absolute line, is a fifth of one eye and a
    // third of another; the fraction is one number for one share.
    expect(closureFraction(4, 8)).toBe(closureFraction(2.25, 4.5));
  });

  it("is null, never a number, without a shape or a usable ruler", () => {
    expect(closureFraction(null, 8)).toBeNull();
    expect(closureFraction(4, null)).toBeNull();
    // A zero baseline is no ruler at all: dividing by it would
    // publish Infinity, and a negative one is impossible.
    expect(closureFraction(4, 0)).toBeNull();
    expect(closureFraction(4, -8)).toBeNull();
  });
});

describe("armLineClosureFraction, the arm line on the fraction scale", () => {
  it("places the passive line's arm line at 0.55 of any baseline", () => {
    // Half the baseline less the 10 percent gap is 0.45 of it, so a
    // lid falling from the baseline must cover 0.55 to arm, whoever
    // the face belongs to.
    expect(armLineClosureFraction(4, 8)).toBeCloseTo(0.55, 12);
    expect(armLineClosureFraction(3, 6)).toBeCloseTo(0.55, 12);
    expect(APERTURE_HYSTERESIS_FRACTION).toBe(0.1);
  });

  it("moves with the line in force, so a guided line moves the cut", () => {
    // A guided line of 6 against a 9 mm baseline arms at 5.4 mm: a
    // lid needs to cover only 0.4 of the baseline to get there.
    expect(armLineClosureFraction(6, 9)).toBeCloseTo(0.4, 12);
    expect(closureCompleteness(0.45, 6, 9)).toBe("complete");
    expect(closureCompleteness(0.45, 4.5, 9)).toBe("incomplete");
  });
});

describe("closureCompleteness, the label at the arm line", () => {
  it("is complete exactly at the arm line and incomplete a hair short", () => {
    // Binary-exact: 5 x 0.9 is 4.5 and 1 - 4.5 / 9 is 0.5, so the edge
    // is tested on the edge itself and not a rounding of it.
    expect(armLineClosureFraction(5, 9)).toBe(0.5);
    expect(closureCompleteness(0.5, 5, 9)).toBe("complete");
    expect(closureCompleteness(0.5 - 2 ** -20, 5, 9)).toBe("incomplete");
    expect(closureCompleteness(1, 5, 9)).toBe("complete");
    expect(closureCompleteness(0, 5, 9)).toBe("incomplete");
  });

  it("is null without a fraction, a line or a usable ruler", () => {
    expect(closureCompleteness(null, 5, 9)).toBeNull();
    expect(closureCompleteness(0.5, null, 9)).toBeNull();
    expect(closureCompleteness(0.5, 5, null)).toBeNull();
    expect(closureCompleteness(0.5, 5, 0)).toBeNull();
  });

  it("agrees with the detector's own arming on every depth of a sweep", () => {
    // The label reads travel from the baseline and blinkStep reads
    // depth against the arm line; for a lid starting AT the baseline
    // they must be the same decision at every depth, including the
    // exact arm line (4.5 here) and the band just above it, where a
    // closure crosses the line and never arms.
    for (let eighths = 1; eighths < 72; eighths += 1) {
      const minMm = eighths / 8;
      const { counted, label } = detectorAndLabel(9, 5, minMm);
      expect(label, `min ${String(minMm)} mm`).toBe(
        counted ? "complete" : "incomplete",
      );
    }
    // Both sides of the edge were really visited, not skipped.
    expect(detectorAndLabel(9, 5, 4.5)).toEqual({
      counted: true,
      label: "complete",
    });
    expect(detectorAndLabel(9, 5, 4.625)).toEqual({
      counted: false,
      label: "incomplete",
    });
  });
});

describe("the arm line and the label agree on every fixture blink", () => {
  it("labels both of the owner's recorded blinks complete, the depth they armed at", () => {
    // session-01 through the page's own path: both eyes merged, the
    // ruler this face is born with (the birth statistic over its own
    // open eye), the passive line hung from it, the detector, and the
    // shape window the page reads each counted blink from.
    const session = loadSession01();
    const series = session.frames.map((frame) => {
      const face = frameLandmarks(frame);
      return {
        timestampMs: frame.timestampMs,
        mm: mergedApertureMm(
          apertureMm(
            face,
            LEFT_EYE_EAR_INDICES,
            LEFT_IRIS_RING_INDICES,
            1280,
            720,
          ),
          apertureMm(
            face,
            RIGHT_EYE_EAR_INDICES,
            RIGHT_IRIS_RING_INDICES,
            1280,
            720,
          ),
        ),
      };
    });
    const window = describeCalibrationWindow(
      series.flatMap((sample) => (sample.mm === null ? [] : [sample.mm])),
    );
    expect(window).not.toBeNull();
    if (window === null) return;
    const baselineMm = window.baselineMm;
    const lineMm = personalThresholdMm({
      kind: "ready",
      baselineMm,
      window,
    });
    expect(lineMm).not.toBeNull();
    if (lineMm === null) return;
    const armLineMm = lineMm * (1 - APERTURE_HYSTERESIS_FRACTION);

    const blinks: {
      durationMs: number | null;
      reachedArmLine: boolean;
      fraction: number | null;
      label: ReturnType<typeof closureCompleteness>;
    }[] = [];
    let state = initialBlinkState;
    let closureMinMm = Infinity;
    series.forEach((sample, index) => {
      const previousBlinkEndMs = state.lastBlinkEndedAtMs;
      const countBefore = state.blinkCount;
      const wasClosed = state.eye === "closed";
      state = blinkStep(state, sample.timestampMs, sample.mm, lineMm);
      if (!wasClosed && state.eye === "closed") closureMinMm = Infinity;
      if (state.eye === "closed" && sample.mm !== null) {
        closureMinMm = Math.min(closureMinMm, sample.mm);
      }
      if (state.blinkCount > countBefore) {
        const startMs = shapeWindowStartMs(
          sample.timestampMs,
          state.lastBlinkDurationMs ?? 0,
          previousBlinkEndMs,
        );
        // The page reads the window before this frame joins it.
        const shape = analyzeClosing(
          series
            .slice(0, index)
            .flatMap((earlier) =>
              earlier.timestampMs >= startMs && earlier.mm !== null
                ? [{ timestampMs: earlier.timestampMs, apertureMm: earlier.mm }]
                : [],
            ),
        );
        const fraction = closureFraction(
          shape?.amplitudeMm ?? null,
          baselineMm,
        );
        blinks.push({
          durationMs: state.lastBlinkDurationMs,
          reachedArmLine: closureMinMm <= armLineMm,
          fraction,
          label: closureCompleteness(fraction, lineMm, baselineMm),
        });
      }
    });

    // The same two blinks blink.test.ts times against the fixed line.
    expect(blinks.map((blink) => blink.durationMs)).toEqual([133, 117]);
    for (const blink of blinks) {
      expect(blink.label).toBe(
        blink.reachedArmLine ? "complete" : "incomplete",
      );
    }
    expect(blinks.map((blink) => blink.label)).toEqual([
      "complete",
      "complete",
    ]);
    // What the fixture measures today, pinned so a change to the
    // aperture pipeline moves these WITH it, visibly. The second blink
    // is the travel-versus-depth gap in the flesh: it started 0.93 mm
    // under the baseline, bottomed a millimetre past the arm line, and
    // cleared the label's cut (0.55) by two hundredths.
    expect(armLineClosureFraction(lineMm, baselineMm)).toBeCloseTo(0.55, 12);
    expect(blinks[0]?.fraction).toBeCloseTo(0.699, 3);
    expect(blinks[1]?.fraction).toBeCloseTo(0.57, 3);
  });
});
