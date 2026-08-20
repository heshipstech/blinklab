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

describe("the ruler freezes at birth (the round's criterion 2)", () => {
  // The six-person round's pre-registered baseline criterion FAILED:
  // the rise-only ratchet moved the ruler 34.6 percent DURING one
  // volunteer's marked window and 15.4 percent just before another's,
  // and both sessions were excluded because a moving ruler is not a
  // ruler. Measured on the published Eyeblink8 run, the ratchet also
  // rose on every one of the eight clips. So the owner decided on
  // 20 August 2026: thirty seconds of learning DEFINE this person's
  // "open", and the definition then holds for the whole session,
  // like any instrument that is calibrated and then used.
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

  it("no longer rises, even when the eyes sustain wider than ever", () => {
    // The freeze's deliberate trade, inverted from the old ladder
    // rule this block replaces. A genuine sustained widening after
    // calibration no longer moves the ruler, because in a live
    // session it is indistinguishable from the P3 failure that moved
    // a ruler 34.6 percent mid-measurement.
    const wider = Array.from({ length: 700 }, () => 9);
    const state = feed(readyAtSeven(), 60000, wider);
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") {
      expect(state.baselineMm).toBeCloseTo(7, 6);
    }
  });

  it("does not creep on a brief wide eyed excursion either", () => {
    // Fix #126 capped this rise; the freeze removes it. Two seconds
    // of raised brows leave the ruler exactly where birth put it.
    const excursion = [
      ...Array.from({ length: 540 }, () => 7),
      ...Array.from({ length: 60 }, () => 11),
    ];
    const state = feed(readyAtSeven(), 60000, excursion);
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") {
      expect(state.baselineMm).toBeCloseTo(7, 6);
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

describe("the birth ceiling, fix #126 tightened by the round", () => {
  // The owner's own broken session: a baseline of 10.7 mm against a
  // resting aperture of 5.25, which put the blink line at 5.35, ABOVE
  // their open eye. Fix #126 capped the baseline at 1.4 times the
  // window's median. The round then showed 1.4 was looser than the
  // plan's own pre-registered soundness line: baselines born at 1.28
  // and 1.33 times resting passed the learner and failed the round's
  // 1.25 check. The learner must not produce a ruler the plan calls
  // implausible on sight, so the ceiling now IS the plan's line.
  //
  // With the ruler frozen at birth, the ceiling has exactly one job:
  // bounding the birth estimate. The p90 stays because blinks during
  // learning must not drag "open" down.

  it("pins the ceiling factor to the plan's pre-registered line", () => {
    expect(BASELINE_MEDIAN_CEILING_FACTOR).toBe(1.25);
  });

  it("bounds the birth estimate against a surprised learning window", () => {
    // A person who was surprised during the learning window would
    // otherwise start the session with a broken line and carry it,
    // frozen, to the end. The wide samples are INTERLEAVED: birth
    // happens at the 30 second mark, so a tail appended after it
    // would never be seen, and the first draft of this test proved
    // exactly nothing for exactly that reason. Every sixth sample at
    // 12 mm puts the raw p90 at 12 while the median stays 6.5.
    const surprised = Array.from({ length: 350 }, (_, i) =>
      i % 6 === 5 ? 12 : 6.5,
    );
    const state = feed(startBaseline(0), 0, surprised);
    const baseline = state.kind === "ready" ? state.baselineMm : 0;
    expect(baseline).toBeLessThanOrEqual(6.5 * BASELINE_MEDIAN_CEILING_FACTOR);
    expect(baseline).toBeLessThan(12);
    expect(personalThresholdMm(state) ?? Infinity).toBeLessThan(6.5);
  });

  it("keeps the blink line below the eye it is measuring", () => {
    // The property that actually matters, stated directly: half the
    // baseline must stay under the typical open aperture, or the eye
    // reads closed at rest. Interleaved for the same reason as above,
    // and the excursion reads 14 mm because a smaller one leaves half
    // the uncapped p90 under the aperture anyway, and this test would
    // hold with the ceiling deleted, which the mutation run proved.
    const surprised = Array.from({ length: 350 }, (_, i) =>
      i % 5 === 4 ? 14 : 6.5,
    );
    const state = feed(startBaseline(0), 0, surprised);
    const threshold = personalThresholdMm(state) ?? Infinity;
    expect(threshold).toBeLessThan(6.5);
  });

  it("leaves a healthy birth untouched, the ceiling never binding", () => {
    // The recorded fixture's own shape: a median near 7 and a p90
    // near 7.9, a ratio of about 1.13, under the 1.25 ceiling. The
    // check is that the bounded answer IS the raw p90, so the
    // tightening costs nothing where nothing was broken.
    // Interleaved, because birth happens at the 30 second mark and a
    // tail of wide samples appended after it would never be seen.
    const window = Array.from({ length: 350 }, (_, i) =>
      i % 5 === 4 ? 7.9 : 7,
    );
    const state = feed(startBaseline(0), 0, window);
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
