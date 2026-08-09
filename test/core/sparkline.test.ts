import { describe, expect, it } from "vitest";

import {
  LEFT_EYE_EAR_INDICES,
  RIGHT_EYE_EAR_INDICES,
} from "../../src/core/constants";
import { eyeAspectRatio, eyeLandmarksFromFace } from "../../src/core/ear";
import {
  sparklineSegments,
  withinWindow,
  type TimedSample,
} from "../../src/core/sparkline";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";

const WIDTH = 600;
const HEIGHT = 80;
const WINDOW_MS = 10000;
const EAR_MAX = 0.6;

describe("sparklineSegments", () => {
  it("maps known samples to hand checkable canvas points", () => {
    const nowMs = 10000;
    const samples: TimedSample[] = [
      { timestampMs: 0, value: 0.6 },
      { timestampMs: 5000, value: 0.3 },
      { timestampMs: 10000, value: 0 },
    ];
    expect(
      sparklineSegments(samples, nowMs, WINDOW_MS, WIDTH, HEIGHT, EAR_MAX),
    ).toEqual([
      [
        { x: 0, y: 0 },
        { x: 300, y: 40 },
        { x: 600, y: 80 },
      ],
    ]);
  });

  it("splits into separate segments where the value was null", () => {
    const nowMs = 10000;
    const samples: TimedSample[] = [
      { timestampMs: 9000, value: 0.3 },
      { timestampMs: 9500, value: null },
      { timestampMs: 10000, value: 0.3 },
    ];
    const segments = sparklineSegments(
      samples,
      nowMs,
      WINDOW_MS,
      WIDTH,
      HEIGHT,
      EAR_MAX,
    );
    expect(segments.length).toBe(2);
    expect(segments[0]?.length).toBe(1);
    expect(segments[1]?.length).toBe(1);
  });

  it("drops samples older than the window and returns nothing for none", () => {
    const samples: TimedSample[] = [{ timestampMs: 0, value: 0.3 }];
    expect(
      sparklineSegments(samples, 20000, WINDOW_MS, WIDTH, HEIGHT, EAR_MAX),
    ).toEqual([]);
    expect(
      sparklineSegments([], 20000, WINDOW_MS, WIDTH, HEIGHT, EAR_MAX),
    ).toEqual([]);
  });

  it("clamps a value above the fixed scale to the top edge", () => {
    const segments = sparklineSegments(
      [{ timestampMs: 10000, value: 0.9 }],
      10000,
      WINDOW_MS,
      WIDTH,
      HEIGHT,
      EAR_MAX,
    );
    expect(segments[0]?.[0]?.y).toBe(0);
  });

  it("maps the whole fixture to one unbroken segment", () => {
    const session = loadSession01();
    const samples: TimedSample[] = session.frames.map((frame) => {
      const face = frameLandmarks(frame);
      const right = eyeLandmarksFromFace(face, RIGHT_EYE_EAR_INDICES);
      const left = eyeLandmarksFromFace(face, LEFT_EYE_EAR_INDICES);
      const rightEar = right === null ? null : eyeAspectRatio(right);
      const leftEar = left === null ? null : eyeAspectRatio(left);
      return {
        timestampMs: frame.timestampMs,
        value:
          rightEar === null || leftEar === null
            ? null
            : (rightEar + leftEar) / 2,
      };
    });
    const last = samples[samples.length - 1];
    const segments = sparklineSegments(
      samples,
      last?.timestampMs ?? 0,
      WINDOW_MS,
      WIDTH,
      HEIGHT,
      EAR_MAX,
    );
    expect(segments.length).toBe(1);
    expect(segments[0]?.length).toBe(300);
  });
});

describe("withinWindow, the rule that replaced four guessed caps", () => {
  const feed = (fps: number, seconds: number, windowMs: number) => {
    // Feed samples at a given rate and keep only the window, exactly as
    // the frame loop does, one sample at a time.
    let kept: { timestampMs: number; value: number | null }[] = [];
    const stepMs = 1000 / fps;
    for (let i = 0; i <= fps * seconds; i += 1) {
      const nowMs = i * stepMs;
      kept = withinWindow(
        [...kept, { timestampMs: nowMs, value: 1 }],
        nowMs,
        windowMs,
      );
    }
    return kept;
  };

  // THE REGRESSION. Every trace buffer was capped at 1200 samples,
  // chosen for 60 frames per second. At the 130 a 120 Hz display
  // produces, 1200 holds 9.2 seconds of a 10 second window, so the
  // trace started part way in and never reached the left edge. This
  // failed four times in one day because the number was written out by
  // hand in four places.
  it("covers the whole window at any frame rate, including 130 and 500", () => {
    for (const fps of [24, 30, 60, 130, 500]) {
      const kept = feed(fps, 20, 10000);
      const span =
        (kept[kept.length - 1]?.timestampMs ?? 0) - (kept[0]?.timestampMs ?? 0);
      // Within one frame of the full window, at every rate.
      expect(span).toBeGreaterThanOrEqual(10000 - 1000 / fps - 1);
      expect(span).toBeLessThanOrEqual(10000);
    }
  });

  it("stays bounded, so no rate can grow it without limit", () => {
    // The window bounds the memory. 500 frames per second over 10
    // seconds is 5001 samples and never more, however long it runs.
    expect(feed(500, 60, 10000).length).toBeLessThanOrEqual(5001);
  });

  it("drops a sample from the future rather than keeping it forever", () => {
    // A clip's clock restarts at zero. Under the old one sided test a
    // stale sample read as negative age and survived every filter.
    const kept = withinWindow(
      [
        { timestampMs: 50000, value: 1 },
        { timestampMs: 500, value: 2 },
      ],
      1000,
      10000,
    );
    expect(kept.map((sample) => sample.value)).toEqual([2]);
  });

  it("keeps a sample exactly on both edges", () => {
    const kept = withinWindow(
      [
        { timestampMs: 0, value: 1 },
        { timestampMs: 10000, value: 2 },
      ],
      10000,
      10000,
    );
    expect(kept).toHaveLength(2);
  });
});
