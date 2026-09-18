import { describe, expect, it } from "vitest";

import type { GazeSample } from "../../src/core/fixation";
import {
  READING_MIN_CYCLES,
  READING_RHYTHM_CAP,
  RETURN_MAX_FRACTION,
  SWEEP_MIN_HORIZONTAL,
  detectReadingRhythm,
} from "../../src/core/readingRhythm";

// Roadmap 14.12. Reading a line of text drags the gaze slowly across
// the screen and snaps it back — a sawtooth in the horizontal offset.
// The detector is demo-only until 14.11's run carries its committed
// prediction, and its Check names its own adversaries: staring, a
// random walk, and the PURSUIT SINUSOID, which oscillates like
// reading but symmetrically — only the asymmetry rule tells them
// apart, which is why that rule carries a mutation.

function at(timestampMs: number, horizontal: number): GazeSample {
  return { timestampMs, offset: { horizontal, vertical: 0 } };
}

/** A reading-shaped sawtooth: a slow drift one way, a fast return. */
function sawtooth(
  cycles: number,
  lineMs = 1800,
  returnMs = 120,
  amplitude = 0.12,
  sign = 1,
): GazeSample[] {
  const samples: GazeSample[] = [];
  let t = 0;
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    // After the first cycle the return already ended at offset zero,
    // so the next drift starts from its own second step.
    for (let step = cycle === 0 ? 0 : 1; step <= 12; step += 1) {
      samples.push(
        at(t + (lineMs * step) / 12, sign * amplitude * (step / 12)),
      );
    }
    t += lineMs;
    for (let step = 1; step <= 3; step += 1) {
      samples.push(
        at(t + (returnMs * step) / 3, sign * amplitude * (1 - step / 3)),
      );
    }
    t += returnMs;
  }
  return samples;
}

describe("the sawtooth is accepted", () => {
  it("four line-shaped cycles read as a rhythm", () => {
    const verdict = detectReadingRhythm(sawtooth(4));
    expect(verdict.reading).toBe(true);
    expect(verdict.cycles).toBeGreaterThanOrEqual(3);
  });

  it("the mirrored orientation reads too, because scripts run both ways", () => {
    const verdict = detectReadingRhythm(sawtooth(4, 1800, 120, 0.12, -1));
    expect(verdict.reading).toBe(true);
  });
});

describe("the adversaries are rejected", () => {
  it("staring is not reading", () => {
    // Stillness with jitter an order of magnitude under the sweep
    // floor: no sweep, no cycle, no rhythm.
    const samples: GazeSample[] = [];
    for (let step = 0; step < 120; step += 1) {
      samples.push(at(step * 33, step % 2 === 0 ? 0.001 : -0.001));
    }
    const verdict = detectReadingRhythm(samples);
    expect(verdict.reading).toBe(false);
    expect(verdict.cycles).toBe(0);
  });

  it("a random walk is not reading", () => {
    // Deterministic pseudo-random steps (a small LCG, seeded), so the
    // fixture never flakes: sweeps exist, but their durations carry
    // no line-then-return asymmetry and their slow phases no
    // consistent direction.
    const samples: GazeSample[] = [];
    let seed = 12345;
    let h = 0;
    for (let step = 0; step < 240; step += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      h += ((seed / 2147483648) * 2 - 1) * 0.03;
      samples.push(at(step * 33, h));
    }
    expect(detectReadingRhythm(samples).reading).toBe(false);
  });

  it("the pursuit sinusoid is rejected by the asymmetry rule", () => {
    // The one adversary that oscillates with reading's period and
    // amplitude. Its two half-cycles last the same, so the return is
    // never faster than the drift, and the asymmetry rule is the
    // ONLY thing standing between it and a false "reading".
    const samples: GazeSample[] = [];
    for (let step = 0; step < 300; step += 1) {
      samples.push(
        at(step * 33, 0.12 * Math.sin((2 * Math.PI * step * 33) / 2000)),
      );
    }
    const verdict = detectReadingRhythm(samples);
    expect(verdict.reading).toBe(false);
    expect(verdict.cycles).toBe(0);
  });

  it("a sub-floor sawtooth is jitter, not lines of text", () => {
    const verdict = detectReadingRhythm(sawtooth(4, 1800, 120, 0.015));
    expect(verdict.reading).toBe(false);
  });
});

describe("the asymmetry boundary, pinned from both sides", () => {
  function twoPhase(returnMs: number): GazeSample[] {
    // Three cycles of a 1000 ms drift and a return of the given
    // length, probing the rule as literals: at half the drift it
    // passes, one frame period past half it fails. A confirming
    // drift sample follows the last return, because a sweep counts
    // only once the turn back proves it ended.
    const samples: GazeSample[] = [];
    let t = 0;
    for (let cycle = 0; cycle < 3; cycle += 1) {
      if (cycle === 0) {
        samples.push(at(t, 0));
      }
      samples.push(at(t + 500, 0.06), at(t + 1000, 0.12));
      samples.push(at(t + 1000 + returnMs, 0));
      t += 1000 + returnMs;
    }
    samples.push(at(t + 400, 0.06));
    return samples;
  }

  it("a return at exactly half the drift still reads", () => {
    expect(detectReadingRhythm(twoPhase(500)).reading).toBe(true);
  });

  it("a return longer than half the drift does not", () => {
    expect(detectReadingRhythm(twoPhase(533)).reading).toBe(false);
  });
});

describe("honesty of the words and the record", () => {
  it("every sentence carries the demo cap, accepted or not", () => {
    const accepted = detectReadingRhythm(sawtooth(4));
    const rejected = detectReadingRhythm([at(0, 0), at(33, 0)]);
    expect(accepted.sentence).toContain(READING_RHYTHM_CAP);
    expect(rejected.sentence).toContain(READING_RHYTHM_CAP);
  });

  it("the cap says exactly how far the claim goes", () => {
    expect(READING_RHYTHM_CAP).toContain(
      "checked on the maintainer's sessions",
    );
    expect(READING_RHYTHM_CAP).toContain("validated against no outcome");
  });

  it("timestamps that do not move forward throw by name", () => {
    expect(() => detectReadingRhythm([at(100, 0), at(100, 0.1)])).toThrow(
      /forward/,
    );
  });

  it("the choices are the literals the tests probe", () => {
    // Moving a constant moves the boundary tests above with it; these
    // literals make that a deliberate two-place edit (roadmap 10.1c).
    expect(SWEEP_MIN_HORIZONTAL).toBe(0.04);
    expect(RETURN_MAX_FRACTION).toBe(0.5);
    expect(READING_MIN_CYCLES).toBe(3);
  });
});
