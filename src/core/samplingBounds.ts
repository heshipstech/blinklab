import { percentile } from "./statistics";

// The PERCLOS sampling bound, roadmap 10.10a.
//
// PERCLOS is a fraction read off regularly spaced camera samples, and
// every closure's edges land somewhere between two reads. This module
// asks, by seeded deterministic sweep, how wrong the sampled fraction
// can be purely from that — the SAMPLING TERM only, nothing about the
// shut line's placement (amendment 6) or the landmark noise floor
// (docs/aperture-noise-floor.txt). The method, the generator shape and
// the prediction were committed to docs/sampling-bounds.txt before any
// cell was computed; the committed table is recomputed by test on
// every run, so it cannot drift from this code.
//
// Everything is deterministic on purpose: a hand-rolled linear
// congruential generator instead of Math.random, integer state, fixed
// iteration order — the table must reproduce bit for bit anywhere.

export const SAMPLING_WINDOW_S = 60;
export const SAMPLING_BOUND_FPS = [15, 25, 30, 60];
export const SAMPLING_BOUND_FRACTIONS = [0.05, 0.15, 0.3];
export const SAMPLING_BOUND_DRAWS = 2000;
export const SAMPLING_BOUND_SEED = 20260905;

const MIN_CLOSURES = 2;
const MAX_CLOSURES = 10;
const MIN_CLOSURE_S = 0.5;
const MAX_CLOSURE_S = 6;

/**
 * A seeded uniform generator on [0, 1): the Numerical Recipes linear
 * congruential parameters over 32-bit state. Not cryptographic and not
 * meant to be — meant to give the same sweep on every machine forever.
 */
export function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export type Closure = { startS: number; endS: number };

/**
 * N non-overlapping closures whose total duration hits the target
 * fraction EXACTLY, so every draw's true PERCLOS is known by
 * construction. Durations are drawn uniformly in [0.5, 6) seconds and
 * then scaled as a set to the target total (the committed generator
 * shape); the open time is split into N+1 random gaps, so placement is
 * uniform without overlap by construction.
 */
export function generateClosures(
  random: () => number,
  windowS: number,
  targetFraction: number,
): Closure[] {
  const count =
    MIN_CLOSURES + Math.floor(random() * (MAX_CLOSURES - MIN_CLOSURES + 1));
  const rawDurations: number[] = [];
  let rawTotal = 0;
  for (let i = 0; i < count; i += 1) {
    const duration = MIN_CLOSURE_S + random() * (MAX_CLOSURE_S - MIN_CLOSURE_S);
    rawDurations.push(duration);
    rawTotal += duration;
  }
  const scale = (targetFraction * windowS) / rawTotal;
  const durations = rawDurations.map((duration) => duration * scale);

  const openTotal = windowS - targetFraction * windowS;
  const gapWeights: number[] = [];
  let weightTotal = 0;
  for (let i = 0; i < count + 1; i += 1) {
    const weight = random();
    gapWeights.push(weight);
    weightTotal += weight;
  }

  const closures: Closure[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    cursor += (openTotal * (gapWeights[i] ?? 0)) / weightTotal;
    const duration = durations[i] ?? 0;
    closures.push({ startS: cursor, endS: cursor + duration });
    cursor += duration;
  }
  return closures;
}

/** The exact closed fraction of a closure set — the sweep's ground truth. */
export function trueClosedFraction(
  closures: readonly Closure[],
  windowS: number,
): number {
  let closed = 0;
  for (const closure of closures) {
    closed += closure.endS - closure.startS;
  }
  return closed / windowS;
}

/**
 * The fraction a camera at `fps` starting at `phaseS` would report:
 * the share of its regular samples that land inside a closure. A
 * sample at time t is closed when startS <= t < endS, matching how a
 * frame either shows a shut eye or does not.
 */
export function sampledClosedFraction(
  closures: readonly Closure[],
  windowS: number,
  fps: number,
  phaseS: number,
): number {
  const period = 1 / fps;
  let samples = 0;
  let closed = 0;
  for (let t = phaseS; t < windowS; t += period) {
    samples += 1;
    for (const closure of closures) {
      if (t >= closure.startS && t < closure.endS) {
        closed += 1;
        break;
      }
    }
  }
  return samples === 0 ? 0 : closed / samples;
}

/**
 * The committed table's worst cell (15 fps), pinned by test against
 * docs/sampling-bounds.txt so the sentence below and the table cannot
 * move apart.
 */
export const WORST_PERCLOS_SAMPLING_BOUND = 0.0022;

/**
 * The on-page conditions line for PERCLOS, roadmap 10.10b. The sweep
 * found the sampling term negligible, and saying only that would read
 * as "this number is exact" — so the sentence names what actually
 * conditions the number, each with its committed document.
 */
export function perclosConditionsSentence(): string {
  return (
    "Conditions: the sampling term is at most ±0.002 of the share even " +
    "at 15 frames per second (docs/sampling-bounds.txt). What bounds " +
    "this number is the instrument-adjusted shut line and the landmark " +
    "noise floor (docs/aperture-noise-floor.txt), not the frame rate."
  );
}

/**
 * The on-page conditions line for blink counts, the other half of
 * 10.10b. Rate's sampling story is the opposite of PERCLOS's and was
 * committed first: quick shallow blinks are lost outright between
 * frames at ordinary webcam rates, so the count is a floor.
 */
export function blinkCountConditionsSentence(): string {
  return (
    "Conditions: the count is a floor, not a count — at 25 to 30 " +
    "frames per second a quick shallow blink can fall between frames " +
    "and be lost outright (docs/blink-sample-rate.txt)."
  );
}

export type SamplingBoundCell = {
  fps: number;
  fraction: number;
  p95Error: number;
};

/**
 * The committed sweep: for each (fps, fraction) cell, 2000 seeded
 * draws of a closure set and a phase, and the 95th percentile of the
 * absolute error between the sampled fraction and the exact one. Cell
 * seeds are derived, not shared, so a cell's numbers do not move when
 * another cell's draw count does.
 */
export function samplingBoundsTable(): SamplingBoundCell[] {
  const table: SamplingBoundCell[] = [];
  for (const fps of SAMPLING_BOUND_FPS) {
    for (const fraction of SAMPLING_BOUND_FRACTIONS) {
      const random = lcg(
        SAMPLING_BOUND_SEED + fps * 1000 + Math.round(fraction * 100),
      );
      const errors: number[] = [];
      for (let draw = 0; draw < SAMPLING_BOUND_DRAWS; draw += 1) {
        const closures = generateClosures(random, SAMPLING_WINDOW_S, fraction);
        const phaseS = random() / fps;
        const sampled = sampledClosedFraction(
          closures,
          SAMPLING_WINDOW_S,
          fps,
          phaseS,
        );
        errors.push(Math.abs(sampled - fraction));
      }
      const p95 = percentile(errors, 95);
      table.push({ fps, fraction, p95Error: p95 ?? Number.NaN });
    }
  }
  return table;
}
