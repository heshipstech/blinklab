import { describe, expect, it } from "vitest";

import {
  baselineStep,
  personalThresholdMm,
  startBaseline,
  type BaselineState,
} from "../../src/core/baseline";
import { percentile } from "../../src/core/statistics";

// The clock is injected as always: timestamps are hand written, the
// 30 second learning window is traversed in microseconds of test time.
function feed(
  state: BaselineState,
  startMs: number,
  values: (number | null)[],
  stepMs = 100,
): BaselineState {
  let current = state;
  values.forEach((value, index) => {
    current = baselineStep(current, startMs + index * stepMs, value);
  });
  return current;
}

const openEyes = Array.from({ length: 350 }, () => 7);

describe("percentile", () => {
  it("solves hand checkable values", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
  });

  it("returns null for no samples", () => {
    expect(percentile([], 90)).toBeNull();
  });
});

describe("baseline learning", () => {
  it("counts down, then becomes ready with a high percentile baseline", () => {
    const state = feed(startBaseline(0), 0, openEyes);
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") {
      expect(state.baselineMm).toBeCloseTo(7, 6);
    }
  });

  it("keeps learning past the deadline when samples are too few", () => {
    const sparse: (number | null)[] = Array.from({ length: 350 }, (_, i) =>
      i < 10 ? 7 : null,
    );
    expect(feed(startBaseline(0), 0, sparse).kind).toBe("learning");
  });

  it("is not dragged down by blinks during learning, the percentile holds", () => {
    const withBlinks = openEyes.map((v, i) => (i % 50 === 0 ? 2 : v));
    const state = feed(startBaseline(0), 0, withBlinks);
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") {
      expect(state.baselineMm).toBeCloseTo(7, 6);
    }
  });
});

describe("the ladder's rule: rises but never falls", () => {
  function readyAtSeven(): BaselineState {
    return feed(startBaseline(0), 0, openEyes);
  }

  it("never falls, sustained droop cannot lower the bar", () => {
    const drooping = Array.from({ length: 700 }, () => 5);
    const state = feed(readyAtSeven(), 60000, drooping);
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") {
      expect(state.baselineMm).toBeCloseTo(7, 6);
    }
  });

  it("rises when the eyes sustain wider than ever", () => {
    const wider = Array.from({ length: 700 }, () => 9);
    const state = feed(readyAtSeven(), 60000, wider);
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") {
      expect(state.baselineMm).toBeGreaterThan(8.9);
    }
  });

  it("ignores null frames in both phases", () => {
    const noisy: (number | null)[] = [null, 7, null, 7, null];
    const state = feed(readyAtSeven(), 60000, noisy);
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") {
      expect(state.baselineMm).toBeCloseTo(7, 6);
    }
  });
});

describe("personalThresholdMm", () => {
  it("is half the baseline once ready, null while learning", () => {
    const ready = feed(startBaseline(0), 0, openEyes);
    expect(personalThresholdMm(ready)).toBeCloseTo(3.5, 6);
    expect(personalThresholdMm(startBaseline(0))).toBeNull();
  });
});
