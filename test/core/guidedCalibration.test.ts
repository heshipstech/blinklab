import { describe, expect, it } from "vitest";

import {
  collectCalibrationSample,
  emptyGuidedCalibration,
  resolveGuidedCalibration,
  type GuidedCalibrationSamples,
} from "../../src/core/guidedCalibration";

// The guided blink-line calibration measures a person's OWN open and
// closed aperture through two held phases, then places the personal
// line in the real gap between them. The passive baseline assumes
// closed is near zero and puts the line at half of open; a guided run
// measures the real closed value. A refused calibration is a result,
// not an accident — too few samples in either phase, or a closure the
// instrument did not register (the personal echo of the corpus recall
// ceiling), each yields a refusal rather than a guessed line.

function repeat(value: number, count: number): number[] {
  return Array.from({ length: count }, () => value);
}

const ENOUGH = 40; // comfortably over the minimum

function samples(open: number[], closed: number[]): GuidedCalibrationSamples {
  return { open, closed };
}

describe("collectCalibrationSample", () => {
  it("routes a trusted reading to the phase in progress", () => {
    let s = emptyGuidedCalibration;
    s = collectCalibrationSample(s, "open", 8);
    s = collectCalibrationSample(s, "closed", 2);
    expect(s.open).toEqual([8]);
    expect(s.closed).toEqual([2]);
  });

  it("drops a null aperture rather than storing it", () => {
    let s = emptyGuidedCalibration;
    s = collectCalibrationSample(s, "open", null);
    s = collectCalibrationSample(s, "open", 8);
    expect(s.open).toEqual([8]);
  });
});

describe("resolveGuidedCalibration, ready", () => {
  it("places the personal line at the midpoint of open and closed", () => {
    const result = resolveGuidedCalibration(
      samples(repeat(8, ENOUGH), repeat(2, ENOUGH)),
    );
    expect(result.kind).toBe("ready");
    if (result.kind === "ready") {
      expect(result.openMedianMm).toBe(8);
      expect(result.closedMedianMm).toBe(2);
      expect(result.personalLineMm).toBe(5);
    }
  });
});

describe("resolveGuidedCalibration, refusals", () => {
  it("refuses when the open phase has too few samples", () => {
    const result = resolveGuidedCalibration(
      samples(repeat(8, 5), repeat(2, ENOUGH)),
    );
    expect(result).toEqual({ kind: "refused", reason: "not-enough-open" });
  });

  it("refuses when the closed phase has too few samples", () => {
    const result = resolveGuidedCalibration(
      samples(repeat(8, ENOUGH), repeat(2, 5)),
    );
    expect(result).toEqual({ kind: "refused", reason: "not-enough-closed" });
  });

  it("refuses when the closure was not registered, the ceiling's echo", () => {
    // Closed median 7 against open 8 is only 12% below: the instrument
    // did not see this person's closure, so no line can be drawn.
    const result = resolveGuidedCalibration(
      samples(repeat(8, ENOUGH), repeat(7, ENOUGH)),
    );
    expect(result).toEqual({
      kind: "refused",
      reason: "closure-not-registered",
    });
  });

  it("accepts a closure exactly at the separation boundary", () => {
    // The separation floor is 30%: a closed median at exactly 70% of
    // open is accepted, one hair above it is refused.
    const ready = resolveGuidedCalibration(
      samples(repeat(10, ENOUGH), repeat(7, ENOUGH)),
    );
    expect(ready.kind).toBe("ready");
    const refused = resolveGuidedCalibration(
      samples(repeat(10, ENOUGH), repeat(7.01, ENOUGH)),
    );
    expect(refused.kind).toBe("refused");
  });
});
