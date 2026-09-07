import { analyzeClosing, type ApertureSample } from "./blinkShape";

// How much of a blink's peak closing velocity the frame rate alone
// takes away. Roadmap 10.10c4b, ladder B12, audit F-033. The
// prediction was written before any of this existed and lives in
// docs/velocity-sampling-bias.txt.
//
// blinkShape.ts computes the peak as the largest drop between two
// ADJACENT samples divided by their interval: one forward finite
// difference. That does not measure the fastest instant of a descent,
// it measures the average speed over one sampling interval containing
// it. A blink's closing phase is 50 to 120 milliseconds and the
// interval at 25 frames per second is 40, so one interval covers a
// third to most of the whole descent — the bias is the same order as
// the quantity, not a correction term.
//
// This module is the same shape as samplingBounds.ts next door: a pure
// simulation whose numbers a test recomputes, so the bound published
// in prose cannot drift from the arithmetic that produced it. It feeds
// its samples to `analyzeClosing`, the function the page itself uses,
// rather than restating the finite difference, because a second
// implementation of the thing under test would measure itself.

/** Rates the table covers. 240 is the control, far above anything run here. */
export const VELOCITY_BIAS_FPS = [25, 30, 60, 240];

/** Closing durations, milliseconds: the span of an ordinary human blink. */
export const VELOCITY_BIAS_DURATIONS_MS = [50, 80, 120];

/**
 * Sampling phases evaluated per cell.
 *
 * Phase is not a detail averaged away by luck. A sampler that happens
 * to straddle the midpoint reads much closer to the truth than one
 * that brackets it, and a real recording has no say in which it gets,
 * so every cell reports the worst, the best and the median over
 * evenly spaced starts across one interval.
 */
export const VELOCITY_BIAS_PHASES = 40;

/** Aperture at a moment of a raised-cosine fall from open to shut. */
export function raisedCosineDescent(
  openMm: number,
  amplitudeMm: number,
  closingMs: number,
  atMs: number,
): number {
  if (atMs <= 0) {
    return openMm;
  }
  if (atMs >= closingMs) {
    return openMm - amplitudeMm;
  }
  return (
    openMm - (amplitudeMm * (1 - Math.cos((Math.PI * atMs) / closingMs))) / 2
  );
}

/**
 * The descent's own fastest instant, analytically.
 *
 * The derivative of the raised cosine at its midpoint, pi * amplitude
 * / (2T). Analytic rather than simulated so the truth this is measured
 * against does not itself depend on a sampling choice.
 */
export function truePeakVelocityMmPerS(
  amplitudeMm: number,
  closingMs: number,
): number {
  return (Math.PI * amplitudeMm) / (2 * (closingMs / 1000));
}

/** One cell of the table: a rate, a duration, and what sampling costs. */
export type VelocityBiasCell = {
  fps: number;
  closingMs: number;
  /** Underestimate as a fraction of the true peak, worst phase. */
  worst: number;
  /** The same, at the median phase. */
  median: number;
  /** The same, at the kindest phase. */
  best: number;
  /**
   * What the amplitude-over-velocity ratio is multiplied by at the
   * median phase. Above one: sampling makes the time constant read
   * longer, which is the direction drowsiness itself moves it.
   */
  ratioInflation: number;
};

const OPEN_MM = 7;
const AMPLITUDE_MM = 7;

/**
 * The descent sampled at one rate and one starting phase, measured by
 * the page's own arithmetic.
 *
 * The window runs a full interval either side of the descent so the
 * open and shut plateaus are both sampled: `analyzeClosing` needs a
 * maximum before its minimum, exactly as it does on a real blink.
 */
function sampledShape(
  fps: number,
  closingMs: number,
  phaseMs: number,
): { peakMmPerS: number; amplitudeMm: number } | null {
  const intervalMs = 1000 / fps;
  const samples: ApertureSample[] = [];
  for (
    let atMs = phaseMs - intervalMs;
    atMs <= closingMs + intervalMs;
    atMs += intervalMs
  ) {
    samples.push({
      timestampMs: atMs,
      apertureMm: raisedCosineDescent(OPEN_MM, AMPLITUDE_MM, closingMs, atMs),
    });
  }
  const shape = analyzeClosing(samples);
  if (shape === null) {
    return null;
  }
  return {
    peakMmPerS: shape.peakClosingVelocityMmPerS,
    amplitudeMm: shape.amplitudeMm,
  };
}

/** One cell, computed over every phase. */
export function velocityBiasCell(
  fps: number,
  closingMs: number,
): VelocityBiasCell {
  const truth = truePeakVelocityMmPerS(AMPLITUDE_MM, closingMs);
  const intervalMs = 1000 / fps;
  const losses: number[] = [];
  const inflations: number[] = [];
  for (let step = 0; step < VELOCITY_BIAS_PHASES; step += 1) {
    const phaseMs = (step / VELOCITY_BIAS_PHASES) * intervalMs;
    const shape = sampledShape(fps, closingMs, phaseMs);
    if (shape === null) {
      // A rate this slow cannot describe a descent this short at all,
      // which is a refusal rather than a bias. Recorded as total loss
      // so the cell cannot quietly average over the gap.
      losses.push(1);
      inflations.push(Number.POSITIVE_INFINITY);
      continue;
    }
    losses.push((truth - shape.peakMmPerS) / truth);
    const trueRatioMs = (AMPLITUDE_MM / truth) * 1000;
    const seenRatioMs = (shape.amplitudeMm / shape.peakMmPerS) * 1000;
    inflations.push(seenRatioMs / trueRatioMs);
  }
  const sorted = [...losses].sort((a, b) => a - b);
  const middle = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const sortedInflations = [...inflations].sort((a, b) => a - b);
  return {
    fps,
    closingMs,
    worst: Math.max(...losses),
    median: middle,
    best: Math.min(...losses),
    ratioInflation:
      sortedInflations[Math.floor(sortedInflations.length / 2)] ?? 1,
  };
}

/** Every cell, rates outer and durations inner. */
export function velocityBiasTable(): VelocityBiasCell[] {
  return VELOCITY_BIAS_FPS.flatMap((fps) =>
    VELOCITY_BIAS_DURATIONS_MS.map((closingMs) =>
      velocityBiasCell(fps, closingMs),
    ),
  );
}

/**
 * One number the documents can quote: the worst underestimate at any
 * phase and any ordinary blink duration, at the rates this project
 * actually runs.
 *
 * Taken from the table rather than typed beside it, so a document
 * carrying it carries what the simulation produced.
 */
export function worstPublishedRateBias(): number {
  return Math.max(
    ...velocityBiasTable()
      .filter((cell) => cell.fps === 25 || cell.fps === 30)
      .map((cell) => cell.worst),
  );
}
