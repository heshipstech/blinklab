import { describe, expect, it } from "vitest";

import {
  CALIBRATION_REFUSED_SENTENCE,
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

  // Roadmap 10.1c, ladder D2. Both floors are literals here. The
  // window is 30 000 ms and the sample count is 100, and the September
  // audit moved each an order of magnitude with the whole suite green,
  // because every other test fed 350 samples over 35 seconds and never
  // stood on either edge.
  it("needs 100 samples, not 99, as a literal", () => {
    // 30 seconds of clock either way, so only the count decides. The
    // step is 300 ms, which puts sample 100 at 29 700 ms and sample
    // 101 at 30 000: the run of 99 has crossed neither edge.
    const ninetyNine = feed(
      startBaseline(0),
      0,
      Array.from({ length: 99 }, () => 7),
      300,
    );
    expect(ninetyNine.kind).toBe("learning");
    const oneHundred = feed(
      startBaseline(0),
      0,
      Array.from({ length: 101 }, () => 7),
      300,
    );
    expect(oneHundred.kind).toBe("ready");
  });

  it("needs 30 000 ms of clock, not 29 999, as a literal", () => {
    // The sample floor is cleared first, at one sample a millisecond,
    // so only the clock decides the last step. One millisecond short
    // is still learning; the 30 000th is ready.
    const learned = feed(
      startBaseline(0),
      0,
      Array.from({ length: 200 }, () => 7),
      1,
    );
    expect(learned.kind).toBe("learning");
    expect(baselineStep(learned, 29999, 7).kind).toBe("learning");
    expect(baselineStep(learned, 30000, 7).kind).toBe("ready");
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
  // Since the refusal (docs/calibration-refusal.txt) the ceiling's
  // job changed once more: it no longer bounds the birth estimate,
  // it REFUSES the birth. A window the ceiling binds produced a
  // clipped ruler that was still 1.35 times one session's resting
  // eye — a guess wearing a number's clothes — so a bound window now
  // births nothing at all. Every ready ruler is a raw, unclipped p90.

  it("pins the ceiling factor to the plan's pre-registered line", () => {
    expect(BASELINE_MEDIAN_CEILING_FACTOR).toBe(1.25);
  });

  it("refuses the surprised learning window rather than clipping it", () => {
    // A person who was surprised during the learning window used to
    // start the session with a clipped line and carry it, frozen, to
    // the end. The wide samples are INTERLEAVED: birth happens at
    // the 30 second mark, so a tail appended after it would never be
    // seen, and the first draft of the clipping-era test proved
    // exactly nothing for exactly that reason. Every sixth sample at
    // 12 mm puts the raw p90 at 12 while the median stays 6.5.
    const surprised = Array.from({ length: 350 }, (_, i) =>
      i % 6 === 5 ? 12 : 6.5,
    );
    const state = feed(startBaseline(0), 0, surprised);
    expect(state.kind).toBe("refused");
  });

  it("publishes no blink line at all from a window the ceiling binds", () => {
    // The clipping era held "the blink line stays below the eye" by
    // clipping the baseline. The refusal holds the deeper property:
    // a line the instrument cannot vouch for is not drawn low, it is
    // not drawn.
    const surprised = Array.from({ length: 350 }, (_, i) =>
      i % 5 === 4 ? 14 : 6.5,
    );
    const state = feed(startBaseline(0), 0, surprised);
    expect(personalThresholdMm(state)).toBeNull();
  });

  it("refuses the macbookair window, the failure the refusal exists for", () => {
    // The dry run's recorded shape, the same one the birth
    // certificate tests pin: a median of 7.51 mm with enough frames
    // at 10.35 to drag the p90 to them, spread 1.378. Under the
    // clipping era this window birthed a ruler at 9.3875 mm, still
    // 1.35 times that session's resting eye. Interleaved every ninth
    // sample so the outliers are inside the window when the thirty
    // seconds elapse: 33 of the 301 samples at birth, just over the
    // p90's reach.
    const macbookair = Array.from({ length: 350 }, (_, i) =>
      i % 9 === 8 ? 10.35 : 7.51,
    );
    const state = feed(startBaseline(0), 0, macbookair);
    expect(state.kind).toBe("refused");
    if (state.kind !== "refused") return;
    // The refused state carries the full birth certificate: an
    // analysis must be able to say WHY a session was refused.
    expect(state.window.spreadRatio).toBeCloseTo(10.35 / 7.51, 6);
    expect(state.window.ceilingBound).toBe(true);
    expect(personalThresholdMm(state)).toBeNull();
    expect(learningSecondsLeft(state, 60_000)).toBeNull();
  });

  it("refusal is frozen: a calm eye afterwards does not un-refuse", () => {
    // The exit the person is offered is a restart, in the refusal
    // sentence itself. Silently re-learning mid-session would be the
    // P3 failure again: a ruler that appears while the measurement
    // runs is a ruler that moved.
    const macbookair = Array.from({ length: 350 }, (_, i) =>
      i % 9 === 8 ? 10.35 : 7.51,
    );
    const refused = feed(startBaseline(0), 0, macbookair);
    const calm = Array.from({ length: 700 }, () => 7);
    const after = feed(refused, 60_000, calm);
    expect(after.kind).toBe("refused");
    expect(personalThresholdMm(after)).toBeNull();
  });

  it("pins the refusal sentence verbatim to docs/calibration-refusal.txt", () => {
    expect(CALIBRATION_REFUSED_SENTENCE).toBe(
      "Calibration was refused: while learning your baseline, the widest eye openings disagreed with the middle ones by more than the instrument allows, which usually means blinks or a squint contaminated the learning period. Numbers that depend on the blink line are withheld rather than guessed. Restart the camera and keep your eyes comfortably open for the first thirty seconds.",
    );
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
