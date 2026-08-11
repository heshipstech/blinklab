import { describe, expect, it } from "vitest";

import {
  baselineStep,
  learningSecondsLeft,
  personalThresholdMm,
  startBaseline,
  type BaselineState,
} from "../../src/core/baseline";
import { BASELINE_MEDIAN_CEILING_FACTOR } from "../../src/core/constants";
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

describe("the ratchet's ceiling, fix #126", () => {
  // The owner's own broken session: a baseline of 10.7 mm against a
  // resting aperture of 5.25, which put the blink line at 5.35, ABOVE
  // their open eye. Every closure was then timed from a crossing that
  // had happened while they sat there awake, so durations read 216 to
  // 300 ms against a true 117 to 133, and one logged blink carried an
  // amplitude of 0.2 mm.
  //
  // The p90 is what makes that reachable: sixty frames of surprise in
  // a six hundred frame window move it a long way, and the baseline
  // never falls, so the lift is permanent for the session. The MEDIAN
  // of the same window barely moves, which is why it makes a good
  // ceiling.

  function established(restingMm: number): BaselineState {
    // A full learning window of ordinary open eyes.
    return feed(
      startBaseline(0),
      0,
      Array.from({ length: 350 }, () => restingMm),
    );
  }

  it("pins the ceiling factor", () => {
    expect(BASELINE_MEDIAN_CEILING_FACTOR).toBe(1.4);
  });

  it("refuses a rise driven by a brief wide eyed excursion", () => {
    // Five hundred and forty ordinary frames plus sixty wide ones,
    // which is roughly two seconds of raised brows at 30 fps. The p90
    // of that window is about 11 mm; the median is still 6.5.
    let state = established(6.5);
    const before = state.kind === "ready" ? state.baselineMm : 0;
    state = feed(state, 40000, [
      ...Array.from({ length: 540 }, () => 6.5),
      ...Array.from({ length: 60 }, () => 11),
    ]);
    const after = state.kind === "ready" ? state.baselineMm : 0;
    expect(after).toBeLessThanOrEqual(6.5 * BASELINE_MEDIAN_CEILING_FACTOR);
    expect(after).toBeLessThan(11);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("keeps the blink line below the eye it is measuring", () => {
    // The property that actually matters, stated directly: whatever
    // the ratchet does, half the baseline must stay under the typical
    // open aperture, or the eye reads closed at rest.
    let state = established(6.5);
    state = feed(state, 40000, [
      ...Array.from({ length: 540 }, () => 6.5),
      ...Array.from({ length: 60 }, () => 11),
    ]);
    const threshold = personalThresholdMm(state) ?? Infinity;
    expect(threshold).toBeLessThan(6.5);
  });

  it("still accepts a genuine rise, eyes that really did open wider", () => {
    // Not a brief excursion but a sustained change: the whole window
    // moves, so the median moves with it and the ceiling rises too.
    let state = established(6.5);
    const before = state.kind === "ready" ? state.baselineMm : 0;
    state = feed(
      state,
      40000,
      Array.from({ length: 600 }, () => 8.5),
    );
    const after = state.kind === "ready" ? state.baselineMm : 0;
    expect(after).toBeGreaterThan(before);
    expect(after).toBeGreaterThanOrEqual(8);
  });

  it("never falls, so a drooping lid cannot lower its own bar", () => {
    // The rule the ratchet exists for, unchanged: the ceiling may
    // block a RISE, it must never force a fall, or drowsiness would
    // quietly lower the line that is meant to expose it.
    let state = established(8);
    const before = state.kind === "ready" ? state.baselineMm : 0;
    state = feed(
      state,
      40000,
      Array.from({ length: 600 }, () => 3),
    );
    const after = state.kind === "ready" ? state.baselineMm : 0;
    expect(after).toBe(before);
  });

  it("bounds the very first baseline too, not only later rises", () => {
    // A person who was surprised during the learning window would
    // otherwise start the session with a broken line and no rise
    // ever needed to get there.
    const state = feed(startBaseline(0), 0, [
      ...Array.from({ length: 300 }, () => 6.5),
      ...Array.from({ length: 50 }, () => 12),
    ]);
    const baseline = state.kind === "ready" ? state.baselineMm : 0;
    expect(baseline).toBeLessThanOrEqual(6.5 * BASELINE_MEDIAN_CEILING_FACTOR);
    expect(personalThresholdMm(state) ?? Infinity).toBeLessThan(6.5);
  });

  it("leaves a healthy session untouched, the ceiling never binding", () => {
    // The recorded fixture's own shape: a median near 7 and a p90
    // near 7.9, a ratio of about 1.12, nowhere near the 1.4 ceiling.
    // The check is that the bounded answer IS the raw p90, so the fix
    // costs nothing where nothing was broken.
    let state = established(7);
    const window = [
      ...Array.from({ length: 500 }, () => 7),
      ...Array.from({ length: 100 }, () => 7.9),
    ];
    state = feed(state, 40000, window);
    const after = state.kind === "ready" ? state.baselineMm : 0;
    const rawP90 = percentile(window, 90) ?? 0;
    const median = percentile(window, 50) ?? 0;
    expect(rawP90).toBeCloseTo(7.9, 5);
    expect(rawP90).toBeLessThan(median * BASELINE_MEDIAN_CEILING_FACTOR);
    expect(after).toBeCloseTo(rawP90, 5);
  });
});

describe("the 30 second learning window, pinned by literal clocks (remediation C1)", () => {
  // The audit's headline for this file: the learning window could be
  // cut from 30 seconds to 1 with every test green, because the
  // suite always fed enough elapsed time. These literals hold the
  // boundary from both sides. The window is a safety constant: it is
  // how long the instrument watches a face before it claims to know
  // that face's open eyes.
  const feed = (endMs: number): BaselineState => {
    let state = startBaseline(0);
    // Plenty of samples on a steady 100 ms grid, so the sample-count
    // gates are satisfied and only TIME decides readiness.
    for (let t = 100; t <= endMs; t += 100) {
      state = baselineStep(state, t, 7);
    }
    return state;
  };

  it("still learning one step before 30 seconds", () => {
    expect(feed(29_900).kind).toBe("learning");
  });

  it("ready exactly at 30 seconds, the boundary included", () => {
    // Readiness is elapsed >= the window, and only a probe AT the
    // boundary pins that operator: review flipped it to a strict
    // greater-than and the one-step-off probes left the suite green.
    expect(feed(30_000).kind).toBe("ready");
    expect(feed(30_100).kind).toBe("ready");
  });
});

describe("learningSecondsLeft (remediation C1, the missing test)", () => {
  it("counts down in whole seconds from the learning start", () => {
    const state = startBaseline(1_000);
    expect(learningSecondsLeft(state, 1_000)).toBe(30);
    expect(learningSecondsLeft(state, 11_000)).toBe(20);
    expect(learningSecondsLeft(state, 30_500)).toBe(1);
    // Never negative, even when readiness is overdue because samples
    // are still missing: 0 and waiting, not a minus sign.
    expect(learningSecondsLeft(state, 99_000)).toBe(0);
  });

  it("answers null once the baseline is ready, not zero", () => {
    let state = startBaseline(0);
    for (let t = 100; t <= 31_000; t += 100) {
      state = baselineStep(state, t, 7);
    }
    expect(state.kind).toBe("ready");
    expect(learningSecondsLeft(state, 31_000)).toBeNull();
  });
});
