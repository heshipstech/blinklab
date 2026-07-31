import { describe, expect, it } from "vitest";

import { apertureMm } from "../../src/core/aperture";
import { blinkStep, initialBlinkState } from "../../src/core/blink";
import {
  BLINK_APERTURE_THRESHOLD_MM,
  LEFT_EYE_EAR_INDICES,
  LEFT_IRIS_RING_INDICES,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";

function runSeries(
  series: (number | null)[],
  thresholdMm = BLINK_APERTURE_THRESHOLD_MM,
) {
  let state = initialBlinkState;
  for (const value of series) {
    state = blinkStep(state, value, thresholdMm);
  }
  return state;
}

describe("blinkStep", () => {
  it("counts one blink for one close and reopen", () => {
    expect(runSeries([8, 8, 3, 2, 3, 8, 8]).blinkCount).toBe(1);
  });

  it("counts two separated blinks as two", () => {
    expect(runSeries([8, 2, 8, 8, 2, 2, 8]).blinkCount).toBe(2);
  });

  it("counts a long closure once, on the reopen", () => {
    const state = runSeries([8, 2, 2, 2, 2, 2]);
    expect(state.blinkCount).toBe(0);
    expect(blinkStep(state, 8, BLINK_APERTURE_THRESHOLD_MM).blinkCount).toBe(1);
  });

  it("runs the boundary trio: below closes, at and above stay open", () => {
    const th = BLINK_APERTURE_THRESHOLD_MM;
    expect(runSeries([8, th - 0.1, 8]).blinkCount).toBe(1);
    expect(runSeries([8, th, 8]).blinkCount).toBe(0);
    expect(runSeries([8, th + 0.1, 8]).blinkCount).toBe(0);
  });

  it("refuses to count a blink interrupted by invalid frames", () => {
    expect(runSeries([8, 2, null, 8, 8]).blinkCount).toBe(0);
  });

  it("never counts while the signal only ever descends", () => {
    expect(runSeries([8, 6, 4, 3, 2, 2]).blinkCount).toBe(0);
  });
});

describe("blinkStep against the recorded fixture", () => {
  function meanApertureSeries(): number[] {
    const session = loadSession01();
    return session.frames.map((frame) => {
      const face = frameLandmarks(frame);
      const right = apertureMm(
        face,
        RIGHT_EYE_EAR_INDICES,
        RIGHT_IRIS_RING_INDICES,
        1280,
        720,
      );
      const left = apertureMm(
        face,
        LEFT_EYE_EAR_INDICES,
        LEFT_IRIS_RING_INDICES,
        1280,
        720,
      );
      if (right === null || left === null) {
        throw new Error("fixture frame lost an aperture");
      }
      return (right + left) / 2;
    });
  }

  it("finds exactly the two full recorded blinks at the fixed threshold", () => {
    expect(runSeries(meanApertureSeries()).blinkCount).toBe(2);
  });

  it("the shallow third blink only appears at a 5 mm threshold", () => {
    expect(runSeries(meanApertureSeries(), 5).blinkCount).toBe(3);
  });
});
