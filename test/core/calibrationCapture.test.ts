import { describe, expect, it } from "vitest";

import {
  CALIBRATION_TARGETS,
  captureStep,
  isCaptureDone,
  parseCalibrationSamples,
  startCapture,
  type CalibrationCapture,
  type CompletedTarget,
} from "../../src/core/calibrationCapture";
import {
  CALIBRATION_SAMPLES_PER_TARGET,
  CALIBRATION_SETTLE_MS,
} from "../../src/core/constants";

const OFFSET = { horizontal: 0.05, vertical: -0.02 };

function feed(
  state: CalibrationCapture,
  startMs: number,
  count: number,
  stepMs = 20,
): CalibrationCapture {
  let current = state;
  for (let i = 0; i < count; i++) {
    current = captureStep(current, startMs + i * stepMs, OFFSET);
  }
  return current;
}

describe("the calibration targets", () => {
  it("are nine, spread across the viewport, none duplicated", () => {
    expect(CALIBRATION_TARGETS.length).toBe(9);
    const keys = new Set(
      CALIBRATION_TARGETS.map((t) => `${String(t.x)},${String(t.y)}`),
    );
    expect(keys.size).toBe(9);
    for (const target of CALIBRATION_TARGETS) {
      expect(target.x).toBeGreaterThan(0);
      expect(target.x).toBeLessThan(1);
      expect(target.y).toBeGreaterThan(0);
      expect(target.y).toBeLessThan(1);
    }
  });
});

describe("captureStep, the sample collector", () => {
  it("ignores samples during the settle window", () => {
    const state = feed(startCapture(0), 0, 10);
    expect(state.currentSamples.length).toBe(0);
  });

  it("collects after the settle window ends", () => {
    let state = startCapture(0);
    state = captureStep(state, CALIBRATION_SETTLE_MS + 1, OFFSET);
    expect(state.currentSamples.length).toBe(1);
  });

  it("skips invalid frames without counting them", () => {
    let state = startCapture(0);
    state = captureStep(state, CALIBRATION_SETTLE_MS + 1, null);
    state = captureStep(state, CALIBRATION_SETTLE_MS + 2, OFFSET);
    expect(state.currentSamples.length).toBe(1);
  });

  it("advances the target at exactly the quota, not before", () => {
    let state = startCapture(0);
    state = feed(
      state,
      CALIBRATION_SETTLE_MS + 1,
      CALIBRATION_SAMPLES_PER_TARGET - 1,
    );
    expect(state.targetIndex).toBe(0);
    state = captureStep(state, 99999, OFFSET);
    expect(state.targetIndex).toBe(1);
    expect(state.currentSamples.length).toBe(0);
    expect(state.completed.length).toBe(1);
    expect(state.completed[0]?.samples.length).toBe(
      CALIBRATION_SAMPLES_PER_TARGET,
    );
  });

  it("walks all nine targets to done, recording them in order", () => {
    let state = startCapture(0);
    let nowMs = 0;
    for (let target = 0; target < 9; target++) {
      nowMs += CALIBRATION_SETTLE_MS + 10;
      for (let i = 0; i < CALIBRATION_SAMPLES_PER_TARGET; i++) {
        state = captureStep(state, nowMs, OFFSET);
        nowMs += 20;
      }
    }
    expect(isCaptureDone(state)).toBe(true);
    expect(state.completed.length).toBe(9);
    expect(state.completed.map((c) => c.target)).toEqual([
      ...CALIBRATION_TARGETS,
    ]);
  });

  it("is not done before the ninth completes", () => {
    expect(isCaptureDone(startCapture(0))).toBe(false);
  });
});

describe("parseCalibrationSamples, the reload boundary the samples store forgot", () => {
  // The sibling of parseCalibrationProfile: the samples store also cast
  // its JSON, `JSON.parse(raw) as CompletedTarget[]`, so a value that
  // parsed but was the wrong shape would be re-solved into a profile.
  // This is the validated boundary that replaces the cast. Shape and
  // finiteness only, on every target and every sample.
  const good: CompletedTarget[] = [
    {
      target: { x: 0.1, y: 0.9 },
      samples: [{ horizontal: 0.05, vertical: -0.02 }],
    },
    { target: { x: 0.5, y: 0.5 }, samples: [] },
  ];

  it("accepts a well-formed samples array", () => {
    expect(parseCalibrationSamples(JSON.stringify(good))).toEqual(good);
  });

  it("accepts an empty array, which is what a fresh save round-trips", () => {
    // saveCalibrationSamples([]) is a real path (the store's own test),
    // so an empty array must read back as an empty array, not as null.
    expect(parseCalibrationSamples("[]")).toEqual([]);
  });

  it("rejects non-JSON", () => {
    expect(parseCalibrationSamples("{not json")).toBeNull();
  });

  it("rejects a value that is not an array", () => {
    expect(
      parseCalibrationSamples(JSON.stringify({ target: { x: 0, y: 0 } })),
    ).toBeNull();
  });

  it("rejects an entry whose target is malformed", () => {
    expect(
      parseCalibrationSamples(
        JSON.stringify([{ target: { x: 0.1 }, samples: [] }]),
      ),
    ).toBeNull();
  });

  it("rejects an entry whose samples hold a non-finite offset", () => {
    // The exact gap this closes: a value that parses but is the wrong
    // shape used to be trusted and re-solved into a gaze mapping.
    expect(
      parseCalibrationSamples(
        '[{"target":{"x":0.1,"y":0.9},"samples":[{"horizontal":"x","vertical":0}]}]',
      ),
    ).toBeNull();
  });

  it("rejects an array entry that is not an object", () => {
    expect(parseCalibrationSamples(JSON.stringify([5]))).toBeNull();
  });

  it("rejects an entry whose target is not an object", () => {
    expect(
      parseCalibrationSamples(JSON.stringify([{ target: 5, samples: [] }])),
    ).toBeNull();
  });

  it("rejects an entry whose samples field is not an array", () => {
    expect(
      parseCalibrationSamples(
        JSON.stringify([{ target: { x: 0, y: 0 }, samples: "nope" }]),
      ),
    ).toBeNull();
  });

  it("rejects a sample that is not an object", () => {
    expect(
      parseCalibrationSamples(
        JSON.stringify([{ target: { x: 0, y: 0 }, samples: [7] }]),
      ),
    ).toBeNull();
  });
});
