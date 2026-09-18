// Roadmap 14.12. Reading-rhythm detector from the horizontal gaze
// sawtooth, DEMO-ONLY until 14.11's run carries its committed
// prediction.
//
// Reading a line of text drags the gaze slowly across the screen and
// snaps it back: a sawtooth in the horizontal offset, and the shape
// is the signature. The three adversaries the row names are rejected
// by three different properties. STARING never sweeps far enough to
// make a segment. A RANDOM WALK sweeps, but its slow phases point
// nowhere consistently and its returns carry no timing discipline.
// The PURSUIT SINUSOID is the dangerous one — it oscillates with
// reading's period and amplitude — and only the ASYMMETRY RULE tells
// them apart: a real return sweep is a saccade, an order of
// magnitude faster than the drift it undoes, while a sinusoid's two
// half-cycles last the same. That rule carries a mutation in
// tools/mutationCheck.mjs, because it is the one comparison whose
// silent loss would turn smooth pursuit into "reading".
//
// The detector reads only the horizontal channel on purpose: the
// vertical line-step of real reading is small against this
// instrument's vertical noise, and a rule nobody can check against
// the signal it actually has would be decoration. Direction is
// accepted in EITHER orientation, because scripts run both ways and
// the offset's sign convention (positive = the user's screen left)
// should not decide whose reading counts.
//
// Nothing is wired to the page or the export: the row is the
// detector and its properties, demo-only by its own words, and the
// sentence it returns carries the cap so no consumer can quote the
// number without the claim's limits.

import type { GazeSample } from "./fixation";

/**
 * The smallest horizontal movement that counts as a sweep, in offset
 * units. A CHOICE, not a derivation: twice the fixation detector's
 * whole dispersion box (0.02, both axes summed), so gaze parked on
 * one spot can never assemble a sweep out of its own jitter, while a
 * line of text — a swing several times larger on any calibrated
 * session — clears it easily.
 */
export const SWEEP_MIN_HORIZONTAL = 0.04;

/**
 * The asymmetry rule: the return may last at most this fraction of
 * the drift it undoes. A CHOICE stated as one: real return sweeps
 * are saccades, an order of magnitude faster than the drift, so half
 * is deliberately generous — and still fatal to a sinusoid, whose
 * half-cycles last the same by construction.
 */
export const RETURN_MAX_FRACTION = 0.5;

/**
 * How many consecutive line-shaped cycles make a rhythm. A CHOICE:
 * one drift-and-return is a glance and back, two could be a glance
 * each way; three in a row with the same orientation is a pattern
 * somebody is performing.
 */
export const READING_MIN_CYCLES = 3;

/** The claim's own limits, attached to every sentence this module
 * writes. Worded as a CAP, not an achievement: nothing has been
 * checked on anybody's sessions yet, and even once it has, the most
 * this demo may ever claim is that. Promotion past the cap belongs
 * to 14.11's committed prediction, not to a consumer with an
 * enthusiastic label. */
export const READING_RHYTHM_CAP =
  "demo-only, validated against no outcome; the most this can ever " +
  "claim is 'checked on the maintainer's sessions'";

export type ReadingRhythm = {
  reading: boolean;
  /** The longest run of consecutive line-shaped cycles found. */
  cycles: number;
  sentence: string;
};

type Sweep = {
  direction: 1 | -1;
  durationMs: number;
};

/**
 * The horizontal series reduced to alternating sweeps, each at least
 * SWEEP_MIN_HORIZONTAL tall — turning-point detection with
 * hysteresis, so jitter under the floor never opens or closes a
 * sweep. Timestamps must move forward: a backwards gap would make a
 * duration negative, which is a wrong number that looks ordinary
 * (the 12.9 precedent), so it throws by name instead.
 */
function sweeps(samples: readonly GazeSample[]): Sweep[] {
  const out: Sweep[] = [];
  let previousMs = -Infinity;
  for (const sample of samples) {
    if (sample.timestampMs <= previousMs) {
      throw new Error(
        "readingRhythm: timestamps must move strictly forward " +
          `(${String(sample.timestampMs)} after ${String(previousMs)})`,
      );
    }
    previousMs = sample.timestampMs;
  }
  const first = samples[0];
  if (first === undefined) {
    return out;
  }
  let direction: 1 | -1 | 0 = 0;
  let pivot = first;
  let extreme = first;
  for (const sample of samples) {
    const h = sample.offset.horizontal;
    if (direction === 0) {
      if (Math.abs(h - pivot.offset.horizontal) >= SWEEP_MIN_HORIZONTAL) {
        direction = h > pivot.offset.horizontal ? 1 : -1;
        extreme = sample;
      }
      continue;
    }
    if (
      direction === 1
        ? h > extreme.offset.horizontal
        : h < extreme.offset.horizontal
    ) {
      extreme = sample;
      continue;
    }
    if (Math.abs(extreme.offset.horizontal - h) >= SWEEP_MIN_HORIZONTAL) {
      out.push({
        direction,
        durationMs: extreme.timestampMs - pivot.timestampMs,
      });
      pivot = extreme;
      extreme = sample;
      direction = direction === 1 ? -1 : 1;
    }
  }
  // The sweep still open when the series ends is NOT emitted: its end
  // was never confirmed by a reversal, so its duration is truncated —
  // unknown-short, not measured-short — and a truncated tail once
  // handed the pursuit sinusoid a fake fast return in this module's
  // own first test run. A sweep exists when the turn back proves it.
  return out;
}

function longestRun(all: Sweep[], slowDirection: 1 | -1): number {
  let run = 0;
  let best = 0;
  for (let index = 0; index + 1 < all.length; index += 1) {
    const slow = all[index];
    const fast = all[index + 1];
    if (slow === undefined || fast === undefined) {
      break;
    }
    if (slow.direction !== slowDirection) {
      continue;
    }
    // Sweeps alternate by construction, so fast runs opposite; the
    // cycle is line-shaped when the return respects the asymmetry
    // rule. A failed cycle breaks the run — a rhythm with holes in
    // it is glances, not reading.
    if (
      fast.durationMs <= slow.durationMs * RETURN_MAX_FRACTION &&
      slow.durationMs > 0
    ) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

export function detectReadingRhythm(
  samples: readonly GazeSample[],
): ReadingRhythm {
  const all = sweeps(samples);
  const cycles = Math.max(longestRun(all, 1), longestRun(all, -1));
  const reading = cycles >= READING_MIN_CYCLES;
  const sentence = reading
    ? `Reading rhythm: ${String(cycles)} line-shaped cycles in a row — ` +
      "a slow drift one way and a return at most half as long back " +
      `(${READING_RHYTHM_CAP}).`
    : `Reading rhythm: no sawtooth — ${String(cycles)} line-shaped ` +
      `cycle(s) in a row against a floor of ` +
      `${String(READING_MIN_CYCLES)} (${READING_RHYTHM_CAP}).`;
  return { reading, cycles, sentence };
}
