import { describe, expect, it } from "vitest";

import { apertureMm } from "../../src/core/aperture";
import { analyzeClosing } from "../../src/core/blinkShape";
import {
  LEFT_EYE_EAR_INDICES,
  LEFT_IRIS_RING_INDICES,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";

type Sample = { timestampMs: number; apertureMm: number };

function samples(pairs: [number, number][]): Sample[] {
  return pairs.map(([timestampMs, apertureMm]) => ({
    timestampMs,
    apertureMm,
  }));
}

describe("analyzeClosing, hand computed", () => {
  it("finds amplitude, peak velocity and their ratio on uneven timestamps", () => {
    // Descent 8 to 6 over 50 ms is 40 mm/s, then 6 to 2 over 50 ms is
    // 80 mm/s, the peak. Amplitude 6 mm. Ratio 6/80 s = 75 ms.
    const shape = analyzeClosing(
      samples([
        [0, 8],
        [100, 8],
        [150, 6],
        [200, 2],
        [300, 2],
      ]),
    );
    expect(shape).not.toBeNull();
    if (shape !== null) {
      expect(shape.amplitudeMm).toBeCloseTo(6, 10);
      expect(shape.peakClosingVelocityMmPerS).toBeCloseTo(80, 10);
      expect(shape.amplitudeOverVelocityMs).toBeCloseTo(75, 10);
    }
  });

  it("measures the descent only, ignoring the reopening tail", () => {
    const shape = analyzeClosing(
      samples([
        [0, 8],
        [100, 2],
        [200, 9],
      ]),
    );
    expect(shape).not.toBeNull();
    if (shape !== null) {
      expect(shape.amplitudeMm).toBeCloseTo(6, 10);
      expect(shape.peakClosingVelocityMmPerS).toBeCloseTo(60, 10);
    }
  });

  it("starts the descent at the pre closure maximum, not the window start", () => {
    const shape = analyzeClosing(
      samples([
        [0, 5],
        [100, 8],
        [200, 2],
      ]),
    );
    expect(shape).not.toBeNull();
    if (shape !== null) {
      expect(shape.amplitudeMm).toBeCloseTo(6, 10);
    }
  });

  it("returns null on degenerate input instead of guessing", () => {
    expect(analyzeClosing([])).toBeNull();
    expect(analyzeClosing(samples([[0, 8]]))).toBeNull();
    expect(
      analyzeClosing(
        samples([
          [0, 8],
          [100, 8],
        ]),
      ),
    ).toBeNull();
    expect(
      analyzeClosing(
        samples([
          [0, 8],
          [0, 2],
        ]),
      ),
    ).toBeNull();
  });
});

describe("analyzeClosing against the recorded fixture", () => {
  it("reads both recorded blinks as physiologically plausible shapes", () => {
    const session = loadSession01();
    const series = session.frames.map((frame) => {
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
      return {
        timestampMs: frame.timestampMs,
        apertureMm: right === null || left === null ? 0 : (right + left) / 2,
      };
    });

    // The two blinks bottom out somewhere inside the recording. Take
    // a window around each below-4 crossing and analyse it.
    const shapes = [];
    let inBlink = false;
    for (let i = 0; i < series.length; i++) {
      const mm = series[i]?.apertureMm ?? 0;
      if (mm < 4 && !inBlink) {
        inBlink = true;
        const window = series.slice(Math.max(0, i - 25), i + 5);
        const shape = analyzeClosing(window);
        if (shape !== null) {
          shapes.push(shape);
        }
      }
      if (mm >= 4) {
        inBlink = false;
      }
    }
    expect(shapes.length).toBe(2);
    for (const shape of shapes) {
      expect(shape.amplitudeMm).toBeGreaterThan(2);
      expect(shape.amplitudeMm).toBeLessThan(9);
      expect(shape.peakClosingVelocityMmPerS).toBeGreaterThan(10);
      expect(shape.peakClosingVelocityMmPerS).toBeLessThan(400);
      expect(shape.amplitudeOverVelocityMs).toBeGreaterThan(10);
      expect(shape.amplitudeOverVelocityMs).toBeLessThan(400);
    }
  });
});
