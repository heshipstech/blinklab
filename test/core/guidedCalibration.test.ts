import { describe, expect, it } from "vitest";

import {
  GUIDED_CALIBRATION_PHASE_MS,
  collectCalibrationSample,
  emptyGuidedCalibration,
  resolveGuidedCalibration,
  startCalibrationSession,
  calibrationSessionStep,
  serializeBlinkCalibration,
  parseBlinkCalibration,
  type CalibrationSessionState,
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

describe("the calibration session state machine", () => {
  // Drive a session from nowMs 0 by feeding one aperture per 33 ms
  // tick until it reaches "done", capturing the phase seen each tick.
  function run(
    openMm: number,
    closedMm: number,
  ): { state: CalibrationSessionState; phasesSeen: string[] } {
    let state = startCalibrationSession(0);
    const phasesSeen: string[] = [];
    for (let tick = 1; tick <= 400 && state.kind !== "done"; tick++) {
      const phase = state.kind === "collecting" ? state.phase : "done";
      phasesSeen.push(phase);
      const mm = phase === "closed" ? closedMm : openMm;
      state = calibrationSessionStep(state, tick * 33, mm);
    }
    return { state, phasesSeen };
  }

  it("starts collecting the open phase", () => {
    const state = startCalibrationSession(1000);
    expect(state.kind).toBe("collecting");
    if (state.kind === "collecting") {
      expect(state.phase).toBe("open");
    }
  });

  it("walks open then closed then done, in that order", () => {
    const { state, phasesSeen } = run(8, 2);
    expect(state.kind).toBe("done");
    expect(phasesSeen).toContain("open");
    expect(phasesSeen).toContain("closed");
    // Open always precedes closed: the last open tick is before the
    // first closed tick.
    expect(phasesSeen.lastIndexOf("open")).toBeLessThan(
      phasesSeen.indexOf("closed"),
    );
  });

  it("resolves a clean run to a ready line at the midpoint", () => {
    const { state } = run(8, 2);
    expect(state.kind).toBe("done");
    if (state.kind === "done" && state.result.kind === "ready") {
      expect(state.result.personalLineMm).toBe(5);
    } else {
      throw new Error("expected a ready result");
    }
  });

  it("resolves a run where the eye never closed to a refusal", () => {
    const { state } = run(8, 8);
    expect(state.kind).toBe("done");
    if (state.kind === "done") {
      expect(state.result.kind).toBe("refused");
    }
  });

  it("holds the open phase until its duration elapses", () => {
    let state = startCalibrationSession(0);
    state = calibrationSessionStep(state, GUIDED_CALIBRATION_PHASE_MS - 1, 8);
    expect(state.kind === "collecting" && state.phase).toBe("open");
    state = calibrationSessionStep(state, GUIDED_CALIBRATION_PHASE_MS, 8);
    expect(state.kind === "collecting" && state.phase).toBe("closed");
  });

  it("ignores a backwards clock, state unchanged", () => {
    const state = startCalibrationSession(1000);
    expect(calibrationSessionStep(state, 500, 8)).toBe(state);
  });

  it("is terminal once done", () => {
    const { state } = run(8, 2);
    expect(calibrationSessionStep(state, 999999, 5)).toBe(state);
  });
});

describe("stored blink calibration, serialise and validated parse", () => {
  const good = {
    personalLineMm: 5,
    openMedianMm: 8,
    closedMedianMm: 2,
  };

  it("round-trips a ready calibration", () => {
    const raw = serializeBlinkCalibration(good);
    expect(parseBlinkCalibration(raw)).toEqual(good);
  });

  it("rejects non-JSON", () => {
    expect(parseBlinkCalibration("not json {")).toBeNull();
  });

  it("rejects a missing field", () => {
    expect(
      parseBlinkCalibration(
        JSON.stringify({ personalLineMm: 5, openMedianMm: 8 }),
      ),
    ).toBeNull();
  });

  it("rejects a non-finite number", () => {
    expect(
      parseBlinkCalibration(
        JSON.stringify({
          personalLineMm: null,
          openMedianMm: 8,
          closedMedianMm: 2,
        }),
      ),
    ).toBeNull();
    expect(
      parseBlinkCalibration(
        '{"personalLineMm":5,"openMedianMm":8,"closedMedianMm":"x"}',
      ),
    ).toBeNull();
  });

  it("rejects a zero median, which a real calibration never produces", () => {
    // resolveGuidedCalibration medians real apertures, all above zero,
    // so a stored zero is a degenerate or tampered entry, not a
    // calibration.
    expect(
      parseBlinkCalibration(
        JSON.stringify({
          personalLineMm: 4,
          openMedianMm: 8,
          closedMedianMm: 0,
        }),
      ),
    ).toBeNull();
  });

  it("rejects a line that does not sit between closed and open", () => {
    // A line at or outside the open/closed bracket is not one these
    // medians could have produced: a tampered or stale-format entry.
    expect(
      parseBlinkCalibration(
        JSON.stringify({
          personalLineMm: 9,
          openMedianMm: 8,
          closedMedianMm: 2,
        }),
      ),
    ).toBeNull();
    expect(
      parseBlinkCalibration(
        JSON.stringify({
          personalLineMm: 1,
          openMedianMm: 8,
          closedMedianMm: 2,
        }),
      ),
    ).toBeNull();
  });
});
