import { describe, expect, it } from "vitest";

import {
  assembleFeatureRecord,
  isFeatureRecord,
  type FeatureRecord,
} from "../../src/core/featureRecord";

// A fully populated frame, the owner's own plausible numbers.
const FULL: FeatureRecord = {
  timestampMs: 61000,
  faceDetected: true,
  fps: 60,
  apertureMm: 5.9,
  baselineMm: 7.2,
  shutBaselineMm: 7.2,
  baselineOverResting: 1.16,
  blinkRatePerMin: 14,
  lastBlinkDurationMs: 133,
  lastBlinkAmplitudeMm: 3.4,
  lastBlinkPeakVelocityMmPerS: 72,
  perclos: 0.021,
  longClosureCount: 1,
  fixationCount: 12,
  fixationMedianMs: 383,
  fixating: true,
  onScreen: true,
};

// The first honest second of a session: nothing is trusted yet.
const ALL_NULL: FeatureRecord = {
  timestampMs: 1000,
  faceDetected: false,
  fps: null,
  apertureMm: null,
  baselineMm: null,
  shutBaselineMm: null,
  baselineOverResting: null,
  blinkRatePerMin: null,
  lastBlinkDurationMs: null,
  lastBlinkAmplitudeMm: null,
  lastBlinkPeakVelocityMmPerS: null,
  perclos: null,
  longClosureCount: 0,
  fixationCount: null,
  fixationMedianMs: null,
  fixating: null,
  onScreen: null,
};

const NUMBER_KEYS = [
  "timestampMs",
  "fps",
  "apertureMm",
  "baselineMm",
  "shutBaselineMm",
  "blinkRatePerMin",
  "lastBlinkDurationMs",
  "lastBlinkAmplitudeMm",
  "lastBlinkPeakVelocityMmPerS",
  "perclos",
  "longClosureCount",
  "fixationCount",
  "fixationMedianMs",
] as const;

describe("assembleFeatureRecord", () => {
  it("passes every field through unchanged", () => {
    expect(assembleFeatureRecord(FULL)).toEqual(FULL);
  });

  it("returns a fresh object every call, rows never share", () => {
    // A shared mutated object would let every buffered row silently
    // become the newest row. Two calls must be independent.
    const first = assembleFeatureRecord(FULL);
    const second = assembleFeatureRecord(ALL_NULL);
    expect(first).not.toBe(second);
    expect(first.timestampMs).toBe(61000);
    expect(second.timestampMs).toBe(1000);
    const third = assembleFeatureRecord(FULL);
    expect(third).not.toBe(first);
  });

  it("produces records the validator accepts, full and empty alike", () => {
    expect(isFeatureRecord(assembleFeatureRecord(FULL))).toBe(true);
    expect(isFeatureRecord(assembleFeatureRecord(ALL_NULL))).toBe(true);
  });
});

describe("isFeatureRecord, the schema", () => {
  it("accepts the two canonical shapes", () => {
    expect(isFeatureRecord(FULL)).toBe(true);
    expect(isFeatureRecord(ALL_NULL)).toBe(true);
  });

  it("rejects non-objects outright, including arrays wearing the keys", () => {
    expect(isFeatureRecord(null)).toBe(false);
    expect(isFeatureRecord(undefined)).toBe(false);
    expect(isFeatureRecord(42)).toBe(false);
    expect(isFeatureRecord("record")).toBe(false);
    expect(isFeatureRecord([])).toBe(false);
    // An array can carry every key and still not be a record.
    expect(isFeatureRecord(Object.assign([], FULL))).toBe(false);
  });

  it("rejects a wrong type in each field family", () => {
    expect(isFeatureRecord({ ...FULL, timestampMs: "61000" })).toBe(false);
    expect(isFeatureRecord({ ...FULL, faceDetected: null })).toBe(false);
    expect(isFeatureRecord({ ...FULL, perclos: "0.02" })).toBe(false);
    expect(isFeatureRecord({ ...FULL, fixating: 1 })).toBe(false);
    expect(isFeatureRecord({ ...FULL, onScreen: "yes" })).toBe(false);
    expect(isFeatureRecord({ ...FULL, longClosureCount: null })).toBe(false);
  });

  it("rejects NaN and both infinities everywhere a number lives", () => {
    // NaN is a number to typeof and a lie to arithmetic; Infinity
    // serializes to nothing JSON can hold. Both are refused at the
    // door, on every numeric field.
    for (const key of NUMBER_KEYS) {
      expect(isFeatureRecord({ ...FULL, [key]: Number.NaN })).toBe(false);
      expect(isFeatureRecord({ ...FULL, [key]: Infinity })).toBe(false);
      expect(isFeatureRecord({ ...FULL, [key]: -Infinity })).toBe(false);
    }
  });

  it("rejects negatives where a negative is meaningless", () => {
    expect(isFeatureRecord({ ...FULL, longClosureCount: -1 })).toBe(false);
    expect(isFeatureRecord({ ...FULL, fixationCount: -3 })).toBe(false);
    expect(isFeatureRecord({ ...FULL, blinkRatePerMin: -2 })).toBe(false);
    expect(isFeatureRecord({ ...FULL, lastBlinkAmplitudeMm: -0.5 })).toBe(
      false,
    );
    expect(isFeatureRecord({ ...FULL, lastBlinkPeakVelocityMmPerS: -10 })).toBe(
      false,
    );
    expect(isFeatureRecord({ ...FULL, perclos: -0.1 })).toBe(false);
    expect(isFeatureRecord({ ...FULL, perclos: 1.1 })).toBe(false);
  });

  it("rejects every possible missing key, not just one", () => {
    for (const key of Object.keys(FULL)) {
      const copy: Record<string, unknown> = { ...FULL };
      delete copy[key];
      expect(isFeatureRecord(copy), `missing ${key} must fail`).toBe(false);
    }
  });

  it("tolerates extra keys deliberately", () => {
    // Forward compatibility: a future field must not make old
    // records unreadable. Documented decision, not an oversight.
    expect(isFeatureRecord({ ...FULL, futureField: 123 })).toBe(true);
  });
});
