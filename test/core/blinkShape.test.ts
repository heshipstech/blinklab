import { describe, expect, it } from "vitest";

import { apertureMm } from "../../src/core/aperture";
import {
  analyzeClosing,
  shapeWindowStartMs,
  type ApertureSample,
} from "../../src/core/blinkShape";
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

describe("the shape window clipped at the previous blink (remediation B4)", () => {
  // The audit's synthetic two-close-blinks trace, rebuilt on an exact
  // 33 ms grid, 30 frames per second. Blink 1 is fast and shallow:
  // 8.0 down to 1.5 mm in two steps, peak velocity 3.25 mm per step.
  // Blink 2 is slow and deep: 8.0 down to 0.5 mm in seven steps.
  // They sit close enough that blink 2's 400 ms lead-in reaches over
  // blink 1, which is the contamination band ordinary blinking
  // visits routinely.
  const STEP_MS = 33;
  const trace: ApertureSample[] = [
    ...[0, 1, 2, 3].map((i) => ({ timestampMs: i * STEP_MS, apertureMm: 8 })),
    { timestampMs: 132, apertureMm: 4.75 },
    { timestampMs: 165, apertureMm: 1.5 },
    { timestampMs: 198, apertureMm: 8 }, // blink 1 reopens here
    ...[231, 264, 297, 330, 363].map((t) => ({
      timestampMs: t,
      apertureMm: 8,
    })),
    ...[1, 2, 3, 4, 5, 6].map((i) => ({
      timestampMs: 363 + i * STEP_MS,
      apertureMm: 8 - (7.5 / 7) * i,
    })),
    { timestampMs: 594, apertureMm: 0.5 },
    { timestampMs: 627, apertureMm: 8 }, // blink 2 reopens here
  ];
  const REOPEN_1 = 198;
  const REOPEN_2 = 627;
  // Window arithmetic value, not the reducer's closed-phase figure
  // (132 ms here); both clip to the same start, checked by review.
  const DURATION_2 = 231;
  const windowFrom = (startMs: number, endMs: number) =>
    trace.filter((s) => s.timestampMs >= startMs && s.timestampMs <= endMs);

  it("gives the second blink its own shape, all three columns", () => {
    const first = analyzeClosing(
      windowFrom(shapeWindowStartMs(REOPEN_1, 66, null), REOPEN_1),
    );
    const second = analyzeClosing(
      windowFrom(shapeWindowStartMs(REOPEN_2, DURATION_2, REOPEN_1), REOPEN_2),
    );
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (first === null || second === null) return;
    // Blink 1: fell 6.5 mm at 3.25 mm per 33 ms step.
    expect(first.peakClosingVelocityMmPerS).toBeCloseTo(3.25 / 0.033, 3);
    expect(first.amplitudeMm).toBeCloseTo(6.5, 6);
    // Blink 2: fell 7.5 mm at 7.5/7 mm per step, three times slower.
    expect(second.peakClosingVelocityMmPerS).toBeCloseTo(7.5 / 7 / 0.033, 3);
    expect(second.amplitudeMm).toBeCloseTo(7.5, 6);
    expect(second.amplitudeOverVelocityMs).toBeCloseTo(231, 0);
    // The audit's literal check: no column of blink 2 equals blink 1's.
    expect(second.amplitudeMm).not.toBe(first.amplitudeMm);
    expect(second.peakClosingVelocityMmPerS).not.toBe(
      first.peakClosingVelocityMmPerS,
    );
    expect(second.amplitudeOverVelocityMs).not.toBe(
      first.amplitudeOverVelocityMs,
    );
  });

  it("counterfactual: the unclipped window published the predecessor's velocity", () => {
    // The bug we did write, pinned so its mechanism stays understood.
    // Without the clip, the second window's global minimum is its own
    // 0.5 mm floor, but the descent scan climbs back to the trace's
    // first 8.0 and crosses blink 1's steeper fall, so blink 2 is
    // published with blink 1's peak velocity, bit for bit, and its
    // A over V collapses from 231 ms to 76 ms.
    const first = analyzeClosing(
      windowFrom(shapeWindowStartMs(REOPEN_1, 66, null), REOPEN_1),
    );
    const contaminated = analyzeClosing(
      windowFrom(shapeWindowStartMs(REOPEN_2, DURATION_2, null), REOPEN_2),
    );
    if (first === null || contaminated === null) {
      throw new Error("both shapes must exist for the counterfactual");
    }
    expect(contaminated.peakClosingVelocityMmPerS).toBe(
      first.peakClosingVelocityMmPerS,
    );
    expect(contaminated.amplitudeOverVelocityMs).toBeCloseTo(76, 0);
  });
});
