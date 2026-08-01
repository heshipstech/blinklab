import { describe, expect, it } from "vitest";

import { apertureMm } from "../../src/core/aperture";
import {
  blinkStep,
  initialBlinkState,
  type BlinkState,
} from "../../src/core/blink";
import {
  BLINK_APERTURE_THRESHOLD_MM,
  LEFT_EYE_EAR_INDICES,
  LEFT_IRIS_RING_INDICES,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";

// The clock is injected: samples arrive 100 ms apart unless a test
// says otherwise, so durations are hand countable.
function runSeries(
  series: (number | null)[],
  thresholdMm = BLINK_APERTURE_THRESHOLD_MM,
  stepMs = 100,
): BlinkState {
  let state = initialBlinkState;
  series.forEach((value, index) => {
    state = blinkStep(state, index * stepMs, value, thresholdMm);
  });
  return state;
}

describe("blink counting, as since 4.1", () => {
  it("counts one blink for one close and reopen", () => {
    expect(runSeries([8, 8, 3, 2, 3, 8, 8]).blinkCount).toBe(1);
  });

  it("counts two separated blinks as two", () => {
    expect(runSeries([8, 2, 8, 8, 2, 2, 8]).blinkCount).toBe(2);
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
});

describe("blink duration, new at 4.3", () => {
  it("times a hand countable blink: three closed samples, 300 ms", () => {
    const state = runSeries([8, 2, 2, 2, 8]);
    expect(state.blinkCount).toBe(1);
    expect(state.lastBlinkDurationMs).toBe(300);
  });

  it("reads a long deliberate closure longer, 2000 ms", () => {
    const series: (number | null)[] = [8, ...Array<number>(20).fill(2), 8];
    expect(runSeries(series).lastBlinkDurationMs).toBe(2000);
  });

  it("keeps the most recent duration when blinks differ", () => {
    const state = runSeries([8, 2, 8, 8, 2, 2, 2, 8]);
    expect(state.blinkCount).toBe(2);
    expect(state.lastBlinkDurationMs).toBe(300);
  });

  it("forgets a pending duration when invalid frames interrupt", () => {
    const state = runSeries([8, 2, 2, null, 8, 8]);
    expect(state.blinkCount).toBe(0);
    expect(state.lastBlinkDurationMs).toBeNull();
  });

  it("has no duration before any blink completed", () => {
    expect(runSeries([8, 8, 8]).lastBlinkDurationMs).toBeNull();
  });
});

describe("blink timing against the recorded fixture", () => {
  it("times the owner's two blinks at 133 and 117 ms below threshold", () => {
    const session = loadSession01();
    const durations: number[] = [];
    let state = initialBlinkState;
    for (const frame of session.frames) {
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
      const mean = right === null || left === null ? null : (right + left) / 2;
      const before = state.blinkCount;
      state = blinkStep(
        state,
        frame.timestampMs,
        mean,
        BLINK_APERTURE_THRESHOLD_MM,
      );
      if (state.blinkCount > before && state.lastBlinkDurationMs !== null) {
        durations.push(Math.round(state.lastBlinkDurationMs));
      }
    }
    expect(durations).toEqual([133, 117]);
  });
});
